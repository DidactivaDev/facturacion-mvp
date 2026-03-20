import { NextRequest } from "next/server";
import { parseJsonBodyWithOptionalGzip } from "@/lib/parse-json-request";
import alasqlImport from "alasql";
import { getOpenAIClient } from "@/lib/openai";
import { type ParsedData } from "@/lib/csv-parser";
import type { QualityReport } from "@/lib/data-quality";
import type { ColumnMapping } from "@/lib/column-mapper";
import {
  buildSafeNormalizationProposal,
  shouldBuildSafeNormalizationProposal,
} from "@/lib/normalization-proposal";

const alasql = alasqlImport as unknown as {
  (sql: string, params?: unknown[]): unknown;
  tables: Record<string, { data: Record<string, unknown>[] }>;
};
import type OpenAI from "openai";

// ─── SQL Tool Definition ─────────────────────────────────

const SQL_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "execute_sql",
    description:
      "Ejecuta una consulta SQL SELECT sobre la tabla 'datos' que contiene el dataset del usuario. " +
      "Usa esto para cálculos precisos: sumas, conteos, agrupaciones, filtrados, detección de duplicados, etc. " +
      "La tabla se llama 'datos' y las columnas tienen los nombres exactos del dataset. " +
      "Solo se permiten consultas SELECT.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "La consulta SQL SELECT a ejecutar. Ejemplo: SELECT nombre_ur, COUNT(*) as total FROM datos GROUP BY nombre_ur",
        },
      },
      required: ["query"],
    },
  },
};

const QUALITY_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "analyze_quality",
    description:
      "Ejecuta un análisis de calidad de datos: detecta nulos por columna, duplicados, " +
      "valores únicos, estadísticas básicas. Usa esto cuando el usuario pregunte por " +
      "calidad de datos, errores, inconsistencias, campos vacíos, duplicados, etc.",
    parameters: {
      type: "object",
      properties: {
        checks: {
          type: "array",
          items: {
            type: "string",
            enum: ["nulls", "duplicates", "stats", "outliers"],
          },
          description:
            "Qué verificaciones ejecutar: 'nulls' (campos vacíos), 'duplicates' (registros duplicados), " +
            "'stats' (estadísticas por columna), 'outliers' (valores atípicos en columnas numéricas).",
        },
        duplicate_keys: {
          type: "array",
          items: { type: "string" },
          description:
            "Columnas a usar como llave para detectar duplicados. Si no se especifica, se usan todas las columnas.",
        },
      },
      required: ["checks"],
    },
  },
};

// Track current headers for column name auto-correction
let currentHeaders: string[] = [];

// ─── SQL Execution in Server ─────────────────────────────

/** Convert a column name to a safe SQL identifier */
function sanitizeColumnName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[()]/g, "")           // remove parentheses
    .replace(/[^a-zA-Z0-9]+/g, "_") // non-alphanumeric → underscore
    .replace(/^_+|_+$/g, "")        // trim underscores
    .toLowerCase()
    .substring(0, 60);               // keep reasonable length
}

/** Mapping from sanitized column name → original column name */
let columnNameMap: Record<string, string> = {};

function loadDataForSQL(data: ParsedData): void {
  currentHeaders = data.headers;

  // Build sanitized name mapping
  const sanitized: Record<string, string> = {};
  const usedNames = new Set<string>();
  for (const h of data.headers) {
    let sName = sanitizeColumnName(h);
    // Handle duplicates by appending a number
    if (usedNames.has(sName)) {
      let i = 2;
      while (usedNames.has(`${sName}_${i}`)) i++;
      sName = `${sName}_${i}`;
    }
    usedNames.add(sName);
    sanitized[h] = sName;
  }
  columnNameMap = sanitized;

  try {
    alasql("DROP TABLE IF EXISTS datos");
  } catch {
    // ignore
  }
  alasql("CREATE TABLE datos");

  if (data.rows.length > 0) {
    alasql.tables["datos"].data = data.rows.map((row) => {
      const clean: Record<string, string | number | boolean> = {};
      for (const key of data.headers) {
        const sKey = sanitized[key];
        const rawVal = row[key];

        // Handle various types that might come through
        if (rawVal === undefined || rawVal === null) {
          clean[sKey] = "";
          continue;
        }

        // Convert to string first to normalize
        const val = String(rawVal).trim();

        // Try to parse as plain number first
        const num = parseFloat(val);
        if (val !== "" && !isNaN(num) && isFinite(num)) {
          clean[sKey] = num;
        } else if (val.includes("$") || val.match(/^[\d,$.\-\s]+$/)) {
          // Try to parse as monetary value: strip $, spaces, commas
          const stripped = val.replace(/[$\s,]/g, "");
          if (!stripped || stripped === "-" || stripped === "--") {
            clean[sKey] = 0; // "$ -", "$-", "$0" → 0
          } else {
            const moneyNum = parseFloat(stripped);
            clean[sKey] = !isNaN(moneyNum) && isFinite(moneyNum) ? moneyNum : val;
          }
        } else {
          clean[sKey] = val;
        }
      }
      return clean;
    });
  }
}

/**
 * Simple similarity score between two strings (0-1).
 * Uses normalized case-insensitive comparison and longest common substring ratio.
 */
function stringSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;

  // Character overlap ratio
  let matches = 0;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length > nb.length ? na : nb;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) matches++;
  }
  const positionalScore = matches / longer.length;

  // Check if one contains the other
  if (longer.includes(shorter) || shorter.includes(longer)) {
    return 0.85 + positionalScore * 0.15;
  }

  return positionalScore;
}

/**
 * Auto-correct column names in SQL queries by matching [bracketed names]
 * against actual table headers. Fixes GPT-4o mini typos.
 */
function autoFixColumnNames(query: string): string {
  if (currentHeaders.length === 0) return query;

  // Find all [column_name] references
  return query.replace(/\[([^\]]+)\]/g, (_match, colName: string) => {
    // Check exact match first
    if (currentHeaders.includes(colName)) return `[${colName}]`;

    // Case-insensitive exact match
    const exactCI = currentHeaders.find(
      (h) => h.toLowerCase() === colName.toLowerCase()
    );
    if (exactCI) return `[${exactCI}]`;

    // Fuzzy match — find best match above threshold
    let bestMatch = "";
    let bestScore = 0;
    for (const header of currentHeaders) {
      const score = stringSimilarity(colName, header);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = header;
      }
    }

    if (bestScore >= 0.75 && bestMatch) {
      console.log(`[SQL AutoFix] "${colName}" → "${bestMatch}" (score: ${bestScore.toFixed(2)})`);
      return `[${bestMatch}]`;
    }

    return `[${colName}]`;
  });
}

function runSQL(query: string): string {
  const trimmed = query.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT")) {
    return "Error: Solo se permiten consultas SELECT.";
  }

  try {
    const fixedQuery = autoFixColumnNames(query);
    console.log(`[SQL] Query: ${fixedQuery}${fixedQuery !== query ? " (auto-fixed)" : ""}`);
    const results = alasql(fixedQuery) as Record<string, unknown>[];
    console.log(`[SQL] Results: ${results?.length ?? 0} rows`);
    if (results?.length > 0) {
      console.log(`[SQL] First row sample:`, JSON.stringify(results[0]).substring(0, 300));
    }
    if (!results || results.length === 0) {
      return "La consulta no retornó resultados.";
    }

    const limited = results.slice(0, 200);
    const cols = Object.keys(limited[0]);
    const header = cols.join(" | ");
    const sep = cols.map(() => "---").join(" | ");
    const rows = limited.map((r) =>
      cols
        .map((c) => {
          const v = r[c];
          if (v === null || v === undefined) return "";
          if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
          return String(v);
        })
        .join(" | ")
    );

    let out = `${header}\n${sep}\n${rows.join("\n")}`;
    if (results.length > 200) {
      out += `\n\n(Mostrando 200 de ${results.length} resultados)`;
    } else {
      out += `\n\n(${results.length} resultado(s))`;
    }
    return out;
  } catch (err) {
    return `Error SQL: ${err instanceof Error ? err.message : "desconocido"}`;
  }
}

function runQualityAnalysis(
  data: ParsedData,
  checks: string[],
  duplicateKeys?: string[]
): string {
  const parts: string[] = [];

  if (checks.includes("nulls")) {
    parts.push("## Campos vacíos por columna\n");
    const lines: string[] = ["Columna | Vacíos | % Vacíos", "--- | --- | ---"];
    for (const h of data.headers) {
      const nulls = data.rows.filter(
        (r) => r[h] === undefined || r[h] === null || r[h].toString().trim() === ""
      ).length;
      if (nulls > 0) {
        lines.push(`${h} | ${nulls} | ${((nulls / data.totalRows) * 100).toFixed(1)}%`);
      }
    }
    parts.push(lines.length > 2 ? lines.join("\n") : "No se encontraron campos vacíos.");
  }

  if (checks.includes("duplicates")) {
    const keys = duplicateKeys && duplicateKeys.length > 0 ? duplicateKeys : data.headers;
    const validKeys = keys.filter((k) => data.headers.includes(k));
    parts.push(`\n## Duplicados (llaves: ${validKeys.join(", ")})\n`);

    const seen = new Map<string, number>();
    for (const row of data.rows) {
      const key = validKeys.map((k) => (row[k] || "").toString().trim().toLowerCase()).join("|");
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    const dups = Array.from(seen.entries()).filter(([, c]) => c > 1);
    if (dups.length > 0) {
      const totalDupRows = dups.reduce((s, [, c]) => s + c, 0);
      parts.push(`Se encontraron **${dups.length} grupos** de duplicados (${totalDupRows} filas afectadas).`);
      parts.push("\nPrimeros 10 grupos duplicados:");
      parts.push(`${validKeys.join(" | ")} | Repeticiones`);
      parts.push(`${validKeys.map(() => "---").join(" | ")} | ---`);
      for (const [key, count] of dups.slice(0, 10)) {
        parts.push(`${key.split("|").join(" | ")} | ${count}`);
      }
    } else {
      parts.push("No se encontraron duplicados.");
    }
  }

  if (checks.includes("stats")) {
    parts.push("\n## Estadísticas por columna\n");
    parts.push("Columna | Tipo | Únicos | Min | Max | Ejemplo frecuente");
    parts.push("--- | --- | --- | --- | --- | ---");
    for (const h of data.headers) {
      const vals = data.rows.map((r) => r[h]).filter((v) => v !== undefined && v !== null && v.toString().trim() !== "");
      const unique = new Set(vals.map((v) => v.toString().trim())).size;
      const nums = vals.map((v) => parseFloat(v)).filter((n) => !isNaN(n));
      const isNum = nums.length > vals.length * 0.7;

      // top value
      const counts: Record<string, number> = {};
      for (const v of vals) { counts[v.toString().trim()] = (counts[v.toString().trim()] || 0) + 1; }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

      if (isNum && nums.length > 0) {
        parts.push(
          `${h} | numérico | ${unique} | ${Math.min(...nums)} | ${Math.max(...nums)} | ${top ? `${top[0]} (${top[1]}x)` : "-"}`
        );
      } else {
        parts.push(`${h} | texto | ${unique} | - | - | ${top ? `${top[0]} (${top[1]}x)` : "-"}`);
      }
    }
  }

  if (checks.includes("outliers")) {
    parts.push("\n## Valores atípicos en columnas numéricas\n");
    let foundAny = false;
    for (const h of data.headers) {
      const nums = data.rows
        .map((r) => parseFloat(r[h]))
        .filter((n) => !isNaN(n));
      if (nums.length < 10) continue;

      const sorted = [...nums].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      if (iqr === 0) continue;

      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;
      const outliers = nums.filter((n) => n < lower || n > upper);
      if (outliers.length > 0) {
        foundAny = true;
        parts.push(
          `- **${h}**: ${outliers.length} outlier(s). Rango normal: ${lower.toFixed(2)} a ${upper.toFixed(2)}. Valores: ${outliers.slice(0, 5).map((o) => o.toFixed(2)).join(", ")}${outliers.length > 5 ? "..." : ""}`
        );
      }
    }
    if (!foundAny) parts.push("No se detectaron outliers significativos.");
  }

  return parts.join("\n");
}

// ─── System Prompt ──────────────────────────────────────

function buildQualityContext(report?: QualityReport): string {
  if (!report) {
    return "No hay un reporte de calidad precalculado para este dataset.";
  }

  const alertLines =
    report.alerts.length > 0
      ? report.alerts
          .map((alert, index) => {
            const affectedRows =
              alert.affectedRows !== undefined
                ? ` · filas afectadas: ${alert.affectedRows}`
                : "";
            return `${index + 1}. [${alert.severity.toUpperCase()}] ${alert.title} — ${alert.description}${affectedRows}. Recomendación: ${alert.recommendation}`;
          })
          .join("\n")
      : "No se detectaron alertas de calidad.";

  return `REPORTE DE CALIDAD ACTUAL:
- Fuente: ${report.source}
- Filas analizadas: ${report.totalRows}
- Columnas: ${report.totalColumns}
- Alertas altas: ${report.summary.highAlerts}
- Alertas medias: ${report.summary.mediumAlerts}
- Alertas bajas: ${report.summary.lowAlerts}
- Total de alertas: ${report.summary.totalAlerts}

DETALLE DE ALERTAS:
${alertLines}`;
}

// ─── Column hints for AI ────────────────────────────────

function normHeader(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findHeaderByPatterns(
  headers: string[],
  patterns: string[]
): string | null {
  const normed = patterns.map(normHeader);
  for (const h of headers) {
    const nh = normHeader(h);
    for (const p of normed) {
      if (nh === p) return h;
    }
  }
  for (const h of headers) {
    const nh = normHeader(h);
    for (const p of normed) {
      if (p.length >= 4 && nh.includes(p)) return h;
    }
  }
  return null;
}

function buildColumnHints(headers: string[]): string {
  const hints: string[] = [];

  const montoCol = findHeaderByPatterns(headers, [
    "monto o importe especifico", "importe especifico", "monto factura",
    "monto pendiente", "importe", "monto", "total",
  ]);
  const provCol = findHeaderByPatterns(headers, [
    "proveedor", "nombre proveedor", "razon social",
    "indique el proveedor", "si cuenta con factura indique el proveedor",
  ]);
  const pagadoCol = findHeaderByPatterns(headers, [
    "esta_pagado", "pagado", "estatus pago",
    "importe pagado", "importe pagado del contrato", "monto pagado",
  ]);

  // Use sanitized names for SQL hints
  const sMontoCol = montoCol ? columnNameMap[montoCol] : null;
  const sProvCol = provCol ? columnNameMap[provCol] : null;
  const sPagadoCol = pagadoCol ? columnNameMap[pagadoCol] : null;

  if (sMontoCol) hints.push(`- Columna de MONTO PRINCIPAL: ${sMontoCol}. Valores numéricos. Puedes sumar directamente con SUM(${sMontoCol}).`);
  if (sProvCol) hints.push(`- Columna de PROVEEDOR: ${sProvCol}. Para contar proveedores usa COUNT(DISTINCT ${sProvCol}) excluyendo vacíos y "-".`);
  if (sPagadoCol) hints.push(`- Columna de PAGO: ${sPagadoCol}. Valores numéricos. Un registro SIN PAGO tiene valor = 0. Usa: WHERE ${sPagadoCol} = 0`);

  if (hints.length === 0) return "";

  return `INTERPRETACIÓN DE COLUMNAS CLAVE:\n${hints.join("\n")}`;
}

function buildSystemPrompt(
  data: ParsedData,
  options?: {
    source?: string;
    qualityReport?: QualityReport;
    autoPrompt?: boolean;
  }
): string {
  // Use cleaned alasql data for samples so the AI sees actual stored values (numeric, not "$1,234")
  const sqlData = alasql.tables["datos"]?.data as Record<string, unknown>[] | undefined;
  const sampleRows = sqlData?.slice(0, 20) ?? [];

  const schema = data.headers
    .map((h) => {
      const sName = columnNameMap[h] || h;
      const nums = sampleRows.filter(
        (r) => r[sName] !== "" && typeof r[sName] === "number"
      ).length;
      const type = nums > sampleRows.length * 0.7 ? "NUMBER" : "TEXT";
      const examples = [...new Set(
        (sqlData?.slice(0, 5) ?? []).map((r) => String(r[sName] ?? "")).filter(Boolean)
      )].slice(0, 3);
      return `  - ${sName} (${type}) ej: ${examples.join(", ")}`;
    })
    .join("\n");

  const qualityContext = buildQualityContext(options?.qualityReport);
  const sourceLine = options?.source ? `Fuente actual: ${options.source}` : "";
  const columnHints = buildColumnHints(data.headers);
  const autoPromptSection = options?.autoPrompt
    ? `
MODO DE ARRANQUE AUTOMÁTICO:
- Esta es la primera respuesta después de cargar un archivo con alertas.
- La interfaz mostrará las alertas en tarjetas visuales, así que NO enumeres todas una por una.
- Resume en lenguaje simple qué está pasando con el archivo.
- Di qué conviene corregir primero en 2 a 4 puntos cortos.
- Explica qué tipos de corrección puedes aplicar en este dataset.
- NO generes bloques data-edit todavía.
- Termina con una pregunta clara sobre si el usuario desea que normalices o corrijas los datos.`
    : "";

  return `Eres un asistente experto en análisis de datos tabulares, especialmente datos de facturación y presupuesto gubernamental en México.

DATOS DISPONIBLES:
Tabla: datos (${data.totalRows} filas, ${data.headers.length} columnas)
${sourceLine}
${schema}

${columnHints}

${qualityContext}

HERRAMIENTAS:
Tienes acceso a dos herramientas:
1. **execute_sql**: Ejecuta consultas SQL SELECT sobre la tabla "datos". SIEMPRE usa esta herramienta para cálculos, conteos, sumas, filtrados, agrupaciones. No calcules de memoria.
2. **analyze_quality**: Ejecuta análisis de calidad de datos (nulos, duplicados, stats, outliers).

SINTAXIS SQL:
- Los nombres de columna en la tabla ya están normalizados a formato snake_case sin espacios ni caracteres especiales.
- Usa los nombres de columna directamente SIN corchetes ni comillas: SELECT monto_o_importe_especifico FROM datos
- Para strings literales usa comillas simples: WHERE columna = 'valor'

REGLA CRÍTICA DE HERRAMIENTAS:
- NUNCA respondas una pregunta sobre cantidades, conteos, sumas, montos, totales, cuántos, cuáles o cualquier dato numérico SIN ANTES llamar a execute_sql. Si no llamas execute_sql, TU RESPUESTA SERÁ INCORRECTA.
- SIEMPRE ejecuta una consulta SQL antes de dar cualquier número o conteo. Sin excepción.
- NO adivines ni calcules de memoria. Los datos están en la tabla "datos" y SOLO puedes consultarlos con execute_sql.

REGLAS GENERALES:
- Responde siempre en español
- Usa un tono claro, tranquilo y útil para personas no técnicas.
- Evita jerga técnica innecesaria. Si usas un término técnico, explícalo en la misma frase.
- Empieza con una conclusión corta para que la persona entienda rápido qué pasa.
- Cuando corresponda, cierra con el siguiente paso recomendado o una pregunta clara.
- Puedes ejecutar múltiples queries si es necesario (una a la vez).
- Cuando muestres datos, prefiere tablas markdown para conteos, comparaciones, topes y ejemplos.
- Usa formato de moneda mexicana ($ con comas) para montos
- Si detectas errores o inconsistencias, menciónalos
- Sé preciso, pero no abrumes con texto largo
- Prefiere párrafos cortos y listas breves
- No repitas información que ya esté claramente resumida en la interfaz

EDICIÓN DE DATOS:
- Cuando el usuario pida corregir, limpiar, normalizar, convertir, estandarizar o aplicar cambios, responde con una explicación breve y después genera uno o más bloques \`\`\`data-edit\`\`\` con JSON válido.
- Solo están permitidas estas operaciones: update_cells, delete_rows, fill_empty, replace_values, normalize_column, delete_duplicates.
- NO uses add_column ni inventes operaciones nuevas.
- Usa nombres de columna EXACTOS del dataset.
- Los números de fila son 1-based.
- Si la petición es ambigua o riesgosa, primero pide confirmación en lenguaje natural y no generes data-edit.
- Sé conservador con eliminaciones de filas: solo propón delete_rows o delete_duplicates cuando haya un criterio claro.

FORMATOS data-edit SOPORTADOS:
\`\`\`data-edit
{
  "type": "update_cells",
  "description": "Corregir proveedor en filas específicas",
  "updates": [
    { "row": 5, "column": "proveedor", "value": "Proveedor corregido" }
  ]
}
\`\`\`

\`\`\`data-edit
{
  "type": "delete_rows",
  "description": "Eliminar filas inválidas",
  "rowIndices": [8, 14]
}
\`\`\`

\`\`\`data-edit
{
  "type": "fill_empty",
  "description": "Llenar vacíos con un valor controlado",
  "columns": ["estatus_workflow"],
  "fillValue": "Pendiente de validación"
}
\`\`\`

\`\`\`data-edit
{
  "type": "replace_values",
  "description": "Estandarizar catálogo de valores",
  "columns": ["prioridad"],
  "replaceMap": { "alta": "Alta", "ALTA": "Alta" }
}
\`\`\`

\`\`\`data-edit
{
  "type": "normalize_column",
  "description": "Normalizar nombres",
  "columns": ["nombre_ur"],
  "normalizeType": "uppercase"
}
\`\`\`

\`\`\`data-edit
{
  "type": "delete_duplicates",
  "description": "Eliminar duplicados confirmados",
  "duplicateKeys": ["id_ur", "id_partida_especifica"]
}
\`\`\`

GRÁFICAS:
Cuando el usuario pida una gráfica o cuando ayude a entender mejor los datos, genera un bloque:

\`\`\`chart
{
  "type": "bar",
  "title": "Título",
  "data": [
    { "name": "Etiqueta1", "value": 1234 },
    { "name": "Etiqueta2", "value": 5678 }
  ]
}
\`\`\`

Tipos: "bar", "pie", "line". Para múltiples series usa "keys": ["serie1", "serie2"].
Los valores deben ser NUMÉRICOS. Usa nombres cortos. Máximo 15-20 items.
${autoPromptSection}`;
}

function createPlainTextResponse(content: string): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(content));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

// ─── API Route ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const {
      question,
      data,
      history,
      source,
      mappings,
      qualityReport,
      autoPrompt,
    } = (await parseJsonBodyWithOptionalGzip(request)) as {
      question?: string;
      data: ParsedData;
      history?: { role: "user" | "assistant"; content: string }[];
      source?: string;
      mappings?: ColumnMapping[];
      qualityReport?: QualityReport;
      autoPrompt?: boolean;
    };

    const effectiveQuestion =
      (question || "").trim() ||
      (autoPrompt
        ? "Resume las alertas del archivo, explica qué correcciones puedes aplicar y pregunta si deseas que normalice los datos."
        : "");

    if (!effectiveQuestion || !data) {
      return new Response(
        JSON.stringify({ error: "Se requiere una pregunta y datos" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (
      shouldBuildSafeNormalizationProposal({
        question: effectiveQuestion,
        history,
      })
    ) {
      const proposal = buildSafeNormalizationProposal({
        data,
        qualityReport,
        mappings,
      });

      return createPlainTextResponse(proposal.message);
    }

    // Cargar datos en SQL
    loadDataForSQL(data);
    console.log(`[Chat API] Datos cargados: ${data.totalRows} filas, ${data.headers.length} columnas`);
    console.log(`[Chat API] Headers: ${data.headers.join(", ")}`);
    // Log sample values of boolean columns for debugging
    if (data.rows.length > 0) {
      const sample = data.rows[0];
      console.log(`[Chat API] Sample row esta_facturado="${sample["esta_facturado"]}" (type: ${typeof sample["esta_facturado"]}), esta_pagado="${sample["esta_pagado"]}" (type: ${typeof sample["esta_pagado"]})`);
    }

    const systemPrompt = buildSystemPrompt(data, {
      source,
      qualityReport,
      autoPrompt,
    });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history (last 10 messages)
    if (history && history.length > 0) {
      const recentHistory = history.slice(-10);
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: effectiveQuestion });

    const openai = getOpenAIClient();

    // ─── Tool calling loop ───────────────────────────

    const MAX_TOOL_ROUNDS = 5;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools: [SQL_TOOL, QUALITY_TOOL],
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 3000,
      });

      const choice = response.choices[0];
      const message = choice.message;

      // If there are tool calls, execute them and continue the loop
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`[Chat API] Round ${round}: GPT requested ${message.tool_calls.length} tool call(s)`);
        messages.push(message);

        for (const toolCall of message.tool_calls) {
          let result: string;

          // Only handle function tool calls (not custom tool calls)
          if (!("function" in toolCall)) {
            result = "Tipo de herramienta no soportado.";
            messages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
            continue;
          }

          const fnCall = toolCall as { id: string; function: { name: string; arguments: string } };

          try {
            const args = JSON.parse(fnCall.function.arguments);

            if (fnCall.function.name === "execute_sql") {
              console.log(`[Chat API] Executing SQL: ${args.query}`);
              result = runSQL(args.query);
              console.log(`[Chat API] SQL result (first 200 chars): ${result.substring(0, 200)}`);
            } else if (fnCall.function.name === "analyze_quality") {
              result = runQualityAnalysis(
                data,
                args.checks || ["nulls", "stats"],
                args.duplicate_keys
              );
            } else {
              result = "Herramienta no reconocida.";
            }
          } catch (err) {
            result = `Error ejecutando herramienta: ${err instanceof Error ? err.message : "desconocido"}`;
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        // Continue loop — GPT will see the tool results and decide what to do next
        continue;
      }

      // No tool calls — this is the final response.
      if (choice.finish_reason === "stop" || !message.tool_calls) {
        console.log(`[Chat API] Round ${round}: Final response (no tool calls). finish_reason=${choice.finish_reason}. Content preview: ${(message.content || "").substring(0, 200)}`);
        console.log(`[Chat API] Total messages in context: ${messages.length}. Tool calls made: ${round > 0 ? 'yes' : 'no'}`);
        const fullContent = message.content || "";

        // Stream the already-obtained response directly
        return createPlainTextResponse(fullContent);
      }
    }

    // If we exhausted the tool loop, do one last streaming call
    const finalStream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      stream: true,
      temperature: 0.3,
      max_tokens: 3000,
    });

    // Stream the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of finalStream!) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Chat API error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

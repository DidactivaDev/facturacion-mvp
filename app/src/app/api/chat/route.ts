import { NextRequest } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { type ParsedData } from "@/lib/csv-parser";
const alasql = require("alasql") as {
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

// ─── SQL Execution in Server ─────────────────────────────

function loadDataForSQL(data: ParsedData): void {
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
        const rawVal = row[key];

        // Handle various types that might come through
        if (rawVal === undefined || rawVal === null) {
          clean[key] = "";
          continue;
        }

        // Convert to string first to normalize
        const val = String(rawVal).trim();

        // Try to parse as number
        const num = parseFloat(val);
        if (val !== "" && !isNaN(num) && isFinite(num)) {
          clean[key] = num;
        } else {
          clean[key] = val;
        }
      }
      return clean;
    });
  }
}

function runSQL(query: string): string {
  const trimmed = query.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT")) {
    return "Error: Solo se permiten consultas SELECT.";
  }

  try {
    const results = alasql(query) as Record<string, unknown>[];
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

function buildSystemPrompt(data: ParsedData): string {
  const schema = data.headers
    .map((h) => {
      const sample = data.rows.slice(0, 20);
      const nums = sample.filter(
        (r) => r[h] !== "" && !isNaN(parseFloat(r[h]))
      ).length;
      const type = nums > sample.length * 0.7 ? "NUMBER" : "TEXT";
      const examples = [...new Set(data.rows.slice(0, 5).map((r) => r[h]).filter(Boolean))].slice(0, 3);
      return `  - ${h} (${type}) ej: ${examples.join(", ")}`;
    })
    .join("\n");

  return `Eres un asistente experto en análisis de datos tabulares, especialmente datos de facturación y presupuesto gubernamental en México.

DATOS DISPONIBLES:
Tabla: datos (${data.totalRows} filas, ${data.headers.length} columnas)
${schema}

HERRAMIENTAS:
Tienes acceso a dos herramientas:
1. **execute_sql**: Ejecuta consultas SQL SELECT sobre la tabla "datos". SIEMPRE usa esta herramienta para cálculos, conteos, sumas, filtrados, agrupaciones. No calcules de memoria.
2. **analyze_quality**: Ejecuta análisis de calidad de datos (nulos, duplicados, stats, outliers).

REGLAS IMPORTANTES:
- Responde siempre en español
- SIEMPRE usa execute_sql para cualquier pregunta que requiera cálculos o filtrados. No inventes números.
- Puedes ejecutar múltiples queries si es necesario (una a la vez).
- Cuando muestres datos, usa tablas markdown
- Usa formato de moneda mexicana ($ con comas) para montos
- Si detectas errores o inconsistencias, menciónalos
- Sé preciso y muestra el razonamiento

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
Los valores deben ser NUMÉRICOS. Usa nombres cortos. Máximo 15-20 items.`;
}

// ─── API Route ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { question, data, history } = (await request.json()) as {
      question: string;
      data: ParsedData;
      history?: { role: "user" | "assistant"; content: string }[];
    };

    if (!question || !data) {
      return new Response(
        JSON.stringify({ error: "Se requiere una pregunta y datos" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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

    const systemPrompt = buildSystemPrompt(data);

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

    messages.push({ role: "user", content: question });

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
        console.log(`[Chat API] Round ${round}: Final response (no tool calls). finish_reason=${choice.finish_reason}`);
        const fullContent = message.content || "";

        // Stream the already-obtained response directly
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(fullContent));
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

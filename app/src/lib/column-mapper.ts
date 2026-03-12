/**
 * Column Mapper — Auto-mapeo de columnas fuente al estándar CCINSHAE
 *
 * Estrategia de matching (en orden de prioridad):
 * 1. Match exacto (case-insensitive, trimmed)
 * 2. Match por aliases definidos en el schema
 * 3. Match por similitud normalizada (sin acentos, sin _, sin espacios)
 * 4. Sin mapeo → queda vacío
 */

import {
  STANDARD_FIELDS,
  type StandardField,
} from "./standard-schema";
import type { ParsedData } from "./csv-parser";

export interface ColumnMapping {
  /** Nombre de la columna en el estándar */
  standardField: string;
  /** Nombre de la columna en el archivo fuente (null = sin mapeo) */
  sourceColumn: string | null;
  /** Método usado para hacer el match */
  matchMethod: "exact" | "alias" | "fuzzy" | "none";
  /** Confianza del match 0-1 */
  confidence: number;
  /** Si el campo es obligatorio en el estándar */
  required: boolean;
}

/**
 * Normaliza un string para comparación:
 * lowercase, sin acentos, sin _, sin guiones, sin espacios extra
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[_\-]/g, " ") // guiones y underscores a espacios
    .replace(/\s+/g, " ") // espacios múltiples a uno
    .trim();
}

/**
 * Distancia de Levenshtein entre dos strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * Calcula similitud entre 0 y 1 usando Levenshtein.
 */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Genera el auto-mapeo entre las columnas del archivo fuente y el estándar.
 */
export function autoMapColumns(sourceHeaders: string[]): ColumnMapping[] {
  const usedSourceColumns = new Set<string>();
  const mappings: ColumnMapping[] = [];

  for (const field of STANDARD_FIELDS) {
    const mapping = findBestMatch(field, sourceHeaders, usedSourceColumns);
    if (mapping.sourceColumn) {
      usedSourceColumns.add(mapping.sourceColumn);
    }
    mappings.push(mapping);
  }

  return mappings;
}

function findBestMatch(
  field: StandardField,
  sourceHeaders: string[],
  used: Set<string>
): ColumnMapping {
  const available = sourceHeaders.filter((h) => !used.has(h));
  const normalizedFieldName = normalize(field.name);
  const normalizedAliases = field.aliases.map(normalize);

  // 1. Exact match on field name
  for (const header of available) {
    if (normalize(header) === normalizedFieldName) {
      return {
        standardField: field.name,
        sourceColumn: header,
        matchMethod: "exact",
        confidence: 1,
        required: field.required,
      };
    }
  }

  // 2. Alias match
  for (const header of available) {
    const normalizedHeader = normalize(header);
    if (normalizedAliases.includes(normalizedHeader)) {
      return {
        standardField: field.name,
        sourceColumn: header,
        matchMethod: "alias",
        confidence: 0.95,
        required: field.required,
      };
    }
  }

  // 3. Fuzzy match — solo si la similitud es mayor a 0.6
  let bestMatch: { header: string; score: number } | null = null;
  for (const header of available) {
    const normalizedHeader = normalize(header);

    // Comparar contra el nombre del campo
    const nameScore = similarity(normalizedHeader, normalizedFieldName);

    // Comparar contra cada alias
    let aliasScore = 0;
    for (const alias of normalizedAliases) {
      const s = similarity(normalizedHeader, alias);
      if (s > aliasScore) aliasScore = s;
    }

    const score = Math.max(nameScore, aliasScore);
    if (score > 0.6 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { header, score };
    }
  }

  if (bestMatch) {
    return {
      standardField: field.name,
      sourceColumn: bestMatch.header,
      matchMethod: "fuzzy",
      confidence: Math.round(bestMatch.score * 100) / 100,
      required: field.required,
    };
  }

  // 4. No match
  return {
    standardField: field.name,
    sourceColumn: null,
    matchMethod: "none",
    confidence: 0,
    required: field.required,
  };
}

/**
 * Aplica el mapeo a los datos: transforma ParsedData al formato estándar.
 * Las columnas sin mapeo quedan como cadena vacía.
 */
export function applyMapping(
  data: ParsedData,
  mappings: ColumnMapping[]
): ParsedData {
  const standardHeaders = mappings.map((m) => m.standardField);

  const standardRows = data.rows.map((row) => {
    const newRow: Record<string, string> = {};
    for (const mapping of mappings) {
      if (mapping.sourceColumn && row[mapping.sourceColumn] !== undefined) {
        newRow[mapping.standardField] = row[mapping.sourceColumn];
      } else {
        newRow[mapping.standardField] = "";
      }
    }
    return newRow;
  });

  return {
    headers: standardHeaders,
    rows: standardRows,
    totalRows: standardRows.length,
  };
}

/**
 * Resumen del mapeo para trazabilidad.
 */
export function getMappingSummary(mappings: ColumnMapping[]) {
  const mapped = mappings.filter((m) => m.sourceColumn !== null);
  const unmapped = mappings.filter((m) => m.sourceColumn === null);
  const unmappedRequired = unmapped.filter((m) => m.required);

  return {
    totalFields: mappings.length,
    mapped: mapped.length,
    unmapped: unmapped.length,
    unmappedRequired: unmappedRequired.length,
    details: mappings,
  };
}

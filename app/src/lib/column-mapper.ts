/**
 * Column Mapper — Auto-mapeo de columnas fuente al estándar CCINSHAE
 *
 * Estrategia de matching (en orden de prioridad):
 * 1. Match exacto del nombre oficial
 * 2. Match por aliases definidos en el estándar
 * 3. Match por aliases de columnas extra conocidas para merge multiarchivo
 * 4. Match fuzzy solo si es único y suficientemente claro
 * 5. Sin mapeo → queda vacío / se preserva como extra
 */

import { STANDARD_FIELDS, type StandardField } from "./standard-schema";
import type { ParsedData } from "./csv-parser";

export type ColumnMatchMethod = "exact" | "alias" | "fuzzy" | "none";

export interface ColumnMapping {
  /** Nombre de la columna en el estándar */
  standardField: string;
  /** Nombre de la columna en el archivo fuente (null = sin mapeo) */
  sourceColumn: string | null;
  /** Método usado para hacer el match */
  matchMethod: ColumnMatchMethod;
  /** Confianza del match 0-1 */
  confidence: number;
  /** Si el campo es obligatorio en el estándar */
  required: boolean;
}

export interface SemanticExtraField {
  canonicalName: string;
  aliases: string[];
}

export interface HeaderCandidate {
  canonicalName: string;
  kind: "standard" | "extra";
  standardField: string | null;
  matchMethod: ColumnMatchMethod;
  confidence: number;
}

export interface HeaderResolution {
  sourceHeader: string;
  normalizedHeader: string;
  canonicalName: string;
  kind: "standard" | "extra";
  standardField: string | null;
  matchMethod: ColumnMatchMethod;
  confidence: number;
}

export interface HeaderAnalysis {
  resolutions: HeaderResolution[];
  warnings: string[];
  errors: string[];
}

const FUZZY_MATCH_THRESHOLD = 0.82;
const FUZZY_MATCH_DELTA = 0.06;

export const SEMANTIC_EXTRA_FIELDS: SemanticExtraField[] = [
  {
    canonicalName: "numero_factura",
    aliases: [
      "numero_factura",
      "numero factura",
      "número de factura",
      "si cuenta con factura indique el numero de factura",
      "si cuenta con factura indique el número de factura",
    ],
  },
  {
    canonicalName: "mes_calendario",
    aliases: [
      "mes_calendario",
      "mes calendario",
      "mes calendario en que requiere el recurso",
      "mes en que requiere el recurso",
    ],
  },
  {
    canonicalName: "justificacion",
    aliases: ["justificacion", "justificación"],
  },
  {
    canonicalName: "observacion",
    aliases: ["observacion", "observación", "observaciones"],
  },
  {
    canonicalName: "monto_factura",
    aliases: [
      "monto_factura",
      "monto factura",
      "importe_factura",
      "importe factura",
    ],
  },
  {
    canonicalName: "esta_facturado",
    aliases: ["esta_facturado", "esta facturado", "facturado"],
  },
  {
    canonicalName: "esta_pagado",
    aliases: ["esta_pagado", "esta pagado", "pagado"],
  },
  {
    canonicalName: "clave_presupuestal",
    aliases: ["clave_presupuestal", "clave presupuestal"],
  },
  {
    canonicalName: "area_contratante",
    aliases: ["area_contratante", "área contratante", "area contratante"],
  },
  {
    canonicalName: "area_financiera",
    aliases: ["area_financiera", "área financiera", "area financiera"],
  },
  {
    canonicalName: "estatus_workflow",
    aliases: ["estatus_workflow", "estatus workflow"],
  },
];

interface StandardCandidateScore {
  field: StandardField;
  score: number;
}

/**
 * Normaliza un header para comparación robusta:
 * lowercase, sin acentos, sin paréntesis decorativos, sin saltos de línea,
 * sin caracteres especiales y con espacios colapsados.
 */
export function normalizeColumnName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[_\-\/]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildExtraColumnKey(value: string): string {
  const normalized = normalizeColumnName(value);
  return normalized.replace(/\s+/g, "_").replace(/^_+|_+$/g, "") || "columna_extra";
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

function getStandardScores(normalizedHeader: string): StandardCandidateScore[] {
  return STANDARD_FIELDS.map((field) => {
    const normalizedFieldName = normalizeColumnName(field.name);
    const aliasScores = field.aliases.map((alias) =>
      similarity(normalizedHeader, normalizeColumnName(alias))
    );
    const score = Math.max(
      similarity(normalizedHeader, normalizedFieldName),
      ...aliasScores
    );

    return { field, score };
  }).sort((a, b) => b.score - a.score);
}

function findExtraFieldMatch(normalizedHeader: string): SemanticExtraField | null {
  for (const field of SEMANTIC_EXTRA_FIELDS) {
    const options = [field.canonicalName, ...field.aliases].map(
      normalizeColumnName
    );

    if (options.includes(normalizedHeader)) {
      return field;
    }
  }

  return null;
}

export function resolveHeaderCandidate(
  sourceHeader: string
):
  | { candidate: HeaderCandidate; warning?: string }
  | { candidate: null; ambiguity: string[] }
  | { candidate: null } {
  const normalizedHeader = normalizeColumnName(sourceHeader);

  if (!normalizedHeader) {
    return { candidate: null };
  }

  for (const field of STANDARD_FIELDS) {
    if (normalizeColumnName(field.name) === normalizedHeader) {
      return {
        candidate: {
          canonicalName: field.name,
          kind: "standard",
          standardField: field.name,
          matchMethod: "exact",
          confidence: 1,
        },
      };
    }
  }

  const aliasMatches = STANDARD_FIELDS.filter((field) =>
    field.aliases.some((alias) => normalizeColumnName(alias) === normalizedHeader)
  );

  if (aliasMatches.length > 1) {
    return {
      candidate: null,
      ambiguity: aliasMatches.map((field) => field.name),
    };
  }

  if (aliasMatches.length === 1) {
    return {
      candidate: {
        canonicalName: aliasMatches[0].name,
        kind: "standard",
        standardField: aliasMatches[0].name,
        matchMethod: "alias",
        confidence: 0.95,
      },
    };
  }

  const extraField = findExtraFieldMatch(normalizedHeader);
  if (extraField) {
    return {
      candidate: {
        canonicalName: extraField.canonicalName,
        kind: "extra",
        standardField: null,
        matchMethod: "alias",
        confidence: 0.95,
      },
    };
  }

  const scoredFields = getStandardScores(normalizedHeader);
  const [bestMatch, secondBestMatch] = scoredFields;

  if (
    bestMatch &&
    bestMatch.score >= FUZZY_MATCH_THRESHOLD &&
    secondBestMatch &&
    secondBestMatch.score >= FUZZY_MATCH_THRESHOLD &&
    bestMatch.score - secondBestMatch.score < FUZZY_MATCH_DELTA
  ) {
    return {
      candidate: null,
      ambiguity: [bestMatch.field.name, secondBestMatch.field.name],
    };
  }

  if (bestMatch && bestMatch.score >= FUZZY_MATCH_THRESHOLD) {
    return {
      candidate: {
        canonicalName: bestMatch.field.name,
        kind: "standard",
        standardField: bestMatch.field.name,
        matchMethod: "fuzzy",
        confidence: Math.round(bestMatch.score * 100) / 100,
      },
      warning: `La columna "${sourceHeader}" se resolvió por similitud contra "${bestMatch.field.name}".`,
    };
  }

  return {
    candidate: {
      canonicalName: buildExtraColumnKey(sourceHeader),
      kind: "extra",
      standardField: null,
      matchMethod: "none",
      confidence: 0,
    },
  };
}

export function analyzeSourceHeaders(sourceHeaders: string[]): HeaderAnalysis {
  const resolutions: HeaderResolution[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const seenCanonical = new Map<string, string>();

  for (const sourceHeader of sourceHeaders) {
    const normalizedHeader = normalizeColumnName(sourceHeader);

    if (!normalizedHeader) {
      continue;
    }

    const result = resolveHeaderCandidate(sourceHeader);

    if ("ambiguity" in result && result.ambiguity) {
      errors.push(
        `La columna "${sourceHeader}" es ambigua entre ${result.ambiguity
          .map((candidate) => `"${candidate}"`)
          .join(" y ")}.`
      );
      continue;
    }

    if (!result.candidate) {
      continue;
    }

    const previousHeader = seenCanonical.get(result.candidate.canonicalName);
    if (previousHeader) {
      errors.push(
        `Las columnas "${previousHeader}" y "${sourceHeader}" intentan mapearse al mismo campo "${result.candidate.canonicalName}".`
      );
      continue;
    }

    seenCanonical.set(result.candidate.canonicalName, sourceHeader);

    if (result.warning) {
      warnings.push(result.warning);
    }

    resolutions.push({
      sourceHeader,
      normalizedHeader,
      canonicalName: result.candidate.canonicalName,
      kind: result.candidate.kind,
      standardField: result.candidate.standardField,
      matchMethod: result.candidate.matchMethod,
      confidence: result.candidate.confidence,
    });
  }

  return {
    resolutions,
    warnings,
    errors,
  };
}

/**
 * Genera el auto-mapeo entre las columnas del archivo fuente y el estándar.
 */
export function autoMapColumns(sourceHeaders: string[]): ColumnMapping[] {
  const analysis = analyzeSourceHeaders(sourceHeaders);
  const byStandardField = new Map<string, HeaderResolution>();

  for (const resolution of analysis.resolutions) {
    if (resolution.standardField) {
      byStandardField.set(resolution.standardField, resolution);
    }
  }

  return STANDARD_FIELDS.map((field) => {
    const match = byStandardField.get(field.name);

    return {
      standardField: field.name,
      sourceColumn: match?.sourceHeader ?? null,
      matchMethod: match?.matchMethod ?? "none",
      confidence: match?.confidence ?? 0,
      required: field.required,
    };
  });
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

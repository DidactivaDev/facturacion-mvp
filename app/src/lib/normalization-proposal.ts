import type { ColumnMapping } from "./column-mapper";
import { autoMapColumns, normalizeColumnName } from "./column-mapper";
import type { ParsedData } from "./csv-parser";
import type { QualityReport } from "./data-quality";
import type { ReplaceValuesOperation } from "./data-operations";
import { getCatalogFields } from "./standard-schema";

const MAX_TABLE_ROWS = 20;
const MAX_PENDING_ROWS = 15;

const YES_NO_BASE_RULES: Record<string, string> = {
  si: "Sí",
  sí: "Sí",
  "s i": "Sí",
  yes: "Sí",
  verdadero: "Sí",
  true: "Sí",
  "1": "Sí",
  no: "No",
  falso: "No",
  false: "No",
  "0": "No",
};

const SAFE_CATALOG_RULES: Record<string, Record<string, string>> = {
  "INDICAR SI EL CONCEPTO CUENTA CON CONTRATO (SELECCIONAR OPCIÓN)": {
    ...YES_NO_BASE_RULES,
    "con contrato": "Sí",
    "sin contrato": "No",
  },
  "INDICAR LA CONDICIÓN ACTUAL DE LA SUFICIENCIA PRESUPUESTAL (SELECCIONAR OPCIÓN)": {
    "con suficiencia": "Suficiente",
    "con suficiencia presupuestal": "Suficiente",
    si: "Suficiente",
    sí: "Suficiente",
    "sin suficiencia": "Insuficiente",
    "sin suficiencia presupuestal": "Insuficiente",
    no: "Insuficiente",
    pendiente: "Pendiente de validación",
    "pendiente de validacion": "Pendiente de validación",
    "pendiente validacion": "Pendiente de validación",
    "en validacion": "Pendiente de validación",
    "por validar": "Pendiente de validación",
  },
  "INDICAR EL NIVEL DE PRIORIDAD (SELECCIONAR OPCIÓN)": {
    prioritario: "Alta",
    "necesidad prioritaria": "Alta",
    "alta prioridad": "Alta",
    "prioridad alta": "Alta",
    "media prioridad": "Media",
    "prioridad media": "Media",
    "baja prioridad": "Baja",
    "prioridad baja": "Baja",
  },
  "CUENTA CON FACTURA RECATEGORIZADA (SELECCIONAR OPCIÓN)": {
    ...YES_NO_BASE_RULES,
    facturado: "Sí",
    "no facturado": "No",
    "con factura": "Sí",
    "sin factura": "No",
  },
};

const NORMALIZATION_INTENT_PATTERNS = [
  /\bnormaliz(a|ar|arlo|arla|alos|alas|acion|ación|o|e|emos)\b/i,
  /\bestandariz(a|ar|acion|ación|o|e)\b/i,
  /\bhomolog(a|ar|acion|ación)\b/i,
];

const AFFIRMATIVE_RESPONSES = new Set([
  "si",
  "sí",
  "si normalizar",
  "sí normalizar",
  "normalizar",
  "ok",
  "ok normalizar",
  "va",
  "vale",
  "dale",
  "adelante",
  "hazlo",
  "hazlo por favor",
  "por favor",
  "claro",
]);

interface SafeReplacementRow {
  standardField: string;
  sourceColumn: string;
  currentValue: string;
  suggestedValue: string;
  count: number;
}

interface PendingReviewRow {
  standardField: string;
  sourceColumn: string;
  currentValue: string;
  count: number;
  reason: string;
}

export interface SafeNormalizationProposal {
  message: string;
  operations: ReplaceValuesOperation[];
  safeRows: SafeReplacementRow[];
  pendingRows: PendingReviewRow[];
  notes: string[];
}

interface BuildSafeNormalizationProposalOptions {
  data: ParsedData;
  qualityReport?: QualityReport;
  mappings?: ColumnMapping[];
}

interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

function normalizeIntentText(value: string): string {
  return normalizeColumnName(value).replace(/\s+/g, " ").trim();
}

function isAffirmativeReply(question: string): boolean {
  const normalized = normalizeIntentText(question);
  if (!normalized) return false;
  if (AFFIRMATIVE_RESPONSES.has(normalized)) return true;
  return /^(si|sí|ok|vale|dale|adelante|hazlo)(\s|$)/i.test(question.trim());
}

function lastAssistantAskedForNormalization(
  history?: ChatHistoryMessage[]
): boolean {
  const lastAssistantMessage = [...(history || [])]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!lastAssistantMessage) return false;

  const normalized = normalizeIntentText(lastAssistantMessage.content);
  return (
    normalized.includes("deseas que normalice o corrija los datos") ||
    normalized.includes("deseas que normalice los datos") ||
    normalized.includes("si deseas que normalice o corrija los datos")
  );
}

export function shouldBuildSafeNormalizationProposal(options: {
  question: string;
  history?: ChatHistoryMessage[];
}): boolean {
  const question = options.question.trim();

  if (!question) return false;

  if (NORMALIZATION_INTENT_PATTERNS.some((pattern) => pattern.test(question))) {
    return true;
  }

  return (
    isAffirmativeReply(question) &&
    lastAssistantAskedForNormalization(options.history)
  );
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function toStrictCatalogKey(value: string): string {
  return value.toLowerCase().trim();
}

function toRuleLookupKey(value: string): string {
  return normalizeIntentText(value);
}

function resolveMappings(
  data: ParsedData,
  mappings?: ColumnMapping[]
): ColumnMapping[] {
  return mappings && mappings.length > 0 ? mappings : autoMapColumns(data.headers);
}

function buildMarkdownTable(
  headers: string[],
  rows: string[][]
): string {
  const headerLine = `| ${headers.map(escapeTableCell).join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyLines = rows.map(
    (row) => `| ${row.map((cell) => escapeTableCell(cell)).join(" | ")} |`
  );

  return [headerLine, separatorLine, ...bodyLines].join("\n");
}

export function buildSafeNormalizationProposal({
  data,
  qualityReport,
  mappings,
}: BuildSafeNormalizationProposalOptions): SafeNormalizationProposal {
  const effectiveMappings = resolveMappings(data, mappings);
  const catalogFields = getCatalogFields();
  const safeRows: SafeReplacementRow[] = [];
  const pendingRows: PendingReviewRow[] = [];
  const operations: ReplaceValuesOperation[] = [];
  const notes: string[] = [];
  const sourceUsage = new Map<string, string[]>();

  for (const field of catalogFields) {
    const mapping = effectiveMappings.find(
      (candidate) => candidate.standardField === field.name && candidate.sourceColumn
    );
    if (!mapping?.sourceColumn) continue;

    const usedBy = sourceUsage.get(mapping.sourceColumn) ?? [];
    usedBy.push(field.name);
    sourceUsage.set(mapping.sourceColumn, usedBy);
  }

  const conflictedSourceColumns = new Set(
    Array.from(sourceUsage.entries())
      .filter(([, standardFields]) => standardFields.length > 1)
      .map(([sourceColumn]) => sourceColumn)
  );

  for (const [sourceColumn, standardFields] of sourceUsage.entries()) {
    if (standardFields.length > 1) {
      notes.push(
        `La columna "${sourceColumn}" está mapeada a varios catálogos (${standardFields.join(
          ", "
        )}), así que la dejé fuera de la propuesta automática para evitar cambios riesgosos.`
      );
    }
  }

  for (const field of catalogFields) {
    if (!field.catalog) continue;

    const mapping = effectiveMappings.find(
      (candidate) => candidate.standardField === field.name
    );

    if (!mapping?.sourceColumn) continue;
    if (conflictedSourceColumns.has(mapping.sourceColumn)) continue;

    const invalidValueCounts = new Map<string, number>();
    const validCatalogKeys = new Set(field.catalog.map(toStrictCatalogKey));

    for (const row of data.rows) {
      const rawValue = (row[mapping.sourceColumn] || "").toString().trim();
      if (!rawValue) continue;
      if (validCatalogKeys.has(toStrictCatalogKey(rawValue))) continue;
      invalidValueCounts.set(rawValue, (invalidValueCounts.get(rawValue) || 0) + 1);
    }

    if (invalidValueCounts.size === 0) continue;

    const replaceMap: Record<string, string> = {};
    const ruleSet = SAFE_CATALOG_RULES[field.name] || {};

    for (const [rawValue, count] of Array.from(invalidValueCounts.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], "es");
    })) {
      const suggestedValue = ruleSet[toRuleLookupKey(rawValue)];

      if (suggestedValue) {
        replaceMap[rawValue] = suggestedValue;
        safeRows.push({
          standardField: field.name,
          sourceColumn: mapping.sourceColumn,
          currentValue: rawValue,
          suggestedValue,
          count,
        });
      } else {
        pendingRows.push({
          standardField: field.name,
          sourceColumn: mapping.sourceColumn,
          currentValue: rawValue,
          count,
          reason: "No hay una equivalencia segura definida para este valor.",
        });
      }
    }

    if (Object.keys(replaceMap).length > 0) {
      const affectedRows = Object.entries(replaceMap).reduce(
        (sum, [rawValue]) => sum + (invalidValueCounts.get(rawValue) || 0),
        0
      );

      operations.push({
        type: "replace_values",
        description: `Normalizar ${mapping.sourceColumn} al catálogo de ${field.name} (${affectedRows} registro(s) estimados).`,
        columns: [mapping.sourceColumn],
        replaceMap,
      });
    }
  }

  const catalogAlertCount =
    qualityReport?.alerts.filter((alert) => alert.category === "catalog").length ?? 0;

  const intro =
    operations.length > 0
      ? `Sí puedo ayudarte. Encontré ${safeRows.length} cambio(s) seguro(s) listos para normalizar ${operations.length} columna(s) del archivo.`
      : pendingRows.length > 0
        ? "Revisé los valores fuera de catálogo, pero por ahora no encontré cambios lo bastante seguros para aplicar automáticamente."
        : catalogAlertCount > 0
          ? "Revisé las alertas de catálogo y en este momento no encontré cambios seguros pendientes por normalizar."
          : "No veo valores fuera de catálogo que requieran una normalización automática en este momento.";

  const messageParts = [intro];

  if (safeRows.length > 0) {
    const safeTable = buildMarkdownTable(
      ["Columna", "Valor actual", "Valor sugerido", "Registros"],
      safeRows.slice(0, MAX_TABLE_ROWS).map((row) => [
        row.sourceColumn,
        row.currentValue,
        row.suggestedValue,
        row.count.toLocaleString("es-MX"),
      ])
    );

    messageParts.push(
      "",
      "Estos son los cambios seguros que te propongo:",
      "",
      safeTable
    );

    if (safeRows.length > MAX_TABLE_ROWS) {
      messageParts.push(
        "",
        `Mostré ${MAX_TABLE_ROWS} cambio(s), pero la propuesta completa incluye ${safeRows.length}.`
      );
    }
  }

  if (pendingRows.length > 0) {
    const pendingTable = buildMarkdownTable(
      ["Columna", "Valor detectado", "Registros", "Motivo"],
      pendingRows.slice(0, MAX_PENDING_ROWS).map((row) => [
        row.sourceColumn,
        row.currentValue,
        row.count.toLocaleString("es-MX"),
        row.reason,
      ])
    );

    messageParts.push(
      "",
      "También encontré algunos valores que prefiero dejar para revisión manual:",
      "",
      pendingTable
    );

    if (pendingRows.length > MAX_PENDING_ROWS) {
      messageParts.push(
        "",
        `Mostré ${MAX_PENDING_ROWS} caso(s) pendientes, pero detecté ${pendingRows.length} en total.`
      );
    }
  }

  if (notes.length > 0) {
    messageParts.push(
      "",
      "Notas importantes:",
      "",
      ...notes.map((note) => `- ${note}`)
    );
  }

  if (operations.length > 0) {
    messageParts.push(
      "",
      "Si estás de acuerdo, confirma la propuesta de corrección que aparece abajo."
    );
  } else if (pendingRows.length > 0) {
    messageParts.push(
      "",
      "Si quieres, en el siguiente paso puedo ayudarte a revisar estos valores uno por uno."
    );
  }

  const dataEditBlocks = operations.map(
    (operation) => `\`\`\`data-edit\n${JSON.stringify(operation, null, 2)}\n\`\`\``
  );

  return {
    message: [...messageParts, ...dataEditBlocks].join("\n"),
    operations,
    safeRows,
    pendingRows,
    notes,
  };
}

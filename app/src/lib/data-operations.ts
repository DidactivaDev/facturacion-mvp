import type { ParsedData } from "./csv-parser";

const DATA_EDIT_REGEX = /```data-edit\n([\s\S]*?)```/g;
const MAX_PREVIEW_ROWS = 5;
const MAX_DELETE_PREVIEW_COLUMNS = 3;
const MAX_DUPLICATE_EXTRA_COLUMNS = 2;

export type NormalizeType =
  | "uppercase"
  | "lowercase"
  | "trim"
  | "remove_accents";

export interface UpdateCellChange {
  row: number;
  column: string;
  value: string;
}

export interface UpdateCellsOperation {
  type: "update_cells";
  description: string;
  updates: UpdateCellChange[];
}

export interface DeleteRowsOperation {
  type: "delete_rows";
  description: string;
  rowIndices: number[];
}

export interface FillEmptyOperation {
  type: "fill_empty";
  description: string;
  columns: string[];
  fillValue: string;
}

export interface ReplaceValuesOperation {
  type: "replace_values";
  description: string;
  columns: string[];
  replaceMap: Record<string, string>;
}

export interface NormalizeColumnOperation {
  type: "normalize_column";
  description: string;
  columns: string[];
  normalizeType: NormalizeType;
}

export interface DeleteDuplicatesOperation {
  type: "delete_duplicates";
  description: string;
  duplicateKeys: string[];
}

export type DataEditOperation =
  | UpdateCellsOperation
  | DeleteRowsOperation
  | FillEmptyOperation
  | ReplaceValuesOperation
  | NormalizeColumnOperation
  | DeleteDuplicatesOperation;

export interface UnsupportedDataEditOperation {
  type: string;
  description?: string;
  [key: string]: unknown;
}

export interface DataEditBlock {
  raw: string;
  parsed: DataEditOperation | UnsupportedDataEditOperation | null;
  errors: string[];
}

export interface DataEditPreviewRow {
  row: number;
  before: Record<string, string>;
  after: Record<string, string> | null;
}

export interface DataEditPreview {
  columns: string[];
  previewHeaders: string[];
  affectedRows: number;
  affectedCells: number;
  sampleRows: DataEditPreviewRow[];
}

export interface DataEditProposalOperation {
  raw: string;
  description: string;
  type: string;
  operation: DataEditOperation | UnsupportedDataEditOperation | null;
  errors: string[];
  preview: DataEditPreview | null;
}

export interface DataEditProposal {
  operations: DataEditProposalOperation[];
  summary: {
    operationCount: number;
    affectedRows: number;
    affectedCells: number;
    columns: string[];
  };
  isValid: boolean;
  canApply: boolean;
}

export interface ApplyDataEditResult {
  data: ParsedData;
  summary: DataEditProposal["summary"];
}

interface WorkingRow {
  rowId: number;
  values: Record<string, string>;
}

interface OperationEffect {
  columns: string[];
  previewHeaders: string[];
  changedRowIds: Set<number>;
  changedCellCount: number;
  deletedRowIds: Set<number>;
  sampleRows: DataEditPreviewRow[];
}

interface SampleCapture {
  order: number[];
  beforeByRowId: Map<number, Record<string, string>>;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function isBlank(value: unknown): boolean {
  return asString(value).trim() === "";
}

function normalizeAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function createWorkingRows(data: ParsedData): WorkingRow[] {
  return data.rows.map((row, index) => {
    const values: Record<string, string> = {};
    for (const header of data.headers) {
      values[header] = asString(row[header]);
    }
    return { rowId: index + 1, values };
  });
}

function buildParsedData(headers: string[], rows: WorkingRow[]): ParsedData {
  return {
    headers: [...headers],
    rows: rows.map((row) => {
      const nextRow: Record<string, string> = {};
      for (const header of headers) {
        nextRow[header] = asString(row.values[header]);
      }
      return nextRow;
    }),
    totalRows: rows.length,
  };
}

function pickValues(
  row: WorkingRow,
  headers: string[]
): Record<string, string> {
  const selected: Record<string, string> = {};
  for (const header of headers) {
    selected[header] = asString(row.values[header]);
  }
  return selected;
}

function createSampleCapture(): SampleCapture {
  return { order: [], beforeByRowId: new Map() };
}

function captureBeforeRow(
  capture: SampleCapture,
  row: WorkingRow,
  previewHeaders: string[]
) {
  if (capture.beforeByRowId.has(row.rowId) || capture.order.length >= MAX_PREVIEW_ROWS) {
    return;
  }

  capture.order.push(row.rowId);
  capture.beforeByRowId.set(row.rowId, pickValues(row, previewHeaders));
}

function buildSampleRows(
  capture: SampleCapture,
  rows: WorkingRow[],
  previewHeaders: string[],
  deletedRowIds: Set<number>
): DataEditPreviewRow[] {
  const rowsById = new Map(rows.map((row) => [row.rowId, row]));

  return capture.order.map((rowId) => {
    const before = capture.beforeByRowId.get(rowId) || {};
    if (deletedRowIds.has(rowId)) {
      return { row: rowId, before, after: null };
    }

    const current = rowsById.get(rowId);
    return {
      row: rowId,
      before,
      after: current ? pickValues(current, previewHeaders) : null,
    };
  });
}

function dedupeNumbers(values: number[]): number[] {
  return Array.from(new Set(values));
}

function getPreviewColumnsForDeletedRows(headers: string[]): string[] {
  return headers.slice(0, Math.min(headers.length, MAX_DELETE_PREVIEW_COLUMNS));
}

function getPreviewColumnsForDuplicateRows(
  headers: string[],
  duplicateKeys: string[]
): string[] {
  const extra = headers
    .filter((header) => !duplicateKeys.includes(header))
    .slice(0, MAX_DUPLICATE_EXTRA_COLUMNS);
  return uniqueStrings([...duplicateKeys, ...extra]);
}

function normalizeCellValue(value: string, normalizeType: NormalizeType): string {
  if (normalizeType === "uppercase") return value.toUpperCase();
  if (normalizeType === "lowercase") return value.toLowerCase();
  if (normalizeType === "trim") return value.trim();
  return normalizeAccents(value);
}

function ensureDescription(obj: Record<string, unknown>): string {
  return typeof obj.description === "string" && obj.description.trim()
    ? obj.description.trim()
    : "Sin descripción";
}

function parseSupportedOperation(
  parsedJson: Record<string, unknown>
): DataEditOperation | UnsupportedDataEditOperation {
  const type = typeof parsedJson.type === "string" ? parsedJson.type : "";
  const description = ensureDescription(parsedJson);

  switch (type) {
    case "update_cells":
      return {
        type,
        description,
        updates: Array.isArray(parsedJson.updates)
          ? parsedJson.updates.map((update) => ({
              row:
                isPlainObject(update) && typeof update.row === "number"
                  ? update.row
                  : Number.NaN,
              column:
                isPlainObject(update) && typeof update.column === "string"
                  ? update.column
                  : "",
              value:
                isPlainObject(update) && "value" in update
                  ? asString(update.value)
                  : "",
            }))
          : [],
      };
    case "delete_rows":
      return {
        type,
        description,
        rowIndices: Array.isArray(parsedJson.rowIndices)
          ? parsedJson.rowIndices.map((value) => Number(value))
          : [],
      };
    case "fill_empty":
      return {
        type,
        description,
        columns: Array.isArray(parsedJson.columns)
          ? parsedJson.columns.map((value) => asString(value))
          : [],
        fillValue: asString(parsedJson.fillValue),
      };
    case "replace_values": {
      const replaceMap: Record<string, string> = {};
      if (isPlainObject(parsedJson.replaceMap)) {
        for (const [key, value] of Object.entries(parsedJson.replaceMap)) {
          replaceMap[key] = asString(value);
        }
      }
      return {
        type,
        description,
        columns: Array.isArray(parsedJson.columns)
          ? parsedJson.columns.map((value) => asString(value))
          : [],
        replaceMap,
      };
    }
    case "normalize_column":
      return {
        type,
        description,
        columns: Array.isArray(parsedJson.columns)
          ? parsedJson.columns.map((value) => asString(value))
          : [],
        normalizeType: asString(parsedJson.normalizeType) as NormalizeType,
      };
    case "delete_duplicates":
      return {
        type,
        description,
        duplicateKeys: Array.isArray(parsedJson.duplicateKeys)
          ? parsedJson.duplicateKeys.map((value) => asString(value))
          : [],
      };
    default:
      return {
        ...parsedJson,
        type,
        description,
      };
  }
}

export function getOperationLabel(type: string): string {
  switch (type) {
    case "update_cells":
      return "Actualizar celdas";
    case "delete_rows":
      return "Eliminar filas";
    case "fill_empty":
      return "Llenar vacíos";
    case "replace_values":
      return "Reemplazar valores";
    case "normalize_column":
      return "Normalizar columnas";
    case "delete_duplicates":
      return "Eliminar duplicados";
    default:
      return "Operación no soportada";
  }
}

export function extractDataEditBlocks(content: string): string[] {
  const blocks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = DATA_EDIT_REGEX.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }

  return blocks;
}

export function parseDataEditBlocks(content: string): DataEditBlock[] {
  return extractDataEditBlocks(content).map((raw) => {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isPlainObject(parsed)) {
        return {
          raw,
          parsed: null,
          errors: ["El bloque data-edit debe ser un objeto JSON válido."],
        };
      }

      return {
        raw,
        parsed: parseSupportedOperation(parsed),
        errors: [],
      };
    } catch {
      return {
        raw,
        parsed: null,
        errors: ["No se pudo parsear el bloque data-edit como JSON."],
      };
    }
  });
}

export function validateDataEditOperation(
  data: ParsedData,
  operation: DataEditOperation | UnsupportedDataEditOperation | null
): string[] {
  if (!operation) {
    return ["La operación no es válida."];
  }

  if (!operation.type) {
    return ["La operación no incluye un campo 'type'."];
  }

  if (
    operation.type !== "update_cells" &&
    operation.type !== "delete_rows" &&
    operation.type !== "fill_empty" &&
    operation.type !== "replace_values" &&
    operation.type !== "normalize_column" &&
    operation.type !== "delete_duplicates"
  ) {
    return [`La operación "${operation.type}" no está soportada en v1.`];
  }

  const supportedOperation = operation as DataEditOperation;
  const errors: string[] = [];

  if (!("description" in supportedOperation) || !asString(supportedOperation.description).trim()) {
    errors.push("La operación debe incluir una descripción.");
  }

  if (supportedOperation.type === "update_cells") {
    if (!supportedOperation.updates.length) {
      errors.push("La operación update_cells debe incluir al menos un cambio.");
    }

    for (const update of supportedOperation.updates) {
      if (!Number.isInteger(update.row) || update.row < 1 || update.row > data.totalRows) {
        errors.push(`La fila ${update.row} está fuera del rango del dataset.`);
      }
      if (!data.headers.includes(update.column)) {
        errors.push(`La columna "${update.column}" no existe en el dataset.`);
      }
    }
  }

  if (supportedOperation.type === "delete_rows") {
    if (!supportedOperation.rowIndices.length) {
      errors.push("La operación delete_rows debe incluir al menos una fila.");
    }

    for (const rowIndex of supportedOperation.rowIndices) {
      if (!Number.isInteger(rowIndex) || rowIndex < 1 || rowIndex > data.totalRows) {
        errors.push(`La fila ${rowIndex} está fuera del rango del dataset.`);
      }
    }
  }

  if (supportedOperation.type === "fill_empty") {
    if (!supportedOperation.columns.length) {
      errors.push("La operación fill_empty debe incluir al menos una columna.");
    }
    for (const column of supportedOperation.columns) {
      if (!data.headers.includes(column)) {
        errors.push(`La columna "${column}" no existe en el dataset.`);
      }
    }
  }

  if (supportedOperation.type === "replace_values") {
    if (!supportedOperation.columns.length) {
      errors.push("La operación replace_values debe incluir al menos una columna.");
    }
    if (Object.keys(supportedOperation.replaceMap).length === 0) {
      errors.push("La operación replace_values debe incluir un replaceMap con valores.");
    }
    for (const column of supportedOperation.columns) {
      if (!data.headers.includes(column)) {
        errors.push(`La columna "${column}" no existe en el dataset.`);
      }
    }
  }

  if (supportedOperation.type === "normalize_column") {
    if (!supportedOperation.columns.length) {
      errors.push("La operación normalize_column debe incluir al menos una columna.");
    }
    for (const column of supportedOperation.columns) {
      if (!data.headers.includes(column)) {
        errors.push(`La columna "${column}" no existe en el dataset.`);
      }
    }
    if (
      supportedOperation.normalizeType !== "uppercase" &&
      supportedOperation.normalizeType !== "lowercase" &&
      supportedOperation.normalizeType !== "trim" &&
      supportedOperation.normalizeType !== "remove_accents"
    ) {
      errors.push(
        `La normalización "${supportedOperation.normalizeType}" no está soportada.`
      );
    }
  }

  if (supportedOperation.type === "delete_duplicates") {
    if (!supportedOperation.duplicateKeys.length) {
      errors.push(
        "La operación delete_duplicates debe incluir al menos una llave de duplicado."
      );
    }
    for (const key of supportedOperation.duplicateKeys) {
      if (!data.headers.includes(key)) {
        errors.push(`La columna "${key}" no existe en el dataset.`);
      }
    }
  }

  return uniqueStrings(errors);
}

function applyOperationToWorkingRows(
  rows: WorkingRow[],
  headers: string[],
  operation: DataEditOperation
): OperationEffect {
  const changedRowIds = new Set<number>();
  const deletedRowIds = new Set<number>();
  let changedCellCount = 0;
  let columns: string[] = [];
  let previewHeaders: string[] = [];
  const sampleCapture = createSampleCapture();

  if (operation.type === "update_cells") {
    columns = uniqueStrings(operation.updates.map((update) => update.column));
    previewHeaders = columns;

    for (const update of operation.updates) {
      const row = rows.find((candidate) => candidate.rowId === update.row);
      if (!row) continue;

      captureBeforeRow(sampleCapture, row, previewHeaders);
      if (asString(row.values[update.column]) !== update.value) {
        row.values[update.column] = update.value;
        changedRowIds.add(row.rowId);
        changedCellCount += 1;
      }
    }
  }

  if (operation.type === "delete_rows") {
    const rowIndices = dedupeNumbers(operation.rowIndices);
    previewHeaders = getPreviewColumnsForDeletedRows(headers);

    for (const rowIndex of rowIndices) {
      const row = rows.find((candidate) => candidate.rowId === rowIndex);
      if (!row) continue;

      captureBeforeRow(sampleCapture, row, previewHeaders);
      changedRowIds.add(row.rowId);
      deletedRowIds.add(row.rowId);
      changedCellCount += headers.length;
    }

    if (deletedRowIds.size > 0) {
      const remaining = rows.filter((row) => !deletedRowIds.has(row.rowId));
      rows.splice(0, rows.length, ...remaining);
    }
  }

  if (operation.type === "fill_empty") {
    columns = uniqueStrings(operation.columns);
    previewHeaders = columns;

    for (const row of rows) {
      let rowChanged = false;
      for (const column of columns) {
        if (!isBlank(row.values[column])) continue;
        captureBeforeRow(sampleCapture, row, previewHeaders);
        row.values[column] = operation.fillValue;
        rowChanged = true;
        changedCellCount += 1;
      }
      if (rowChanged) {
        changedRowIds.add(row.rowId);
      }
    }
  }

  if (operation.type === "replace_values") {
    columns = uniqueStrings(operation.columns);
    previewHeaders = columns;

    for (const row of rows) {
      let rowChanged = false;
      for (const column of columns) {
        const currentValue = asString(row.values[column]);
        if (!Object.prototype.hasOwnProperty.call(operation.replaceMap, currentValue)) {
          continue;
        }

        const nextValue = operation.replaceMap[currentValue];
        if (currentValue === nextValue) continue;

        captureBeforeRow(sampleCapture, row, previewHeaders);
        row.values[column] = nextValue;
        rowChanged = true;
        changedCellCount += 1;
      }
      if (rowChanged) {
        changedRowIds.add(row.rowId);
      }
    }
  }

  if (operation.type === "normalize_column") {
    columns = uniqueStrings(operation.columns);
    previewHeaders = columns;

    for (const row of rows) {
      let rowChanged = false;
      for (const column of columns) {
        const currentValue = asString(row.values[column]);
        const nextValue = normalizeCellValue(currentValue, operation.normalizeType);
        if (currentValue === nextValue) continue;

        captureBeforeRow(sampleCapture, row, previewHeaders);
        row.values[column] = nextValue;
        rowChanged = true;
        changedCellCount += 1;
      }
      if (rowChanged) {
        changedRowIds.add(row.rowId);
      }
    }
  }

  if (operation.type === "delete_duplicates") {
    columns = uniqueStrings(operation.duplicateKeys);
    previewHeaders = getPreviewColumnsForDuplicateRows(headers, columns);
    const seen = new Set<string>();

    for (const row of rows) {
      const key = columns.map((column) => asString(row.values[column]).trim().toLowerCase()).join("|");
      if (!seen.has(key)) {
        seen.add(key);
        continue;
      }

      captureBeforeRow(sampleCapture, row, previewHeaders);
      changedRowIds.add(row.rowId);
      deletedRowIds.add(row.rowId);
      changedCellCount += headers.length;
    }

    if (deletedRowIds.size > 0) {
      const remaining = rows.filter((row) => !deletedRowIds.has(row.rowId));
      rows.splice(0, rows.length, ...remaining);
    }
  }

  return {
    columns,
    previewHeaders,
    changedRowIds,
    changedCellCount,
    deletedRowIds,
    sampleRows: buildSampleRows(sampleCapture, rows, previewHeaders, deletedRowIds),
  };
}

export function previewDataEditOperation(
  data: ParsedData,
  operation: DataEditOperation
): DataEditPreview {
  const rows = createWorkingRows(data);
  const effect = applyOperationToWorkingRows(rows, data.headers, operation);

  return {
    columns: effect.columns,
    previewHeaders: effect.previewHeaders,
    affectedRows: effect.changedRowIds.size,
    affectedCells: effect.changedCellCount,
    sampleRows: effect.sampleRows,
  };
}

export function buildDataEditProposal(
  content: string,
  data: ParsedData
): DataEditProposal | null {
  const parsedBlocks = parseDataEditBlocks(content);

  if (parsedBlocks.length === 0) return null;

  const operations: DataEditProposalOperation[] = parsedBlocks.map((block) => {
    const operationErrors = [
      ...block.errors,
      ...validateDataEditOperation(data, block.parsed),
    ];

    const description =
      block.parsed && "description" in block.parsed
        ? asString(block.parsed.description)
        : "Sin descripción";
    const type =
      block.parsed && "type" in block.parsed ? asString(block.parsed.type) : "unknown";

    const preview =
      operationErrors.length === 0 &&
      block.parsed &&
      type !== "unknown" &&
      type !== "add_column"
        ? previewDataEditOperation(data, block.parsed as DataEditOperation)
        : null;

    return {
      raw: block.raw,
      description,
      type,
      operation: block.parsed,
      errors: uniqueStrings(operationErrors),
      preview,
    };
  });

  const validOperations = operations.filter(
    (operation): operation is DataEditProposalOperation & { operation: DataEditOperation; preview: DataEditPreview } =>
      operation.errors.length === 0 &&
      operation.operation !== null &&
      operation.preview !== null
  );

  const columns = uniqueStrings(
    validOperations.flatMap((operation) => operation.preview.columns)
  );

  const summary = {
    operationCount: operations.length,
    affectedRows: validOperations.reduce(
      (sum, operation) => sum + operation.preview.affectedRows,
      0
    ),
    affectedCells: validOperations.reduce(
      (sum, operation) => sum + operation.preview.affectedCells,
      0
    ),
    columns,
  };

  const isValid = operations.length > 0 && operations.every((operation) => operation.errors.length === 0);
  const canApply = isValid && (summary.affectedRows > 0 || summary.affectedCells > 0);

  return {
    operations,
    summary,
    isValid,
    canApply,
  };
}

export function applyDataEditOperations(
  data: ParsedData,
  operations: DataEditOperation[]
): ApplyDataEditResult {
  const rows = createWorkingRows(data);
  const columns = new Set<string>();
  const affectedRowIds = new Set<number>();
  let affectedCells = 0;

  for (const operation of operations) {
    const validationErrors = validateDataEditOperation(data, operation);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(" "));
    }

    const effect = applyOperationToWorkingRows(rows, data.headers, operation);
    for (const rowId of effect.changedRowIds) {
      affectedRowIds.add(rowId);
    }
    affectedCells += effect.changedCellCount;
    for (const column of effect.columns) {
      columns.add(column);
    }
  }

  return {
    data: buildParsedData(data.headers, rows),
    summary: {
      operationCount: operations.length,
      affectedRows: affectedRowIds.size,
      affectedCells,
      columns: Array.from(columns),
    },
  };
}

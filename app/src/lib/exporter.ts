/**
 * Exporter — Exportar datos estandarizados a CSV y XLSX
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ParsedData } from "./csv-parser";
import type { ColumnMapping } from "./column-mapper";
import type { QualityReport } from "./data-quality";

/**
 * Genera un string CSV a partir de ParsedData.
 */
export function exportToCSV(data: ParsedData): string {
  return Papa.unparse({
    fields: data.headers,
    data: data.rows.map((row) => data.headers.map((h) => row[h] ?? "")),
  });
}

export interface ExtraSheet {
  name: string;
  data: ParsedData;
}

/**
 * Genera un Blob XLSX a partir de ParsedData. Opcionalmente agrega hojas
 * adicionales (p. ej. las columnas no mapeadas).
 */
export function exportToXLSX(
  data: ParsedData,
  sheetName = "Estándar",
  extraSheets: ExtraSheet[] = []
): Blob {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data.rows, { header: data.headers });
  // Excel limita el nombre de la hoja a 31 caracteres.
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  for (const sheet of extraSheets) {
    const extraWs = XLSX.utils.json_to_sheet(sheet.data.rows, {
      header: sheet.data.headers,
    });
    XLSX.utils.book_append_sheet(wb, extraWs, sheet.name.slice(0, 31));
  }
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Genera un resumen de trazabilidad de la corrida.
 */
export function generateRunSummary(
  source: string,
  data: ParsedData,
  report: QualityReport,
  mappings: ColumnMapping[]
) {
  const mapped = mappings.filter((m) => m.sourceColumn !== null);
  const unmapped = mappings.filter((m) => m.sourceColumn === null);

  return {
    fecha: new Date().toISOString(),
    fuente: source,
    totalFilas: data.totalRows,
    totalColumnasFuente: data.headers.length,
    totalColumnasEstandar: mappings.length,
    columnasMapeadas: mapped.length,
    columnasSinMapeo: unmapped.length,
    alertasAltas: report.summary.highAlerts,
    alertasMedias: report.summary.mediumAlerts,
    alertasBajas: report.summary.lowAlerts,
    totalAlertas: report.summary.totalAlerts,
    mapeos: mapped.map((m) => ({
      estandar: m.standardField,
      fuente: m.sourceColumn,
      metodo: m.matchMethod,
      confianza: m.confidence,
    })),
    sinMapeo: unmapped.map((m) => ({
      estandar: m.standardField,
      obligatorio: m.required,
    })),
  };
}

/**
 * Descarga un blob como archivo en el navegador.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Descarga un string como archivo de texto.
 */
export function downloadText(text: string, filename: string, mime = "text/csv") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  downloadBlob(blob, filename);
}

/**
 * Descarga el resumen de trazabilidad como JSON.
 */
export function downloadRunSummary(
  source: string,
  data: ParsedData,
  report: QualityReport,
  mappings: ColumnMapping[]
) {
  const summary = generateRunSummary(source, data, report, mappings);
  const json = JSON.stringify(summary, null, 2);
  downloadText(json, `resumen_corrida_${Date.now()}.json`, "application/json");
}

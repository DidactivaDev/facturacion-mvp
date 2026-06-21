"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  applyMapping,
  getUnmappedSourceColumns,
  buildUnmappedColumnsData,
  type ColumnMapping,
} from "@/lib/column-mapper";
import {
  exportToCSV,
  exportToXLSX,
  downloadText,
  downloadBlob,
  downloadRunSummary,
} from "@/lib/exporter";
import type { ParsedData } from "@/lib/csv-parser";
import type { QualityReport } from "@/lib/data-quality";

interface StandardExporterProps {
  data: ParsedData;
  mappings: ColumnMapping[];
  report: QualityReport;
  source: string;
}

export default function StandardExporter({
  data,
  mappings,
  report,
  source,
}: StandardExporterProps) {
  const [includeUnmapped, setIncludeUnmapped] = useState(false);
  const [placement, setPlacement] = useState<"end" | "sheet">("sheet");

  const summary = useMemo(() => {
    const mapped = mappings.filter((m) => m.sourceColumn !== null);
    const unmappedRequired = mappings.filter(
      (m) => m.sourceColumn === null && m.required
    );
    return { mapped: mapped.length, total: mappings.length, unmappedRequired: unmappedRequired.length };
  }, [mappings]);

  const unmappedColumns = useMemo(
    () => getUnmappedSourceColumns(data, mappings),
    [data, mappings]
  );


  const appendToTable = includeUnmapped && placement === "end";
  const previewData = useMemo(
    () => applyMapping(data, mappings, { includeUnmapped: appendToTable }),
    [data, mappings, appendToTable]
  );

  const handleExportCSV = () => {
    const csvData = applyMapping(data, mappings, { includeUnmapped });
    const csv = exportToCSV(csvData);
    downloadText(csv, `estandar_ccinshae_${Date.now()}.csv`);
  };

  const handleExportXLSX = () => {
    let blob: Blob;
    if (includeUnmapped && placement === "sheet") {
      const standardData = applyMapping(data, mappings);
      const extraData = buildUnmappedColumnsData(data, unmappedColumns);
      blob = exportToXLSX(standardData, "CCINSHAE", [
        { name: "Columnas no mapeadas", data: extraData },
      ]);
    } else {
      const xlsxData = applyMapping(data, mappings, { includeUnmapped });
      blob = exportToXLSX(xlsxData, "CCINSHAE");
    }
    downloadBlob(blob, `estandar_ccinshae_${Date.now()}.xlsx`);
  };

  const handleExportSummary = () => {
    downloadRunSummary(source, data, report, mappings);
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              summary.unmappedRequired > 0
                ? "bg-amber-100 dark:bg-amber-900/30"
                : "bg-emerald-100 dark:bg-emerald-900/30"
            }`}
          >
            {summary.unmappedRequired > 0 ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-600">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-600">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {summary.unmappedRequired > 0
                ? "Exportación con advertencias"
                : "Listo para exportar"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {summary.mapped} de {summary.total} campos mapeados
              {summary.unmappedRequired > 0 &&
                ` · ${summary.unmappedRequired} obligatorios sin mapeo`}
            </p>
          </div>
        </div>

        {summary.unmappedRequired > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2 mb-3">
            Algunos campos obligatorios no tienen mapeo. Se exportarán vacíos.
            Revisa el mapeo de columnas para mejorar la calidad del resultado exportado.
          </p>
        )}

        {/* Incluir columnas no mapeadas */}
        {unmappedColumns.length > 0 && (
          <div className="rounded-md border bg-muted/20 px-3 py-2.5 mb-4 space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeUnmapped}
                onChange={(e) => setIncludeUnmapped(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              Incluir columnas no mapeadas ({unmappedColumns.length})
            </label>

            {includeUnmapped && (
              <div className="pl-6 space-y-1.5">
                <span className="text-[11px] text-muted-foreground">Ubicación:</span>
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-2 text-[11px] cursor-pointer select-none">
                    <input
                      type="radio"
                      name="unmapped-placement"
                      checked={placement === "end"}
                      onChange={() => setPlacement("end")}
                      className="h-3 w-3 accent-primary"
                    />
                    Al final de la tabla
                  </label>
                  <label className="flex items-center gap-2 text-[11px] cursor-pointer select-none">
                    <input
                      type="radio"
                      name="unmapped-placement"
                      checked={placement === "sheet"}
                      onChange={() => setPlacement("sheet")}
                      className="h-3 w-3 accent-primary"
                    />
                    En hoja aparte{" "}
                    <span className="text-muted-foreground">
                      (solo Excel; en CSV se anexan al final)
                    </span>
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  Columnas: {unmappedColumns.join(", ")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        <div className="rounded-md border overflow-hidden mb-4">
          <div className="text-xs font-medium px-3 py-2 bg-muted/30 border-b">
            Vista previa del estándar ({previewData.totalRows} filas, {previewData.headers.length} columnas)
          </div>
          <div className="overflow-auto max-h-[200px] custom-scrollbar">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b bg-muted/20 sticky top-0">
                  {previewData.headers.slice(0, 8).map((h) => (
                    <th key={h} className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">
                      {h.length > 20 ? h.slice(0, 20) + "…" : h}
                    </th>
                  ))}
                  {previewData.headers.length > 8 && (
                    <th className="px-2 py-1.5 text-muted-foreground">
                      +{previewData.headers.length - 8} más
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {previewData.rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b">
                    {previewData.headers.slice(0, 8).map((h) => (
                      <td key={h} className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                        {(row[h] || "").toString().slice(0, 20) || (
                          <span className="text-rose-400 italic">vacío</span>
                        )}
                      </td>
                    ))}
                    {previewData.headers.length > 8 && <td />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {includeUnmapped && placement === "sheet" && (
            <div className="text-[11px] text-muted-foreground px-3 py-2 border-t bg-muted/10">
              + se incluirá una hoja aparte{" "}
              <span className="font-medium">«Columnas no mapeadas»</span> con{" "}
              {unmappedColumns.length} columna(s). En CSV se anexan al final.
            </div>
          )}
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handleExportCSV} size="sm" className="gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            Descargar CSV
          </Button>
          <Button onClick={handleExportXLSX} size="sm" variant="outline" className="gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            Descargar Excel
          </Button>
          <Button onClick={handleExportSummary} size="sm" variant="ghost" className="gap-2 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clipRule="evenodd" />
            </svg>
            Resumen de corrida (JSON)
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/60">
        El export a Google Sheets estará disponible en una versión futura. Por ahora usa CSV o Excel.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { QualityReport, ColumnStats } from "@/lib/data-quality";
import QualityAlertCard from "./QualityAlertCard";

interface QualityReportViewProps {
  report: QualityReport;
}

function StatsTable({ stats }: { stats: ColumnStats[] }) {
  return (
    <div className="overflow-auto max-h-[400px] custom-scrollbar">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/30 sticky top-0">
            <th className="text-left px-3 py-2 font-semibold">Columna</th>
            <th className="text-right px-3 py-2 font-semibold">Nulos</th>
            <th className="text-right px-3 py-2 font-semibold">% Nulos</th>
            <th className="text-right px-3 py-2 font-semibold">Únicos</th>
            <th className="text-left px-3 py-2 font-semibold">Tipo</th>
            <th className="text-left px-3 py-2 font-semibold">Top valores</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.column} className="border-b hover:bg-muted/20">
              <td className="px-3 py-2 font-medium whitespace-nowrap">{s.column}</td>
              <td className="px-3 py-2 text-right">
                <span className={s.nullCount > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                  {s.nullCount}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className={s.nullPercent > 20 ? "text-rose-600 dark:text-rose-400 font-medium" : ""}>
                  {s.nullPercent}%
                </span>
              </td>
              <td className="px-3 py-2 text-right">{s.uniqueCount}</td>
              <td className="px-3 py-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  s.isNumeric
                    ? "bg-[#235b4e]/10 text-[#235b4e] dark:bg-[#235b4e]/30 dark:text-[#3e8e7c]"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}>
                  {s.isNumeric ? "numérico" : "texto"}
                </span>
              </td>
              <td className="px-3 py-2 max-w-[200px] truncate text-muted-foreground">
                {s.topValues.slice(0, 3).map((v) => `${v.value} (${v.count})`).join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function QualityReportView({ report }: QualityReportViewProps) {
  const [showStats, setShowStats] = useState(false);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{report.totalRows.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Filas analizadas</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className={`text-2xl font-bold ${report.summary.highAlerts > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {report.summary.highAlerts}
          </p>
          <p className="text-xs text-muted-foreground">Alertas altas</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className={`text-2xl font-bold ${report.summary.mediumAlerts > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {report.summary.mediumAlerts}
          </p>
          <p className="text-xs text-muted-foreground">Alertas medias</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-[#235b4e] dark:text-[#3e8e7c]">{report.summary.lowAlerts}</p>
          <p className="text-xs text-muted-foreground">Alertas bajas</p>
        </div>
      </div>

      {/* Alerts */}
      {report.alerts.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            Alertas y recomendaciones ({report.alerts.length})
          </h3>
          {report.alerts.map((alert, i) => (
            <QualityAlertCard key={i} alert={alert} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-emerald-500/10 border-emerald-200 dark:border-emerald-800/40 p-4 text-center">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            ✓ No se detectaron problemas de calidad
          </p>
        </div>
      )}

      {/* Column stats toggle */}
      <div>
        <button
          onClick={() => setShowStats(!showStats)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 transition-transform ${showStats ? "rotate-90" : ""}`}
          >
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
          Estadísticas por columna ({report.columnStats.length} columnas)
        </button>
        {showStats && (
          <div className="mt-2 rounded-lg border bg-card overflow-hidden">
            <StatsTable stats={report.columnStats} />
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="text-[10px] text-muted-foreground/60 flex items-center gap-3">
        <span>Fuente: {report.source}</span>
        <span>·</span>
        <span>Analizado: {new Date(report.timestamp).toLocaleString("es-MX")}</span>
        <span>·</span>
        <span>{report.totalColumns} columnas fuente</span>
      </div>
    </div>
  );
}

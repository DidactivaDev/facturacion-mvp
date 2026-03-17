"use client";

import { useState } from "react";
import type { QualityReport, QualityAlert, ColumnStats } from "@/lib/data-quality";

interface QualityReportViewProps {
  report: QualityReport;
}

const severityConfig = {
  high: {
    label: "Alta",
    bg: "bg-rose-500/10",
    border: "border-rose-200 dark:border-rose-800/40",
    text: "text-rose-700 dark:text-rose-400",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
      </svg>
    ),
  },
  medium: {
    label: "Media",
    bg: "bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-800/40",
    text: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
      </svg>
    ),
  },
  low: {
    label: "Baja",
    bg: "bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-800/40",
    text: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
      </svg>
    ),
  },
};

function AlertCard({ alert }: { alert: QualityAlert }) {
  const config = severityConfig[alert.severity];
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className={`rounded-lg border p-3 ${config.bg} ${config.border}`}>
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 shrink-0 ${config.text}`}>{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badge}`}>
              {config.label}
            </span>
            <h4 className="text-sm font-semibold text-foreground">{alert.title}</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
          {alert.affectedRows !== undefined && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Filas afectadas: {alert.affectedRows.toLocaleString()}
            </p>
          )}
          <div className="mt-2 flex items-start gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5">
              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-primary">{alert.recommendation}</p>
          </div>

          {/* Expandable detail table */}
          {alert.details && alert.details.rows.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`w-3.5 h-3.5 transition-transform ${showDetails ? "rotate-90" : ""}`}
                >
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M.99 6.014A5.006 5.006 0 0 1 5.999 1h4.002a5.006 5.006 0 0 1 5.009 5.014c0 1.26-.466 2.513-1.375 3.564a8.167 8.167 0 0 1-1.252 1.16l-.149.117a14.046 14.046 0 0 0-.901.793 5.073 5.073 0 0 0-.726.91c-.241.403-.437.88-.542 1.442H5.935c-.105-.562-.3-1.04-.542-1.442a5.073 5.073 0 0 0-.726-.91 14.046 14.046 0 0 0-.901-.793l-.149-.117a8.167 8.167 0 0 1-1.252-1.16C1.456 8.527.99 7.274.99 6.014ZM5.999 2.5A3.506 3.506 0 0 0 2.49 6.014c0 .946.354 1.9 1.1 2.772a6.67 6.67 0 0 0 1.024.95l.148.116c.335.264.69.556 1.015.867.193.185.373.382.536.585h3.374c.163-.203.343-.4.536-.585a15.544 15.544 0 0 1 1.015-.867l.148-.116a6.67 6.67 0 0 0 1.024-.95c.746-.873 1.1-1.826 1.1-2.772A3.506 3.506 0 0 0 10.001 2.5H5.999Z" clipRule="evenodd" />
                  <path d="M5.5 12.5a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5ZM6.25 15a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" />
                </svg>
                {alert.details.label}
              </button>

              {showDetails && (
                <div className="mt-2 rounded-md border bg-background overflow-hidden">
                  <div className="overflow-auto max-h-[300px] custom-scrollbar">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b bg-muted/50 sticky top-0">
                          {alert.details.headers.map((h, i) => (
                            <th key={i} className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {alert.details.rows.map((row, i) => (
                          <tr key={i} className="border-b hover:bg-muted/20">
                            {row.map((cell, j) => (
                              <td
                                key={j}
                                className={`px-2 py-1 whitespace-nowrap max-w-[200px] truncate ${
                                  j === 0 ? "font-medium text-muted-foreground" : ""
                                }`}
                                title={cell}
                              >
                                {cell || <span className="text-rose-400 italic">vacío</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {alert.affectedRows && alert.details.rows.length < alert.affectedRows && (
                    <div className="text-[10px] text-muted-foreground/70 text-center py-1 border-t bg-muted/20">
                      Mostrando {alert.details.rows.length} de {alert.affectedRows.toLocaleString()} filas afectadas
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400"
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
          <p className="text-2xl font-bold text-blue-600">{report.summary.lowAlerts}</p>
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
            <AlertCard key={i} alert={alert} />
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

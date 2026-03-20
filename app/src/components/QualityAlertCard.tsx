"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import type { QualityAlert } from "@/lib/data-quality";
import { qualityAlertSeverityUi } from "@/lib/quality-alert-ui";

interface QualityAlertCardProps {
  alert: QualityAlert;
  compact?: boolean;
  showDetails?: boolean;
}

export default function QualityAlertCard({
  alert,
  compact = false,
  showDetails = true,
}: QualityAlertCardProps) {
  const [showExpandedDetails, setShowExpandedDetails] = useState(false);
  const config = qualityAlertSeverityUi[alert.severity];
  const SeverityIcon = config.icon;

  return (
    <div
      className={`rounded-xl border ${config.bg} ${config.border} ${
        compact ? "p-3" : "p-3.5"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`mt-0.5 shrink-0 rounded-lg bg-background/80 p-1.5 ${config.text}`}
        >
          <SeverityIcon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${config.badge}`}
            >
              <span aria-hidden="true">{config.emoji}</span>
              {config.label}
            </span>
            <h4
              className={`font-semibold text-foreground ${
                compact ? "text-sm" : "text-sm"
              }`}
            >
              {alert.title}
            </h4>
          </div>

          <p
            className={`text-muted-foreground ${
              compact ? "text-xs leading-relaxed" : "text-xs leading-relaxed"
            }`}
          >
            {alert.description}
          </p>

          {alert.affectedRows !== undefined && (
            <div className="text-[11px] font-medium text-muted-foreground">
              Registros afectados: {alert.affectedRows.toLocaleString("es-MX")}
            </div>
          )}

          <div className="rounded-lg border border-primary/10 bg-background/70 px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Qué te recomiendo hacer
            </div>
            <p className="text-xs leading-relaxed text-foreground/90">
              {alert.recommendation}
            </p>
          </div>

          {showDetails && alert.details && alert.details.rows.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowExpandedDetails((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${
                    showExpandedDetails ? "rotate-90" : ""
                  }`}
                />
                <Sparkles className="h-3.5 w-3.5" />
                {alert.details.label}
              </button>

              {showExpandedDetails && (
                <div className="overflow-hidden rounded-lg border bg-background">
                  <div className="max-h-[280px] overflow-auto custom-scrollbar">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="sticky top-0 border-b bg-muted/50">
                          {alert.details.headers.map((header, index) => (
                            <th
                              key={`${header}-${index}`}
                              className="whitespace-nowrap px-2 py-1.5 text-left font-semibold"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {alert.details.rows.map((row, rowIndex) => (
                          <tr
                            key={`${alert.title}-${rowIndex}`}
                            className="border-b hover:bg-muted/20"
                          >
                            {row.map((cell, cellIndex) => (
                              <td
                                key={`${rowIndex}-${cellIndex}`}
                                className={`max-w-[220px] truncate px-2 py-1.5 whitespace-nowrap ${
                                  cellIndex === 0
                                    ? "font-medium text-muted-foreground"
                                    : ""
                                }`}
                                title={cell}
                              >
                                {cell || (
                                  <span className="italic text-rose-400">
                                    vacío
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {alert.affectedRows &&
                    alert.details.rows.length < alert.affectedRows && (
                      <div className="border-t bg-muted/20 py-1 text-center text-[10px] text-muted-foreground/70">
                        Mostrando {alert.details.rows.length} de{" "}
                        {alert.affectedRows.toLocaleString("es-MX")} registros
                        afectados
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

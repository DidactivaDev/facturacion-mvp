"use client";

import type { QualityReport } from "@/lib/data-quality";
import QualityAlertCard from "./QualityAlertCard";

interface ChatQualitySummaryCardProps {
  report: QualityReport;
}

function buildSummaryMessage(report: QualityReport): string {
  if (report.summary.highAlerts > 0) {
    return "Hay problemas importantes que conviene revisar antes de exportar o compartir estos datos.";
  }

  if (report.summary.mediumAlerts > 0) {
    return "Hay varios datos que conviene normalizar para que el archivo quede más claro y consistente.";
  }

  if (report.summary.lowAlerts > 0) {
    return "Detecté algunos detalles menores. No bloquean el análisis, pero vale la pena revisarlos.";
  }

  return "No detecté problemas de calidad en este archivo.";
}

export default function ChatQualitySummaryCard({
  report,
}: ChatQualitySummaryCardProps) {
  const priorityAlerts = report.alerts
    .filter((alert) => alert.severity !== "low")
    .slice(0, 3);

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b bg-muted/20 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            Resumen visual de alertas
          </h3>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {report.summary.totalAlerts} alerta
            {report.summary.totalAlerts === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {buildSummaryMessage(report)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b bg-background px-4 py-3 md:grid-cols-4">
        <SummaryStat label="Altas" value={report.summary.highAlerts} tone="text-rose-600" />
        <SummaryStat label="Medias" value={report.summary.mediumAlerts} tone="text-amber-600" />
        <SummaryStat label="Bajas" value={report.summary.lowAlerts} tone="text-blue-600" />
        <SummaryStat label="Registros" value={report.totalRows} tone="text-foreground" />
      </div>

      {priorityAlerts.length > 0 && (
        <div className="border-b bg-background px-4 py-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Qué conviene revisar primero
          </p>
          <ol className="space-y-1 text-sm text-foreground">
            {priorityAlerts.map((alert) => (
              <li key={`${alert.severity}-${alert.title}`} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{alert.title}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="space-y-3 px-4 py-4">
        {report.alerts.map((alert, index) => (
          <QualityAlertCard
            key={`${alert.category}-${alert.title}-${index}`}
            alert={alert}
            compact
          />
        ))}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2 text-center">
      <div className={`text-lg font-semibold ${tone}`}>
        {value.toLocaleString("es-MX")}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

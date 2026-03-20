"use client";

import { Button } from "@/components/ui/button";
import {
  getOperationLabel,
  type DataEditPreview,
  type DataEditProposal,
} from "@/lib/data-operations";

interface DataEditProposalCardProps {
  proposal: DataEditProposal;
  isApplied?: boolean;
  isDismissed?: boolean;
  isApplying?: boolean;
  showActions?: boolean;
  onApply: () => void;
  onCancel?: () => void;
}

function PreviewTable({ preview }: { preview: DataEditPreview }) {
  if (preview.sampleRows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        La operación es válida, pero no produciría cambios sobre el dataset actual.
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <div className="overflow-auto max-h-[240px] custom-scrollbar">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-2 py-1.5 font-semibold">Fila</th>
              {preview.previewHeaders.map((header) => (
                <th key={header} className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.sampleRows.map((row) => (
              <tr key={row.row} className="border-b align-top">
                <td className="px-2 py-1.5 font-mono text-muted-foreground">
                  {row.row}
                </td>
                {preview.previewHeaders.map((header) => {
                  const before = row.before[header] ?? "";
                  const after = row.after ? row.after[header] ?? "" : "__DELETE__";

                  return (
                    <td key={`${row.row}-${header}`} className="px-2 py-1.5 min-w-[140px]">
                      <div className="space-y-1">
                        <div className="text-muted-foreground">
                          {before || <span className="italic text-rose-400">vacío</span>}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                          después
                        </div>
                        <div className={after === "__DELETE__" ? "text-rose-600 font-medium" : "text-foreground"}>
                          {after === "__DELETE__" ? (
                            "Se elimina"
                          ) : after ? (
                            after
                          ) : (
                            <span className="italic text-rose-400">vacío</span>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DataEditProposalCard({
  proposal,
  isApplied = false,
  isDismissed = false,
  isApplying = false,
  showActions = true,
  onApply,
  onCancel,
}: DataEditProposalCardProps) {
  return (
    <div className="mt-3 rounded-2xl border bg-card/80 shadow-sm p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Propuesta de corrección
          </p>
          <p className="text-xs text-muted-foreground">
            {proposal.summary.operationCount} operación(es) · {proposal.summary.affectedRows} fila(s) estimadas · {proposal.summary.affectedCells} celda(s) estimadas
          </p>
          <p className="text-xs text-muted-foreground">
            {proposal.summary.columns.length > 0
              ? `Columnas afectadas: ${proposal.summary.columns.join(", ")}`
              : "Afecta filas completas del archivo"}
          </p>
        </div>

        {isApplied ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-medium">
            Propuesta aplicada
          </span>
        ) : isDismissed ? (
          <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-3 py-1 text-xs font-medium">
            Propuesta cancelada
          </span>
        ) : !showActions ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs font-medium">
            Pendiente de decisión
          </span>
        ) : (
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCancel}
                disabled={isApplying}
              >
                Cancelar
              </Button>
            )}
            <Button
              size="sm"
              onClick={onApply}
              disabled={!proposal.canApply || isApplying}
              className="gap-2"
            >
              {isApplying ? "Aplicando..." : "Confirmar y aplicar"}
            </Button>
          </div>
        )}
      </div>

      {!proposal.isValid && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          La propuesta no se puede aplicar completa. Corrige los errores o pide una nueva propuesta al asistente.
        </div>
      )}

      {proposal.operations.map((operation, index) => (
        <div key={`${operation.type}-${index}`} className="rounded-xl border bg-background/70 p-3 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium text-foreground">
                {getOperationLabel(operation.type)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {operation.description || "Sin descripción"}
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-muted text-muted-foreground">
              {operation.type}
            </span>
          </div>

          {operation.preview && (
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-1">
                {operation.preview.affectedRows} fila(s)
              </span>
              <span className="rounded-full bg-muted px-2 py-1">
                {operation.preview.affectedCells} celda(s)
              </span>
              <span className="rounded-full bg-muted px-2 py-1">
                {operation.preview.columns.length > 0
                  ? operation.preview.columns.join(", ")
                  : "Filas completas"}
              </span>
            </div>
          )}

          {operation.errors.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 space-y-1">
              {operation.errors.map((error, errorIndex) => (
                <p key={errorIndex} className="text-xs text-rose-700">
                  {error}
                </p>
              ))}
            </div>
          )}

          {operation.preview && <PreviewTable preview={operation.preview} />}
        </div>
      ))}
    </div>
  );
}

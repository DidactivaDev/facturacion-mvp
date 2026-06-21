"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Bot, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ResponseCard from "./ResponseCard";
import DataEditProposalCard from "./DataEditProposalCard";
import ChatQualitySummaryCard from "./ChatQualitySummaryCard";
import type { ParsedData } from "@/lib/csv-parser";
import type { QualityReport } from "@/lib/data-quality";
import type { ColumnMapping } from "@/lib/column-mapper";
import {
  applyDataEditOperations,
  buildDataEditProposal,
  type DataEditOperation,
} from "@/lib/data-operations";
import { readApiErrorMessage } from "@/lib/api-response";
import { prepareChatRequestBody } from "@/lib/chat-request-body";

type ChatMessageKind = "default" | "auto-analysis";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: ChatMessageKind;
  reportSnapshot?: QualityReport;
}

interface ChatInterfaceProps {
  data: ParsedData;
  report: QualityReport;
  source: string;
  mappings: ColumnMapping[];
  autoPrompt?: boolean;
  onApplyEdits: (data: ParsedData, source: string) => void;
}

const SUGGESTED_QUERIES = [
  {
    label: "Resumen general",
    query: "Dame un resumen general de los datos: cuántas filas hay, cuántas columnas, y los totales principales",
  },
  {
    label: "Top por área",
    query: "Muestra el top 10 de unidades responsables por monto total, con gráfica de barras",
  },
  {
    label: "Campos vacíos",
    query: "¿Qué columnas tienen campos vacíos? Muéstrame cuántos vacíos tiene cada una",
  },
  {
    label: "Duplicados",
    query: "¿Hay registros duplicados en los datos? Identifícalos y muestra cuáles son",
  },
  {
    label: "Estadísticas",
    query: "Dame estadísticas completas de todas las columnas numéricas: suma, promedio, mín, máx",
  },
  {
    label: "Distribución",
    query: "Muestra una gráfica de pastel con la distribución del gasto por las 8 categorías principales",
  },
  {
    label: "Normalizar alertas",
    query: "Revisa las alertas detectadas y propón una corrección segura para normalizar los datos",
  },
  {
    label: "Corregir duplicados",
    query: "Propón una corrección para eliminar duplicados y estandarizar campos problemáticos",
  },
];

const AUTO_PROMPT_QUERY =
  "Resume todas las alertas detectadas en el archivo, explica qué tipos de corrección puedes aplicar y pregunta si deseas que normalice o corrija los datos.";
const AUTO_PROMPT_LOADING_MESSAGE =
  "Estoy analizando tu archivo. Espera un momento.";

function buildCorrectionSourceName(source: string): string {
  return source.endsWith(" (corregido)") ? source : `${source} (corregido)`;
}

function cloneQualityReport(report: QualityReport): QualityReport {
  return JSON.parse(JSON.stringify(report)) as QualityReport;
}

export default function ChatInterface({
  data,
  report,
  source,
  mappings,
  autoPrompt = false,
  onApplyEdits,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [applyingProposalId, setApplyingProposalId] = useState<string | null>(null);
  const [appliedProposalIds, setAppliedProposalIds] = useState<string[]>([]);
  const [dismissedProposalIds, setDismissedProposalIds] = useState<string[]>([]);
  const [normalizingFromCard, setNormalizingFromCard] = useState(false);
  const [normalizedFromCard, setNormalizedFromCard] = useState(false);
  const [dismissedFromCard, setDismissedFromCard] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageIdRef = useRef(0);
  const autoPromptedRef = useRef(false);

  const nextMessageId = useCallback(() => {
    messageIdRef.current += 1;
    return `msg-${messageIdRef.current}`;
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [input]);

  const proposalsByMessage = useMemo(() => {
    const proposals = new Map<string, ReturnType<typeof buildDataEditProposal>>();

    for (const message of messages) {
      if (message.role !== "assistant") continue;
      proposals.set(message.id, buildDataEditProposal(message.content, data));
    }

    return proposals;
  }, [messages, data]);

  const pendingProposalMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== "assistant") continue;
      if (appliedProposalIds.includes(message.id)) continue;
      if (dismissedProposalIds.includes(message.id)) continue;

      const proposal = proposalsByMessage.get(message.id);
      if (proposal?.isValid && proposal.canApply) {
        return message.id;
      }
    }

    return null;
  }, [messages, proposalsByMessage, appliedProposalIds, dismissedProposalIds]);

  const pendingProposal = pendingProposalMessageId
    ? proposalsByMessage.get(pendingProposalMessageId) ?? null
    : null;

  const sendMessage = useCallback(
    async (
      question?: string,
      options?: { showUserMessage?: boolean; autoPrompt?: boolean }
    ) => {
      const showUserMessage = options?.showUserMessage ?? true;
      const autoPromptRequest = options?.autoPrompt ?? false;
      const text = (question || input).trim();
      const effectiveQuestion = text || (autoPromptRequest ? AUTO_PROMPT_QUERY : "");

      if (!effectiveQuestion || isStreaming) return;

      if (!question && showUserMessage) {
        setInput("");
      }

      const assistantInitialContent = autoPromptRequest
        ? AUTO_PROMPT_LOADING_MESSAGE
        : "";
      const assistantMessageId = nextMessageId();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: assistantInitialContent,
        kind: autoPromptRequest ? "auto-analysis" : "default",
        reportSnapshot: autoPromptRequest ? cloneQualityReport(report) : undefined,
      };
      const userMessage = showUserMessage
        ? { id: nextMessageId(), role: "user" as const, content: effectiveQuestion }
        : null;

      // Build trimmed history to avoid context overflow
      const MAX_HISTORY_CONTENT_LENGTH = 500;
      const historyForRequest = messages
        .filter((m) => m.kind !== "auto-analysis") // quality context is already in system prompt
        .map(({ role, content }) => {
          // Strip data-edit blocks from history — they're huge and already applied
          let trimmed = content.replace(/```data-edit[\s\S]*?```/g, "[propuesta de corrección aplicada]");
          if (trimmed.length > MAX_HISTORY_CONTENT_LENGTH) {
            trimmed = trimmed.substring(0, MAX_HISTORY_CONTENT_LENGTH) + "…";
          }
          return { role, content: trimmed };
        });

      if (userMessage) {
        setMessages((prev) => [...prev, userMessage]);
      }

      setIsStreaming(true);
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const { body, headers } = await prepareChatRequestBody({
          question: effectiveQuestion,
          data,
          source,
          mappings,
          qualityReport: report,
          history: historyForRequest,
          autoPrompt: autoPromptRequest,
        });
        const res = await fetch("/api/chat", {
          method: "POST",
          headers,
          body,
        });

        if (!res.ok) {
          throw new Error(await readApiErrorMessage(res));
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No se pudo leer la respuesta");

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;

          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: fullText }
                : message
            )
          );
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Error desconocido";
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: `Error: ${errorMsg}` }
              : message
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [input, isStreaming, data, source, mappings, report, messages, nextMessageId]
  );

  useEffect(() => {
    if (!autoPrompt || autoPromptedRef.current) return;
    autoPromptedRef.current = true;
    void sendMessage(AUTO_PROMPT_QUERY, {
      showUserMessage: false,
      autoPrompt: true,
    });
  }, [autoPrompt, sendMessage]);

  const handleApplyProposal = useCallback(
    (messageId: string) => {
      const proposal = proposalsByMessage.get(messageId);
      if (!proposal || !proposal.canApply || !proposal.isValid) return;

      const operations = proposal.operations
        .map((operation) => operation.operation)
        .filter(
          (operation): operation is DataEditOperation =>
            operation !== null &&
            operation.type !== "add_column" &&
            operation.type !== "unknown"
        );

      setApplyingProposalId(messageId);

      try {
        const result = applyDataEditOperations(data, operations);
        const nextSource = buildCorrectionSourceName(source);
            onApplyEdits(result.data, nextSource);
        setAppliedProposalIds((prev) => uniqueIds([...prev, messageId]));

        const summaryMessage = [
          "Listo. Ya apliqué la propuesta de corrección al dataset activo.",
          "",
          `- Operaciones aplicadas: ${result.summary.operationCount}`,
          `- Filas afectadas: ${result.summary.affectedRows}`,
          `- Celdas afectadas: ${result.summary.affectedCells}`,
          result.summary.columns.length > 0
            ? `- Columnas impactadas: ${result.summary.columns.join(", ")}`
            : "- Se afectaron filas completas del archivo",
          "",
          "Ya puedes revisar las alertas recalculadas y descargar el archivo corregido desde la vista de datos.",
        ].join("\n");

        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: "assistant",
            content: summaryMessage,
          },
        ]);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "No se pudo aplicar la propuesta.";

        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: "assistant",
            content: `No pude aplicar la propuesta: ${errorMessage}`,
          },
        ]);
      } finally {
        setApplyingProposalId(null);
      }
    },
    [proposalsByMessage, data, source, onApplyEdits, nextMessageId]
  );

  const handleDismissProposal = useCallback(
    (messageId: string) => {
      setDismissedProposalIds((prev) => uniqueIds([...prev, messageId]));
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: "assistant",
          content:
            "Entendido. Dejé esa propuesta sin aplicar. Si quieres, puedo preparar otra opción o ajustar la corrección.",
        },
      ]);
    },
    [nextMessageId]
  );

  const handleNormalizeFromCard = useCallback(() => {
    setNormalizingFromCard(true);
    void sendMessage("Sí, normalizar los datos", { showUserMessage: true }).finally(() => {
      setNormalizingFromCard(false);
      setNormalizedFromCard(true);
    });
  }, [sendMessage]);

  const handleDismissFromCard = useCallback(() => {
    setDismissedFromCard(true);
  }, []);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col bg-card rounded-xl border shadow-sm overflow-hidden" style={{ height: "calc(100vh - 20rem)", minHeight: "500px" }}>
      <div className="flex items-center gap-2 px-5 py-3 border-b bg-muted/20">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-sm font-medium">Asistente de datos</span>
        {messages.length > 0 && (
          <button
            onClick={() => {
              setMessages([]);
              setAppliedProposalIds([]);
              setDismissedProposalIds([]);
            }}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpiar chat
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9f2241]/10 to-[#235b4e]/10 mb-2">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Pregunta sobre tus datos</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Analizo {data.totalRows} registros con {data.headers.length} campos.
                {report.summary.totalAlerts > 0
                  ? ` También detecté ${report.summary.totalAlerts} alerta(s) de calidad y puedo proponer correcciones seguras.`
                  : " Puedo calcular totales, encontrar patrones y detectar anomalías."}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full max-w-2xl">
              {SUGGESTED_QUERIES.map((sq) => (
                <button
                  key={sq.label}
                  onClick={() => sendMessage(sq.query)}
                  className="text-left px-3 py-2.5 rounded-xl border bg-background hover:bg-accent hover:border-primary/30 transition-all text-xs group"
                >
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {sq.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const proposal = msg.role === "assistant" ? proposalsByMessage.get(msg.id) : null;
              const isApplied = appliedProposalIds.includes(msg.id);

              return (
                <div key={msg.id} className="space-y-2">
                  <ResponseCard
                    role={msg.role}
                    content={msg.content}
                    isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id && msg.role === "assistant"}
                  />

                  {msg.role === "assistant" &&
                    msg.kind === "auto-analysis" &&
                    msg.reportSnapshot && (
                      <div className="pl-10">
                        <ChatQualitySummaryCard report={msg.reportSnapshot} />
                      </div>
                    )}

                  {msg.role === "assistant" && proposal && (
                    <div className="pl-10">
                      <DataEditProposalCard
                        proposal={proposal}
                        isApplied={isApplied}
                        isDismissed={dismissedProposalIds.includes(msg.id)}
                        isApplying={applyingProposalId === msg.id}
                        onApply={() => handleApplyProposal(msg.id)}
                        onCancel={() => handleDismissProposal(msg.id)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t bg-muted/10 p-4">
        {/* Normalize action bar */}
        {!normalizedFromCard && !dismissedFromCard && !pendingProposal && !isStreaming && messages.some((m) => m.kind === "auto-analysis" && m.reportSnapshot?.alerts.some((a) => a.category === "catalog")) && (
          <div className="max-w-3xl mx-auto mb-3 rounded-xl border bg-gradient-to-r from-primary/5 to-[#235b4e]/5 border-primary/20 px-4 py-3 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  ¿Quieres que normalice los datos?
                </p>
                <p className="text-xs text-muted-foreground">
                  Puedo corregir automáticamente los valores fuera de catálogo con cambios seguros.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismissFromCard}
                  disabled={normalizingFromCard}
                  className="gap-1.5 text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  No, gracias
                </Button>
                <Button
                  size="sm"
                  onClick={handleNormalizeFromCard}
                  disabled={normalizingFromCard}
                  className="gap-1.5"
                >
                  {normalizingFromCard ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generando propuesta...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Sí, normalizar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {pendingProposal && pendingProposalMessageId && (
          <div className="max-w-3xl mx-auto mb-3 rounded-xl border bg-background px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Hay una propuesta lista para aplicar
                </p>
                <p className="text-xs text-muted-foreground">
                  {pendingProposal.summary.operationCount} operación(es) · {pendingProposal.summary.affectedRows} fila(s) · {pendingProposal.summary.affectedCells} celda(s)
                </p>
                <p className="text-xs text-muted-foreground">
                  {pendingProposal.summary.columns.length > 0
                    ? `Columnas: ${pendingProposal.summary.columns.join(", ")}`
                    : "Afecta filas completas del archivo"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleDismissProposal(pendingProposalMessageId)}
                  disabled={applyingProposalId === pendingProposalMessageId}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => handleApplyProposal(pendingProposalMessageId)}
                  disabled={
                    !pendingProposal.canApply ||
                    applyingProposalId === pendingProposalMessageId
                  }
                >
                  {applyingProposalId === pendingProposalMessageId
                    ? "Aplicando..."
                    : "Aceptar y aplicar"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              placeholder="Escribe tu pregunta o pide una corrección sobre los datos..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              className="w-full resize-none rounded-xl border bg-background px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/60"
            />
          </div>
          <Button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-11 w-11 rounded-xl shrink-0"
          >
            {isStreaming ? (
              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
              </svg>
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
          Enter para enviar &middot; Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}

function uniqueIds(values: string[]): string[] {
  return Array.from(new Set(values));
}

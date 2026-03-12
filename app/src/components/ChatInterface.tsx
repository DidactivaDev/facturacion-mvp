"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import ResponseCard from "./ResponseCard";
import type { ParsedData } from "@/lib/csv-parser";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  data: ParsedData;
}

const SUGGESTED_QUERIES = [
  {
    label: "Resumen general",
    query: "Dame un resumen general de los datos: cuántas filas hay, cuántas columnas, y los totales principales",
  },
  {
    label: "📊 Top por área",
    query: "Muestra el top 10 de unidades responsables por monto total, con gráfica de barras",
  },
  {
    label: "⚠️ Campos vacíos",
    query: "¿Qué columnas tienen campos vacíos? Muéstrame cuántos vacíos tiene cada una",
  },
  {
    label: "🔁 Duplicados",
    query: "¿Hay registros duplicados en los datos? Identifícalos y muestra cuáles son",
  },
  {
    label: "📈 Estadísticas",
    query: "Dame estadísticas completas de todas las columnas numéricas: suma, promedio, mín, máx",
  },
  {
    label: "🥧 Distribución",
    query: "Muestra una gráfica de pastel con la distribución del gasto por las 8 categorías principales",
  },
  {
    label: "🔢 Conteos",
    query: "¿Cuántos valores únicos hay en cada columna? Ordena de mayor a menor",
  },
  {
    label: "📉 Outliers",
    query: "¿Hay valores atípicos o outliers en las columnas numéricas? Identifícalos",
  },
];

export default function ChatInterface({ data }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [input]);

  const sendMessage = useCallback(
    async (question?: string) => {
      const text = (question || input).trim();
      if (!text || isStreaming) return;

      if (!question) setInput("");
      const userMessage: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: text,
            data,
            history: messages,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error del servidor");
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

          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: fullText,
            };
            return updated;
          });
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Error desconocido";
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `Error: ${errorMsg}`,
          };
          return updated;
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [input, isStreaming, data, messages]
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col bg-card rounded-xl border shadow-sm overflow-hidden" style={{ height: "calc(100vh - 20rem)" , minHeight: "500px" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b bg-muted/20">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-sm font-medium">Asistente de datos</span>
        <span className="text-xs text-muted-foreground">
          &middot; GPT-4o mini
        </span>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpiar chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-primary">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Pregunta sobre tus datos</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Analizo {data.totalRows} registros con {data.headers.length} campos.
                Puedo calcular totales, encontrar patrones y detectar anomalias.
              </p>
            </div>

            {/* Quick queries */}
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
            {messages.map((msg, i) => (
              <ResponseCard
                key={i}
                role={msg.role}
                content={msg.content}
                isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t bg-muted/10 p-4">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              placeholder="Escribe tu pregunta sobre los datos..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              className="w-full resize-none rounded-xl border bg-background px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/60"
            />
          </div>
          <Button
            onClick={() => sendMessage()}
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
          Enter para enviar &middot; Shift+Enter para nueva linea
        </p>
      </div>
    </div>
  );
}

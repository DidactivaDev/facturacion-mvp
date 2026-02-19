"use client";

import { useState, useCallback } from "react";
import FileUploader from "@/components/FileUploader";
import DataPreview from "@/components/DataPreview";
import ChatInterface from "@/components/ChatInterface";
import KPIDashboard from "@/components/KPIDashboard";
import type { ParsedData } from "@/lib/csv-parser";

export default function Home() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [source, setSource] = useState<string>("");

  const handleDataLoaded = useCallback((parsed: ParsedData, src: string) => {
    setData(parsed);
    setSource(src);
  }, []);

  const handleClear = useCallback(() => {
    setData(null);
    setSource("");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-none">
                Consulta de Facturacion
              </h1>
              <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
                Analisis inteligente de datos
              </p>
            </div>
          </div>
          {data && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {data.totalRows} registros cargados
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto max-w-6xl px-4 py-6">
        {!data ? (
          /* Upload state */
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
            <div className="text-center mb-8 space-y-3">
              <h2 className="text-2xl font-bold tracking-tight">
                Analiza tus datos de facturacion
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Carga un archivo CSV o conecta un Google Sheet para hacer
                consultas en lenguaje natural con inteligencia artificial
              </p>
            </div>
            <FileUploader onDataLoaded={handleDataLoaded} />
          </div>
        ) : (
          /* Data loaded state */
          <div className="space-y-4">
            {/* KPI Cards */}
            <KPIDashboard data={data} />

            {/* Collapsible data preview */}
            <DataPreview data={data} source={source} onClear={handleClear} />

            {/* Chat */}
            <ChatInterface data={data} />
          </div>
        )}
      </main>
    </div>
  );
}

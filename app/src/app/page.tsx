"use client";

import { useState, useCallback, useMemo } from "react";
import FileUploader from "@/components/FileUploader";
import DataPreview from "@/components/DataPreview";
import ChatInterface from "@/components/ChatInterface";
import KPIDashboard from "@/components/KPIDashboard";
import QualityReportView from "@/components/QualityReport";
import ColumnMapperView from "@/components/ColumnMapper";
import StandardExporter from "@/components/StandardExporter";
import type { ParsedData } from "@/lib/csv-parser";
import { autoMapColumns, type ColumnMapping } from "@/lib/column-mapper";
import { analyzeQuality, type QualityReport } from "@/lib/data-quality";

type Tab = "data" | "quality" | "standard" | "chat";

export default function Home() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [source, setSource] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("quality");
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [report, setReport] = useState<QualityReport | null>(null);

  const handleDataLoaded = useCallback((parsed: ParsedData, src: string) => {
    setData(parsed);
    setSource(src);

    // Auto-mapeo
    const autoMappings = autoMapColumns(parsed.headers);
    setMappings(autoMappings);

    // Análisis de calidad
    const qualityReport = analyzeQuality(parsed, autoMappings, src);
    setReport(qualityReport);

    // Si hay alertas altas, mostrar calidad primero; si no, mostrar datos
    setActiveTab(qualityReport.summary.highAlerts > 0 ? "quality" : "data");
  }, []);

  const handleClear = useCallback(() => {
    setData(null);
    setSource("");
    setMappings([]);
    setReport(null);
    setActiveTab("quality");
  }, []);

  const handleMappingsChange = useCallback(
    (newMappings: ColumnMapping[]) => {
      setMappings(newMappings);
      // Recalcular calidad con el nuevo mapeo
      if (data) {
        const newReport = analyzeQuality(data, newMappings, source);
        setReport(newReport);
      }
    },
    [data, source]
  );

  const tabs: { id: Tab; label: string; badge?: string }[] = useMemo(() => {
    return [
      { id: "data" as Tab, label: "Datos" },
      {
        id: "quality" as Tab,
        label: "Calidad",
        badge: report
          ? report.summary.highAlerts > 0
            ? `${report.summary.highAlerts}`
            : report.summary.totalAlerts > 0
            ? `${report.summary.totalAlerts}`
            : "✓"
          : undefined,
      },
      {
        id: "standard" as Tab,
        label: "Estándar CCINSHAE",
        badge:
          mappings.length > 0
            ? `${mappings.filter((m) => m.sourceColumn !== null).length}/${mappings.length}`
            : undefined,
      },
      { id: "chat" as Tab, label: "Chat IA" },
    ];
  }, [report, mappings]);

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
                CCINSHAE
              </h1>
              <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
                Agente de análisis de precisión de gastos
              </p>
            </div>
          </div>
          {data && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {data.totalRows} registros · {source}
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
                Analiza los datos de las precisiones de gastos
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Carga un archivo CSV, Excel o conecta un Google Sheet para
                analizar calidad, estandarizar al formato CCINSHAE y consultar
                con inteligencia artificial
              </p>
            </div>
            <FileUploader onDataLoaded={handleDataLoaded} />
          </div>
        ) : (
          /* Data loaded state */
          <div className="space-y-4">
            {/* KPI Cards */}
            <KPIDashboard data={data} />

            {/* Tabs */}
            <div className="border-b">
              <nav className="flex gap-1" aria-label="Tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
                      activeTab === tab.id
                        ? "text-primary bg-card border border-b-0 border-border -mb-px"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {tab.label}
                      {tab.badge && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            activeTab === tab.id
                              ? "bg-primary/10 text-primary"
                              : tab.id === "quality" &&
                                report &&
                                report.summary.highAlerts > 0
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab content */}
            <div className="min-h-[400px]">
              {activeTab === "data" && (
                <DataPreview
                  data={data}
                  source={source}
                  onClear={handleClear}
                />
              )}

              {activeTab === "quality" && report && (
                <QualityReportView report={report} />
              )}

              {activeTab === "standard" && report && (
                <div className="space-y-6">
                  <div className="rounded-xl border bg-card p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      Mapeo de columnas
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Revisa y ajusta cómo se mapean las columnas de tu archivo
                      al estándar CCINSHAE v0. El auto-mapeo ya sugirió
                      coincidencias.
                    </p>
                    <ColumnMapperView
                      mappings={mappings}
                      sourceHeaders={data.headers}
                      onMappingsChange={handleMappingsChange}
                    />
                  </div>

                  <StandardExporter
                    data={data}
                    mappings={mappings}
                    report={report}
                    source={source}
                  />
                </div>
              )}

              {activeTab === "chat" && <ChatInterface data={data} />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

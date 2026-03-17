"use client";

import { useState, useMemo } from "react";
import type { ColumnMapping } from "@/lib/column-mapper";

interface ColumnMapperViewProps {
  mappings: ColumnMapping[];
  sourceHeaders: string[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
}

const matchMethodLabels: Record<string, string> = {
  exact: "Exacto",
  alias: "Alias",
  fuzzy: "Similitud",
  none: "Sin mapeo",
};

const matchMethodColors: Record<string, string> = {
  exact: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  alias: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  fuzzy: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  none: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
};

export default function ColumnMapperView({
  mappings,
  sourceHeaders,
  onMappingsChange,
}: ColumnMapperViewProps) {
  const [filter, setFilter] = useState<"all" | "mapped" | "unmapped">("all");

  const filtered = useMemo(() => {
    if (filter === "mapped") return mappings.filter((m) => m.sourceColumn !== null);
    if (filter === "unmapped") return mappings.filter((m) => m.sourceColumn === null);
    return mappings;
  }, [mappings, filter]);

  const summary = useMemo(() => {
    const mapped = mappings.filter((m) => m.sourceColumn !== null).length;
    const unmapped = mappings.filter((m) => m.sourceColumn === null).length;
    const requiredUnmapped = mappings.filter(
      (m) => m.sourceColumn === null && m.required
    ).length;
    return { mapped, unmapped, requiredUnmapped };
  }, [mappings]);

  const handleSourceChange = (standardField: string, value: string) => {
    const updated = mappings.map((m) => {
      if (m.standardField !== standardField) return m;
      if (value === "") {
        return { ...m, sourceColumn: null, matchMethod: "none" as const, confidence: 0 };
      }
      return { ...m, sourceColumn: value, matchMethod: "exact" as const, confidence: 1 };
    });
    onMappingsChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground">
            {summary.mapped} mapeadas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span className="text-xs text-muted-foreground">
            {summary.unmapped} sin mapeo
            {summary.requiredUnmapped > 0 && (
              <span className="text-rose-600 font-medium">
                {" "}({summary.requiredUnmapped} obligatorias)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1">
        {(["all", "mapped", "unmapped"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {f === "all" ? "Todas" : f === "mapped" ? "Mapeadas" : "Sin mapeo"}
            {" "}
            ({f === "all"
              ? mappings.length
              : f === "mapped"
              ? summary.mapped
              : summary.unmapped})
          </button>
        ))}
      </div>

      {/* Mapping table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-auto max-h-[500px] custom-scrollbar">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30 sticky top-0 z-10">
                <th className="text-left px-3 py-2.5 font-semibold w-[40%]">
                  Campo estándar
                </th>
                <th className="text-left px-3 py-2.5 font-semibold w-[35%]">
                  Columna fuente
                </th>
                <th className="text-center px-3 py-2.5 font-semibold w-[25%]">
                  Match
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((mapping) => (
                <tr
                  key={mapping.standardField}
                  className={`border-b hover:bg-muted/20 ${
                    mapping.sourceColumn === null && mapping.required
                      ? "bg-rose-500/5"
                      : ""
                  }`}
                >
                  {/* Standard field name */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate max-w-[250px]" title={mapping.standardField}>
                        {mapping.standardField}
                      </span>
                      {mapping.required && (
                        <span className="text-rose-500 text-[10px] font-bold shrink-0">*</span>
                      )}
                    </div>
                  </td>

                  {/* Source column selector */}
                  <td className="px-3 py-2.5">
                    <select
                      value={mapping.sourceColumn || ""}
                      onChange={(e) =>
                        handleSourceChange(mapping.standardField, e.target.value)
                      }
                      className={`w-full text-xs rounded-md border px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                        mapping.sourceColumn === null
                          ? "border-rose-300 dark:border-rose-800"
                          : "border-border"
                      }`}
                    >
                      <option value="">— Sin mapeo —</option>
                      {sourceHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Match method */}
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        matchMethodColors[mapping.matchMethod]
                      }`}
                    >
                      {matchMethodLabels[mapping.matchMethod]}
                      {mapping.confidence > 0 &&
                        mapping.matchMethod === "fuzzy" &&
                        ` ${Math.round(mapping.confidence * 100)}%`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/60">
        <span className="text-rose-500 font-bold">*</span> Campo obligatorio en
        el estándar CCINSHAE. Puedes ajustar cualquier mapeo manualmente con los
        selectores.
      </p>
    </div>
  );
}

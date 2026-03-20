/**
 * Data Quality Engine — Análisis de calidad de datos
 *
 * Ejecuta validaciones sobre un ParsedData y genera un reporte
 * con alertas priorizadas y recomendaciones accionables.
 */

import type { ParsedData } from "./csv-parser";
import {
  DEFAULT_DUPLICATE_KEYS,
  getRequiredFields,
  getCatalogFields,
} from "./standard-schema";
import type { ColumnMapping } from "./column-mapper";

// ─── Types ──────────────────────────────────────────────

export type AlertSeverity = "high" | "medium" | "low";

export interface QualityAlert {
  severity: AlertSeverity;
  category: "missing_column" | "nulls" | "duplicates" | "catalog" | "stats";
  title: string;
  description: string;
  affectedRows?: number;
  recommendation: string;
  /** Datos de detalle para mostrar en tabla expandible */
  details?: {
    /** Encabezados de la tabla de detalle */
    headers: string[];
    /** Filas de ejemplo (máximo ~50) */
    rows: string[][];
    /** Etiqueta del botón para expandir */
    label: string;
  };
}

export interface ColumnStats {
  column: string;
  totalRows: number;
  nullCount: number;
  nullPercent: number;
  uniqueCount: number;
  topValues: { value: string; count: number }[];
  isNumeric: boolean;
  min?: number;
  max?: number;
  sum?: number;
}

export interface QualityReport {
  /** Timestamp del análisis */
  timestamp: string;
  /** Nombre del archivo fuente */
  source: string;
  /** Total de filas analizadas */
  totalRows: number;
  /** Total de columnas en el fuente */
  totalColumns: number;
  /** Alertas priorizadas */
  alerts: QualityAlert[];
  /** Estadísticas por columna */
  columnStats: ColumnStats[];
  /** Resumen de conteos */
  summary: {
    highAlerts: number;
    mediumAlerts: number;
    lowAlerts: number;
    totalAlerts: number;
  };
}

// ─── Main Analysis ──────────────────────────────────────

/**
 * Ejecuta el análisis completo de calidad sobre los datos.
 */
export function analyzeQuality(
  data: ParsedData,
  mappings: ColumnMapping[],
  source: string,
  duplicateKeys?: string[]
): QualityReport {
  const alerts: QualityAlert[] = [];

  // 1. Columnas faltantes vs el estándar
  alerts.push(...checkMissingColumns(mappings));

  // 2. Nulos en campos obligatorios
  alerts.push(...checkNulls(data, mappings));

  // 3. Duplicados
  alerts.push(
    ...checkDuplicates(data, mappings, duplicateKeys || DEFAULT_DUPLICATE_KEYS)
  );

  // 4. Valores fuera de catálogo
  alerts.push(...checkCatalogValues(data, mappings));

  // 5. Estadísticas por columna
  const columnStats = computeColumnStats(data);

  // 6. Alertas informativas basadas en stats
  alerts.push(...generateStatsAlerts(columnStats, data.totalRows));

  // Ordenar: high primero, luego medium, luego low
  const severityOrder: Record<AlertSeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const highAlerts = alerts.filter((a) => a.severity === "high").length;
  const mediumAlerts = alerts.filter((a) => a.severity === "medium").length;
  const lowAlerts = alerts.filter((a) => a.severity === "low").length;

  return {
    timestamp: new Date().toISOString(),
    source,
    totalRows: data.totalRows,
    totalColumns: data.headers.length,
    alerts,
    columnStats,
    summary: {
      highAlerts,
      mediumAlerts,
      lowAlerts,
      totalAlerts: alerts.length,
    },
  };
}

// ─── Check: Missing Columns ────────────────────────────

function checkMissingColumns(mappings: ColumnMapping[]): QualityAlert[] {
  const alerts: QualityAlert[] = [];
  const unmapped = mappings.filter((m) => m.sourceColumn === null);

  const requiredUnmapped = unmapped.filter((m) => m.required);
  const optionalUnmapped = unmapped.filter((m) => !m.required);

  if (requiredUnmapped.length > 0) {
    alerts.push({
      severity: "high",
      category: "missing_column",
      title: `${requiredUnmapped.length} columna(s) obligatoria(s) sin mapeo`,
      description: `Campos obligatorios no encontrados: ${requiredUnmapped.map((m) => m.standardField).join(", ")}`,
      recommendation:
        "Revisa el mapeo de columnas y asigna manualmente los campos faltantes, o verifica que el archivo fuente contenga esta información.",
    });
  }

  if (optionalUnmapped.length > 0) {
    alerts.push({
      severity: "low",
      category: "missing_column",
      title: `${optionalUnmapped.length} columna(s) opcional(es) sin mapeo`,
      description: `Campos opcionales no encontrados: ${optionalUnmapped.map((m) => m.standardField).join(", ")}`,
      recommendation:
        "Estos campos son opcionales. Quedarán vacíos en la exportación estándar.",
    });
  }

  return alerts;
}

// ─── Check: Nulls in Required Fields ───────────────────

function checkNulls(
  data: ParsedData,
  mappings: ColumnMapping[]
): QualityAlert[] {
  const alerts: QualityAlert[] = [];
  const requiredFields = getRequiredFields();

  for (const field of requiredFields) {
    const mapping = mappings.find((m) => m.standardField === field.name);
    if (!mapping?.sourceColumn) continue; // si no está mapeado, ya lo reportó checkMissingColumns

    const sourceCol = mapping.sourceColumn;
    const nullCount = data.rows.filter((row) => {
      const val = row[sourceCol];
      return val === undefined || val === null || val.toString().trim() === "";
    }).length;

    if (nullCount > 0) {
      const pct = ((nullCount / data.totalRows) * 100).toFixed(1);

      // Recopilar filas afectadas (máx 50) con algunas columnas de contexto
      const contextCols = [sourceCol, ...data.headers.filter((h) => h !== sourceCol).slice(0, 3)];
      const detailRows: string[][] = [];
      let rowIdx = 0;
      for (const row of data.rows) {
        rowIdx++;
        const val = row[sourceCol];
        if (val === undefined || val === null || val.toString().trim() === "") {
          if (detailRows.length < 50) {
            detailRows.push([String(rowIdx), ...contextCols.map((c) => (row[c] || "").toString())]);
          }
        }
      }

      alerts.push({
        severity: nullCount > data.totalRows * 0.1 ? "high" : "medium",
        category: "nulls",
        title: `${nullCount} valor(es) vacío(s) en "${field.name}"`,
        description: `El campo obligatorio "${field.name}" (fuente: "${sourceCol}") tiene ${nullCount} filas sin valor (${pct}%).`,
        affectedRows: nullCount,
        recommendation: `Completa los valores faltantes en la columna "${sourceCol}" antes de exportar.`,
        details: {
          headers: ["Fila", ...contextCols],
          rows: detailRows,
          label: `Ver ${Math.min(nullCount, 50)} filas con valores vacíos`,
        },
      });
    }
  }

  return alerts;
}

// ─── Check: Duplicates ─────────────────────────────────

function checkDuplicates(
  data: ParsedData,
  mappings: ColumnMapping[],
  keys: string[]
): QualityAlert[] {
  const alerts: QualityAlert[] = [];

  // Resolver las columnas fuente para las llaves de duplicados
  const resolvedKeys: { standard: string; source: string }[] = [];
  for (const key of keys) {
    const mapping = mappings.find((m) => m.standardField === key);
    if (mapping?.sourceColumn) {
      resolvedKeys.push({ standard: key, source: mapping.sourceColumn });
    }
  }

  if (resolvedKeys.length === 0) {
    alerts.push({
      severity: "low",
      category: "duplicates",
      title: "No se pudo verificar duplicados",
      description: `Las llaves para detección de duplicados (${keys.join(", ")}) no están mapeadas a columnas del archivo fuente.`,
      recommendation:
        "Asigna las columnas correspondientes en el mapeo para habilitar la detección de duplicados.",
    });
    return alerts;
  }

  // Contar duplicados
  const seen = new Map<string, number>();
  for (const row of data.rows) {
    const keyValue = resolvedKeys
      .map((k) => (row[k.source] || "").toString().trim().toLowerCase())
      .join("|");
    seen.set(keyValue, (seen.get(keyValue) || 0) + 1);
  }

  const duplicates = Array.from(seen.entries()).filter(([, count]) => count > 1);
  const totalDupRows = duplicates.reduce((sum, [, count]) => sum + count, 0);

  if (duplicates.length > 0) {
    // Construir tabla de detalle con los grupos duplicados y sus filas
    const extraCols = data.headers
      .filter((h) => !resolvedKeys.some((k) => k.source === h))
      .slice(0, 3);
    const detailHeaders = ["Fila", ...resolvedKeys.map((k) => k.standard), ...extraCols, "Repeticiones"];
    const detailRows: string[][] = [];

    // Para cada grupo de duplicados, encontrar las filas correspondientes
    const dupKeySet = new Map(duplicates);
    let rowIdx = 0;
    const groupRows = new Map<string, number[]>();
    for (const row of data.rows) {
      rowIdx++;
      const keyValue = resolvedKeys
        .map((k) => (row[k.source] || "").toString().trim().toLowerCase())
        .join("|");
      if (dupKeySet.has(keyValue)) {
        if (!groupRows.has(keyValue)) groupRows.set(keyValue, []);
        groupRows.get(keyValue)!.push(rowIdx);
      }
    }

    for (const [keyValue, count] of duplicates.slice(0, 20)) {
      const rowNums = groupRows.get(keyValue) || [];
      const keyParts = keyValue.split("|");
      // Show first row from each duplicate group
      const firstRowIdx = rowNums[0] - 1;
      const firstRow = firstRowIdx >= 0 ? data.rows[firstRowIdx] : null;
      detailRows.push([
        rowNums.slice(0, 5).join(", ") + (rowNums.length > 5 ? "..." : ""),
        ...keyParts,
        ...extraCols.map((c) => firstRow ? (firstRow[c] || "").toString() : ""),
        String(count),
      ]);
    }

    alerts.push({
      severity: "high",
      category: "duplicates",
      title: `${duplicates.length} grupo(s) de duplicados detectados`,
      description: `Se encontraron ${duplicates.length} combinaciones duplicadas de (${resolvedKeys.map((k) => k.standard).join(" + ")}), afectando ${totalDupRows} filas en total.`,
      affectedRows: totalDupRows,
      recommendation:
        "Revisa los registros duplicados y elimina o consolida las filas redundantes.",
      details: {
        headers: detailHeaders,
        rows: detailRows,
        label: `Ver ${Math.min(duplicates.length, 20)} grupos duplicados`,
      },
    });
  }

  return alerts;
}

// ─── Check: Catalog Values ─────────────────────────────

function checkCatalogValues(
  data: ParsedData,
  mappings: ColumnMapping[]
): QualityAlert[] {
  const alerts: QualityAlert[] = [];
  const catalogFields = getCatalogFields();

  for (const field of catalogFields) {
    if (!field.catalog) continue;

    const mapping = mappings.find((m) => m.standardField === field.name);
    if (!mapping?.sourceColumn) continue;

    const sourceCol = mapping.sourceColumn;
    const normalizedCatalog = field.catalog.map((v) =>
      v.toLowerCase().trim()
    );

    const invalidRows: { row: number; value: string }[] = [];
    for (let i = 0; i < data.rows.length; i++) {
      const val = (data.rows[i][sourceCol] || "").toString().trim();
      if (val === "") continue; // vacíos se manejan en checkNulls

      if (!normalizedCatalog.includes(val.toLowerCase())) {
        invalidRows.push({ row: i + 1, value: val });
      }
    }

    if (invalidRows.length > 0) {
      const uniqueInvalid = [...new Set(invalidRows.map((r) => r.value))];

      // Tabla de detalle: filas con valores fuera de catálogo
      const extraCols = data.headers
        .filter((h) => h !== sourceCol)
        .slice(0, 2);
      const detailHeaders = ["Fila", sourceCol, ...extraCols, "Valor esperado"];
      const detailRows: string[][] = [];
      for (const inv of invalidRows.slice(0, 50)) {
        const row = data.rows[inv.row - 1];
        detailRows.push([
          String(inv.row),
          inv.value,
          ...extraCols.map((c) => row ? (row[c] || "").toString() : ""),
          field.catalog!.join(" / "),
        ]);
      }

      alerts.push({
        severity: "medium",
        category: "catalog",
        title: `${invalidRows.length} valor(es) fuera de catálogo en "${field.name}"`,
        description: `Valores no reconocidos: ${uniqueInvalid.slice(0, 5).map((v) => `"${v}"`).join(", ")}${uniqueInvalid.length > 5 ? ` y ${uniqueInvalid.length - 5} más` : ""}. Valores válidos: ${field.catalog.join(", ")}.`,
        affectedRows: invalidRows.length,
        recommendation: `Normaliza los valores a las opciones del catálogo: ${field.catalog.join(", ")}.`,
        details: {
          headers: detailHeaders,
          rows: detailRows,
          label: `Ver ${Math.min(invalidRows.length, 50)} filas con valores inválidos`,
        },
      });
    }
  }

  return alerts;
}

// ─── Column Stats ──────────────────────────────────────

function computeColumnStats(data: ParsedData): ColumnStats[] {
  return data.headers.map((col) => {
    const values = data.rows.map((r) => r[col]);
    const nonEmpty = values.filter(
      (v) => v !== undefined && v !== null && v.toString().trim() !== ""
    );
    const nullCount = data.totalRows - nonEmpty.length;

    const uniqueValues = new Set(nonEmpty.map((v) => v.toString().trim()));

    // Top values
    const counts: Record<string, number> = {};
    for (const v of nonEmpty) {
      const key = v.toString().trim();
      counts[key] = (counts[key] || 0) + 1;
    }
    const topValues = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }));

    // Check if numeric
    const numericValues = nonEmpty
      .map((v) => parseFloat(v.toString()))
      .filter((n) => !isNaN(n));
    const isNumeric = numericValues.length > nonEmpty.length * 0.7;

    const stats: ColumnStats = {
      column: col,
      totalRows: data.totalRows,
      nullCount,
      nullPercent: data.totalRows > 0
        ? Math.round((nullCount / data.totalRows) * 1000) / 10
        : 0,
      uniqueCount: uniqueValues.size,
      topValues,
      isNumeric,
    };

    if (isNumeric && numericValues.length > 0) {
      stats.min = Math.min(...numericValues);
      stats.max = Math.max(...numericValues);
      stats.sum = numericValues.reduce((a, b) => a + b, 0);
    }

    return stats;
  });
}

// ─── Stats-based Alerts ────────────────────────────────

function generateStatsAlerts(
  stats: ColumnStats[],
  totalRows: number
): QualityAlert[] {
  const alerts: QualityAlert[] = [];

  // Columnas con muchos nulos (>50%)
  for (const s of stats) {
    if (s.nullPercent > 50 && s.nullCount > 0) {
      alerts.push({
        severity: "low",
        category: "stats",
        title: `Columna "${s.column}" mayormente vacía`,
        description: `${s.nullPercent}% de valores vacíos (${s.nullCount} de ${totalRows} filas).`,
        affectedRows: s.nullCount,
        recommendation:
          "Evalúa si esta columna es necesaria o si los datos deben completarse.",
      });
    }
  }

  // Columnas con un solo valor único (posible constante)
  for (const s of stats) {
    if (
      s.uniqueCount === 1 &&
      s.nullCount === 0 &&
      totalRows > 5
    ) {
      alerts.push({
        severity: "low",
        category: "stats",
        title: `Columna "${s.column}" tiene un solo valor`,
        description: `Todas las filas tienen el valor "${s.topValues[0]?.value}". Podría ser un campo constante.`,
        recommendation:
          "Verifica que este dato sea correcto y no resultado de un error de llenado.",
      });
    }
  }

  return alerts;
}

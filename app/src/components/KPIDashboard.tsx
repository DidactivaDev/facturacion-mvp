"use client";

import type { ParsedData } from "@/lib/csv-parser";

interface KPIDashboardProps {
  data: ParsedData;
}

interface KPI {
  label: string;
  value: string;
  detail?: string;
  color: "blue" | "green" | "amber" | "red";
}

/* ─────────── Normalización para fuzzy matching ─────────── */

function norm(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[_\-()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca la primera columna cuyo nombre normalizado **contenga** alguno de los
 * patrones dados, o que coincida exactamente con alguno de ellos.
 * Devuelve el nombre original de la columna (como está en headers) o null.
 */
function findColumn(
  headers: string[],
  patterns: string[]
): string | null {
  const normedPatterns = patterns.map(norm);

  // 1) Exact match normalizado
  for (const h of headers) {
    const nh = norm(h);
    for (const p of normedPatterns) {
      if (nh === p) return h;
    }
  }

  // 2) Contains match — el header contiene el patrón
  for (const h of headers) {
    const nh = norm(h);
    for (const p of normedPatterns) {
      if (p.length >= 4 && nh.includes(p)) return h;
    }
  }

  // 3) Contains match inverso — el patrón contiene el header corto
  for (const h of headers) {
    const nh = norm(h);
    for (const p of normedPatterns) {
      if (nh.length >= 4 && p.includes(nh)) return h;
    }
  }

  return null;
}

/**
 * Busca TODAS las columnas que coincidan con los patrones.
 */
function findAllColumns(
  headers: string[],
  patterns: string[]
): string[] {
  const found: string[] = [];
  const normedPatterns = patterns.map(norm);

  for (const h of headers) {
    const nh = norm(h);
    for (const p of normedPatterns) {
      if (nh === p || (p.length >= 4 && nh.includes(p)) || (nh.length >= 4 && p.includes(nh))) {
        found.push(h);
        break;
      }
    }
  }
  return found;
}

/**
 * Parsea un valor monetario
 */
function parseMoney(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  const s = String(raw).trim();
  if (!s || s === "-" || s === "$ -" || s === "$-") return 0;
  // Quitar $, espacios, y comas de miles
  const cleaned = s.replace(/[$\s,]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function isTruthy(val: unknown): boolean {
  if (val === true) return true;
  if (typeof val === "string") {
    const v = val.trim().toLowerCase();
    return v === "true" || v === "1" || v === "si" || v === "sí" || v === "yes";
  }
  if (typeof val === "number") return val === 1;
  return false;
}

function isFalsy(val: unknown): boolean {
  if (val === false) return true;
  if (typeof val === "string") {
    const v = val.trim().toLowerCase();
    return v === "false" || v === "0" || v === "no";
  }
  if (typeof val === "number") return val === 0;
  return false;
}

/* ─────── Detección inteligente de columnas por concepto ─────── */

/** Columna que representa el monto/importe principal */
const MONTO_PATTERNS = [
  "monto_factura", "monto factura", "monto o importe especifico",
  "importe especifico", "monto pendiente", "importe", "monto",
  "total", "monto total", "importe total", "monto_pendiente",
];

/** Columna de proveedor */
const PROVEEDOR_PATTERNS = [
  "proveedor", "nombre proveedor", "razon social", "razon_social",
  "proveedor factura", "indique el proveedor", "nombre_proveedor",
  "si cuenta con factura indique el proveedor",
];

/** Columna que indica si está facturado */
const FACTURADO_PATTERNS = [
  "esta_facturado", "esta facturado", "facturado",
  "cuenta con factura", "factura recategorizada",
  "cuenta con factura recategorizada",
];

/** Columna que indica si está pagado */
const PAGADO_PATTERNS = [
  "esta_pagado", "esta pagado", "pagado", "estatus pago",
  "importe pagado", "importe pagado del contrato",
  "monto pagado", "monto_pagado",
];

/** Columna de estatus/workflow */
const ESTATUS_PATTERNS = [
  "estatus_workflow", "estatus", "status", "estado",
  "condicion", "suficiencia presupuestal",
  "indicar la condicion actual",
  "prioridad", "nivel de prioridad",
];

function computeKPIs(data: ParsedData): KPI[] {
  const rows = data.rows;
  const headers = data.headers;
  const kpis: KPI[] = [];

  // ── Detectar columnas ──
  const montoCol = findColumn(headers, MONTO_PATTERNS);
  const provCol = findColumn(headers, PROVEEDOR_PATTERNS);
  const facturadoCol = findColumn(headers, FACTURADO_PATTERNS);
  const pagadoCol = findColumn(headers, PAGADO_PATTERNS);
  const estatusCol = findColumn(headers, ESTATUS_PATTERNS);

  // ── KPI 1: Monto total ──
  if (montoCol) {
    const total = rows.reduce((sum, r) => sum + parseMoney(r[montoCol]), 0);
    kpis.push({
      label: "Monto total",
      value: `$${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      detail: `${rows.length} registros · col: ${montoCol.substring(0, 30)}`,
      color: "blue",
    });
  } else {
    // Si no hay columna de monto, solo mostramos conteo
    kpis.push({
      label: "Registros",
      value: rows.length.toLocaleString("es-MX"),
      detail: "total de filas cargadas",
      color: "blue",
    });
  }

  // ── KPI 2: Pendiente de pago ──
  if (pagadoCol && montoCol) {
    // Si hay columna de pagado numérica (como "Importe Pagado del Contrato"),
    // pendiente = monto donde pagado = 0 o vacío
    const pendientes = rows.filter((r) => {
      const pagVal = parseMoney(r[pagadoCol]);
      return pagVal === 0;
    });
    const montoPend = pendientes.reduce(
      (sum, r) => sum + parseMoney(r[montoCol]),
      0
    );
    kpis.push({
      label: "Pendiente de pago",
      value: `$${montoPend.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      detail: `${pendientes.length} registros sin pago`,
      color: "amber",
    });
  } else if (facturadoCol && montoCol) {
    // Fallback: si hay campo booleano de facturado/pagado
    const pendientes = rows.filter(
      (r) =>
        isTruthy(r[facturadoCol]) &&
        (!pagadoCol || isFalsy(r[pagadoCol]))
    );
    const montoPend = pendientes.reduce(
      (sum, r) => sum + parseMoney(r[montoCol]),
      0
    );
    kpis.push({
      label: "Pendiente de pago",
      value: `$${montoPend.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      detail: `${pendientes.length} facturas`,
      color: "amber",
    });
  } else {
    kpis.push({
      label: "Pendiente de pago",
      value: "N/D",
      detail: "sin columna de pago detectada",
      color: "amber",
    });
  }

  // ── KPI 3: Proveedores ──
  if (provCol) {
    const proveedores = new Set(
      rows.map((r) => r[provCol]?.trim()).filter((v) => v && v !== "-")
    );
    kpis.push({
      label: "Proveedores",
      value: proveedores.size.toString(),
      detail: "activos en el periodo",
      color: "green",
    });
  } else {
    // Contar valores únicos de la columna más relevante disponible
    const uniqueCol = findColumn(headers, [
      "nombre ur", "id_ur", "ur", "unidad responsable",
    ]);
    if (uniqueCol) {
      const uniques = new Set(
        rows.map((r) => r[uniqueCol]?.trim()).filter(Boolean)
      );
      kpis.push({
        label: "Unidades",
        value: uniques.size.toString(),
        detail: `distintas en "${uniqueCol.substring(0, 25)}"`,
        color: "green",
      });
    } else {
      kpis.push({
        label: "Columnas",
        value: headers.length.toString(),
        detail: "campos en el archivo",
        color: "green",
      });
    }
  }

  // ── KPI 4: Alertas / Estatus ──
  if (estatusCol) {
    const vals = rows.map((r) => r[estatusCol]?.trim().toLowerCase()).filter(Boolean);
    const errorKw = ["error", "rechazado", "anulado", "cancelado", "sin suficiencia"];
    const alertas = vals.filter((v) =>
      errorKw.some((kw) => v.includes(kw))
    );
    const distinctStatus = new Set(vals);
    kpis.push({
      label: "Alertas",
      value: alertas.length.toString(),
      detail:
        alertas.length > 0
          ? `problemas detectados`
          : `${distinctStatus.size} estados distintos`,
      color: alertas.length > 0 ? "red" : "green",
    });
  } else {
    // Sin columna de estatus — mostrar columnas vacías como alerta
    const emptyCounts = headers.map((h) => ({
      header: h,
      empties: rows.filter((r) => !r[h] || r[h].trim() === "" || r[h].trim() === "-").length,
    }));
    const problematic = emptyCounts.filter(
      (c) => c.empties > 0 && c.empties < rows.length
    );
    kpis.push({
      label: "Alertas",
      value: problematic.length.toString(),
      detail: "columnas con valores faltantes",
      color: problematic.length > 0 ? "red" : "green",
    });
  }

  return kpis;
}

const colorClasses = {
  blue: "from-blue-500/10 to-blue-600/5 border-blue-200/60 dark:border-blue-800/40",
  green: "from-emerald-500/10 to-emerald-600/5 border-emerald-200/60 dark:border-emerald-800/40",
  amber: "from-amber-500/10 to-amber-600/5 border-amber-200/60 dark:border-amber-800/40",
  red: "from-rose-500/10 to-rose-600/5 border-rose-200/60 dark:border-rose-800/40",
};

const iconColorClasses = {
  blue: "text-blue-600 dark:text-blue-400",
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-rose-600 dark:text-rose-400",
};

const icons = {
  blue: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  green: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  ),
  amber: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  red: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  ),
};

export default function KPIDashboard({ data }: KPIDashboardProps) {
  const kpis = computeKPIs(data);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 ${colorClasses[kpi.color]}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {kpi.label}
            </span>
            <span className={iconColorClasses[kpi.color]}>
              {icons[kpi.color]}
            </span>
          </div>
          <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
          {kpi.detail && (
            <p className="text-xs text-muted-foreground mt-1">{kpi.detail}</p>
          )}
        </div>
      ))}
    </div>
  );
}

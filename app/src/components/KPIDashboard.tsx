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

function computeKPIs(data: ParsedData): KPI[] {
  const rows = data.rows;
  const kpis: KPI[] = [];

  // Total facturado
  const totalFacturado = rows.reduce((sum, r) => {
    const val = parseFloat(r["monto_factura"] || "0");
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  kpis.push({
    label: "Total facturado",
    value: `$${totalFacturado.toLocaleString("es-MX")}`,
    detail: `${rows.length} registros`,
    color: "blue",
  });

  // Pendientes de pago
  const pendientes = rows.filter(
    (r) =>
      r["esta_facturado"]?.toUpperCase() === "TRUE" &&
      r["esta_pagado"]?.toUpperCase() === "FALSE"
  );
  const montoPendiente = pendientes.reduce((sum, r) => {
    const val = parseFloat(r["monto_factura"] || "0");
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  kpis.push({
    label: "Pendiente de pago",
    value: `$${montoPendiente.toLocaleString("es-MX")}`,
    detail: `${pendientes.length} facturas`,
    color: "amber",
  });

  // Proveedores
  const proveedores = new Set(rows.map((r) => r["proveedor"]).filter(Boolean));
  kpis.push({
    label: "Proveedores",
    value: proveedores.size.toString(),
    detail: "activos en el periodo",
    color: "green",
  });

  // Errores detectados
  const errores = rows.filter(
    (r) =>
      r["estatus_workflow"]?.toLowerCase().includes("error") ||
      r["estatus_workflow"]?.toLowerCase().includes("rechazado") ||
      r["estatus_workflow"]?.toLowerCase().includes("anulado")
  );
  kpis.push({
    label: "Alertas",
    value: errores.length.toString(),
    detail: "errores / anulados / rechazos",
    color: "red",
  });

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

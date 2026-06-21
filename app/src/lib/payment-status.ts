

function norm(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[_\-()/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


export function parseMoney(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  let s = String(raw).trim().replace(/[^\d.,-]/g, "");
  if (!s || s === "-" || s === "." || s === ",") return 0;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", "."); // europeo: . miles, , decimal
    } else {
      s = s.replace(/,/g, ""); // US: , miles, . decimal
    }
  } else if (hasComma) {
    const tail = s.match(/,(\d+)$/);
    const commas = s.match(/,/g)?.length ?? 0;
    s = tail && tail[1].length <= 2 && commas === 1 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (hasDot) {
    const tail = s.match(/\.(\d+)$/);
    const dots = s.match(/\./g)?.length ?? 0;
    if (dots > 1 || (tail && tail[1].length === 3)) {
      s = s.replace(/\./g, "");
    }
  }

  const val = parseFloat(s);
  return Number.isNaN(val) ? 0 : val;
}

export interface PaymentColumns {
  paidAmountCol: string | null;
  statusCol: string | null;
  paidBoolCol: string | null;
}

/** El nombre normalizado de la columna contiene alguno de estos → importe pagado. */
const PAID_AMOUNT_NAME = [
  "importe pagado",
  "monto pagado",
  "total pagado",
  "importe liquidado",
  "monto liquidado",
];

const PAID_BOOL_NAME = ["pagado", "esta pagado", "se pago", "factura pagada", "ya pago"];

const STATUS_NAME = ["estatus", "status", "estado", "situacion"];

const PENDING_VALUE = [
  "pendiente",
  "vencid",
  "por pagar",
  "no pagad",
  "sin pagar",
  "no liquidad",
  "impag",
  "adeud",
  "atras",
  "moros",
  "parcial",
  "en proceso",
  "en tramite",
  "unpaid",
  "overdue",
];

const PAID_VALUE = [
  "pagado",
  "pagada",
  "liquidado",
  "liquidada",
  "saldado",
  "saldada",
  "finiquitado",
  "cubierto",
  "cubierta",
  "abonado",
  "conciliado",
  "cobrado",
  "paid",
];

const TRUE_VALUES = ["si", "true", "1", "x", "yes", "verdadero", "pagado", "paid"];

/**
 * Detecta las columnas relacionadas al estatus de pago a partir de los headers.
 * Es estricta a propósito: la columna de importe pagado debe nombrarse como tal
 * (no basta "monto"), evitando confundir el monto principal con lo pagado.
 */
export function detectPaymentColumns(headers: string[]): PaymentColumns {
  const taken = new Set<string>();

  const find = (pred: (nh: string) => boolean): string | null => {
    for (const h of headers) {
      if (taken.has(h)) continue;
      if (pred(norm(h))) {
        taken.add(h);
        return h;
      }
    }
    return null;
  };

  const paidAmountCol = find((nh) => PAID_AMOUNT_NAME.some((p) => nh.includes(p)));
  const paidBoolCol = find((nh) => PAID_BOOL_NAME.some((p) => nh === p || nh.includes(p)));
  const statusCol = find((nh) => STATUS_NAME.some((p) => nh.includes(p)));

  return { paidAmountCol, statusCol, paidBoolCol };
}

/**
 * Clasifica un registro como "paid" o "pending".
 * Es PAGADO solo con evidencia positiva; de lo contrario es PENDIENTE.
 */
export function classifyPayment(
  row: Record<string, string>,
  cols: PaymentColumns
): "paid" | "pending" {
  if (cols.paidAmountCol && parseMoney(row[cols.paidAmountCol]) > 0) {
    return "paid";
  }

  if (cols.statusCol) {
    const v = norm(row[cols.statusCol] ?? "");
    if (v) {
      if (PENDING_VALUE.some((k) => v.includes(k))) return "pending";
      if (PAID_VALUE.some((k) => v.includes(k))) return "paid";
    }
  }

  if (cols.paidBoolCol) {
    const v = norm(row[cols.paidBoolCol] ?? "");
    if (TRUE_VALUES.includes(v)) return "paid";
  }

  return "pending";
}

export function hasPaymentSignal(cols: PaymentColumns): boolean {
  return Boolean(cols.statusCol || cols.paidAmountCol || cols.paidBoolCol);
}

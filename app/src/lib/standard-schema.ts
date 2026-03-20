/**
 * Estándar CCINSHAE v0 — Definición de campos
 *
 * Cada campo tiene:
 * - name: nombre oficial de la columna en el estándar
 * - required: si es obligatorio
 * - type: "text" | "number" | "catalog" (selección de opciones)
 * - catalog: valores válidos (solo si type === "catalog")
 * - aliases: nombres alternativos para auto-mapeo desde archivos fuente
 * - description: descripción breve del campo
 */

export interface StandardField {
  name: string;
  required: boolean;
  type: "text" | "number" | "catalog";
  catalog?: string[];
  aliases: string[];
  description: string;
}

export const STANDARD_VERSION = "v0";

export const STANDARD_FIELDS: StandardField[] = [
  {
    name: "ID_UR",
    required: true,
    type: "text",
    aliases: ["id_ur", "ur", "clave_ur", "id ur", "idur"],
    description: "Identificador de la Unidad Responsable",
  },
  {
    name: "Nombre UR",
    required: true,
    type: "text",
    aliases: ["nombre_ur", "nombre ur", "unidad responsable", "nom_ur", "nomur"],
    description: "Nombre de la Unidad Responsable",
  },
  {
    name: "CAPITULO",
    required: true,
    type: "text",
    aliases: ["capitulo", "cap", "capitulo_gasto", "cap_gasto"],
    description: "Capítulo de gasto presupuestal",
  },
  {
    name: "ID_PARTIDA_ESPECIFICA",
    required: true,
    type: "text",
    aliases: [
      "id_partida_especifica",
      "partida_especifica",
      "id partida especifica",
      "partida especifica",
      "clave_partida",
    ],
    description: "Identificador de la partida específica",
  },
  {
    name: "DESCRIPCIÓN DEL BIEN O SERVICIO A CONTRATAR",
    required: true,
    type: "text",
    aliases: [
      "partida_descripcion",
      "descripcion_bien",
      "descripcion del bien",
      "descripcion servicio",
      "bien o servicio",
      "concepto",
      "descripcion",
      "descripcion del bien o servicio a contratado",
      "descripcion del bien o servicio a contratar",
    ],
    description: "Descripción del bien o servicio a contratar",
  },
  {
    name: "MONTO O IMPORTE ESPECIFICO",
    required: true,
    type: "number",
    aliases: [
      "monto_pendiente",
      "monto pendiente",
      "importe_especifico",
      "importe especifico",
      "monto",
      "importe",
    ],
    description: "Monto o importe específico del bien/servicio",
  },
  {
    name: "INDICAR SI EL CONCEPTO CUENTA CON CONTRATO (SELECCIONAR OPCIÓN)",
    required: true,
    type: "catalog",
    catalog: ["Sí", "No"],
    aliases: [
      "tiene_contrato",
      "cuenta con contrato",
      "contrato",
      "tipo_contrato",
    ],
    description: "Indica si el concepto cuenta con contrato vigente",
  },
  {
    name: "INDICAR LA CONDICIÓN ACTUAL DE LA SUFICIENCIA PRESUPUESTAL (SELECCIONAR OPCIÓN)",
    required: true,
    type: "catalog",
    catalog: [
      "Suficiente",
      "Insuficiente",
      "Pendiente de validación",
    ],
    aliases: [
      "suficiencia_presupuestal",
      "suficiencia presupuestal",
      "condicion presupuestal",
      "suficiencia",
    ],
    description:
      "Condición actual de la suficiencia presupuestal. Catálogo pendiente de confirmar.",
  },
  {
    name: "INDICAR EL NIVEL DE PRIORIDAD (SELECCIONAR OPCIÓN)",
    required: true,
    type: "catalog",
    catalog: ["Alta", "Media", "Baja"],
    aliases: [
      "prioridad",
      "nivel_prioridad",
      "nivel de prioridad",
      "nivel prioridad",
    ],
    description: "Nivel de prioridad del concepto",
  },
  {
    name: "ID_UNIDAD",
    required: true,
    type: "text",
    aliases: ["id_unidad", "id unidad", "clave_unidad", "unidad"],
    description: "Identificador de la unidad",
  },
  {
    name: "FINALIDAD",
    required: false,
    type: "text",
    aliases: ["finalidad", "fin"],
    description: "Clasificación funcional: finalidad",
  },
  {
    name: "FUNCION",
    required: false,
    type: "text",
    aliases: ["funcion", "función", "funcion2"],
    description: "Clasificación funcional: función",
  },
  {
    name: "2SUBFUNCION",
    required: false,
    type: "text",
    aliases: [
      "subfuncion",
      "subfunción",
      "2subfuncion",
      "sub_funcion",
      "sub funcion",
    ],
    description: "Clasificación funcional: subfunción",
  },
  {
    name: "REASIGNACION",
    required: false,
    type: "text",
    aliases: ["reasignacion", "reasignación"],
    description: "Indicador de reasignación presupuestal",
  },
  {
    name: "ACTIV_INSTIT",
    required: false,
    type: "text",
    aliases: [
      "activ_instit",
      "actividad_institucional",
      "actividad institucional",
      "act_instit",
    ],
    description: "Actividad institucional",
  },
  {
    name: "PROGRAMA_PRESUPUESTARIO",
    required: false,
    type: "text",
    aliases: [
      "programa_presupuestario",
      "programa presupuestario",
      "pp",
      "prog_presup",
    ],
    description: "Programa presupuestario",
  },
  {
    name: "PARTIDA",
    required: false,
    type: "text",
    aliases: ["partida", "clave_partida_gen"],
    description: "Clave de partida genérica",
  },
  {
    name: "TIPO_GASTO",
    required: false,
    type: "text",
    aliases: ["tipo_gasto", "tipo gasto", "tipo de gasto", "tg"],
    description: "Tipo de gasto",
  },
  {
    name: "FUENTE_FINANCIAMIENTO",
    required: false,
    type: "text",
    aliases: [
      "fuente_financiamiento",
      "fuente financiamiento",
      "fuente de financiamiento",
      "ff",
    ],
    description: "Fuente de financiamiento",
  },
  {
    name: "ENTIDAD_FEDERATIVA",
    required: false,
    type: "text",
    aliases: [
      "entidad_federativa",
      "entidad federativa",
      "estado",
      "entidad",
    ],
    description: "Entidad federativa",
  },
  {
    name: "CLAVE_CARTERA",
    required: false,
    type: "text",
    aliases: ["clave_cartera", "clave cartera", "cartera"],
    description: "Clave de cartera",
  },
  {
    name: "CENTRO_COSTO",
    required: false,
    type: "text",
    aliases: ["centro_costo", "centro costo", "centro de costo", "cc"],
    description: "Centro de costo",
  },
  {
    name: "AUX1",
    required: false,
    type: "text",
    aliases: ["aux1", "auxiliar1", "auxiliar_1"],
    description: "Campo auxiliar 1",
  },
  {
    name: "AUX2",
    required: false,
    type: "text",
    aliases: ["aux2", "auxiliar2", "auxiliar_2"],
    description: "Campo auxiliar 2",
  },
  {
    name: "AUX3",
    required: false,
    type: "text",
    aliases: ["aux3", "auxiliar3", "auxiliar_3"],
    description: "Campo auxiliar 3",
  },
  {
    name: "CONTROL_OPERATIVO",
    required: false,
    type: "text",
    aliases: ["control_operativo", "control operativo", "ctrl_op"],
    description: "Control operativo",
  },
  {
    name: "CUENTA CON FACTURA RECATEGORIZADA (SELECCIONAR OPCIÓN)",
    required: false,
    type: "catalog",
    catalog: ["Sí", "No"],
    aliases: [
      "factura_recategorizada",
      "factura recategorizada",
      "recategorizada",
    ],
    description:
      "Indica si cuenta con factura recategorizada. Catálogo pendiente de confirmar.",
  },
  {
    name: "SI CUENTA CON FACTURA INDIQUE EL PROVEEDOR",
    required: false,
    type: "text",
    aliases: [
      "proveedor",
      "proveedor_factura",
      "nombre_proveedor",
      "razon_social",
    ],
    description: "Nombre del proveedor si cuenta con factura",
  },
  {
    name: "SI CUENTA CON FACTURA INDICAR EL NÚMERO DE CONTRATO",
    required: false,
    type: "text",
    aliases: [
      "numero_contrato",
      "num_contrato",
      "número de contrato",
      "no_contrato",
    ],
    description: "Número de contrato si cuenta con factura",
  },
  {
    name: "Importe Mínimo del Contrato",
    required: false,
    type: "number",
    aliases: [
      "importe_min",
      "importe minimo",
      "importe mínimo",
      "min_contrato",
      "monto_minimo",
    ],
    description: "Importe mínimo del contrato",
  },
  {
    name: "Importe Máximo del Contrato",
    required: false,
    type: "number",
    aliases: [
      "importe_max",
      "importe maximo",
      "importe máximo",
      "max_contrato",
      "monto_maximo",
    ],
    description: "Importe máximo del contrato",
  },
  {
    name: "Importe Pagado del Contrato",
    required: false,
    type: "number",
    aliases: [
      "monto_pagado_contrato",
      "importe pagado",
      "monto pagado",
      "pagado_contrato",
    ],
    description: "Importe pagado del contrato",
  },
];

/**
 * Llaves por defecto para detección de duplicados.
 * Combinación configurable — si todas coinciden, se considera duplicado.
 */
export const DEFAULT_DUPLICATE_KEYS = [
  "ID_UR",
  "ID_UNIDAD",
  "ID_PARTIDA_ESPECIFICA",
];

/**
 * Retorna los nombres de las columnas estándar en orden.
 */
export function getStandardColumnNames(): string[] {
  return STANDARD_FIELDS.map((f) => f.name);
}

/**
 * Retorna solo los campos obligatorios.
 */
export function getRequiredFields(): StandardField[] {
  return STANDARD_FIELDS.filter((f) => f.required);
}

/**
 * Retorna los campos que son catálogo.
 */
export function getCatalogFields(): StandardField[] {
  return STANDARD_FIELDS.filter((f) => f.type === "catalog" && f.catalog);
}

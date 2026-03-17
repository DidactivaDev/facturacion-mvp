import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export function parseCSV(csvString: string): ParsedData {
  const result = Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (value) => (typeof value === "string" ? value.trim() : String(value)),
    dynamicTyping: false,
  });

  return {
    headers: result.meta.fields || [],
    rows: result.data,
    totalRows: result.data.length,
  };
}

export function parseCSVFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      transform: (value) => (typeof value === "string" ? value.trim() : String(value)),
      dynamicTyping: false,
      complete: (result) => {
        resolve({
          headers: result.meta.fields || [],
          rows: result.data,
          totalRows: result.data.length,
        });
      },
      error: (error) => reject(error),
    });
  });
}

export function prepareDataForPrompt(data: ParsedData): string {
  const { headers, rows, totalRows } = data;

  // For small datasets, send everything
  if (totalRows <= 500) {
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => headers.map((h) => row[h] ?? "").join(",")),
    ].join("\n");
    return `Dataset completo (${totalRows} filas, ${headers.length} columnas):\n\nColumnas: ${headers.join(", ")}\n\n${csvContent}`;
  }

  // For medium datasets, send schema + summary + sample
  if (totalRows <= 2000) {
    const sample = rows.slice(0, 100);
    const csvSample = [
      headers.join(","),
      ...sample.map((row) => headers.map((h) => row[h] ?? "").join(",")),
    ].join("\n");

    const summary = generateSummary(headers, rows);

    return `Dataset (${totalRows} filas, ${headers.length} columnas):\n\nColumnas: ${headers.join(", ")}\n\nResumen estadístico:\n${summary}\n\nMuestra de las primeras 100 filas:\n${csvSample}`;
  }

  // For large datasets, truncate with warning
  const truncated = rows.slice(0, 2000);
  const csvTruncated = [
    headers.join(","),
    ...truncated.map((row) => headers.map((h) => row[h] ?? "").join(",")),
  ].join("\n");

  const summary = generateSummary(headers, rows);

  return `Dataset grande (${totalRows} filas totales, mostrando primeras 2000, ${headers.length} columnas):\n\nADVERTENCIA: El dataset tiene más de 2000 filas. Solo se incluyen las primeras 2000.\n\nColumnas: ${headers.join(", ")}\n\nResumen estadístico (sobre todos los datos):\n${summary}\n\nPrimeras 2000 filas:\n${csvTruncated}`;
}

function generateSummary(
  headers: string[],
  rows: Record<string, string>[]
): string {
  const lines: string[] = [];

  for (const header of headers) {
    const values = rows.map((r) => r[header]).filter((v) => v !== undefined && v !== "");
    const uniqueCount = new Set(values).size;

    // Check if numeric
    const numericValues = values
      .map((v) => parseFloat(v))
      .filter((n) => !isNaN(n));

    if (numericValues.length > values.length * 0.7) {
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      lines.push(
        `- ${header}: numérico, min=${min}, max=${max}, suma=${sum.toFixed(2)}, ${uniqueCount} valores únicos`
      );
    } else {
      const topValues = getTopValues(values, 5);
      lines.push(
        `- ${header}: texto, ${uniqueCount} valores únicos, más frecuentes: ${topValues}`
      );
    }
  }

  return lines.join("\n");
}

function getTopValues(values: string[], n: number): string {
  const counts: Record<string, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([val, count]) => `"${val}" (${count})`)
    .join(", ");
}

/**
 * Parsea un archivo XLSX y retorna ParsedData.
 * Lee la primera hoja del workbook.
 */
export function parseXLSXFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error("El archivo Excel no tiene hojas"));
          return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: "",
        });

        if (jsonData.length === 0) {
          reject(new Error("La hoja de Excel está vacía"));
          return;
        }

        // Convert all values to strings and trim headers
        const headers = Object.keys(jsonData[0]).map((h) => h.trim());
        const rows = jsonData.map((row) => {
          const cleaned: Record<string, string> = {};
          for (const header of headers) {
            const rawKey = Object.keys(row).find((k) => k.trim() === header);
            const val = rawKey ? row[rawKey] : "";
            cleaned[header] = val !== null && val !== undefined ? String(val) : "";
          }
          return cleaned;
        });

        resolve({ headers, rows, totalRows: rows.length });
      } catch (err) {
        reject(
          new Error(
            `Error al leer el archivo Excel: ${err instanceof Error ? err.message : "desconocido"}`
          )
        );
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsArrayBuffer(file);
  });
}

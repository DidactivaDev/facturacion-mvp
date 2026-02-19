import Papa from "papaparse";

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

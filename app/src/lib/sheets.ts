export function extractSheetId(url: string): string | null {
  // Supports URLs like:
  // https://docs.google.com/spreadsheets/d/SHEET_ID/edit
  // https://docs.google.com/spreadsheets/d/SHEET_ID/
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export function buildExportUrl(sheetId: string, gid?: string): string {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  return gid ? `${base}&gid=${gid}` : base;
}

export async function fetchSheetAsCSV(url: string): Promise<string> {
  const sheetId = extractSheetId(url);
  if (!sheetId) {
    throw new Error(
      "URL de Google Sheets no válida. Asegúrate de copiar la URL completa de la hoja de cálculo."
    );
  }

  const exportUrl = buildExportUrl(sheetId);

  const response = await fetch(exportUrl, {
    redirect: "follow",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("No se encontró la hoja de cálculo. Verifica la URL.");
    }
    if (response.status === 403 || response.status === 401) {
      throw new Error(
        "La hoja de cálculo no es pública. Cambia los permisos a 'Cualquier persona con el enlace' o descárgala como CSV."
      );
    }
    throw new Error(`Error al descargar la hoja: ${response.statusText}`);
  }

  const text = await response.text();

  // Check if we got an HTML page instead of CSV (happens with private sheets)
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error(
      "La hoja de cálculo no es pública. Cambia los permisos a 'Cualquier persona con el enlace' o descárgala como CSV."
    );
  }

  return text;
}

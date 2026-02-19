import { NextRequest, NextResponse } from "next/server";
import { fetchSheetAsCSV } from "@/lib/sheets";
import { parseCSV } from "@/lib/csv-parser";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Se requiere una URL de Google Sheets" },
        { status: 400 }
      );
    }

    const csvText = await fetchSheetAsCSV(url);
    const parsed = parseCSV(csvText);

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "La hoja de cálculo está vacía o no se pudo parsear" },
        { status: 400 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

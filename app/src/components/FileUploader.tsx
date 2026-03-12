"use client";

import { useCallback, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseCSVFile, parseXLSXFile, type ParsedData } from "@/lib/csv-parser";

interface FileUploaderProps {
  onDataLoaded: (data: ParsedData, source: string) => void;
}

export default function FileUploader({ onDataLoaded }: FileUploaderProps) {
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoadingFile(true);
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
        setError("Solo se aceptan archivos CSV o Excel (.xlsx)");
        setLoadingFile(false);
        return;
      }
      try {
        let data: ParsedData;
        if (ext === "xlsx" || ext === "xls") {
          data = await parseXLSXFile(file);
        } else {
          data = await parseCSVFile(file);
        }
        if (data.rows.length === 0) {
          setError("El archivo esta vacio");
          setLoadingFile(false);
          return;
        }
        onDataLoaded(data, file.name);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al parsear el archivo"
        );
      } finally {
        setLoadingFile(false);
        // Reset file input so same file can be re-uploaded
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [onDataLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleSheetsSubmit = async () => {
    if (!sheetsUrl.trim()) return;
    setError(null);
    setLoadingSheets(true);

    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetsUrl }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Error al cargar Google Sheet");
        return;
      }

      onDataLoaded(result, "Google Sheets");
    } catch {
      setError("Error de conexion al cargar Google Sheet");
    } finally {
      setLoadingSheets(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer group ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : loadingFile
            ? "border-primary/50 bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-accent/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!loadingFile) fileInputRef.current?.click();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <div className="flex flex-col items-center gap-4">
          {/* Upload icon */}
          <div className={`rounded-2xl p-4 transition-colors ${isDragging ? "bg-primary/10" : "bg-muted group-hover:bg-primary/5"}`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={`w-8 h-8 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground group-hover:text-primary/70"}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
          </div>

          <div>
            {loadingFile ? (
              <>
                <p className="text-base font-semibold text-primary">
                  Procesando archivo...
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Esto puede tardar unos segundos
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-foreground">
                  Arrastra tu archivo CSV o Excel aqui
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  o <span className="text-primary font-medium">haz clic para seleccionar</span>
                </p>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.451a1.125 1.125 0 0 0 1.587 1.595l3.454-3.553a3 3 0 0 0 0-4.242Z" clipRule="evenodd" />
            </svg>
            Archivos .csv o .xlsx con datos de facturacion
          </div>

          {/* Explicit button fallback for browsers that block programmatic click */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Seleccionar archivo
          </Button>
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-3 text-muted-foreground font-medium">
            o conecta desde
          </span>
        </div>
      </div>

      {/* Google Sheets URL */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>
          </div>
          <Input
            placeholder="Pega la URL de tu Google Sheet publico..."
            value={sheetsUrl}
            onChange={(e) => setSheetsUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSheetsSubmit();
            }}
            className="pl-10 h-11"
          />
        </div>
        <Button
          onClick={handleSheetsSubmit}
          disabled={!sheetsUrl.trim() || loadingSheets}
          className="h-11 px-6"
        >
          {loadingSheets ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando
            </span>
          ) : (
            "Conectar"
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}

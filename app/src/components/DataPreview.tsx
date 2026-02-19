"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ParsedData } from "@/lib/csv-parser";

interface DataPreviewProps {
  data: ParsedData;
  source: string;
  onClear: () => void;
}

export default function DataPreview({
  data,
  source,
  onClear,
}: DataPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const previewRows = data.rows.slice(0, 8);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header bar - always visible */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
            >
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-primary">
              <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-3.69l-2.22 1.11a5.25 5.25 0 0 1-4.69.138l-.35-.175a3.75 3.75 0 0 0-3.36-.1L1.5 11.06Zm0-1.67 5.15-2.14a5.25 5.25 0 0 1 4.69.138l.35.175a3.75 3.75 0 0 0 3.36.1L19 6.32v-1.07a.75.75 0 0 0-.75-.75H3.25a.75.75 0 0 0-.75.75v3.39Z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Datos cargados</span>
          </button>
          <Badge variant="secondary" className="text-xs font-normal">
            {source}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {data.totalRows} filas &middot; {data.headers.length} columnas
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-destructive h-7"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 mr-1">
            <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
          </svg>
          Cambiar
        </Button>
      </div>

      {/* Expandable table */}
      {isExpanded && (
        <div className="overflow-auto max-h-[350px] custom-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20">
                {data.headers.map((header) => (
                  <TableHead
                    key={header}
                    className="whitespace-nowrap text-xs font-semibold sticky top-0 bg-muted/80 backdrop-blur-sm"
                  >
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, i) => (
                <TableRow key={i} className="hover:bg-muted/30">
                  {data.headers.map((header) => (
                    <TableCell
                      key={header}
                      className="whitespace-nowrap text-xs py-2"
                    >
                      {row[header] ?? ""}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.totalRows > 8 && (
            <div className="text-center py-2 text-xs text-muted-foreground border-t bg-muted/10">
              Mostrando 8 de {data.totalRows} filas
            </div>
          )}
        </div>
      )}
    </div>
  );
}

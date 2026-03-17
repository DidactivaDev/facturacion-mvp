"use client";

import { useState, useMemo } from "react";
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

const PAGE_SIZES = [8, 25, 50, 100] as const;

export default function DataPreview({
  data,
  source,
  onClear,
}: DataPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pageSize, setPageSize] = useState<number>(8);
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(data.totalRows / pageSize);

  const visibleRows = useMemo(() => {
    const start = currentPage * pageSize;
    return data.rows.slice(start, start + pageSize);
  }, [data.rows, currentPage, pageSize]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(0);
  };

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
        <>
          <div className="overflow-auto max-h-[500px] custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead className="whitespace-nowrap text-xs font-semibold sticky top-0 bg-muted/80 backdrop-blur-sm text-muted-foreground w-[50px]">
                    #
                  </TableHead>
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
                {visibleRows.map((row, i) => (
                  <TableRow key={i} className="hover:bg-muted/30">
                    <TableCell className="whitespace-nowrap text-xs py-2 text-muted-foreground/60 font-mono">
                      {currentPage * pageSize + i + 1}
                    </TableCell>
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
          </div>

          {/* Footer: pagination + page size */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/10">
            {/* Page size selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Mostrar</span>
              <div className="flex gap-1">
                {PAGE_SIZES.filter((s) => s <= data.totalRows || s === PAGE_SIZES[0]).map((size) => (
                  <button
                    key={size}
                    onClick={() => handlePageSizeChange(size)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      pageSize === size
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {size}
                  </button>
                ))}
                {data.totalRows > PAGE_SIZES[PAGE_SIZES.length - 1] && (
                  <button
                    onClick={() => handlePageSizeChange(data.totalRows)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      pageSize === data.totalRows
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Todas
                  </button>
                )}
              </div>
            </div>

            {/* Pagination controls */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {currentPage * pageSize + 1}–
                {Math.min((currentPage + 1) * pageSize, data.totalRows)} de{" "}
                {data.totalRows}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(0)}
                  disabled={currentPage === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Primera página"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-muted-foreground">
                    <path fillRule="evenodd" d="M3.22 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L4.81 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L3.22 8.53ZM8.72 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 1 1 1.06 1.06L10.31 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L8.72 8.53Z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Anterior"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-muted-foreground">
                    <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                  </svg>
                </button>
                <span className="text-xs text-muted-foreground px-1 py-1 min-w-[60px] text-center">
                  {currentPage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Siguiente"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-muted-foreground">
                    <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages - 1)}
                  disabled={currentPage >= totalPages - 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Última página"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-muted-foreground">
                    <path fillRule="evenodd" d="M12.78 7.47a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.19 8 7.47 4.28a.75.75 0 0 1 1.06-1.06l4.25 4.25ZM7.28 7.47a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L5.69 8 1.97 4.28a.75.75 0 0 1 1.06-1.06l4.25 4.25Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

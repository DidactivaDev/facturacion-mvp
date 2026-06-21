"use client";

import { Bot } from "lucide-react";
import ChartRenderer from "./ChartRenderer";

interface ResponseCardProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export interface ContentBlock {
  type: "text" | "chart" | "data-edit";
  content: string;
}

export function splitContentBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const blockRegex = /```(chart|data-edit)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index).trim();
    if (textBefore) {
      blocks.push({ type: "text", content: textBefore });
    }

    blocks.push({
      type: match[1] === "chart" ? "chart" : "data-edit",
      content: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    blocks.push({ type: "text", content: remaining });
  }

  if (blocks.length === 0 && text.trim()) {
    blocks.push({ type: "text", content: text });
  }

  return blocks;
}

export default function ResponseCard({
  role,
  content,
  isStreaming,
}: ResponseCardProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-[#9f2241] to-[#235b4e] text-white"
        }`}
      >
        {isUser ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z" />
          </svg>
        ) : (
          <Bot className="w-3.5 h-3.5" />
        )}
      </div>

      {/* Message */}
      <div className={`max-w-[85%] ${isUser ? "text-right" : ""}`}>
        {isUser ? (
          <div className="inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-primary text-primary-foreground rounded-tr-sm">
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
        ) : content === "" && isStreaming ? (
          <div className="inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-card border shadow-sm rounded-tl-sm">
            <div className="flex items-center gap-1.5 py-1 px-1">
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {splitContentBlocks(content).map((block, i) =>
              block.type === "chart" ? (
                <ChartRenderer key={i} json={block.content} />
              ) : block.type === "data-edit" ? (
                null
              ) : (
                <div
                  key={i}
                  className="inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-card border shadow-sm rounded-tl-sm"
                >
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none [&_.table-wrap]:my-2 [&_.table-wrap]:overflow-x-auto [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_table]:rounded-lg [&_table]:overflow-hidden [&_th]:border [&_th]:border-border [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:bg-muted/50 [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-2.5 [&_td]:py-1.5 [&_p]:my-2 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_h1]:mb-2 [&_h1]:text-base [&_h2]:mb-2 [&_h2]:text-sm [&_h3]:mb-1 [&_h3]:text-sm [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(block.content) }}
                  />
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInlineMarkdown(text: string): string {
  let html = escapeHtml(text);

  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
  );
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  return html;
}

function isCodeFence(line: string): boolean {
  return line.trim().startsWith("```");
}

function isHeading(line: string): boolean {
  return /^#{1,3}\s+/.test(line.trim());
}

function isUnorderedListLine(line: string): boolean {
  return /^\s*[-*]\s+/.test(line);
}

function isOrderedListLine(line: string): boolean {
  return /^\s*\d+\.\s+/.test(line);
}

function isTableSeparatorLine(line: string): boolean {
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line.trim());
}

function isTableRowLine(line: string): boolean {
  return line.includes("|");
}

function splitTableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index];
  const nextLine = lines[index + 1];

  return (
    isCodeFence(line) ||
    isHeading(line) ||
    isUnorderedListLine(line) ||
    isOrderedListLine(line) ||
    (isTableRowLine(line) && Boolean(nextLine) && isTableSeparatorLine(nextLine))
  );
}

function renderMarkdown(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n").trim();

  if (!normalized) return "";

  const lines = normalized.split("\n");
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (isCodeFence(line)) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !isCodeFence(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^###\s+/.test(line.trim())) {
      blocks.push(`<h3>${renderInlineMarkdown(line.trim().replace(/^###\s+/, ""))}</h3>`);
      index += 1;
      continue;
    }

    if (/^##\s+/.test(line.trim())) {
      blocks.push(`<h2>${renderInlineMarkdown(line.trim().replace(/^##\s+/, ""))}</h2>`);
      index += 1;
      continue;
    }

    if (/^#\s+/.test(line.trim())) {
      blocks.push(`<h1>${renderInlineMarkdown(line.trim().replace(/^#\s+/, ""))}</h1>`);
      index += 1;
      continue;
    }

    if (
      isTableRowLine(line) &&
      index + 1 < lines.length &&
      isTableSeparatorLine(lines[index + 1])
    ) {
      const headerCells = splitTableCells(line);
      index += 2;

      const bodyRows: string[][] = [];
      while (index < lines.length && lines[index].trim() && isTableRowLine(lines[index])) {
        bodyRows.push(splitTableCells(lines[index]));
        index += 1;
      }

      const headersHtml = headerCells
        .map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`)
        .join("");
      const rowsHtml = bodyRows
        .map((row) => {
          const cells = row
            .map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`)
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");

      blocks.push(
        `<div class="table-wrap"><table><thead><tr>${headersHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`
      );
      continue;
    }

    if (isUnorderedListLine(line)) {
      const items: string[] = [];
      while (index < lines.length && isUnorderedListLine(lines[index])) {
        items.push(
          `<li>${renderInlineMarkdown(
            lines[index].replace(/^\s*[-*]\s+/, "").trim()
          )}</li>`
        );
        index += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (isOrderedListLine(line)) {
      const items: string[] = [];
      while (index < lines.length && isOrderedListLine(lines[index])) {
        items.push(
          `<li>${renderInlineMarkdown(
            lines[index].replace(/^\s*\d+\.\s+/, "").trim()
          )}</li>`
        );
        index += 1;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isBlockStart(lines, index)
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(
      `<p>${paragraphLines
        .map((paragraphLine) => renderInlineMarkdown(paragraphLine))
        .join("<br/>")}</p>`
    );
  }

  return blocks.join("");
}

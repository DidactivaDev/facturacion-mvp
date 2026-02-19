"use client";

import ChartRenderer from "./ChartRenderer";

interface ResponseCardProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface ContentBlock {
  type: "text" | "chart";
  content: string;
}

function splitContentBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const chartRegex = /```chart\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = chartRegex.exec(text)) !== null) {
    // Text before the chart
    const textBefore = text.slice(lastIndex, match.index).trim();
    if (textBefore) {
      blocks.push({ type: "text", content: textBefore });
    }
    // The chart JSON
    blocks.push({ type: "chart", content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last chart
  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    blocks.push({ type: "text", content: remaining });
  }

  // If no blocks were created, treat everything as text
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
            : "bg-gradient-to-br from-violet-500 to-blue-500 text-white"
        }`}
      >
        {isUser ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.47Z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M4.5 2A2.5 2.5 0 0 0 2 4.5v2.879a2.5 2.5 0 0 0 .732 1.767l4.5 4.5a2.5 2.5 0 0 0 3.536 0l2.878-2.878a2.5 2.5 0 0 0 0-3.536l-4.5-4.5A2.5 2.5 0 0 0 7.379 2H4.5ZM5 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
          </svg>
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
              ) : (
                <div
                  key={i}
                  className="inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-card border shadow-sm rounded-tl-sm"
                >
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_table]:border-collapse [&_table]:my-2 [&_table]:rounded-lg [&_table]:overflow-hidden [&_th]:border [&_th]:border-border [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:bg-muted/50 [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-2.5 [&_td]:py-1.5 [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_strong]:text-foreground"
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

function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (but NOT chart blocks - those are already extracted)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  html = html.replace(
    /^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm,
    (_match, headerRow: string, _separator: string, bodyRows: string) => {
      const headers = headerRow
        .split("|")
        .filter((c: string) => c.trim())
        .map((c: string) => `<th>${c.trim()}</th>`)
        .join("");
      const rows = bodyRows
        .trim()
        .split("\n")
        .map((row: string) => {
          const cells = row
            .split("|")
            .filter((c: string) => c.trim())
            .map((c: string) => `<td>${c.trim()}</td>`)
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");
      return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    }
  );

  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br/>");

  html = `<p>${html}</p>`;

  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>(<h[1-3]>)/g, "$1");
  html = html.replace(/(<\/h[1-3]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<table>)/g, "$1");
  html = html.replace(/(<\/table>)<\/p>/g, "$1");
  html = html.replace(/<p>(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)<\/p>/g, "$1");
  html = html.replace(/<p>(<pre>)/g, "$1");
  html = html.replace(/(<\/pre>)<\/p>/g, "$1");

  return html;
}

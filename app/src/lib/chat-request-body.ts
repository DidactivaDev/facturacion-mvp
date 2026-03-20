/**
 * Prepares the chat API body: gzip when CompressionStream exists (browser),
 * so large datasets stay under proxy body limits (HTTP 413).
 */
export async function prepareChatRequestBody(payload: object): Promise<{
  body: BodyInit;
  headers: HeadersInit;
}> {
  const json = JSON.stringify(payload);
  if (typeof CompressionStream !== "undefined") {
    try {
      const compressed = await gzipUtf8String(json);
      return {
        body: compressed,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Encoding": "gzip",
        },
      };
    } catch {
      /* send raw JSON */
    }
  }
  return {
    body: json,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  };
}

async function gzipUtf8String(text: string): Promise<ArrayBuffer> {
  const input = new TextEncoder().encode(text);
  const readable = new ReadableStream({
    start(c) {
      c.enqueue(input);
      c.close();
    },
  });
  const compressed = readable.pipeThrough(new CompressionStream("gzip"));
  return new Response(compressed).arrayBuffer();
}

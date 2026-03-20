import type { NextRequest } from "next/server";
import { gunzipSync } from "node:zlib";

/**
 * Reads JSON from a POST body; supports gzip when Content-Encoding: gzip
 * (client must set it when sending compressed payloads).
 */
export async function parseJsonBodyWithOptionalGzip(
  request: NextRequest
): Promise<unknown> {
  const encoding = request.headers
    .get("content-encoding")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const raw = Buffer.from(await request.arrayBuffer());
  const decoded =
    encoding === "gzip" ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  return JSON.parse(decoded);
}

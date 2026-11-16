import { isAnalyticsIngestConfigured } from "@/db/pool";
import { parseClickEvent } from "@/lib/analytics/model";
import { recordClickMetric } from "@/lib/analytics/repository";

let missingConfigurationReported = false;
const MAX_BODY_BYTES = 2048;

async function readLimitedBody(request: Request): Promise<{ readonly text: string; readonly tooLarge: boolean }> {
  const reader = request.body?.getReader();
  if (reader === undefined) return { text: "", tooLarge: false };

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_BODY_BYTES) {
        await reader.cancel();
        return { text: "", tooLarge: true };
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return { text: chunks.join(""), tooLarge: false };
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return new Response(null, { status: 413, headers: { "cache-control": "no-store" } });
  }

  let body: unknown;
  try {
    const result = await readLimitedBody(request);
    if (result.tooLarge) return new Response(null, { status: 413, headers: { "cache-control": "no-store" } });
    body = JSON.parse(result.text);
  } catch {
    return new Response(null, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const event = parseClickEvent(body);
  if (event === null) return new Response(null, { status: 400, headers: { "cache-control": "no-store" } });

  if (!isAnalyticsIngestConfigured()) {
    if (!missingConfigurationReported) {
      console.error("[analytics] collection disabled: ANALYTICS_DATABASE_URL is not configured");
      missingConfigurationReported = true;
    }
    return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
  }

  try {
    await recordClickMetric(event);
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
        ? error.code
        : "unknown";
    console.error(`[analytics] click metric write failed (${code})`);
    return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

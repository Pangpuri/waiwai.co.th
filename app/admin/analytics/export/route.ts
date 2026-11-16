import { requireAdminUser } from "@/lib/auth/dal";
import { isAnalyticsPeriod } from "@/lib/analytics/model";
import { loadAnalyticsReport } from "@/lib/analytics/repository";
import { toCsv } from "@/lib/forms/csv";

export async function GET(request: Request): Promise<Response> {
  await requireAdminUser("analytics");

  const period = new URL(request.url).searchParams.get("period");
  if (!isAnalyticsPeriod(period)) {
    return new Response("Invalid analytics period", {
      status: 400,
      headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
    });
  }

  const report = await loadAnalyticsReport(period);
  if (report === null) {
    return new Response("Analytics database is not configured", {
      status: 503,
      headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
    });
  }

  const csv = toCsv(report.metrics, [
    { header: "day", value: (row) => row.day },
    { header: "event_type", value: (row) => row.type },
    { header: "item", value: (row) => row.label },
    { header: "source", value: (row) => row.source },
    { header: "count", value: (row) => String(row.clicks) },
  ]);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="waiwai-analytics-report-${period}-${report.through}.csv"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
      "x-content-type-options": "nosniff",
    },
  });
}

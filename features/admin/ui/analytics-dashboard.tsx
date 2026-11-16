import Link from "next/link";

import { SITE } from "@/lib/site";
import { chartBucketsOf, sumClicks, type AnalyticsMetric, type AnalyticsReport, type ClickEventType, type DailyMetric } from "@/lib/analytics/model";
import type { adminAnalytics as thAdminAnalytics } from "@/lib/i18n/messages/areas/th/adminAnalytics";

type AnalyticsStrings = typeof thAdminAnalytics;
type Marketplace = (typeof SITE.marketplaces)[number];

function dayLabel(day: string, period: AnalyticsReport["period"]): string {
  const date = new Date(`${day}-01T12:00:00+07:00`);
  const exactDate = new Date(`${day}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("th-TH", period === "year" ? { month: "short" } : { day: "numeric", month: "short" })
    .format(period === "year" ? date : exactDate);
}

function aggregateMetrics(metrics: readonly AnalyticsMetric[]): readonly AnalyticsMetric[] {
  const aggregated = new Map<string, AnalyticsMetric>();
  for (const metric of metrics) {
    const key = `${metric.type}:${metric.source}:${metric.targetId}`;
    const previous = aggregated.get(key);
    aggregated.set(key, {
      ...metric,
      day: "",
      clicks: (previous?.clicks ?? 0) + metric.clicks,
    });
  }
  return [...aggregated.values()].sort((left, right) => right.clicks - left.clicks || left.label.localeCompare(right.label));
}

function marketplaceById(id: string): Marketplace | undefined {
  return SITE.marketplaces.find((marketplace) => marketplace.id === id);
}

function sourceLabel(source: AnalyticsMetric["source"], strings: AnalyticsStrings): string {
  return strings.sourceLabels[source];
}

function eventLabel(type: ClickEventType, strings: AnalyticsStrings): string {
  return strings.eventLabels[type];
}

function marketplaceLabel(marketplace: Marketplace, strings: AnalyticsStrings): string {
  return strings.marketplaceLabels[marketplace.id];
}

function summaryFor(type: ClickEventType, metrics: readonly AnalyticsMetric[]): number {
  return sumClicks(metrics.filter((metric) => metric.type === type));
}

function TrendChart({
  daily,
  period,
  title,
  metric,
  noData,
}: {
  readonly daily: readonly DailyMetric[];
  readonly period: AnalyticsReport["period"];
  readonly title: string;
  readonly metric: "clicks" | "pageViews";
  readonly noData: string;
}) {
  const buckets = chartBucketsOf(daily, period);
  const maxValue = Math.max(1, ...buckets.map((bucket) => bucket[metric]));
  const total = buckets.reduce((sum, bucket) => sum + bucket[metric], 0);

  return (
    <div className="border-line flex flex-col gap-3 border-t pt-4">
      <h3 className="text-fg text-sm font-semibold">{title}</h3>
      {total === 0 ? (
        <p className="text-fg-muted text-sm">{noData}</p>
      ) : (
        <div className="overflow-x-auto">
          <ol aria-label={title} className="flex h-44 min-w-full items-end gap-1">
            {buckets.map((bucket) => {
              const value = bucket[metric];
              const height = value === 0 ? 0 : Math.max(3, (value / maxValue) * 100);
              return (
                <li key={bucket.day} className="flex h-full min-w-4 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-fg-muted text-[10px]">{value === 0 ? "" : value.toLocaleString("th-TH")}</span>
                  <div className="bg-brand-red w-full max-w-8 rounded-t-sm" style={{ height: `${height}%` }} />
                  <span className="text-fg-muted whitespace-nowrap text-[10px]">{dayLabel(bucket.day, period)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

export function AnalyticsDashboard({
  report,
  collectorConfigured,
  strings,
}: {
  readonly report: AnalyticsReport | null;
  readonly collectorConfigured: boolean;
  readonly strings: AnalyticsStrings;
}) {
  if (report === null) {
    return (
      <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-5 sm:p-6">
        <h2 className="text-fg text-lg font-semibold">{strings.title}</h2>
        <p className="text-fg-muted text-sm">{strings.databaseMissing}</p>
      </section>
    );
  }

  const metrics = aggregateMetrics(report.metrics);
  const platformTotals = new Map<Marketplace["platform"], number>();
  for (const metric of metrics) {
    if (metric.type !== "store_click") continue;
    const marketplace = marketplaceById(metric.targetId);
    if (marketplace !== undefined) {
      platformTotals.set(marketplace.platform, (platformTotals.get(marketplace.platform) ?? 0) + metric.clicks);
    }
  }

  const platforms = [...new Set(SITE.marketplaces.map((marketplace) => marketplace.platform))];
  const exportHref = `/admin/analytics/export?period=${encodeURIComponent(report.period)}`;
  const marketRows = SITE.marketplaces.map((marketplace) => {
    const metric = metrics.find((item) => item.type === "store_click" && item.targetId === marketplace.id);
    return {
      key: marketplace.id,
      label: marketplaceLabel(marketplace, strings),
      source: "home" as const,
      type: "store_click" as const,
      clicks: metric?.clicks ?? 0,
    };
  });
  const otherRows = metrics
    .filter((metric) => metric.type !== "store_click")
    .map((metric) => ({
      key: `${metric.type}:${metric.source}:${metric.targetId}`,
      label: metric.type === "site_view" ? strings.siteLabel : metric.label,
      source: metric.source,
      type: metric.type,
      clicks: metric.clicks,
    }));
  const rows = [...marketRows, ...otherRows].sort((left, right) => right.clicks - left.clicks || left.label.localeCompare(right.label));

  return (
    <section className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-fg text-lg font-semibold">{strings.title}</h2>
          <p className="text-fg-muted text-xs">{strings.range.replace("{from}", report.from).replace("{through}", report.through)}</p>
        </div>
        <Link
          href={exportHref}
          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-xl border px-3 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {strings.export}
        </Link>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <form action="/admin" method="get" className="flex flex-wrap items-end gap-2">
          <label htmlFor="analytics-period" className="text-fg-muted text-xs font-semibold">
            {strings.periodLabel}
          </label>
          <select
            id="analytics-period"
            name="analyticsPeriod"
            defaultValue={report.period}
            className="border-line-strong bg-surface text-fg focus-visible:ring-ring rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="week">{strings.periodWeek}</option>
            <option value="month">{strings.periodMonth}</option>
            <option value="year">{strings.periodYear}</option>
          </select>
          <button
            type="submit"
            className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-lg px-3 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.applyPeriod}
          </button>
        </form>
      </div>

      {!collectorConfigured ? (
        <p className="border-line bg-surface-raised text-fg-muted rounded-xl border p-3 text-xs" role="status">
          {strings.collectorDisabled}
        </p>
      ) : null}

      <p className="text-fg-muted text-xs">{strings.metricMeaning}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(["site_view", "store_click", "news_click", "recipe_click", "careers_view", "career_apply"] as const).map((type) => (
          <article key={type} className="border-line bg-surface-raised rounded-xl border p-3">
            <h3 className="text-fg-muted text-xs font-semibold">{eventLabel(type, strings)}</h3>
            <p className="text-fg mt-1 text-xl font-bold">{summaryFor(type, metrics).toLocaleString("th-TH")}</p>
          </article>
        ))}
      </div>

      <div className="border-line flex flex-col gap-3 border-t pt-4">
        <h3 className="text-fg text-sm font-semibold">{strings.platformTotals}</h3>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {platforms.map((platform) => (
            <li key={platform} className="border-line bg-surface-raised flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="text-fg">{strings.platformLabels[platform]}</span>
              <span className="text-fg font-semibold">{(platformTotals.get(platform) ?? 0).toLocaleString("th-TH")}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          daily={report.daily}
          period={report.period}
          title={strings.pageViewsChartTitle}
          metric="pageViews"
          noData={strings.noData}
        />
        <TrendChart
          daily={report.daily}
          period={report.period}
          title={strings.clicksChartTitle}
          metric="clicks"
          noData={strings.noData}
        />
      </div>

      <div className="border-line flex flex-col gap-3 border-t pt-4">
        <h3 className="text-fg text-sm font-semibold">{strings.breakdownTitle}</h3>
        {rows.length === 0 ? (
          <p className="text-fg-muted text-sm">{strings.noData}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="text-fg-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold">{strings.columnType}</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">{strings.columnItem}</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">{strings.columnSource}</th>
                  <th scope="col" className="py-2 text-right font-semibold">{strings.columnClicks}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-line border-t">
                    <td className="text-fg-muted py-2 pr-3">{eventLabel(row.type, strings)}</td>
                    <td className="text-fg py-2 pr-3">{row.label}</td>
                    <td className="text-fg-muted py-2 pr-3">{sourceLabel(row.source, strings)}</td>
                    <td className="text-fg py-2 text-right font-semibold">{row.clicks.toLocaleString("th-TH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

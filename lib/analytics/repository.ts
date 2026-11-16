import { getPool, isDatabaseConfigured } from "@/db/pool";
import { queryWithRole } from "@/lib/db/read";

import { analyticsPeriodBounds, type AnalyticsMetric, type AnalyticsPeriod, type AnalyticsReport, type ClickEventType } from "./model";

type MetricRow = {
  readonly day: string;
  readonly type: string;
  readonly source: string;
  readonly targetId: string;
  readonly clicks: string;
  readonly label: string;
};

type DailyRow = {
  readonly day: string;
  readonly clicks: string;
  readonly pageViews: string;
};

function clickCount(raw: string): number {
  const count = Number(raw);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid click metric count returned by database");
  return count;
}

function metricOf(row: MetricRow): AnalyticsMetric {
  const type = row.type as ClickEventType;
  if (!["site_view", "store_click", "news_click", "recipe_click", "careers_view", "career_apply"].includes(type)) {
    throw new Error(`Unknown analytics event type returned by database: ${row.type}`);
  }
  if (!["home", "news", "recipes", "careers", "site"].includes(row.source)) {
    throw new Error(`Unknown analytics source returned by database: ${row.source}`);
  }
  return {
    day: row.day,
    type,
    source: row.source as AnalyticsMetric["source"],
    targetId: row.targetId,
    label: type === "site_view" ? "website" : row.label,
    clicks: clickCount(row.clicks),
  };
}

export async function recordClickMetric(event: {
  readonly type: string;
  readonly targetId: string;
  readonly source: string;
}): Promise<boolean> {
  const result = await queryWithRole<{ recorded: boolean }>(
    "analytics",
    "select public.record_click_metric($1, $2, $3) as recorded",
    [event.type, event.targetId, event.source],
  );
  return result.rows[0]?.recorded === true;
}

export async function loadAnalyticsReport(
  period: AnalyticsPeriod,
  now: Date = new Date(),
): Promise<AnalyticsReport | null> {
  if (!isDatabaseConfigured()) return null;

  const bounds = analyticsPeriodBounds(period, now);
  const pool = getPool();
  const [daily, metrics] = await Promise.all([
    pool.query<DailyRow>(
      `with days as (
         select generate_series($1::date::timestamp, $2::date::timestamp, interval '1 day')::date as day
       )
       select days.day::text as day,
              coalesce(sum(metric.clicks) filter (where metric.event_type not in ('site_view', 'careers_view')), 0)::text as clicks,
              coalesce(sum(metric.clicks) filter (where metric.event_type = 'site_view'), 0)::text as "pageViews"
       from days
       left join click_metric_daily as metric on metric.day = days.day
       group by days.day
       order by days.day`,
      [bounds.from, bounds.through],
    ),
    pool.query<MetricRow>(
      `select metric.day::text as day, metric.event_type as type, metric.source,
              metric.target_id as "targetId", metric.clicks::text as clicks,
              case
                when metric.event_type = 'news_click' then coalesce(nullif(news.title_th, ''), news.source_id, metric.target_id)
                when metric.event_type = 'recipe_click' then coalesce(nullif(recipe.title_th, ''), recipe.source_id, metric.target_id)
                when metric.event_type = 'career_apply' then coalesce(nullif(job.title_th, ''), metric.target_id)
                else metric.target_id
              end as label
       from click_metric_daily as metric
       left join news on metric.event_type = 'news_click' and news.id = metric.target_id
       left join recipe on metric.event_type = 'recipe_click' and recipe.id = metric.target_id
       left join job_posting as job on metric.event_type = 'career_apply' and job.id = metric.target_id
       where metric.day between $1::date and $2::date
       order by metric.clicks desc, metric.event_type, label, metric.source`,
      [bounds.from, bounds.through],
    ),
  ]);

  return {
    period,
    ...bounds,
    daily: daily.rows.map((row) => ({
      day: row.day,
      clicks: clickCount(row.clicks),
      pageViews: clickCount(row.pageViews),
    })),
    metrics: metrics.rows.map(metricOf),
  };
}

export async function loadAnalyticsCsvMetrics(report: AnalyticsReport): Promise<readonly AnalyticsMetric[]> {
  return report.metrics;
}

import { SITE } from "@/lib/site";

export const ANALYTICS_PERIODS = ["week", "month", "year"] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const CLICK_EVENT_TYPES = [
  "site_view",
  "store_click",
  "news_click",
  "recipe_click",
  "careers_view",
  "career_apply",
] as const;
export type ClickEventType = (typeof CLICK_EVENT_TYPES)[number];

export type ClickEvent = {
  readonly type: ClickEventType;
  readonly targetId: string;
  readonly source: "home" | "news" | "recipes" | "careers" | "site";
};

export type DailyMetric = {
  readonly day: string;
  readonly clicks: number;
  readonly pageViews: number;
};

export type AnalyticsMetric = {
  readonly day: string;
  readonly type: ClickEventType;
  readonly source: ClickEvent["source"];
  readonly targetId: string;
  readonly label: string;
  readonly clicks: number;
};

export type AnalyticsReport = {
  readonly period: AnalyticsPeriod;
  readonly from: string;
  readonly through: string;
  readonly daily: readonly DailyMetric[];
  readonly metrics: readonly AnalyticsMetric[];
};

const SOURCES_BY_TYPE: Readonly<Record<ClickEventType, readonly ClickEvent["source"][]>> = {
  site_view: ["site"],
  store_click: ["home"],
  news_click: ["home", "news"],
  recipe_click: ["home", "recipes"],
  careers_view: ["careers"],
  career_apply: ["careers"],
};

const TARGET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const MARKETPLACE_IDS: ReadonlySet<string> = new Set(SITE.marketplaces.map((marketplace) => marketplace.id));

export function isAnalyticsPeriod(value: unknown): value is AnalyticsPeriod {
  return typeof value === "string" && ANALYTICS_PERIODS.includes(value as AnalyticsPeriod);
}

export function parseClickEvent(value: unknown): ClickEvent | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["type", "targetId", "source"].includes(key))) return null;
  if (
    typeof record.type !== "string" ||
    !CLICK_EVENT_TYPES.includes(record.type as ClickEventType) ||
    typeof record.targetId !== "string" ||
    !TARGET_ID_PATTERN.test(record.targetId) ||
    typeof record.source !== "string"
  ) {
    return null;
  }

  const type = record.type as ClickEventType;
  const source = record.source as ClickEvent["source"];
  if (!SOURCES_BY_TYPE[type].includes(source)) return null;
  if (type === "site_view" && record.targetId !== "site") return null;
  if (type === "store_click" && !MARKETPLACE_IDS.has(record.targetId)) return null;
  if (type === "careers_view" && record.targetId !== "careers") return null;

  return { type, targetId: record.targetId, source };
}

export function isTrackablePageViewPath(pathname: string, locale: string): boolean {
  const localePrefix = `/${locale}`;
  if (pathname !== localePrefix && !pathname.startsWith(`${localePrefix}/`)) return false;
  const previewPrefix = `${localePrefix}/preview`;
  return pathname !== previewPrefix && !pathname.startsWith(`${previewPrefix}/`);
}

function bangkokDateParts(now: Date): { readonly year: number; readonly month: number; readonly day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const valueOf = (type: "year" | "month" | "day"): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) throw new Error(`Missing ${type} in Bangkok date`);
    return Number(value);
  };
  return { year: valueOf("year"), month: valueOf("month"), day: valueOf("day") };
}

function dateText(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function analyticsPeriodBounds(period: AnalyticsPeriod, now: Date = new Date()): {
  readonly from: string;
  readonly through: string;
} {
  const { year, month, day } = bangkokDateParts(now);
  const today = new Date(Date.UTC(year, month - 1, day));
  let start: Date;
  if (period === "week") {
    const daysSinceMonday = (today.getUTCDay() + 6) % 7;
    start = new Date(today.getTime() - daysSinceMonday * 86_400_000);
  } else if (period === "month") {
    start = new Date(Date.UTC(year, month - 1, 1));
  } else {
    start = new Date(Date.UTC(year, 0, 1));
  }
  return { from: dateText(start), through: dateText(today) };
}

export function chartBucketsOf(daily: readonly DailyMetric[], period: AnalyticsPeriod): readonly DailyMetric[] {
  if (period !== "year") return daily;
  const monthly = new Map<string, number>();
  const monthlyPageViews = new Map<string, number>();
  for (const point of daily) {
    const month = point.day.slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + point.clicks);
    monthlyPageViews.set(month, (monthlyPageViews.get(month) ?? 0) + point.pageViews);
  }
  return [...monthly].map(([day, clicks]) => ({
    day,
    clicks,
    pageViews: monthlyPageViews.get(day) ?? 0,
  }));
}

export function sumClicks(metrics: readonly { readonly clicks: number }[]): number {
  return metrics.reduce((sum, metric) => sum + metric.clicks, 0);
}

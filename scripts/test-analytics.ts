import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  analyticsPeriodBounds,
  chartBucketsOf,
  isTrackablePageViewPath,
  isAnalyticsPeriod,
  parseClickEvent,
  sumClicks,
} from "@/lib/analytics/model";
import { SITE } from "@/lib/site";

test("analytics: validates supported events, source/event pairs, and target identifiers", () => {
  assert.deepEqual(parseClickEvent({ type: "store_click", targetId: "shopee-serda", source: "home" }), {
    type: "store_click",
    targetId: "shopee-serda",
    source: "home",
  });
  assert.deepEqual(parseClickEvent({ type: "career_apply", targetId: "job-22", source: "careers" }), {
    type: "career_apply",
    targetId: "job-22",
    source: "careers",
  });
  assert.deepEqual(parseClickEvent({ type: "site_view", targetId: "site", source: "site" }), {
    type: "site_view",
    targetId: "site",
    source: "site",
  });

  assert.equal(parseClickEvent({ type: "site_view", targetId: "/en/news/123", source: "site" }), null);
  assert.equal(parseClickEvent({ type: "site_view", targetId: "site", source: "news" }), null);
  assert.equal(parseClickEvent({ type: "store_click", targetId: "not-a-store", source: "home" }), null);
  assert.equal(parseClickEvent({ type: "store_click", targetId: "shopee", source: "news" }), null);
  assert.equal(parseClickEvent({ type: "careers_view", targetId: "job-22", source: "careers" }), null);
  assert.equal(parseClickEvent({ type: "news_click", targetId: "bad id", source: "news" }), null);
  assert.equal(parseClickEvent({ type: "news_click", targetId: "news-1", source: "news", email: "private@example.com" }), null);
});

test("analytics: database allowlist covers every configured marketplace", () => {
  const migration = [
    "0054-click-metrics.sql",
    "0055-site-page-views.sql",
  ].map((file) => readFileSync(join(import.meta.dirname, "..", "db", "migrations", file), "utf8")).join("\n");
  for (const marketplace of SITE.marketplaces) {
    assert.ok(migration.includes(`'${marketplace.id}'`), `database allowlist is missing ${marketplace.id}`);
  }
  assert.match(migration, /p_event_type = 'site_view'/);
});

test("analytics: page views include direct public routes but exclude preview routes", () => {
  assert.equal(isTrackablePageViewPath("/th", "th"), true);
  assert.equal(isTrackablePageViewPath("/en/news/123", "en"), true);
  assert.equal(isTrackablePageViewPath("/th/preview/home", "th"), false);
  assert.equal(isTrackablePageViewPath("/admin/analytics", "th"), false);
  assert.equal(isTrackablePageViewPath("/de/about", "th"), false);
});

test("analytics: periods use Bangkok dates and weeks start on Monday", () => {
  const mondayAtBangkok = new Date("2026-01-04T18:00:00.000Z");
  assert.deepEqual(analyticsPeriodBounds("week", mondayAtBangkok), {
    from: "2026-01-05",
    through: "2026-01-05",
  });
  assert.deepEqual(analyticsPeriodBounds("month", mondayAtBangkok), {
    from: "2026-01-01",
    through: "2026-01-05",
  });
  assert.deepEqual(analyticsPeriodBounds("year", mondayAtBangkok), {
    from: "2026-01-01",
    through: "2026-01-05",
  });
  assert.deepEqual(analyticsPeriodBounds("week", new Date("2026-03-01T00:00:00.000Z")), {
    from: "2026-02-23",
    through: "2026-03-01",
  });
});

test("analytics: rejects invalid periods and groups yearly chart points by month", () => {
  assert.equal(isAnalyticsPeriod("month"), true);
  assert.equal(isAnalyticsPeriod("quarter"), false);
  assert.equal(isAnalyticsPeriod(null), false);

  const daily = [
    { day: "2026-01-01", clicks: 3, pageViews: 10 },
    { day: "2026-01-31", clicks: 2, pageViews: 5 },
    { day: "2026-02-01", clicks: 4, pageViews: 8 },
  ];
  assert.deepEqual(chartBucketsOf(daily, "year"), [
    { day: "2026-01", clicks: 5, pageViews: 15 },
    { day: "2026-02", clicks: 4, pageViews: 8 },
  ]);
  assert.deepEqual(chartBucketsOf(daily, "month"), daily);
  assert.equal(sumClicks(chartBucketsOf(daily, "year")), 9);
  assert.equal(sumClicks([]), 0);
});

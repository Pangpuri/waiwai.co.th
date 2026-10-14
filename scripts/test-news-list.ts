import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  BUDDHIST_YEAR_OFFSET,
  buddhistYearOf,
  christianYearOfLabel,
  clampNewsPage,
  defaultNewsListView,
  isNewsSort,
  newsListPath,
  newsPageCount,
  newsYearOptions,
  parseNewsPageNumber,
} from "@/lib/news/list-view";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

/**
 * เทสต์มุมมองรายการข่าว (รอบที่ 271 · มติเจ้าของ D29)
 *
 * ผู้ใช้แจ้ง: *"มีหน้าข่าวสารและกิจกรรม ไม่ได้เรียงตามวันที่ล่าสุดลงมาหาเก่าสุดครับตอนนี้
 * อาจจะเพิ่มการปรับล่าสุดเป็นดีฟอลและเพิ่มตัวกรองว่าให้กรองจากอะไรในการโชว์หน้าครับ"*
 *
 * มติ: (1) ตัวกรอง = ปี พ.ศ. + สลับ ล่าสุด/เก่าสุด · ค่าเริ่มต้น = ล่าสุด
 *      (2) หน้า static แยกเส้นทาง (ไม่ใช้ query) (3) `sort_order` ไม่มีผลกับหน้าเว็บ
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("news-view: เส้นทางของแต่ละมุมมอง (พาธกลาง · หน้า 1 ไม่ใส่ /page/1)", () => {
  const base = defaultNewsListView();
  assert.deepEqual(base, { sort: "newest", year: null, page: 1 }, "ค่าเริ่มต้นต้องเป็นล่าสุด · ทุกปี · หน้า 1");

  assert.equal(newsListPath({ sort: "newest", year: null, page: 1 }), "/news");
  assert.equal(newsListPath({ sort: "newest", year: null, page: 3 }), "/news/page/3");
  assert.equal(newsListPath({ sort: "oldest", year: null, page: 1 }), "/news/oldest");
  assert.equal(newsListPath({ sort: "oldest", year: null, page: 2 }), "/news/oldest/page/2");
  /* 2021 (ค.ศ.) = พ.ศ. 2564 */
  assert.equal(newsListPath({ sort: "newest", year: 2021, page: 1 }), "/news/year/2564");
  assert.equal(newsListPath({ sort: "newest", year: 2021, page: 2 }), "/news/year/2564/page/2");
  assert.equal(newsListPath({ sort: "oldest", year: 2021, page: 1 }), "/news/year/2564/oldest");
  assert.equal(newsListPath({ sort: "oldest", year: 2021, page: 4 }), "/news/year/2564/oldest/page/4");

  /* ห้ามมี prefix ภาษาในพาธกลาง (ตัวเรียกใช้ localePath เติมให้) */
  for (const view of [
    { sort: "newest", year: null, page: 1 },
    { sort: "oldest", year: 2021, page: 2 },
  ] as const) {
    assert.ok(!/^\/(th|en)(\/|$)/.test(newsListPath(view)), `พาธต้องไม่ผูกภาษา: ${newsListPath(view)}`);
  }
});

test("news-view: แปลงปี พ.ศ. ↔ ค.ศ. และปฏิเสธค่าที่ไม่ใช่ปี", () => {
  assert.equal(BUDDHIST_YEAR_OFFSET, 543);
  assert.equal(buddhistYearOf("2026-09-12T10:00:00Z"), 2569);
  assert.equal(buddhistYearOf("2018-10-09"), 2561);
  assert.equal(buddhistYearOf(null), null);
  assert.equal(buddhistYearOf("ไม่ใช่วันที่"), null);

  assert.equal(christianYearOfLabel("2564"), 2021);
  assert.equal(christianYearOfLabel(" 2569 "), 2026);
  for (const bad of ["", "64", "25644", "abcd", "9999", "1000"]) {
    assert.equal(christianYearOfLabel(bad), null, `"${bad}" ต้องไม่ถูกตีเป็นปี`);
  }
  /* ค่าที่ได้ต้องตรงกับปีในฐานข้อมูล (ค.ศ.) — ใช้กรองด้วย `extract(year …)` */
  assert.equal(christianYearOfLabel("2561"), 2018);
});

test("news-view: จำนวนหน้า/เลขหน้า — ปลอดภัยกับค่าหลุดช่วง", () => {
  assert.equal(newsPageCount(151, 15), 11);
  assert.equal(newsPageCount(0, 15), 1, "ไม่มีข่าวเลย = ยังมีหน้า 1 (แสดงการ์ดทดสอบ)");
  assert.equal(newsPageCount(15, 15), 1);
  assert.equal(newsPageCount(16, 15), 2);
  assert.equal(clampNewsPage(99, 11), 11);
  assert.equal(clampNewsPage(0, 11), 1);
  assert.equal(clampNewsPage(Number.NaN, 11), 1);

  assert.equal(parseNewsPageNumber("7"), 7);
  assert.equal(parseNewsPageNumber(" 7 "), 7);
  for (const bad of ["0", "-1", "2.5", "abc", ""]) {
    assert.equal(parseNewsPageNumber(bad), null, `"${bad}" ต้องไม่ใช่เลขหน้า`);
  }
});

test("news-view: ตัวเลือกปีในแถวกรอง — มาก→น้อย · ตัดปีที่ไม่มีข่าว", () => {
  const options = newsYearOptions([
    { year: 2564, count: 22 },
    { year: 2569, count: 13 },
    { year: 2560, count: 0 },
    { year: 2568, count: 27 },
  ]);
  assert.deepEqual(
    options.map((option) => option.year),
    [2569, 2568, 2564],
    "เรียงปีใหม่→เก่า และตัดปีที่ไม่มีข่าวออก",
  );
  assert.equal(options[0]?.christianYear, 2026, "ต้องมีปี ค.ศ. ให้สร้างเส้นทาง/กรอง");
  assert.equal(options[2]?.christianYear, 2021);
});

test("news-view: ⚠️ หน้าเว็บต้องเรียงตามวันที่เสมอ — `sort_order` ห้ามกลับมาในคิวรีสาธารณะ", () => {
  const repository = sourceOf("lib/news/repository.ts");
  const orderLine = repository.slice(repository.indexOf("const PUBLIC_NEWS_ORDER"));
  const order = orderLine.slice(0, orderLine.indexOf(";") + 1);

  assert.ok(order.includes("n.published_at desc nulls last"), `ลำดับสาธารณะต้องเป็นวันที่มาก่อน: ${order}`);
  assert.ok(order.includes("n.id desc"), "ตัวตัดสินสุดท้ายต้องนิ่ง (id) เมื่อวันที่ซ้ำกัน");
  assert.ok(!order.includes("sort_order"), "ต้องไม่มี sort_order ในลำดับสาธารณะ (เคสจริงรอบ 271)");

  /* เรียงกลับได้ (เก่าสุดก่อน) — ใช้ตัวแปรทิศทาง ไม่สร้างสตริงใหม่ */
  assert.ok(repository.includes('const direction = options.sort === "oldest" ? "asc" : "desc";'));
  /* กรองปีต้องใช้พารามิเตอร์ ไม่ต่อสตริงจากผู้ใช้ */
  assert.ok(repository.includes("extract(year from n.published_at) = $"), "กรองปีต้องผูกพารามิเตอร์");
});

test("news-view: แถวกรองเป็นลิงก์ล้วน (ไม่เพิ่ม JS) และใช้เส้นทาง static", () => {
  const filter = sourceOf("features/news/ui/news-filter.tsx");
  assert.ok(!filter.includes('"use client"'), "แถวกรองต้องเป็น Server Component (ไม่มี JS)");
  assert.ok(!filter.includes("searchParams"), "ห้ามใช้ query string");
  assert.ok(filter.includes("newsListPath("), "ต้องสร้างเส้นทางจากตรรกะกลางตัวเดียว");
  assert.ok(filter.includes('aria-current='), "ปุ่มที่เลือกอยู่ต้องบอกผู้ช่วยอ่านหน้าจอ");

  const page = sourceOf("features/news/ui/news-list-page.tsx");
  assert.ok(page.includes("NewsFilter"), "หน้าจวมุมมองต้องมีแถวกรอง");
  assert.ok(page.includes("math") === false || true, "");
  assert.ok(page.includes("heading={m.title}"), "โหมดบล็อกต้องส่ง heading (a11y · 1 h1 ต่อหน้า)");
});

test("news-view: ทุกเส้นทางของมุมมองต้องมีอยู่จริง + revalidate 300 + ห้ามปิด dynamicParams", () => {
  const routes = [
    "app/[lang]/news/page.tsx",
    "app/[lang]/news/page/[page]/page.tsx",
    "app/[lang]/news/oldest/page.tsx",
    "app/[lang]/news/oldest/page/[page]/page.tsx",
    "app/[lang]/news/year/[year]/page.tsx",
    "app/[lang]/news/year/[year]/page/[page]/page.tsx",
    "app/[lang]/news/year/[year]/oldest/page.tsx",
    "app/[lang]/news/year/[year]/oldest/page/[page]/page.tsx",
  ];
  for (const route of routes) {
    assert.ok(existsSync(path.join(ROOT, route)), `${route} ต้องมีอยู่`);
    const source = sourceOf(route);
    assert.ok(source.includes("export const revalidate = 300"), `${route}: ต้องมี revalidate = 300 (ISR)`);
    assert.ok(!/export const dynamicParams = false/.test(source), `${route}: ห้ามปิด dynamicParams (บทเรียนรอบ 139)`);
    assert.ok(source.includes("NewsListViewPage"), `${route}: ต้องใช้หน้าจอรวมตัวเดียวกัน`);
  }
});

test("news-view: ข้อความแถวกรองมีครบทั้งสองภาษา", () => {
  for (const [locale, page] of [
    ["th", th.newsPage],
    ["en", en.newsPage],
  ] as const) {
    for (const key of [
      "dbFilterLabel",
      "dbFilterAllYears",
      "dbFilterYear",
      "dbSortLabel",
      "dbSortNewest",
      "dbSortOldest",
    ] as const) {
      assert.ok(page[key].trim().length > 0, `${locale}: newsPage.${key} ว่าง`);
    }
    assert.ok(page.dbFilterYear.includes("{year}"), `${locale}: ป้ายปีต้องมี {year} ให้เติมค่า`);
  }
  assert.notEqual(th.newsPage.dbSortNewest, en.newsPage.dbSortNewest, "สองภาษาต้องไม่ใช่ข้อความเดียวกัน");
});

test("news-view: แปลงค่าจาก URL ได้แบบไม่โยน error (หน้าที่ไม่ถูกต้อง → 404 ไม่ใช่ 500)", () => {
  assert.equal(isNewsSort("newest"), true);
  assert.equal(isNewsSort("oldest"), true);
  assert.equal(isNewsSort("random"), false);
  /* หน้าที่ใช้ตัวแปลงต้องเรียก notFound() เมื่อค่าไม่ถูกต้อง */
  for (const route of [
    "app/[lang]/news/year/[year]/page.tsx",
    "app/[lang]/news/oldest/page/[page]/page.tsx",
  ]) {
    const source = sourceOf(route);
    assert.ok(source.includes("notFound()"), `${route}: ต้องตอบ 404 เมื่อพารามิเตอร์ไม่ถูกต้อง`);
  }
});

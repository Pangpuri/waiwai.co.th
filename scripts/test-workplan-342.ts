import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parseExportProductPage } from "@/lib/products/export-parse";
import { isProductMarket, validateProductInput } from "@/lib/products/model";
import { productHasDetails } from "@/lib/products/display";
import { parseProductsPageCopy, PRODUCTS_PAGE_COPY_KEY } from "@/lib/products/page-copy-model";
import { parseYouTubeViewCount } from "@/lib/recipes/youtube-views";
import { isHeroSlideLocale, selectHeroSlidesForLocale, type HeroPageSlide } from "@/lib/hero/model";
import {
  NEWS_VIEW_DEDUPE_MS,
  parseNewsViewMarks,
  shouldCountNewsView,
  withNewsViewMark,
} from "@/lib/news/view-counter";
import { NEWS_VIEW_GRANT_COLUMNS, NEWS_VIEW_WHERE_COLUMNS } from "./db-roles.ts";

/* ── 342: สินค้าส่งออก (ตัวแกะหน้าเว็บเดิม) ──────────────────────────────── */

const EXPORT_HTML = `
<section class="module-page">
  <table>
    <tbody>
      <tr><td><img src="https://cdn.example/a.gif" width="210" /></td><td><img src="https://cdn.example/b.gif" width="210" /></td></tr>
      <tr><td>Tom Yum Shrimp Flavour</td><td>Chicken Flavour</td></tr>
      <tr><td>A spicy hot and sour soup.</td><td>A good blending of chicken broth.</td></tr>
      <tr><td>1 carton = 62.3 x 35.3 x 39.2 cm.</td><td>1 carton = 60.5 x 35.0 x 38.5 cm.</td></tr>
    </tbody>
  </table>
</section>`;

test("export-parse: แกะชื่อ/คำอธิบาย/ขนาดบรรจุ/ภาพ จากตารางเว็บเดิม", () => {
  const page = parseExportProductPage(EXPORT_HTML);
  assert.equal(page.products.length, 2);
  assert.equal(page.products[0]?.nameEn, "Tom Yum Shrimp Flavour");
  assert.equal(page.products[0]?.nameTh, "Tom Yum Shrimp Flavour", "ไม่มีชื่อไทย = ใช้ชื่ออังกฤษ");
  assert.match(page.products[0]?.detailsEn ?? "", /spicy hot and sour/);
  assert.match(page.products[0]?.packaging ?? "", /^1 carton =/);
  assert.equal(page.products[1]?.imageUrl, "https://cdn.example/b.gif");
});

test("export-parse: หน้าเปล่า/ไม่มีตาราง = ไม่โยน error", () => {
  assert.deepEqual(parseExportProductPage("<html></html>").products, []);
});

test("product market: ค่าที่รู้จักผ่าน · ค่าแปลกปลอมถูกปฏิเสธ", () => {
  assert.equal(isProductMarket("domestic"), true);
  assert.equal(isProductMarket("export"), true);
  assert.equal(isProductMarket("wholesale"), false);
  assert.equal(isProductMarket(""), false);

  const base = {
    id: "px1515401",
    categoryId: "instant-noodles" as const,
    sourceId: "x1515401",
    sourceUrl: "/en/pages/15154-x",
    nameTh: "Test",
    nameEn: "Test",
    groupTh: "",
    groupEn: "",
    taglineTh: "",
    taglineEn: "",
    detailsTh: "",
    detailsEn: "",
    allergensTh: "",
    allergensEn: "",
    netWeightTh: "",
    netWeightEn: "",
    fdaNumber: "",
    packagingTh: "",
    packagingEn: "",
    sortOrder: 1,
  };
  assert.deepEqual(validateProductInput({ ...base, market: "export" }), []);
  const issues = validateProductInput({ ...base, market: "bad" as unknown as "export" });
  assert.ok(issues.some((issue) => issue.code === "unknown-market"));
});

/* ── 342: ยอดวิวข่าว (กันนับซ้ำ) ─────────────────────────────────────────── */

test("news view: นับครั้งแรก แล้วไม่นับซ้ำภายใน 24 ชม.", () => {
  const now = 1_700_000_000_000;
  const marks = parseNewsViewMarks("", now);
  assert.equal(shouldCountNewsView(marks, "148398", now), true);

  const after = withNewsViewMark(marks, "148398", now);
  const parsed = parseNewsViewMarks(after, now + 1000);
  assert.equal(shouldCountNewsView(parsed, "148398", now + 1000), false);
  assert.equal(shouldCountNewsView(parsed, "148399", now + 1000), true, "ข่าวอื่นยังนับได้");
  assert.equal(shouldCountNewsView(parsed, "148398", now + NEWS_VIEW_DEDUPE_MS), true, "ครบ 24 ชม. = นับใหม่");
});

test("news view: คุกกี้เสีย/ยอดเก่าเกินกำหนดถูกข้าม ไม่ทำให้ request ล้ม", () => {
  const now = 1_700_000_000_000;
  assert.deepEqual(parseNewsViewMarks("garbage,abc:1,148398:not-a-number", now), []);
  const old = `148398:${String(now - NEWS_VIEW_DEDUPE_MS - 1)}`;
  assert.deepEqual(parseNewsViewMarks(old, now), []);
});

/* ── 342: ยอดวิว YouTube ─────────────────────────────────────────────────── */

test("youtube views: อ่าน viewCount จาก HTML และคืน null เมื่อไม่มี/ค่าเสีย", () => {
  assert.equal(parseYouTubeViewCount('{"viewCount":"4045"}'), 4045);
  assert.equal(parseYouTubeViewCount("no data"), null);
  assert.equal(parseYouTubeViewCount('{"viewCount":"-1"}'), null);
});

/* ── 342: สไลด์ hero ตามภาษา ─────────────────────────────────────────────── */

const slide = (id: string, locale: HeroPageSlide["locale"]): HeroPageSlide => ({
  id,
  sortOrder: 1,
  locale,
  mediaPath: "/slide/x.jpg",
  altTh: id,
  altEn: id,
  focusX: 50,
  focusY: 50,
  zoom: 1,
  isActive: true,
});

test("hero locale: เหลือ 2 ภาษา · สไลด์แยกไทย/อังกฤษชัดเจน ไม่มี all", () => {
  const mixed = [slide("th", "th"), slide("en", "en")];
  assert.deepEqual(selectHeroSlidesForLocale(mixed, "th").map((s) => s.id), ["th"]);
  assert.deepEqual(selectHeroSlidesForLocale(mixed, "en").map((s) => s.id), ["en"]);

  /* ข้อมูลเก่าที่ไม่มี locale = ถือเป็นไทย (ไม่หายจากหน้าไทย) */
  const legacy = [{ ...slide("legacy", "th"), locale: undefined }];
  assert.deepEqual(selectHeroSlidesForLocale(legacy, "th").map((s) => s.id), ["legacy"]);
  assert.deepEqual(selectHeroSlidesForLocale(legacy, "en"), []);
  assert.deepEqual(selectHeroSlidesForLocale([], "th"), []);

  assert.equal(isHeroSlideLocale("all"), false);
  assert.equal(isHeroSlideLocale("th"), true);
  assert.equal(isHeroSlideLocale("en"), true);
});

/* ── 342: สิทธิ์นับวิว (least privilege) ─────────────────────────────────── */

test("news view: role ฟอร์มได้สิทธิ์แคบสุด + ตัวนับใช้ประตู formQuery", () => {
  assert.deepEqual([...NEWS_VIEW_GRANT_COLUMNS], ["view_count"]);
  assert.ok(NEWS_VIEW_WHERE_COLUMNS.includes("source_id"));
  assert.ok(NEWS_VIEW_WHERE_COLUMNS.includes("status"));
  assert.ok(NEWS_VIEW_WHERE_COLUMNS.includes("deleted_at"));

  const source = readFileSync("lib/news/metrics.ts", "utf8");
  assert.ok(source.includes("formQuery"), "ตัวนับวิวต้องใช้ formQuery (role สิทธิ์แคบ)");
  assert.ok(!source.includes("getPool"), "ห้ามใช้ pool เขียนของหลังบ้านในเส้นทางสาธารณะ");
});

/* ── 342: การ์ดที่ไม่มีข้อมูล = ไม่ต้องมี dropdown ─────────────────────────── */

const emptyProduct = {
  nameTh: "สินค้าทดสอบ",
  nameEn: "Test product",
  groupTh: "",
  groupEn: "",
  taglineTh: "",
  taglineEn: "",
  detailsTh: "",
  detailsEn: "",
  allergensTh: "",
  allergensEn: "",
  netWeightTh: "",
  netWeightEn: "",
  packagingTh: "",
  packagingEn: "",
  fdaNumber: "",
  ingredients: [],
};

test("product details: การ์ดที่มีแค่ชื่อ/ภาพ = ไม่มีอะไรให้กาง", () => {
  assert.equal(productHasDetails(emptyProduct, "th"), false);
  assert.equal(productHasDetails(emptyProduct, "en"), false);
});

test("product details: มีข้อมูลอย่างน้อย 1 ช่อง = กางได้", () => {
  assert.equal(productHasDetails({ ...emptyProduct, taglineTh: "คำโปรย" }, "th"), true);
  assert.equal(productHasDetails({ ...emptyProduct, packagingEn: "1 carton" }, "en"), true);
  assert.equal(productHasDetails({ ...emptyProduct, ingredients: [{ nameTh: "แป้ง" }] }, "th"), true);
});

test("recipe lightbox: เรนเดอร์ผ่าน portal ออกจากกรอบ dropdown", () => {
  const source = readFileSync("features/recipes/ui/recipe-image-lightbox.tsx", "utf8");
  assert.ok(source.includes("createPortal"), "ต้องใช้ createPortal");
  assert.ok(source.includes("document.body"), "ต้อง portal ไปที่ document.body");
});

test("products page copy: อ่าน/ตัดช่องว่าง/จำกัดความยาว และคีย์แยกจาก site settings", () => {
  assert.equal(PRODUCTS_PAGE_COPY_KEY, "products-page-copy");

  const parsed = parseProductsPageCopy({
    eyebrow: { th: "  หมวดผลิตภัณฑ์ของเรา  ", en: "  Our products  " },
    title: { th: "เลือกหมวดที่สนใจ", en: "Choose a category" },
    intro: { th: "รายละเอียดผลิตภัณฑ์", en: "Product details" },
  });
  assert.deepEqual(parsed, {
    eyebrow: { th: "หมวดผลิตภัณฑ์ของเรา", en: "Our products" },
    title: { th: "เลือกหมวดที่สนใจ", en: "Choose a category" },
    intro: { th: "รายละเอียดผลิตภัณฑ์", en: "Product details" },
  });

  assert.equal(parseProductsPageCopy(null), null);
  assert.equal(parseProductsPageCopy([]), null);
  assert.deepEqual(parseProductsPageCopy({ eyebrow: { th: "x".repeat(200) } })?.eyebrow.th.length, 80);
});

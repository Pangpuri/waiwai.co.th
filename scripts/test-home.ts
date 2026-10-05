import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  homeCategoryCards,
  homeNewsItems,
  homeProductHighlights,
  homeRecipeItems,
} from "@/features/home/view-models";
import { CATALOG_ITEMS, catalogHref, catalogSlugs } from "@/features/products/catalog";
import { HERO_SLIDES } from "@/features/home/slides";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import type { ProductCategoryCardRecord, ProductHighlightRecord } from "@/lib/products/repository";
import type { NewsRecord } from "@/lib/news/repository";
import type { RecipeRecord } from "@/lib/recipes/repository";

/**
 * เทสต์หน้าแรก (รอบที่ 108) — "แก้ลิงก์เสีย + เอาของจริงมาแสดง"
 *
 * บริบทจริง (ตรวจจากหน้าเว็บที่เรนเดอร์)
 * - หน้าแรกเคยมี **ลิงก์เสีย 4 เส้น** ไป `/products/{packet-noodles,cup-noodles,ready-to-cook,seasoning}`
 *   เพราะฝัง slug เองใน `features/home/content.ts` (ของจริงคือ `instant-noodles` · `dried-vermicelli` ·
 *   `serda` · `quick-zabb` · `noodie` · `rod-ded`)
 * - และ 3 ส่วน (สินค้า/เมนู/ข่าว) ยังแสดง "ข้อมูลทดสอบ" ทั้งที่ฐานข้อมูลมีของจริง
 * ⇒ เทสต์ชุดนี้ล็อกทั้งสองเรื่องไว้ (ทั้งระดับข้อมูลแปลง และการสแกนซอร์ส)
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/**
 * ตัดคอมเมนต์ออก — ใช้สแกน "โค้ดจริง" เท่านั้น
 * (คอมเมนต์ที่อธิบายบทเรียนมีคำว่า `/products/cup-noodles` ได้ — เป็นประวัติ ไม่ใช่ลิงก์)
 */
function codeOf(relativePath: string): string {
  return sourceOf(relativePath)
    .replaceAll(/\/\*[\s\S]*?\*\//g, " ")
    .replaceAll(/(^|\s)\/\/[^\n]*/g, " ");
}

const categoryRow: ProductCategoryCardRecord = {
  id: "instant-noodles",
  descriptionTh: "เริ่มผลิตครั้งแรกเมื่อปี พ.ศ. 2515",
  descriptionEn: "",
  imagePath: "/media/catInstant",
  imageWidth: 500,
  imageHeight: 603,
  productCount: 22,
};

const highlightRow: ProductHighlightRecord = {
  id: "p40599",
  categoryId: "instant-noodles",
  nameTh: "บะหมี่กึ่งสำเร็จรูปไวไว รสปรุงสำเร็จ",
  nameEn: "",
  imagePath: "/media/prod1",
  imageWidth: 500,
  imageHeight: 603,
};

const recipeRow: RecipeRecord = {
  id: "r1",
  sourceId: "12586",
  sourceUrl: "/th/articles/1",
  titleTh: "เมนูต้มยำแห้ง",
  titleEn: "Dry tom yum",
  coverPath: "/media/cover1",
  coverWidth: 800,
  coverHeight: 600,
  videoProvider: "youtube",
  videoId: "abc123",
  publishedOn: "2026-08-01",
  sortOrder: 1,
};

const newsRow: NewsRecord = {
  id: "n148398",
  sourceId: "148398",
  sourceUrl: "/th/news/148398-x",
  titleTh: "ว้าวสนั่นกรุง",
  titleEn: "",
  excerptTh: "คำโปรย",
  excerptEn: "",
  coverPath: "/media/newscover",
  coverWidth: 400,
  coverHeight: 300,
  body: [],
  publishedLocal: "2026-09-12T11:28",
  publishedLabel: "12 กันยายน 2026 11:28",
};

/* ── 1) หมวดสินค้า: ลิงก์ต้องชี้ slug จริงเสมอ ─────────────────────────────── */

test("home: การ์ดหมวดมาจาก CATALOG_ITEMS 6 ใบ และลิงก์ชี้ slug จริงทุกใบ", () => {
  const cards = homeCategoryCards([categoryRow], "th", th);

  assert.equal(cards.length, CATALOG_ITEMS.length, "ต้องมี 6 หมวดตามแค็ตตาล็อก");
  assert.deepEqual(
    cards.map((card) => card.slug),
    CATALOG_ITEMS.map((item) => item.slug),
    "ลำดับต้องตาม CATALOG_ITEMS",
  );

  for (const card of cards) {
    assert.ok(catalogSlugs().includes(card.slug), `${card.slug} ต้องเป็น slug ที่มีอยู่จริง`);
    assert.equal(card.href, `/th/products/${card.slug}`, "ลิงก์ต้องมี prefix ภาษาและ slug จริง");
    assert.notEqual(card.name.trim(), "", "ชื่อหมวดต้องมาจากพจนานุกรม (ไม่ว่าง)");
  }

  const first = cards[0];
  assert.ok(first !== undefined);
  assert.equal(first.productCount, 22, "จำนวนสินค้ามาจากฐานข้อมูล");
  assert.equal(first.image.src, "/media/catInstant", "ใช้ภาพจริงจากคลังเมื่อมี");
  assert.equal(first.imageFromDatabase, true);
  assert.equal(first.description, "เริ่มผลิตครั้งแรกเมื่อปี พ.ศ. 2515");

  /* หมวดที่ไม่มีแถวในฐานข้อมูล → ยังเป็นการ์ดที่ลิงก์ถูก + ถอยไปใช้ภาพในโค้ด */
  const second = cards[1];
  assert.ok(second !== undefined);
  assert.equal(second.href, `/th/products/${second.slug}`);
  assert.equal(second.productCount, 0);
  assert.equal(second.imageFromDatabase, false);
  assert.ok(second.image.src.startsWith("/products/"), "ถอยไปใช้ภาพใน public/products/");
});

test("home: การ์ดหมวดเป็นอังกฤษได้ (EN ว่าง → ถอยไปใช้ไทย)", () => {
  const cards = homeCategoryCards([categoryRow], "en", en);
  const first = cards[0];
  assert.ok(first !== undefined);
  assert.equal(first.description, "เริ่มผลิตครั้งแรกเมื่อปี พ.ศ. 2515", "EN ว่าง = ใช้ไทย");
  assert.equal(first.href, `/en/products/${first.slug}`, "ลิงก์ต้องเป็นภาษา en");
  assert.equal(cards.length, 6);
});

/* ── 2) สินค้าเด่น ────────────────────────────────────────────────────────── */

test("home: สินค้าเด่น 1 ตัวต่อหมวด เรียงตามแค็ตตาล็อก และกดไปหน้าหมวดจริง", () => {
  const items = homeProductHighlights([highlightRow], "th", th);
  assert.equal(items.length, 1);
  const first = items[0];
  assert.ok(first !== undefined);
  assert.equal(first.name, "บะหมี่กึ่งสำเร็จรูปไวไว รสปรุงสำเร็จ");
  assert.equal(first.categoryName, th.productsPage.items.instantNoodles.name);
  assert.equal(first.href, catalogHref("th", "instant-noodles"));
  assert.equal(first.image.src, "/media/prod1");
});

test("home: ไม่มีข้อมูลจริง = ไม่มีสินค้าเด่น (ห้ามแต่งชื่อสินค้าขึ้นเอง)", () => {
  assert.deepEqual([...homeProductHighlights([], "th", th)], []);

  /* แถวที่ไม่มีภาพ/ชื่อว่าง ต้องถูกข้าม */
  const noImage: ProductHighlightRecord = { ...highlightRow, imagePath: null, imageWidth: null, imageHeight: null };
  const noName: ProductHighlightRecord = { ...highlightRow, nameTh: "  ", nameEn: "" };
  assert.deepEqual([...homeProductHighlights([noImage, noName], "th", th)], []);
});

/* ── 3) เมนูอาหาร + ข่าว: ของจริง + ลิงก์ถูก ──────────────────────────────── */

test("home: เมนูจริง — จำกัดจำนวน · ชื่อ/วันที่ตามภาษา · ไม่มีภาพก็ยังแสดงการ์ดได้", () => {
  const many: readonly RecipeRecord[] = [
    recipeRow,
    { ...recipeRow, id: "r2", titleTh: "เมนูสอง", titleEn: "" },
    { ...recipeRow, id: "r3", titleTh: "เมนูสาม", titleEn: "" },
    { ...recipeRow, id: "r4", titleTh: "เมนูสี่", titleEn: "" },
  ];

  const items = homeRecipeItems(many, "th", 3);
  assert.equal(items.length, 3, "ต้องตัดตามจำนวนที่ขอ");
  assert.equal(items[0]?.title, "เมนูต้มยำแห้ง");
  assert.equal(items[0]?.href, "/th/recipes", "กดแล้วไปหน้ารวมเมนู (ยังไม่มีหน้ารายเมนู)");
  assert.ok((items[0]?.date ?? "").includes("2569"), "วันที่แบบไทย = พุทธศักราช");

  const english = homeRecipeItems([recipeRow], "en", 3);
  assert.equal(english[0]?.title, "Dry tom yum", "มี EN = ใช้ EN");

  const noCover = homeRecipeItems([{ ...recipeRow, coverPath: null, coverWidth: null, coverHeight: null }], "th", 3);
  assert.equal(noCover[0]?.image, null, "ไม่มีภาพปก = การ์ดยังแสดง (ไม่ล้ม)");

  assert.deepEqual([...homeRecipeItems([], "th", 3)], [], "ไม่มีข้อมูล = ว่าง (ผู้เรียกถอยไปใช้การ์ดตัวอย่าง)");
});

test("home: ข่าวจริง — การ์ดต้องกดไปหน้าข่าวนั้นได้จริง (ไม่ใช่แค่หน้ารวม)", () => {
  const items = homeNewsItems([newsRow], "th", 3);
  const first = items[0];
  assert.ok(first !== undefined);
  assert.equal(first.href, "/th/news/148398", "ต้องเป็นลิงก์ไปหน้าข่าวชิ้นนั้น");
  assert.equal(first.published, "12 กันยายน 2569");
  assert.equal(first.dateTime, "2026-09-12T11:28", "ต้องมี dateTime ให้ <time>");
  assert.equal(first.image?.src, "/media/newscover");

  const english = homeNewsItems([newsRow], "en", 3);
  assert.equal(english[0]?.href, "/en/news/148398", "ลิงก์ตามภาษา");

  assert.equal(homeNewsItems([newsRow, newsRow, { ...newsRow, id: "n2" }], "th", 2).length, 2, "จำกัดจำนวนได้");
  assert.deepEqual([...homeNewsItems([], "th", 3)], []);
});

/* ── 4) กันลิงก์เสียกลับมา (สแกนซอร์ส) ────────────────────────────────────── */

test("home: ห้ามมี slug เก่าที่ไม่มีอยู่จริงในโค้ดหน้าแรก (ต้นเหตุลิงก์เสีย 4 เส้น)", () => {
  const legacySlugs = ["packet-noodles", "cup-noodles", "ready-to-cook", "seasoning"];
  const files = [
    "features/home/content.ts",
    "features/home/view-models.ts",
    "features/home/ui/products-showcase.tsx",
    "app/[lang]/page.tsx",
  ];

  for (const file of files) {
    const source = codeOf(file);
    for (const slug of legacySlugs) {
      assert.ok(!source.includes(`/products/${slug}`), `${file} ยังอ้าง slug เก่า ${slug}`);
    }
  }

  /* และต้องไม่มีรายการข้อมูลจำลองของสินค้าอีก (ตัดคอมเมนต์ออกก่อน — คอมเมนต์เล่าประวัติได้) */
  const content = codeOf("features/home/content.ts");
  assert.ok(!content.includes("PRODUCT_CATEGORIES"), "ต้องไม่มี PRODUCT_CATEGORIES (ข้อมูลจำลองเดิม)");
  assert.ok(!content.includes("FEATURED_PRODUCTS"), "ต้องไม่มี FEATURED_PRODUCTS (ข้อมูลจำลองเดิม)");

  /* หน้าแรกต้องเดินผ่านตัวแปลง (ไม่ประกอบข้อมูลเองในไฟล์หน้า) */
  const page = sourceOf("app/[lang]/page.tsx");
  for (const marker of ["homeCategoryCards(", "homeProductHighlights(", "homeRecipeItems(", "homeNewsItems("]) {
    assert.ok(page.includes(marker), `หน้าแรกต้องใช้ ${marker}`);
  }
  assert.ok(page.includes("listProductCategoryCards()"), "ต้องอ่านหมวดจากฐานข้อมูล");
  assert.ok(page.includes("listRecipes()") && page.includes("listNews("), "ต้องอ่านเมนู/ข่าวจากฐานข้อมูล");
});

test("home: ชื่อสินค้า/หมวดทุกใบมี alt (a11y) และการ์ดสินค้าใช้ <Image> ที่มีขนาดจริง", () => {
  const showcase = sourceOf("features/home/ui/products-showcase.tsx");
  assert.ok(showcase.includes("alt={messages.productsPage.items[category.id].imageAlt}"), "รูปหมวดต้องมี alt");
  assert.ok(showcase.includes("alt={product.name}"), "รูปสินค้าต้องมี alt จากชื่อจริง");
  assert.ok(showcase.includes("width={product.image.width}") && showcase.includes("height={product.image.height}"));
  assert.ok(!showcase.includes("PackShot"), "ไม่ใช้ภาพสินค้าแบบวาดแล้ว (ของจริงมาจากฐานข้อมูล)");
});

/* ── 5) Hero: ทำเครื่องหมายภาพรออนุมัติ ───────────────────────────────────── */

test("home: สไลด์ hero ต้องประกาศสถานะอนุมัติ และมีป้ายสองภาษาให้เห็น", () => {
  assert.ok(HERO_SLIDES.length >= 2);
  for (const slide of HERO_SLIDES) {
    assert.ok(
      ["pending-owner", "watermarked"].includes(slide.reviewStatus),
      `${slide.id}: ต้องมีสถานะอนุมัติ`,
    );
  }

  const slider = sourceOf("features/home/ui/hero-slider.tsx");
  assert.ok(slider.includes("labels.sampleBadge"), "ต้องมีป้าย 'ภาพตัวอย่างรออนุมัติ'");
  assert.ok(slider.includes("labels.watermarkBadge"), "ต้องมีป้าย 'ภาพมีลายน้ำ'");
  assert.ok(slider.includes("data-review-status"), "ต้องมี attribute ให้ตรวจสอบได้");

  const hero = sourceOf("features/home/ui/hero.tsx");
  assert.ok(hero.includes("sampleBadge: m.sampleImageBadge"));

  for (const messages of [th, en]) {
    assert.notEqual(messages.hero.sampleImageBadge.trim(), "");
    assert.notEqual(messages.hero.watermarkedImageBadge.trim(), "");
    assert.notEqual(messages.products.countLabel.trim(), "");
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";
import { CATALOG_ITEMS, catalogSlugs } from "@/features/products/catalog";
import {
  CATEGORY_PRESET_VERSION,
  FALLBACK_CATEGORY_IMAGE_HEIGHT,
  FALLBACK_CATEGORY_IMAGE_WIDTH,
  MAX_PRODUCT_CATEGORIES,
  categoryPresetApplyPlan,
  categoryPresetPayload,
  categoryRestoreFields,
  categorySlugIssue,
  defaultSortOrderOf,
  isBuiltInCategorySlug,
  mergeSiteCategories,
  nextCategorySortOrder,
  parseCategoryPreset,
  serializeCategoryPreset,
  siteCategoryDescription,
  siteCategoryName,
  slugifyCategoryName,
  sortCategoryRows,
  validateCategoryEdit,
  validateNewCategory,
  type BuiltInCategoryInfo,
  type CategoryRow,
} from "@/lib/products/categories";

/**
 * เทสต์ "หมวดสินค้า" (รอบที่ 264 · มติเจ้าของ D25) — **ตรรกะล้วน ไม่ต้องมี DB**
 *
 * ล็อกสิ่งเหล่านี้ไว้กันถอยหลัง
 * 1. slug สร้างจากชื่ออังกฤษ + คำสงวน/ซ้ำ/เพดาน 12 หมวด
 * 2. การรวมหมวดหน้าบ้าน = หมวดในโค้ด + หมวดใหม่ · **ซ่อนแล้วไม่ขึ้นเว็บ** · ลำดับตาม `sort_order`
 * 3. ค่าเริ่มต้นถาวร (คืนค่าแล้วต้องกลับมาแสดงบนเว็บ) + **ตารางห้ามถูก UPDATE/DELETE จากแอป**
 * 4. พรีเซ็ต: ไฟล์เสียถูกปฏิเสธ · แถวเสียถูกข้าม · ใช้ชุดไม่ลบ/ไม่สร้างหมวด
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

const builtIn: readonly BuiltInCategoryInfo[] = CATALOG_ITEMS.map((item, index) => ({
  slug: item.slug,
  name: `ชื่อจากพจนานุกรม ${String(index + 1)}`,
  imageAlt: `คำบรรยายภาพ ${String(index + 1)}`,
  imageSrc: item.image.src,
  imageWidth: item.image.width,
  imageHeight: item.image.height,
}));

function row(overrides: Partial<CategoryRow> & { readonly id: string }): CategoryRow {
  return {
    nameTh: "",
    nameEn: "",
    descriptionTh: "",
    descriptionEn: "",
    imagePath: null,
    imageWidth: null,
    imageHeight: null,
    logoPath: null,
    logoWidth: null,
    logoHeight: null,
    productCount: 0,
    sortOrder: 100,
    isHidden: false,
    ...overrides,
  };
}

/* ── 1) slug ───────────────────────────────────────────────────────────────── */

test("หมวด: slug สร้างจากชื่ออังกฤษ และชื่อที่สร้างไม่ได้ต้องคืนค่าว่าง (ไม่เดา)", () => {
  assert.equal(slugifyCategoryName("Instant Noodles"), "instant-noodles");
  assert.equal(slugifyCategoryName("  Quick   Zabb  "), "quick-zabb");
  assert.equal(slugifyCategoryName("SERDA (Café) 2026"), "serda-cafe-2026");
  assert.equal(slugifyCategoryName("บะหมี่กึ่งสำเร็จรูป"), "", "ชื่อไทยล้วน = สร้าง slug ไม่ได้");
  assert.equal(slugifyCategoryName("!!!"), "", "ไม่มี a-z/0-9 = สร้างไม่ได้");
  assert.equal(slugifyCategoryName("-x-"), "x", "ตัดขีดหัวท้าย");
  assert.equal(slugifyCategoryName("a".repeat(200)).length, 60, "เพดานความยาว slug");
});

test("หมวด: ตรวจ slug — ว่าง/รูปผิด/คำสงวน/ซ้ำ", () => {
  assert.equal(categorySlugIssue("instant-noodles"), null);
  assert.equal(categorySlugIssue(""), "empty");
  assert.equal(categorySlugIssue("Instant-Noodles"), "bad-chars");
  assert.equal(categorySlugIssue("new"), "reserved");
  assert.equal(categorySlugIssue("products"), "reserved");
  assert.equal(categorySlugIssue("serda", ["serda"]), "duplicate");
  assert.equal(categorySlugIssue("serda", ["noodie"]), null);
});

test("หมวด: ตรวจคำขอเพิ่มหมวดใหม่ — ชื่อไทยว่าง/ชื่ออังกฤษสร้าง slug ไม่ได้/ซ้ำ/เพดาน", () => {
  const context = { existingSlugs: catalogSlugs(), total: CATALOG_ITEMS.length };

  assert.deepEqual([...validateNewCategory({ nameTh: "หมวดใหม่", nameEn: "New Category" }, context)], []);

  assert.ok(
    validateNewCategory({ nameTh: "  ", nameEn: "New Category" }, context).some((issue) => issue.code === "empty-name-th"),
    "ชื่อไทยว่างต้องไม่ผ่าน",
  );
  assert.ok(
    validateNewCategory({ nameTh: "หมวดใหม่", nameEn: "บะหมี่" }, context).some((issue) => issue.code === "slug-empty"),
    "ชื่ออังกฤษที่สร้าง slug ไม่ได้ต้องไม่ผ่าน",
  );
  assert.ok(
    validateNewCategory({ nameTh: "หมวดใหม่", nameEn: "Serda" }, context).some((issue) => issue.code === "slug-duplicate"),
    "slug ซ้ำกับหมวดเดิมต้องไม่ผ่าน",
  );
  assert.ok(
    validateNewCategory({ nameTh: "หมวดใหม่", nameEn: "New" }, context).some((issue) => issue.code === "slug-reserved"),
    "คำสงวนต้องไม่ผ่าน",
  );

  const full = { existingSlugs: Array.from({ length: MAX_PRODUCT_CATEGORIES }, (_, index) => `c${String(index)}`), total: MAX_PRODUCT_CATEGORIES };
  assert.ok(
    validateNewCategory({ nameTh: "หมวดใหม่", nameEn: "New Category" }, full).some((issue) => issue.code === "too-many-categories"),
    "ถึงเพดานแล้วต้องไม่ผ่าน",
  );
  assert.equal(MAX_PRODUCT_CATEGORIES, 12, "เพดานหมวด = 12 (มติ D25 ข้อ 2)");
});

test("หมวด: ตรวจค่าที่แก้ — ความยาวเกิน/ลำดับผิด", () => {
  assert.deepEqual(
    [...validateCategoryEdit({ nameTh: "ก", nameEn: "", descriptionTh: "", descriptionEn: "", sortOrder: 0 })],
    [],
  );
  assert.ok(validateCategoryEdit({ nameTh: "ก".repeat(301), nameEn: "", descriptionTh: "", descriptionEn: "", sortOrder: 0 }).length > 0);
  assert.ok(validateCategoryEdit({ nameTh: "", nameEn: "", descriptionTh: "ก".repeat(4001), descriptionEn: "", sortOrder: 0 }).length > 0);
  assert.ok(validateCategoryEdit({ nameTh: "", nameEn: "", descriptionTh: "", descriptionEn: "", sortOrder: -1 }).length > 0);
  assert.ok(validateCategoryEdit({ nameTh: "", nameEn: "", descriptionTh: "", descriptionEn: "", sortOrder: 1.5 }).length > 0);
});

/* ── 2) ลำดับ ─────────────────────────────────────────────────────────────── */

test("หมวด: เรียงลำดับ = sort_order → ลำดับในโค้ด → id (นิ่งทุกครั้ง)", () => {
  const rows = [
    { id: "zzz-new", sortOrder: 100 },
    { id: "serda", sortOrder: 100 },
    { id: "instant-noodles", sortOrder: 100 },
    { id: "aaa-new", sortOrder: 100 },
    { id: "noodie", sortOrder: 5 },
  ];
  assert.deepEqual(
    sortCategoryRows(rows).map((entry) => entry.id),
    ["noodie", "instant-noodles", "serda", "aaa-new", "zzz-new"],
    "หมวดในโค้ดมาก่อนหมวดใหม่ (เมื่อ sort_order เท่ากัน) และ id เรียงตามตัวอักษร",
  );

  /* ผลเท่าเดิมเมื่อเรียกซ้ำ (ลำดับนิ่ง) */
  const first = sortCategoryRows(rows).map((entry) => entry.id).join(",");
  const second = sortCategoryRows(rows).map((entry) => entry.id).join(",");
  assert.equal(first, second);
});

test("หมวด: ลำดับตั้งต้นของหมวดในโค้ด = 10, 20, … และหมวดใหม่ต่อท้ายเสมอ", () => {
  assert.equal(defaultSortOrderOf("instant-noodles"), 10);
  assert.equal(defaultSortOrderOf("dried-vermicelli"), 20);
  assert.equal(defaultSortOrderOf("ไม่รู้จัก"), 100);
  assert.equal(nextCategorySortOrder([]), 100);
  assert.equal(nextCategorySortOrder([{ id: "a", sortOrder: 60 }]), 100);
  assert.equal(nextCategorySortOrder([{ id: "a", sortOrder: 120 }]), 130);
});

/* ── 3) รวมหมวดหน้าบ้าน ────────────────────────────────────────────────────── */

test("หมวด: ไม่มีข้อมูลในฐานข้อมูล = ได้หมวดในโค้ดครบตามลำดับ (หน้าเว็บเหมือนเดิมเป๊ะ)", () => {
  const merged = mergeSiteCategories(builtIn, [], "th");
  assert.equal(merged.length, CATALOG_ITEMS.length);
  assert.deepEqual(merged.map((entry) => entry.slug), catalogSlugs());
  for (const entry of merged) {
    assert.equal(entry.builtIn, true);
    assert.equal(entry.nameTh, `ชื่อจากพจนานุกรม ${String(CATALOG_ITEMS.findIndex((item) => item.slug === entry.slug) + 1)}`);
    assert.equal(entry.logoSrc, CATALOG_ITEMS.find((item) => item.slug === entry.slug)?.image.src);
    assert.equal(entry.imageAlt, `คำบรรยายภาพ ${String(CATALOG_ITEMS.findIndex((item) => item.slug === entry.slug) + 1)}`);
  }
});

test("หมวด: ค่าจากฐานข้อมูลทับค่าในโค้ด (ชื่อ/คำอธิบาย/โลโก้/ภาพ) และถอยค่าภาษาได้", () => {
  const merged = mergeSiteCategories(
    builtIn,
    [
      row({
        id: "instant-noodles",
        nameTh: "ชื่อจากหลังบ้าน",
        nameEn: "From admin",
        descriptionTh: "คำอธิบายไทย",
        logoPath: "/media/logo1",
        logoWidth: 120,
        logoHeight: 80,
        imagePath: "/media/hero1",
        imageWidth: 900,
        imageHeight: 600,
        productCount: 22,
      }),
    ],
    "th",
  );
  const first = merged.find((entry) => entry.slug === "instant-noodles");
  assert.ok(first !== undefined);
  assert.equal(first.nameTh, "ชื่อจากหลังบ้าน");
  assert.equal(first.logoSrc, "/media/logo1");
  assert.equal(first.logoWidth, 120);
  assert.equal(first.imageSrc, "/media/hero1");
  assert.equal(first.productCount, 22);
  assert.equal(siteCategoryName(first, "th"), "ชื่อจากหลังบ้าน");
  assert.equal(siteCategoryName(first, "en"), "From admin");
  assert.equal(siteCategoryDescription(first, "en"), "คำอธิบายไทย", "EN ว่าง = ถอยไทย");
  assert.equal(first.imageAlt, "คำบรรยายภาพ 1", "alt ของหมวดในโค้ดมาจากพจนานุกรม");
});

test("หมวด: หมวดในโค้ดที่ถูกซ่อน = ไม่ขึ้นเว็บ (และไม่กระทบหมวดอื่น)", () => {
  const merged = mergeSiteCategories(builtIn, [row({ id: "serda", isHidden: true })], "th");
  assert.equal(merged.some((entry) => entry.slug === "serda"), false, "หมวดที่ซ่อนต้องไม่ขึ้นเว็บ");
  assert.equal(merged.length, CATALOG_ITEMS.length - 1, "หมวดอื่นต้องอยู่ครบ");
});

test("หมวด: หมวดใหม่จากหลังบ้านขึ้นเว็บได้ · ไม่มีภาพ/ไม่มีชื่อ = ข้าม (ไม่ทำหน้าพัง)", () => {
  const merged = mergeSiteCategories(
    builtIn,
    [
      row({ id: "new-brand", nameTh: "แบรนด์ใหม่", nameEn: "New Brand", logoPath: "/media/newlogo", logoWidth: 300, logoHeight: 200, sortOrder: 200, productCount: 3 }),
      row({ id: "no-image", nameTh: "ไม่มีภาพ", sortOrder: 100 }),
      row({ id: "no-name", imagePath: "/media/x", sortOrder: 100 }),
      row({ id: "hidden-new", nameTh: "ซ่อน", imagePath: "/media/y", isHidden: true, sortOrder: 300 }),
    ],
    "th",
  );

  assert.deepEqual(
    merged.map((entry) => entry.slug),
    [...catalogSlugs(), "new-brand"],
    "หมวดใหม่ที่มีภาพ+ชื่อได้ต่อท้าย · ที่ขาดภาพ/ชื่อ/ถูกซ่อนไม่ขึ้น",
  );
  const added = merged.find((entry) => entry.slug === "new-brand");
  assert.ok(added !== undefined);
  assert.equal(added.builtIn, false);
  assert.equal(added.productCount, 3);
  assert.equal(added.imageAlt, "แบรนด์ใหม่", "alt ของหมวดใหม่ = ชื่อหมวด");
  assert.equal(siteCategoryName(added, "en"), "New Brand");
});

test("หมวด: ลำดับการแสดงมาจาก sort_order (สลับหมวดในโค้ดได้)", () => {
  const merged = mergeSiteCategories(
    builtIn,
    [row({ id: "rod-ded", sortOrder: 1 }), row({ id: "instant-noodles", sortOrder: 90 })],
    "th",
  );
  assert.equal(merged[0]?.slug, "rod-ded", "หมวดที่ตั้งลำดับน้อยสุดต้องมาก่อน");
  assert.equal(merged[1]?.slug, "dried-vermicelli", "ที่เหลือเรียงตามลำดับในโค้ด");
  assert.equal(merged[merged.length - 1]?.slug, "instant-noodles", "หมวดที่ตั้งลำดับมากสุดต้องอยู่ท้าย");
});

test("หมวด: ขนาดภาพที่อ่านไม่ได้ (0/ไม่มี) ใช้ค่าสำรอง ⇒ การ์ดไม่พัง", () => {
  const merged = mergeSiteCategories(builtIn, [row({ id: "new-brand", nameTh: "ใหม่", imagePath: "/media/x", imageWidth: 0, imageHeight: null, logoWidth: null, logoHeight: null })], "th");
  const added = merged.find((entry) => entry.slug === "new-brand");
  assert.ok(added !== undefined);
  assert.equal(added.logoWidth, FALLBACK_CATEGORY_IMAGE_WIDTH);
  assert.equal(added.logoHeight, FALLBACK_CATEGORY_IMAGE_HEIGHT);
  assert.equal(added.imageWidth, FALLBACK_CATEGORY_IMAGE_WIDTH);
});

test("หมวด: isBuiltInCategorySlug รู้จักหมวดในโค้ดเท่านั้น", () => {
  assert.equal(isBuiltInCategorySlug("instant-noodles"), true);
  assert.equal(isBuiltInCategorySlug("new-brand"), false);
});

/* ── 4) ค่าเริ่มต้นถาวร ────────────────────────────────────────────────────── */

test("หมวด: คืนค่าเริ่มต้น — ไม่มีค่าเริ่มต้น = ไม่มีอะไรให้คืน · มี = กลับมาแสดงบนเว็บเสมอ", () => {
  assert.equal(categoryRestoreFields(null), null, "หมวดที่สร้างใหม่ไม่มีค่าเริ่มต้น");

  const restored = categoryRestoreFields({
    id: "instant-noodles",
    nameTh: "ชื่อตั้งต้น",
    nameEn: "",
    descriptionTh: "",
    descriptionEn: "",
    imageMediaId: "hero",
    logoMediaId: "logo",
    sortOrder: 10,
    isHidden: true,
    capturedAt: "2026-10-14T00:00:00.000Z",
    capturedBy: "products-category-defaults",
  });
  assert.ok(restored !== null);
  assert.equal(restored.isHidden, false, "คืนค่าเริ่มต้น = กลับมาแสดงบนเว็บ");
  assert.equal(restored.sortOrder, 10);
  assert.equal(restored.imageMediaId, "hero");
});

/* ── 5) พรีเซ็ต ────────────────────────────────────────────────────────────── */

test("หมวด: พรีเซ็ต — serialize/parse ไปกลับได้ และไฟล์เสียถูกปฏิเสธ", () => {
  const payload = categoryPresetPayload([
    {
      id: "instant-noodles",
      nameTh: "ก",
      nameEn: "A",
      descriptionTh: "อธิบาย",
      descriptionEn: "",
      imageMediaId: "img",
      logoMediaId: null,
      sortOrder: 10,
      isHidden: false,
    },
  ]);
  const text = serializeCategoryPreset(payload);
  const parsed = parseCategoryPreset(text);
  assert.ok(parsed !== null);
  assert.equal(parsed.skipped, 0);
  assert.equal(parsed.payload.version, CATEGORY_PRESET_VERSION);
  assert.deepEqual([...parsed.payload.categories], [...payload.categories]);

  assert.equal(parseCategoryPreset("ไม่ใช่ json"), null);
  assert.equal(parseCategoryPreset(JSON.stringify({ version: 99, categories: [] })), null, "เวอร์ชันไม่ตรง = ปฏิเสธ");
  assert.equal(parseCategoryPreset(JSON.stringify({ version: 1, categories: "x" })), null);
  assert.equal(parseCategoryPreset(JSON.stringify({ version: 1, categories: [] }))?.payload.categories.length, 0, "ชุดว่างยังใช้ได้ (ไม่มีอะไรถูกแตะ)");
});

test("หมวด: พรีเซ็ต — แถวเสียถูกข้าม · id ซ้ำถูกข้าม · เกินเพดานปฏิเสธทั้งไฟล์", () => {
  const parsed = parseCategoryPreset(
    JSON.stringify({
      version: 1,
      categories: [
        { id: "instant-noodles", nameTh: "ก", nameEn: "", descriptionTh: "", descriptionEn: "", sortOrder: 10 },
        { id: "instant-noodles", nameTh: "ซ้ำ", nameEn: "", descriptionTh: "", descriptionEn: "" },
        { id: "BAD ID", nameTh: "id ผิด", nameEn: "", descriptionTh: "", descriptionEn: "" },
        { nameTh: "ไม่มี id", nameEn: "", descriptionTh: "", descriptionEn: "" },
      ],
    }),
  );
  assert.ok(parsed !== null);
  assert.equal(parsed.payload.categories.length, 1, "เหลือเฉพาะแถวที่ใช้ได้");
  assert.equal(parsed.skipped, 3, "แถวที่ถูกข้ามต้องถูกนับให้ผู้ใช้รู้");

  const tooMany = {
    version: 1,
    categories: Array.from({ length: MAX_PRODUCT_CATEGORIES + 1 }, (_, index) => ({
      id: `c${String(index)}`,
      nameTh: "x",
      nameEn: "",
      descriptionTh: "",
      descriptionEn: "",
    })),
  };
  assert.equal(parseCategoryPreset(JSON.stringify(tooMany)), null, "เกินเพดาน = ปฏิเสธทั้งไฟล์");
});

test("หมวด: ใช้พรีเซ็ต = เขียนทับเฉพาะหมวดที่มีอยู่จริง (ไม่ลบ/ไม่สร้าง)", () => {
  const payload = categoryPresetPayload([
    {
      id: "instant-noodles",
      nameTh: "จากชุด",
      nameEn: "",
      descriptionTh: "",
      descriptionEn: "",
      imageMediaId: null,
      logoMediaId: null,
      sortOrder: 1,
      isHidden: false,
    },
    {
      id: "not-in-db",
      nameTh: "ไม่มีในระบบ",
      nameEn: "",
      descriptionTh: "",
      descriptionEn: "",
      imageMediaId: null,
      logoMediaId: null,
      sortOrder: 2,
      isHidden: false,
    },
  ]);

  const plan = categoryPresetApplyPlan(payload, ["instant-noodles", "serda"]);
  assert.deepEqual(plan.apply.map((entry) => entry.id), ["instant-noodles"]);
  assert.deepEqual([...plan.skipped], ["not-in-db"], "หมวดที่ไม่มีในระบบต้องถูกข้ามและรายงาน");
});

/* ── 6) สแกนซอร์ส: กันถอยหลัง ──────────────────────────────────────────────── */

test("หมวด: ตารางค่าเริ่มต้นถาวรห้ามถูก UPDATE/DELETE จากแอป (fill-only เท่านั้น)", () => {
  const files = [
    "lib/products/categories-repository.ts",
    "app/admin/product-categories/actions.ts",
    "app/admin/product-categories/page.tsx",
    "app/admin/product-categories/export/route.ts",
    "scripts/import-product-category-defaults.ts",
  ];
  for (const file of files) {
    const source = codeOf(file);
    assert.ok(
      !/delete\s+from\s+product_category_default/i.test(source),
      `${file} ห้ามลบแถวค่าเริ่มต้น (ตารางนี้เป็นข้อมูลถาวร)`,
    );
    assert.ok(
      !/update\s+product_category_default/i.test(source),
      `${file} ห้ามแก้แถวค่าเริ่มต้น (ตารางนี้เป็นข้อมูลถาวร)`,
    );
  }
  const repository = codeOf("lib/products/categories-repository.ts");
  assert.ok(
    repository.includes("on conflict (id) do nothing"),
    "การเติมค่าเริ่มต้นต้องเป็น fill-only (on conflict do nothing)",
  );
});

test("หมวด: ไม่มี action ลบหมวด (มติ D25 ข้อ 3 = ใช้ 'ซ่อนจากเว็บ' แทน)", () => {
  const actions = codeOf("app/admin/product-categories/actions.ts");
  assert.ok(!/export async function deleteCategory(?:Action)?\b/.test(actions), "ต้องไม่มี action ลบหมวด");
  assert.ok(!/delete\s+from\s+product_category\b/i.test(actions), "ห้ามลบแถวหมวดจาก action");
  assert.ok(actions.includes("setCategoryHidden"), "ต้องมี action ซ่อน/แสดง");
  assert.ok(actions.includes("isHidden"), "ต้องอ่านค่าซ่อนจากฟอร์ม");
});

test("หมวด: คำสั่งอ่านฝั่งเว็บต้องกรอง is_hidden (หมวดที่ซ่อนต้องไม่หลุดขึ้นเว็บ)", () => {
  const source = codeOf("lib/products/repository.ts");
  assert.ok(
    source.includes("where c.is_hidden = false"),
    "listProductCategoryCards() ต้องกรอง is_hidden ที่ SQL (ไม่ใช่แค่ที่ UI)",
  );
  assert.ok(source.includes("loadProductCategory"), "ต้องมีตัวอ่านหมวดเดียว (ใช้ตัดสิน 404 ของหน้ารายละเอียด)");

  const detailPage = codeOf("app/[lang]/products/[slug]/page.tsx");
  assert.ok(detailPage.includes("category.isHidden"), "หน้ารายละเอียดต้อง 404 เมื่อหมวดถูกซ่อน");
  assert.ok(detailPage.includes("productDetailPageId(slug)"), "ต้องโหลดเอกสารบล็อกของ slug นั้น (รองรับหมวดใหม่)");
});

test("หมวด: จอหลังบ้านต้องตรวจสิทธิ์ + ไม่มี <form> ซ้อนในช่องภาพ", () => {
  const page = codeOf("app/admin/product-categories/page.tsx");
  assert.ok(page.includes('requireAdminUser("content")'), "ต้องตรวจสิทธิ์ content");

  for (const file of [
    "features/admin/ui/category-image-picker.tsx",
    "features/admin/ui/category-editor-form.tsx",
    "features/admin/ui/category-create-form.tsx",
    "features/admin/ui/category-preset-panel.tsx",
  ]) {
    const source = codeOf(file);
    const blankGaps = source.replace(/\s+/g, " ");
    if (file.includes("picker")) {
      assert.ok(!blankGaps.includes("<form"), "ช่องภาพต้องไม่มี <form> ของตัวเอง (กันฟอร์มซ้อน — บทเรียนรอบที่ 129)");
    }
    /* ต้องมีข้อความจากพจนานุกรมเท่านั้น (ห้ามพิมพ์ไทยตรง ๆ ใน .tsx) */
    assert.ok(!/[\u0E00-\u0E7F]/.test(blankGaps), `${file} ห้ามมีข้อความไทยในไฟล์ .tsx`);
  }
});

test("หมวด: slug ของหมวดใหม่ล็อก (ไม่มีช่องกรอก slug ในจอหลังบ้าน)", () => {
  for (const file of ["features/admin/ui/category-create-form.tsx", "features/admin/ui/category-editor-form.tsx"]) {
    const source = codeOf(file);
    assert.ok(!/name="slug"/.test(source), `${file} ต้องไม่มีช่องกรอก slug (มติ D25 ข้อ 1)`);
  }
  const createForm = sourceOf("features/admin/ui/category-create-form.tsx");
  assert.ok(createForm.includes("slugifyCategoryName("), "ฟอร์มเพิ่มหมวดต้องแสดงตัวอย่าง slug ที่ระบบสร้างให้");
});

test("หมวด: ตัวอ่านของหลังบ้านใช้ getPool (PII/ความลับ) ไม่ใช่ประตูอ่านสาธารณะ", () => {
  const repository = codeOf("lib/products/categories-repository.ts");
  assert.ok(repository.includes("getPool()"), "ชั้นข้อมูลหลังบ้านต้องใช้ getPool()");
  assert.ok(!repository.includes("readQuery("), "ห้ามใช้ประตูอ่านสาธารณะกับตารางของหลังบ้าน");
});

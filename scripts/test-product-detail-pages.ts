import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { CATALOG_ITEMS } from "@/features/products/catalog";
import { parseBlockDocument } from "@/lib/blocks/parse";
import {
  PRODUCT_DETAIL_PAGE_IDS,
  isProductDetailPageId,
  productDetailPageId,
  productDetailPathOfId,
  productDetailPathOfPageId,
  productDetailSlugOfPageId,
} from "@/lib/blocks/product-detail";
import { buildProductDetailTemplate } from "@/lib/blocks/product-detail-template";
import { BLOCK_TEMPLATE_PAGE_IDS, blockCoverageGaps, buildBlockTemplate, hasBlockTemplate } from "@/lib/blocks/templates";
import { documentErrorsOf, validateDocument } from "@/lib/blocks/validate";
import { LOCALES } from "@/lib/i18n/config";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { EMPTY_PAGE_SEO, type PageRecord } from "@/lib/pages/model";
import { PAGE_PATHS, isKnownPagePath, isPreviewablePage } from "@/lib/pages/paths";
import { buildSitemapEntries } from "@/lib/site-settings/sitemap";

/**
 * เทสต์ S3 ส่วนที่ 2 — หน้ารายละเอียดหมวดสินค้าแก้ได้จากหลังบ้าน (รอบที่ 102)
 *
 * จุดที่ต้องคุม
 * 1. ทะเบียน id ↔ slug ↔ path ตรงกับหมวดจริง (`CATALOG_ITEMS`) — ไม่มีทางหลุด
 * 2. เทมเพลตต่อหมวด mirror หน้า stub เดิม (ชื่อ/ภาพ/คำอธิบาย/ปุ่มย้อนกลับ) และผ่าน parser + validator
 * 3. หน้าเว็บสาธารณะอ่านเอกสารที่เผยแพร่ได้ + เปิด index (รอบที่ 170) + มีทางถอย
 * 4. migration 0015 เพิ่มแถว `page` ครบ 6 หน้า (ซ่อนจากเมนู · ใช้ตัวสร้าง)
 * 5. หน้าที่ซ่อนจากเมนูแต่ควร index อยู่ใน sitemap (และหลุดเมื่อสั่ง noindex)
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/* ── 1) ทะเบียน ───────────────────────────────────────────────────────────── */

test("product-detail: ทะเบียน id ตรงกับหมวดจริงใน CATALOG_ITEMS เป๊ะ (ลำดับเดียวกัน)", () => {
  assert.deepEqual(
    [...PRODUCT_DETAIL_PAGE_IDS],
    CATALOG_ITEMS.map((item) => `product-${item.slug}`),
    "id ของหน้า detail ต้อง derive จาก slug ของหมวดจริง",
  );
  assert.equal(new Set(PRODUCT_DETAIL_PAGE_IDS).size, PRODUCT_DETAIL_PAGE_IDS.length, "id ต้องไม่ซ้ำ");
});

test("product-detail: แปลง id ↔ slug ↔ path ไปกลับได้ และค่าที่ไม่รู้จักคืน null", () => {
  for (const item of CATALOG_ITEMS) {
    const pageId = productDetailPageId(item.slug);
    assert.equal(pageId, `product-${item.slug}`);
    assert.equal(isProductDetailPageId(pageId), true);
    assert.equal(productDetailSlugOfPageId(pageId), item.slug);
    assert.equal(productDetailPathOfPageId(pageId), `/products/${item.slug}`);

    const known = PRODUCT_DETAIL_PAGE_IDS.find((entry) => entry === pageId);
    assert.ok(known !== undefined);
    assert.equal(productDetailPathOfId(known), `/products/${item.slug}`);
  }

  /* ค่าที่ไม่ใช่หน้า detail (รวมหน้าเมนูและสตริงที่คล้ายกัน) ต้องไม่ถูกตีความเป็นหน้า detail */
  for (const value of ["products", "product", "product-", "product-unknown", "about"]) {
    assert.equal(isProductDetailPageId(value), false, `${value}: ต้องไม่ใช่หน้า detail`);
    assert.equal(productDetailSlugOfPageId(value), null);
    assert.equal(productDetailPathOfPageId(value), null);
  }
});

test("product-detail: ทุก id มีพาธใน PAGE_PATHS และพรีวิวได้", () => {
  for (const pageId of PRODUCT_DETAIL_PAGE_IDS) {
    const slug = productDetailSlugOfPageId(pageId);
    assert.ok(slug !== null);
    assert.equal(PAGE_PATHS[pageId], `/products/${slug}`, `${pageId}: พาธต้องมาจากทะเบียนกลาง`);
    assert.equal(isKnownPagePath(pageId), true);
    assert.equal(isPreviewablePage(pageId), true, `${pageId}: ต้องพรีวิวได้ (ใช้กลไกเดิม)`);
    assert.equal(hasBlockTemplate(pageId), true, `${pageId}: ต้องมีเทมเพลต`);
  }

  /* ทะเบียนเทมเพลตรวม = หน้าเมนู 9 + หน้า detail ทั้งหมด */
  assert.equal(BLOCK_TEMPLATE_PAGE_IDS.length, 9 + CATALOG_ITEMS.length);
});

/* ── 2) เทมเพลตต่อหมวด ────────────────────────────────────────────────────── */

test("product-detail: slug ที่ไม่รู้จักสร้างเทมเพลตไม่ได้ (กันเขียนทับหน้าอื่น)", () => {
  assert.equal(buildProductDetailTemplate("not-a-category"), null);
  assert.equal(buildProductDetailTemplate(""), null);
});

test("product-detail: เทมเพลตต่อหมวด mirror หน้า stub เดิม และผ่าน parser + validator", () => {
  for (const item of CATALOG_ITEMS) {
    const template = buildProductDetailTemplate(item.slug);
    assert.ok(template !== null, `${item.slug}: ต้องมีเทมเพลต`);
    if (template === null) continue;

    assert.equal(template.page, productDetailPageId(item.slug), "ช่อง page ต้องตรงกับ id ของหน้า");

    const parsed = parseBlockDocument(template.page, JSON.parse(JSON.stringify(template)));
    assert.ok(parsed.ok, `${item.slug}: เทมเพลตต้องผ่าน parser`);
    if (!parsed.ok) continue;
    assert.deepEqual(documentErrorsOf(validateDocument(parsed.document)), [], `${item.slug}: ต้องไม่มี error`);

    /* เนื้อหาต้องมาจากข้อมูลจริง/พจนานุกรม ไม่ใช่การแต่งขึ้น */
    const hero = parsed.document.blocks.find((block) => block.type === "hero");
    assert.ok(hero !== undefined && hero.type === "hero", `${item.slug}: ต้องมีบล็อก hero`);
    if (hero === undefined || hero.type !== "hero") continue;

    assert.equal(hero.title.th, th.productsPage.items[item.id].name);
    assert.equal(hero.title.en, en.productsPage.items[item.id].name);
    assert.equal(hero.image?.path, item.image.src, "ภาพต้องเป็นไฟล์จริงของหมวด");
    assert.equal(hero.image?.altTh, th.productsPage.items[item.id].imageAlt);
    assert.equal(hero.image?.altEn, en.productsPage.items[item.id].imageAlt);
    assert.equal(hero.subtitle.th, th.productsPage.detailStub.body, "คำอธิบาย 'ยังไม่เปิดใช้งาน' ต้องคงอยู่");
    assert.equal(hero.ctaHref, "/products", "ปุ่มย้อนกลับต้องเป็นพาธกลาง (ตัวเรนเดอร์เติมภาษาให้)");
    assert.equal(hero.ctaLabel.th, th.productsPage.detailStub.back);

    /* เทมเพลต mirror หน้า stub ครบ ⇒ ไม่ประกาศช่องว่าง (ไม่งั้นหน้าจอจะเตือนผิด) */
    assert.deepEqual([...blockCoverageGaps(template.page)], [], `${item.slug}: ต้องไม่เหลือช่องว่าง`);
  }
});

test("product-detail: buildBlockTemplate ของหน้า detail คืนเอกสารของหมวดนั้นจริง", () => {
  const template = buildBlockTemplate("product-serda");
  assert.ok(template !== null);
  assert.equal(template?.page, "product-serda");
  assert.ok(template.blocks.some((block) => block.type === "hero"));

  /* หน้าเมนูยังคืนเอกสารของตัวเอง (ไม่ถูกหน้า detail ทับ) */
  assert.equal(buildBlockTemplate("products")?.page, "products");
});

/* ── 3) หน้าเว็บสาธารณะ ────────────────────────────────────────────────────── */

test("product-detail: หน้า /products/[slug] อ่านเอกสารที่เผยแพร่ + เปิด index (รอบที่ 170) + มีทางถอย", () => {
  const source = sourceOf("app/[lang]/products/[slug]/page.tsx");

  assert.ok(source.includes("loadLiveBlockDocument(productDetailPageId(item.slug))"), "ต้องโหลดเอกสารของหมวดนั้น");
  assert.ok(source.includes("<BlockDocumentView"), "ต้องใช้ตัวเรนเดอร์เดียวกับพรีวิว");
  assert.ok(source.includes('export const revalidate = 300;'), "ต้องเป็น ISR เหมือนหน้าอื่นที่อ่าน DB");
  /* รอบที่ 170 (มติเจ้าของ): เปิด index แล้ว — ห้าม hardcode noindex กลับ */
  assert.ok(!source.includes("robots: { index: false, follow: false }"), "ห้าม hardcode noindex (เปิด index แล้ว · รอบที่ 170)");
  assert.ok(source.includes("withPageSeo("), "ต้องผ่าน withPageSeo ⇒ หลังบ้านสั่ง noindex กลับได้ (W2)");
  assert.ok(source.includes("dynamicParams = false"), "ยังล็อก 6 หมวด (ไม่มีหน้า dynamic)");
  assert.ok(source.includes("return ("), "ต้องมีเลย์เอาต์เดิมเป็นทางถอยเมื่อยังไม่เปิดสวิตช์");
});

/* ── 4) migration ─────────────────────────────────────────────────────────── */

test("product-detail: migration 0015 เพิ่มแถว page ครบ 6 หน้า (ซ่อนจากเมนู · ใช้ตัวสร้าง)", () => {
  const sql = sourceOf("db/migrations/0015-product-detail-pages.sql");

  for (const pageId of PRODUCT_DETAIL_PAGE_IDS) {
    assert.ok(sql.includes(`'${pageId}'`), `migration ต้องมี ${pageId}`);
  }
  assert.ok(sql.includes("false, 'blocks'"), "ทุกแถวต้องเป็น in_menu = false + editor = 'blocks'");
  assert.ok(sql.includes("on conflict (id) do nothing"), "ต้องรันซ้ำได้ (idempotent)");
  assert.ok(sql.includes("insert into page"), "ต้องเป็น insert เข้าตาราง page");

  /* id ต้องไม่ชนกับหน้าเมนูในโค้ด */
  for (const menuPage of ["home", "about", "products", "recipes", "news", "careers", "contact"]) {
    assert.ok(!sql.includes(`('${menuPage}'`), `ต้องไม่แตะหน้าเมนู ${menuPage}`);
  }
});

/* ── 5) sitemap ───────────────────────────────────────────────────────────── */

test("product-detail: หน้าที่ซ่อนจากเมนูแต่ควร index (รอบที่ 170) อยู่ใน sitemap · noindex หลุดออก", () => {
  const record: PageRecord = {
    id: "product-serda",
    nameTh: "ซือดะ (SERDA)",
    nameEn: "Serda",
    menuOrder: 53,
    inMenu: false,
    editor: "blocks",
    seo: EMPTY_PAGE_SEO,
  };

  const entries = buildSitemapEntries({ siteUrl: "https://example.test", pages: [record], locales: LOCALES });
  assert.ok(
    entries.some((entry) => entry.url.includes("/products/serda")),
    "หน้ารายละเอียดหมวดต้องขึ้น sitemap (ซ่อนจากเมนู ≠ ห้าม index)",
  );

  /* แต่ถ้าหลังบ้านสั่ง noindex รายหน้า ⇒ ต้องหลุดจาก sitemap ทันที */
  const noindex = buildSitemapEntries({
    siteUrl: "https://example.test",
    pages: [{ ...record, seo: { ...record.seo, noindex: true } }],
    locales: LOCALES,
  });
  assert.equal(noindex.some((entry) => entry.url.includes("/products")), false, "noindex ต้องไม่อยู่ใน sitemap");
});

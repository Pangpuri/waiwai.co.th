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
import { buildProductDetailDocument, type ProductDetailCategoryValues } from "@/lib/products/detail-document";
import { BLOCK_TEMPLATE_PAGE_IDS, blockCoverageGaps, buildBlockTemplate, hasBlockTemplate } from "@/lib/blocks/templates";
import { documentErrorsOf, validateDocument } from "@/lib/blocks/validate";
import { LOCALES } from "@/lib/i18n/config";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { EMPTY_PAGE_SEO, type PageRecord } from "@/lib/pages/model";
import { PAGE_PATHS, isKnownPagePath, isPreviewablePage } from "@/lib/pages/paths";
import { buildSitemapEntries } from "@/lib/site-settings/sitemap";
import { findCatalogItem } from "@/features/products/catalog";
import { publishGoesLive } from "@/lib/blocks/live-scope";

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

  /* ทะเบียนเทมเพลตรวม = หน้าเมนู 5 + หน้า detail ทั้งหมด (รอบ 269: ตัด products/recipes/news ออกด้วย) */
  assert.equal(BLOCK_TEMPLATE_PAGE_IDS.length, 5 + CATALOG_ITEMS.length);
});

/* ── 2) เทมเพลตต่อหมวด ────────────────────────────────────────────────────── */

test("product-detail: slug ที่ไม่รู้จักสร้างเทมเพลตไม่ได้ (กันเขียนทับหน้าอื่น)", () => {
  assert.equal(buildProductDetailDocument("not-a-category"), null);
  assert.equal(buildProductDetailDocument(""), null);
});

test("product-detail: เทมเพลตต่อหมวด mirror หน้า stub เดิม และผ่าน parser + validator", () => {
  for (const item of CATALOG_ITEMS) {
    const template = buildProductDetailDocument(item.slug);
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

  /* หน้าเมนูที่ยังมีเทมเพลตต้องคืนเอกสารของตัวเอง (ไม่ถูกหน้า detail ทับ) */
  assert.equal(buildBlockTemplate("certifications")?.page, "certifications");
  /* รอบ 269: products/recipes/news ใช้จอข้อมูลของตัวเอง ⇒ ไม่มีเทมเพลตซ้อน */
  assert.equal(buildBlockTemplate("products"), null);
  assert.equal(buildBlockTemplate("recipes"), null);
  assert.equal(buildBlockTemplate("news"), null);
});

/* ── 3) หน้าเว็บสาธารณะ ────────────────────────────────────────────────────── */

test("product-detail: หน้า /products/[slug] อ่านเอกสารที่เผยแพร่ + เปิด index (รอบที่ 170) + มีทางถอย", () => {
  const source = sourceOf("app/[lang]/products/[slug]/page.tsx");

  assert.ok(source.includes("loadLiveBlockDocument(productDetailPageId(slug))"), "ต้องโหลดเอกสารของหมวดนั้น");
  assert.ok(source.includes("<BlockDocumentView"), "ต้องใช้ตัวเรนเดอร์เดียวกับพรีวิว");
  assert.ok(source.includes('export const revalidate = 300;'), "ต้องเป็น ISR เหมือนหน้าอื่นที่อ่าน DB");
  /* รอบที่ 170 (มติเจ้าของ): เปิด index แล้ว — ห้าม hardcode noindex กลับ */
  assert.ok(!source.includes("robots: { index: false, follow: false }"), "ห้าม hardcode noindex (เปิด index แล้ว · รอบที่ 170)");
  assert.ok(source.includes("withPageSeo("), "ต้องผ่าน withPageSeo ⇒ หลังบ้านสั่ง noindex กลับได้ (W2)");
  assert.ok(source.includes("dynamicParams = false"), "ยังล็อก 6 หมวด (ไม่มีหน้า dynamic)");
  assert.ok(source.includes("return ("), "ต้องมีเลย์เอาต์เดิมเป็นทางถอยเมื่อยังไม่เปิดสวิตช์");
  /* 🆕 รอบที่ 264 (มติ D25): หมวดที่ถูก "ซ่อนจากเว็บ" ต้อง 404 และหมวดใหม่ต้องเปิดได้ */
  assert.ok(source.includes("isVisibleCategory("), "ต้องมีประตูตัดสินว่าเปิดดูได้ไหม (หมวดใหม่/ถูกซ่อน)");
  assert.ok(source.includes("category.isHidden"), "ต้องอ่านสถานะซ่อนจากฐานข้อมูลแล้วตอบ 404");
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

/* ── รอบที่ 270 (มติเจ้าของ): เอกสารตั้งต้นใน DB + กดเผยแพร่ขึ้นเว็บ + ค่าเริ่มต้น = เทมเพลต+ค่าจริง ── */

const DETAIL_VALUES: ProductDetailCategoryValues = {
  slug: "serda",
  nameTh: "ซือดะ (SERDA)",
  nameEn: "Serda",
  descriptionTh: "คำอธิบายจากหลังบ้าน",
  descriptionEn: "Description from admin",
  imagePath: "/media/logoTEST",
  imageWidth: 400,
  imageHeight: 300,
  hasProducts: true,
};

test("product-detail: เอกสารตั้งต้นใช้ 'ค่าจริงจากฐานข้อมูล' ก่อน (ชื่อ/คำอธิบาย/ภาพ) — ว่างจึงถอยพจนานุกรม", () => {
  const doc = buildProductDetailDocument("serda", DETAIL_VALUES);
  assert.ok(doc !== null);
  const hero = doc?.blocks[0];
  assert.ok(hero !== undefined && hero.type === "hero");
  if (hero === undefined || hero.type !== "hero") return;

  assert.equal(hero.title.th, "ซือดะ (SERDA)", "ชื่อไทยจาก DB ต้องมาก่อนพจนานุกรม");
  assert.equal(hero.title.en, "Serda", "ชื่ออังกฤษจาก DB ต้องมาก่อนพจนานุกรม");
  assert.equal(hero.subtitle.th, "คำอธิบายจากหลังบ้าน");
  assert.equal(hero.subtitle.en, "Description from admin");
  assert.equal(hero.image?.path, "/media/logoTEST", "ภาพต้องมาจากคลัง (/media/<id>) — มติ D9");
  assert.equal(hero.image?.hasWatermark, false, "ภาพจากคลังไม่ใช่ภาพติดลายน้ำ");
  assert.equal(hero.ctaHref, "/products", "ปุ่มย้อนกลับต้องเป็นพาธกลาง");
  assert.equal(hero.note.th, th.productsPage.eyebrow, "eyebrow ต้องเป็นป้ายเดียวกับหน้าเว็บ (รอบ 272: ไม่มีสาขาตัวอย่าง)");

  /* ค่าใน DB ว่าง = ถอยไปใช้พจนานุกรม/ไฟล์ใน public (หน้าเว็บไม่พัง) */
  const fallback = buildProductDetailDocument("serda", { ...DETAIL_VALUES, nameTh: "  ", descriptionTh: "", imagePath: null });
  const fHero = fallback?.blocks[0];
  assert.ok(fHero !== undefined && fHero.type === "hero");
  if (fHero === undefined || fHero.type !== "hero") return;
  assert.equal(fHero.title.th, th.productsPage.items.serda.name);
  assert.equal(fHero.subtitle.th, th.productsPage.detailStub.body);
  assert.equal(fHero.image?.path, findCatalogItem("serda")?.image.src);

  /* รอบที่ 272: ไม่มีสาขา "ตัวอย่าง/รออนุมัติ" อีก — ทุกกรณีใช้ป้ายเดียวกับหน้าหมวด */
  const noProducts = buildProductDetailDocument("serda", { ...DETAIL_VALUES, hasProducts: false });
  const nHero = noProducts?.blocks[0];
  assert.ok(nHero !== undefined && nHero.type === "hero");
  if (nHero !== undefined && nHero.type === "hero") {
    assert.equal(nHero.note.th, th.productsPage.eyebrow);
  }


  /* slug ที่ไม่รู้จัก (ไม่มีในโค้ด ไม่มีค่า DB) = null — ห้ามเขียนทับหน้าอื่น */
  assert.equal(buildProductDetailDocument("not-a-category", null), null);
});

test("product-detail: เอกสารตั้งต้นทั้ง 6 หน้าผ่าน parser + validator 0 error", () => {
  for (const pageId of PRODUCT_DETAIL_PAGE_IDS) {
    const slug = productDetailSlugOfPageId(pageId);
    assert.ok(slug !== null);
    const document = buildProductDetailDocument(slug ?? "");
    assert.ok(document !== null, `${pageId}: ต้องสร้างเอกสารได้`);
    if (document === null) continue;
    assert.equal(document.page, pageId, `${pageId}: id ของเอกสารต้องตรงกับหน้าจอ`);

    const parsed = parseBlockDocument(pageId, JSON.parse(JSON.stringify(document)) as unknown);
    assert.ok(parsed.ok, `${pageId}: ต้องผ่าน parser`);
    if (!parsed.ok) continue;
    const errors = documentErrorsOf(validateDocument(parsed.document));
    assert.equal(errors.length, 0, `${pageId}: ${errors.map((entry) => entry.code).join(", ")}`);
  }
});

test("product-detail: กดเผยแพร่ = ขึ้นเว็บทันที (มติเจ้าของรอบ 270) — ทุก id ของหน้า detail", () => {
  for (const pageId of PRODUCT_DETAIL_PAGE_IDS) {
    assert.equal(publishGoesLive(pageId), true, `${pageId}: ต้องขึ้นเว็บเมื่อกดเผยแพร่`);
  }
  assert.equal(publishGoesLive("news"), false, "หน้าอื่นต้องไม่ถูกเปลี่ยนนโยบายไปด้วย");
  assert.equal(publishGoesLive("contact"), true, "หน้าติดต่อยังขึ้นเว็บเหมือนเดิม");
});

test("product-detail: ตัวนำเข้า = ฉบับร่าง + validator ก่อนเขียน + ไม่ทับงานคน + ไม่เผยแพร่เอง", () => {
  const source = readFileSync(path.join(ROOT, "scripts/import-product-details.ts"), "utf8");
  assert.ok(source.includes("validateDocument("), "ต้องรัน validator ก่อนเขียน (บทเรียนรอบ 257)");
  assert.ok(source.includes("parseBlockDocument("), "ต้อง parse ด้วยตัวตรวจกลาง");
  assert.ok(source.includes('loadDocumentRow(pageId, "draft")'), "ต้องอ่านฉบับร่างเดิมก่อน");
  assert.ok(source.includes("--force"), "ต้องมีทางเลือก --force");
  assert.ok(source.includes("saveDraft("), "เขียนด้วย saveDraft (มีประวัติ/ผู้เขียน)");
  assert.ok(!/publishDraft|setPageLive/.test(source), "ห้ามเผยแพร่เอง — เจ้าของกดจากหลังบ้าน");

  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  assert.ok(
    pkg.scripts["products:detail-import"]?.includes("scripts/import-product-details.ts"),
    "ต้องมีสคริปต์ npm run products:detail-import",
  );
});

test("product-detail: หน้าที่เรนเดอร์จากบล็อกต้องมี h1 พอดี 1 อัน", () => {
  const page = readFileSync(path.join(ROOT, "app/[lang]/products/[slug]/page.tsx"), "utf8");
  assert.ok(page.includes("heading={displayName}"), "ต้องส่ง heading ให้ BlockDocumentView (ไม่งั้นไม่มี h1)");
  /* ตารางสินค้ายังต่อท้ายเสมอ — ไม่ใช่บล็อก ⇒ สินค้าจริงหายไม่ได้ */
  assert.ok(page.includes("<ProductListSection"), "ต้องยังเรนเดอร์รายการสินค้าจากฐานข้อมูล");
});

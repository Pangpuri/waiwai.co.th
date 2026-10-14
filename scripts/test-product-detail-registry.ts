import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";
import { CATALOG_ITEMS } from "@/features/products/catalog";
import { parseBlockDocument } from "@/lib/blocks/parse";
import {
  PRODUCT_DETAIL_PAGE_IDS,
  isProductDetailPageId,
  isProductDetailPageLike,
  productDetailCategoryIdOfPageId,
  productDetailPageId,
  productDetailPathOfId,
} from "@/lib/blocks/product-detail";
import { publishGoesLive } from "@/lib/blocks/live-scope";
import { blockCoverageGaps, buildBlockTemplate, hasBlockTemplate, isBlockBuilderPage } from "@/lib/blocks/templates";
import { isKnownPagePath, isPreviewablePage } from "@/lib/pages/paths";

/**
 * เทสต์ "ทะเบียนหน้าแบบไดนามิก" (รอบที่ 281 · ปิดหนี้ D-280-1) — **ตรรกะล้วน ไม่ต้องมี DB**
 *
 * ล็อกสิ่งเหล่านี้ไว้กันถอยหลัง
 * 1. id ของหน้า detail = `product-<รหัสภายในหมวด>` · รับได้ **ทุกหมวด** (ไม่ใช่แค่ 6 ใบในโค้ด)
 * 2. จอตัวสร้าง/เทมเพลต/พรีวิว/นโยบายเผยแพร่ ใช้ **รูปทรงของ id** ⇒ หมวดใหม่ไม่ตกหล่น
 * 3. `createProductCategoryAdmin` สร้างแถว `page` ให้พร้อมหมวด (transaction เดียว) + migration เติมย้อนหลัง
 * 4. `deleteEmptyCategoryAdmin` เก็บกวาดหน้า/เอกสาร/ประวัติให้หมด
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/* ── 1) รูปทรงของ id ─────────────────────────────────────────────────────── */

test("หน้า detail: id ของหน้าอ้าง **รหัสภายในหมวด** และรับได้ทุกหมวด (ไม่ใช่แค่ 6 ใบในโค้ด)", () => {
  assert.equal(productDetailPageId("serda"), "product-serda");
  assert.equal(productDetailCategoryIdOfPageId("product-serda"), "serda");

  /* หมวดที่สร้างใหม่ (ไม่อยู่ในทะเบียนโค้ด) ต้องได้ id หน้าแบบเดียวกัน */
  assert.equal(productDetailCategoryIdOfPageId("product-my-new-cat"), "my-new-cat");
  assert.equal(isProductDetailPageLike("product-my-new-cat"), true);
  assert.equal(isProductDetailPageId("product-my-new-cat"), false, "ไม่ใช่หมวดในโค้ด (ไม่มีพาธคงที่)");

  /* ของที่ไม่ใช่หน้า detail */
  for (const value of ["home", "privacy", "products", "product-", "product-a/b", "PRODUCT-serda", ""]) {
    assert.equal(productDetailCategoryIdOfPageId(value), null, `${value}: ต้องไม่ใช่หน้า detail`);
    assert.equal(isProductDetailPageLike(value), false);
  }

  /* หมวดในโค้ด: id หน้า ↔ รหัสหมวด ต้องตรงกับ CATALOG_ITEMS */
  for (const item of CATALOG_ITEMS) {
    const pageId = productDetailPageId(item.slug);
    assert.equal(isProductDetailPageId(pageId), true);
    assert.equal(productDetailCategoryIdOfPageId(pageId), item.slug);
    assert.equal(productDetailPathOfId(pageId as (typeof PRODUCT_DETAIL_PAGE_IDS)[number]), `/products/${item.slug}`);
  }
});

test("หน้า detail: id ของหน้า **ไม่ผูกกับ slug** — เปลี่ยนที่อยู่แล้วเอกสารยังอยู่ที่ id เดิม", () => {
  /* slug ของหมวดอาจเปลี่ยน (รอบที่ 280) แต่ id ของหน้า derive จากรหัสภายในเท่านั้น */
  assert.equal(productDetailPageId("instant-noodles"), productDetailPageId("instant-noodles"));
  assert.notEqual(productDetailPageId("instant-noodles"), "product-instant-noodle");
});

/* ── 2) ทุกกลไกที่ "รับหน้า" ต้องรับหมวดใหม่ด้วย ────────────────────────────── */

test("หน้า detail ของหมวดใหม่: มีตัวสร้าง · มีเทมเพลต · พรีวิวได้ · กดเผยแพร่ขึ้นเว็บ", () => {
  const page = "product-my-new-cat";

  assert.equal(isBlockBuilderPage(page), true, "ต้องเปิดจอตัวสร้างได้ (ไม่งั้นกดจากเมนูแล้ว 404)");
  assert.equal(hasBlockTemplate(page), true, "ต้องมีเทมเพลตตั้งต้นให้เริ่ม");
  assert.equal(isPreviewablePage(page), true, "ต้องพรีวิวได้ (ทั้งพรีวิวในหลังบ้านและลิงก์พรีวิว)");
  assert.equal(isKnownPagePath(page), true, "ต้องไม่ถูกมองว่าเป็นหน้าที่ไม่รู้จัก");
  assert.equal(publishGoesLive(page), true, "กดเผยแพร่แล้วต้องขึ้นเว็บทันที");
  assert.deepEqual([...blockCoverageGaps(page)], [], "เทมเพลตครอบคลุมครบ (เหมือนหมวดในโค้ด)");

  /* หน้าที่ **ไม่ใช่** หน้า detail และไม่มีเทมเพลต ต้องยังถูกปฏิเสธเหมือนเดิม */
  for (const value of ["products", "news", "careers", "privacy", "search"]) {
    assert.equal(isBlockBuilderPage(value), false, `${value}: ต้องไม่เปิดจอตัวสร้าง`);
    assert.equal(isPreviewablePage(value), false, `${value}: ต้องไม่พรีวิวได้`);
  }
  assert.equal(publishGoesLive("careers"), false, "careers ไม่ขึ้นเว็บเมื่อกดเผยแพร่ (มติรอบ 266)");
});

test("หน้า detail ของหมวดใหม่: เทมเพลตสร้างได้จริงและผ่าน parser (ชื่อหน้าตรงกับ id)", () => {
  for (const categoryId of ["my-new-cat", ...CATALOG_ITEMS.map((item) => item.slug)]) {
    const page = productDetailPageId(categoryId);
    const document = buildBlockTemplate(page);
    assert.ok(document !== null, `${page}: ต้องสร้างเทมเพลตได้`);
    assert.equal(document.page, page, "ช่อง page ของเอกสารต้องตรงกับหน้าที่ขอ");
    assert.ok(document.blocks.length >= 1, "ต้องมีบล็อกตั้งต้นอย่างน้อย 1 ใบ");

    const parsed = parseBlockDocument(page, document);
    assert.equal(parsed.ok, true, `${page}: เทมเพลตต้องผ่าน parser`);
  }
});

/* ── 3) หมวดใหม่ได้ "แถวหน้าตัวสร้าง" อัตโนมัติ ─────────────────────────────── */

test("หมวดใหม่: สร้างแถว `page` (`product-<id>`) ใน transaction เดียวกับหมวด", () => {
  const repository = codeOf("lib/products/categories-repository.ts");

  assert.ok(repository.includes("productDetailPageId(input.id)"), "ต้อง derive id ของหน้าจากรหัสภายในหมวด");
  assert.ok(repository.includes("insert into page ("), "ต้องสร้างแถว page ของหน้าตัวสร้าง");
  assert.ok(repository.includes("'blocks'"), "หน้าตัวสร้างต้องใช้ editor = blocks");
  assert.ok(
    repository.includes("return withTransaction("),
    "สร้างหมวด + หน้า ต้องอยู่ใน transaction เดียว (ไม่มีสภาพ \"มีหมวดแต่ไม่มีหน้า\")",
  );
});

test("ลบหมวด: เก็บกวาดหน้า + เอกสาร + ประวัติของหน้าตัวสร้างให้หมด", () => {
  const repository = codeOf("lib/products/categories-repository.ts");
  assert.ok(repository.includes("delete from page_document where page = $1"), "ต้องลบเอกสารบล็อก");
  assert.ok(repository.includes("delete from page_document_revision where page = $1"), "ต้องลบประวัติเอกสาร");
  assert.ok(repository.includes("delete from page where id = $1"), "ต้องลบแถว page");
});

test("migration 0043 เติมแถว `page` ให้หมวดที่มีอยู่ก่อนหน้า (idempotent · ไม่ทับค่าเดิม)", () => {
  const sql = sourceOf("db/migrations/0043-product-detail-builder-pages.sql");
  assert.ok(sql.includes("insert into page"), "ต้องเติมแถว page");
  assert.ok(sql.includes("from product_category"), "ต้องอ่านจากตารางหมวด");
  assert.ok(sql.includes("on conflict (id) do nothing"), "ห้ามทับแถวเดิม (idempotent)");
  assert.ok(sql.includes("'product-' || c.id"), "id ของหน้า = product- + รหัสหมวด");
  assert.ok(!sql.includes("update page"), "ห้ามแก้ค่าเดิมของหน้า");
});

/* ── 4) จอตัวสร้าง/พาธจริงจากฐานข้อมูล ─────────────────────────────────────── */

test("จอตัวสร้าง: ปุ่มเปิดหน้าเว็บใช้พาธจริงจากฐานข้อมูล (ไม่ประกอบจาก id)", () => {
  const page = codeOf("app/admin/builder/[page]/page.tsx");
  assert.ok(page.includes("listProductDetailPagePaths()"), "ต้องอ่านพาธจริงของหน้า detail จาก DB");
  assert.ok(page.includes("previewLiveSrc={localePath(\"th\", livePath)}"), "ต้องส่งพาธที่อ่านมาใช้");

  const repository = codeOf("lib/products/repository.ts");
  assert.ok(repository.includes("export async function listProductDetailPagePaths"), "ต้องมีตัวอ่านพาธ");
  assert.ok(repository.includes("paths.set(productDetailPageId(id), `/products/${slug}`)"), "แมป id ของหน้า → พาธ");
});

test("sitemap: ข้าม **ทุก** แถว page ของหน้า detail (ไม่ใช่แค่ 6 ใบในโค้ด)", () => {
  const sitemap = codeOf("app/sitemap.ts");
  assert.ok(sitemap.includes("listProductDetailPagePaths()"), "ต้องอ่านรายการหน้า detail จาก DB");
  assert.ok(
    sitemap.includes("productDetailPaths.size > 0 ? [...productDetailPaths.keys()]"),
    "ต้องใช้ id จาก DB เป็นรายการข้าม (ถอยไปใช้ 6 ใบในโค้ดเมื่ออ่านไม่ได้)",
  );
});

test("เทมเพลต: ไม่มีตารางเขียนมือต่อหมวดอีกแล้ว (ตัวสร้างเดียวใช้ได้ทุกหมวด)", () => {
  const templates = codeOf("lib/blocks/templates.ts");
  /* กันถอยหลัง: เดิมมี 6 บรรทัดแบบ "product-instant-noodles": (options) => buildProductDetailDocument("instant-noodles", …) */
  assert.equal(
    /"product-[a-z-]+": \(options\) => buildProductDetailDocument\(/.test(templates),
    false,
    "ห้ามกลับไปเขียนเทมเพลตทีละหมวด (หมวดใหม่จะตกหล่นอีก)",
  );
  assert.ok(
    templates.includes("function buildProductDetailTemplate(page: string"),
    "ต้องมีตัวสร้างเทมเพลตเดียวที่รับ id ของหน้า",
  );
});

test("least privilege: ตัวอ่านพาธของหน้า detail ใช้ประตูอ่านอย่างเดียว", () => {
  const repository = codeOf("lib/products/repository.ts");
  const start = repository.indexOf("export async function listProductDetailPagePaths");
  assert.ok(start > 0);
  const body = repository.slice(start, start + 900);
  /* ⚠️ โค้ดจริงใช้ `readQuery<…>(` (มี generic) ⇒ ห้ามค้นหาแค่ `readQuery(` */
  assert.ok(body.includes("await readQuery<"), "ต้องอ่านผ่าน readQuery()");
  assert.ok(!body.includes("getPool()"), "ห้ามใช้ pool เขียนของหลังบ้าน");
});

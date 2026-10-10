import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";

import {
  DEFAULT_PRODUCT_SHOWCASE,
  MAX_FEATURED_PER_CATEGORY,
  clampShowcaseOptions,
  productShowcaseView,
} from "@/lib/blocks/product-showcase";
import { createBlock, isBlockType } from "@/lib/blocks/types";
import { buildHomeTemplate } from "@/lib/blocks/home-template";
import { setProductShowcaseOptions } from "@/lib/blocks/edit";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { collectShowcaseBlocks } from "@/lib/blocks/product-showcase-data";
import type { ProductCategoryCardRecord, ProductHighlightRecord } from "@/lib/products/repository";

/**
 * ★ รอบที่ 211 (ขั้น 2 ส่วน ก) — ชั้นข้อมูลของ "บล็อกไดนามิก หมวดสินค้า + สินค้าแนะนำ"
 * เจ้าของ: *"เราจะทำใหม่ให้เข้ากับข้อมูลจริงทั้งโครงสร้าง … ทีละขั้น"* (ทิศทาง: `/admin/builder/home`)
 * บล็อกนี้เก็บแค่ "ตัวเลือก" แล้วดึงข้อมูลจริงจากฐานข้อมูลตอนเรนเดอร์
 */

const category = (id: string, label: string, extra: Partial<ProductCategoryCardRecord> = {}): ProductCategoryCardRecord => ({
  id,
  nameTh: "",
  nameEn: "",
  descriptionTh: `${label} — คำอธิบาย`,
  descriptionEn: "",
  imagePath: `/media/${id}`,
  imageWidth: 500,
  imageHeight: 500,
  logoPath: null,
  logoWidth: null,
  logoHeight: null,
  productCount: 9,
  ...extra,
});

const highlight = (id: string, categoryId: string, nameTh: string, nameEn = ""): ProductHighlightRecord => ({
  id,
  categoryId,
  nameTh,
  nameEn,
  imagePath: `/media/${id}`,
  imageWidth: 400,
  imageHeight: 400,
});

const CATEGORIES = [category("instant-noodles", "บะหมี่กึ่งสำเร็จรูป"), category("serda", "ซือดะ (SERDA)")];
const HIGHLIGHTS = [
  highlight("p1", "instant-noodles", "บะหมี่กึ่งสำเร็จรูป รสต้มยำ", "Instant noodles tom yum"),
  highlight("p2", "instant-noodles", "บะหมี่กึ่งสำเร็จรูป รสเย็นตาโฟ"),
  highlight("p3", "serda", "ซือดะ รสหมู"),
];

test("★ product showcase: ตัวเลือกถูกบีบให้อยู่ในช่วงที่ใช้ได้ (ค่าจากเอกสารไม่เชื่อถือได้)", () => {
  assert.deepEqual(clampShowcaseOptions({}), DEFAULT_PRODUCT_SHOWCASE);
  assert.equal(clampShowcaseOptions({ columns: 9 as never }).columns, 3, "คอลัมน์เพี้ยน = ค่าเริ่มต้น");
  assert.equal(clampShowcaseOptions({ featuredPerCategory: 0 }).featuredPerCategory, 1, "ต่ำเกิน = 1");
  assert.equal(clampShowcaseOptions({ featuredPerCategory: 99 }).featuredPerCategory, MAX_FEATURED_PER_CATEGORY, "สูงเกิน = เพดาน");
  assert.deepEqual(clampShowcaseOptions({ categoryIds: ["serda", " serda ", ""] }).categoryIds, ["serda"], "ตัดค่าว่าง/ซ้ำ");
  assert.equal(clampShowcaseOptions({ showFeatured: false }).showFeatured, false);
});

test("★ product showcase: ประกอบจากข้อมูลจริง + ไม่มีข้อมูล = ไม่เรนเดอร์", () => {
  /* ทุกหมวด (ไม่เลือก) — เรียงตามที่ฐานข้อมูลคืนมา + ลิงก์เป็นพาธกลาง */
  const all = productShowcaseView(CATEGORIES, HIGHLIGHTS, {}, "th");
  assert.equal(all.isEmpty, false);
  assert.deepEqual(all.categories.map((row) => row.id), ["instant-noodles", "serda"], "เรียงตามฐานข้อมูล");
  assert.deepEqual(all.categories.map((row) => row.href), ["/products/instant-noodles", "/products/serda"]);
  assert.equal(all.categories[0]?.title, "บะหมี่กึ่งสำเร็จรูป", "ชื่อหมวดมาจากพจนานุกรมชุดเดียวกับหน้า /products");
  assert.equal(all.categories[0]?.productCount, 9);
  assert.equal(all.categories[0]?.image, "/media/instant-noodles");

  /* เลือกเฉพาะหมวด + จำนวนสินค้าแนะนำต่อหมวด */
  const picked = productShowcaseView(CATEGORIES, HIGHLIGHTS, { categoryIds: ["serda"] }, "th");
  assert.deepEqual(picked.categories.map((row) => row.id), ["serda"]);
  assert.deepEqual(picked.featured.map((row) => row.id), ["p3"], "สินค้าแนะนำต้องเหลือเฉพาะหมวดที่เลือก");

  const twoPerCategory = productShowcaseView(CATEGORIES, HIGHLIGHTS, { featuredPerCategory: 2 }, "th");
  assert.deepEqual(twoPerCategory.featured.map((row) => row.id), ["p1", "p2", "p3"], "2 ตัวแรกของหมวดแรก + 1 ของหมวดสอง");
  assert.equal(twoPerCategory.featured.find((row) => row.id === "p3")?.href, "/products/serda", "ลิงก์ไปหมวดของสินค้านั้น");

  /* ปิดการ์ดสินค้าแนะนำ = ไม่มีเลย (แต่หมวดยังอยู่) */
  const noFeatured = productShowcaseView(CATEGORIES, HIGHLIGHTS, { showFeatured: false }, "th");
  assert.deepEqual(noFeatured.featured, []);
  assert.equal(noFeatured.categories.length, 2);

  /* ภาษา: EN ใช้เมื่อพจนานุกรมมี — ไม่มีก็ถอยไทย (กติกาทั้งโปรเจกต์) */
  const enView = productShowcaseView(CATEGORIES, HIGHLIGHTS, {}, "en");
  assert.equal(enView.categories.find((row) => row.id === "serda")?.title, "Serda", "EN มีคำแปล = ใช้คำแปล");
  assert.equal(enView.categories.find((row) => row.id === "instant-noodles")?.title, "Instant noodles", "EN มีคำแปล = ใช้คำแปล");
  assert.equal(enView.featured[0]?.title, "Instant noodles tom yum", "ชื่อสินค้า EN มาจากฐานข้อมูล");
  /* หมวดที่ไม่มีในพจนานุกรม = ถอยไปใช้ id (ไม่ปล่อยว่าง) */
  assert.equal(productShowcaseView([category("unknown-slug", "x")], [], {}, "th").categories[0]?.title, "unknown-slug");

  /* ไม่มีข้อมูล = ว่าง (หน้าเว็บต้องไม่พัง/ไม่ขึ้นกล่องเปล่า) */
  assert.equal(productShowcaseView([], [], {}, "th").isEmpty, true);
  assert.deepEqual(productShowcaseView([], [], {}, "th").categories, []);
  /* เลือกหมวดที่ไม่มีอยู่ = ว่าง */
  assert.equal(productShowcaseView(CATEGORIES, HIGHLIGHTS, { categoryIds: ["nope"] }, "th").isEmpty, true);

  /* รอบที่ 254: ชื่อที่ตั้งจากหลังบ้านต้องชนะพจนานุกรม (ทั้ง TH/EN) */
  const [firstCategory] = CATEGORIES;
  if (firstCategory !== undefined) {
    const renamed = productShowcaseView([{ ...firstCategory, nameTh: "ชื่อจากหลังบ้าน", nameEn: "Renamed" }], [], {}, "th");
    assert.equal(renamed.categories[0]?.title, "ชื่อจากหลังบ้าน", "ชื่อจากฐานข้อมูลต้องชนะพจนานุกรม");
    const renamedEn = productShowcaseView([{ ...firstCategory, nameTh: "ชื่อจากหลังบ้าน", nameEn: "Renamed" }], [], {}, "en");
    assert.equal(renamedEn.categories[0]?.title, "Renamed");
  }
});

test("★ product showcase: ชื่อหมวด — ค่าจากหลังบ้านมาก่อน แล้วถอยพจนานุกรม (สัญญากับชั้นข้อมูล)", () => {
  const repo = readFileSync("lib/products/repository.ts", "utf8");
  assert.ok(repo.includes("c.name_th") && repo.includes('as "nameTh"'), "ต้องอ่านชื่อหมวดจากฐานข้อมูลได้ (migration 0037)");
  assert.ok(repo.includes('c.description_th as "descriptionTh"'), "คำอธิบายของจริงมาจากฐานข้อมูล");
  const helper = readFileSync("lib/blocks/product-showcase.ts", "utf8");
  assert.ok(
    helper.includes('import { categoryNameOf } from "@/lib/products/display"'),
    "ต้องใช้ตัวช่วยเลือกชื่อกลาง (DB → พจนานุกรม) — ห้ามประกอบเอง",
  );
  assert.ok(helper.includes("categoryNameOf(row.nameTh, row.nameEn,"), "ส่งชื่อจากฐานข้อมูลเข้าตัวช่วยกลาง");
  assert.ok(helper.includes("catalogIdOfSlug.get(id)"), "ต้องแปลง id (slug) เป็นคีย์พจนานุกรมก่อนค้น");
  assert.ok(helper.includes("catalogTh[key]?.name ?? id"), "ชื่อหมวดถอยพจนานุกรม แล้วถอยไปใช้ id");
  assert.ok(helper.includes('english.trim() !== "" ? english : thai'), "EN ว่าง = ถอยไทย");
  assert.ok(helper.includes("`/products/${row.id}`"), "ลิงก์หมวดต้องเป็นพาธกลางจาก id จริง");
});

test("★ product showcase: ลงทะเบียนเป็นชนิดบล็อกของจริง (parse/บีบค่าจากเอกสาร)", () => {
  const raw = {
    page: "home",
    blocks: [
      {
        id: "block-dyn-1",
        version: 1,
        type: "productShowcase",
        style: {},
        heading: { th: "หมวดสินค้า", en: "Products" },
        body: { th: "", en: "" },
        columns: 9,
        showFeatured: "yes",
        featuredPerCategory: 99,
        categoryIds: ["serda", 7, "serda"],
        showCount: "no",
      },
    ],
  };
  const parsed = parseBlockDocument("home", raw);
  assert.ok(parsed.ok, `เอกสารต้องผ่าน parser (${parsed.ok ? "" : parsed.problems.join(", ")})`);
  if (!parsed.ok) return;
  const block = parsed.document.blocks[0];
  assert.equal(block?.type, "productShowcase");
  if (block?.type !== "productShowcase") return;
  /* ค่าที่เพี้ยนจากเอกสารถูกบีบ ไม่ทำให้พัง (เอกสารไม่เชื่อถือได้) */
  assert.equal(block.columns, 3);
  assert.equal(block.showFeatured, true, "ค่าไม่ใช่ boolean = ใช้ค่าเริ่มต้น");
  assert.equal(block.featuredPerCategory, MAX_FEATURED_PER_CATEGORY);
  assert.deepEqual([...block.categoryIds], ["serda"]);
  assert.equal(block.showCount, true, "ค่าไม่ใช่ boolean = ใช้ค่าเริ่มต้น");
  assert.equal(block.heading.th, "หมวดสินค้า");
  /* ชนิดใหม่ต้องอยู่ในทะเบียนกลาง (ป้าย/ตัวเลือกในตัวสร้างอ่านจากทะเบียน) */
  assert.ok(isBlockType("productShowcase"), "ต้องอยู่ใน BLOCK_TYPES");
});

test("★ product showcase: ตัวโหลดข้อมูลจริงเก็บบล็อกได้ครบ (รวมที่ซ้อนในแถว)", async () => {
  const blocks = [
    { id: "a", type: "productShowcase" },
    { id: "row-1", type: "row", columns: [{ blocks: [{ id: "b", type: "productShowcase" }] }, { blocks: [] }] },
    { id: "c", type: "cards" },
  ] as unknown as readonly { readonly id: string; readonly type: string }[];
  const found = collectShowcaseBlocks(blocks as never);
  assert.deepEqual(found.map((block) => block.id), ["a", "b"], "ต้องเจอบล็อกที่ซ้อนในแถวด้วย");

  /* ไม่มีเอกสาร/ไม่มีบล็อกชนิดนี้ = ไม่ยิงฐานข้อมูล (คืน map ว่าง) */
  const { loadProductShowcaseData } = await import("@/lib/blocks/product-showcase-data");
  assert.equal(await loadProductShowcaseData(null), null, "ไม่มีเอกสาร = ไม่ยิงฐานข้อมูล");
  assert.equal(await loadProductShowcaseData({ page: "home", blocks: [] }), null, "ไม่มีบล็อกชนิดนี้ = ไม่ยิงฐานข้อมูล");
});

test("★ product showcase: ตัวเรนเดอร์ + การส่งข้อมูล (ห้ามตัวเรนเดอร์ยิงฐานข้อมูลเอง)", () => {
  const renderer = readFileSync("features/blocks/block-renderer.tsx", "utf8");
  assert.ok(renderer.includes('case "productShowcase": {'), "ต้องมีกรณีเรนเดอร์ของบล็อกนี้");
  assert.ok(renderer.includes("if (productData === null) return null"), "ไม่มีข้อมูล = ไม่เรนเดอร์ (ห้ามกล่องเปล่า)");
  assert.ok(renderer.includes("showcase.isEmpty"), "ไม่มีหมวดจริง = ไม่เรนเดอร์");
  assert.ok(renderer.includes("productData={productData}"), "BlockDocumentView ต้องส่งข้อมูลต่อให้ BlockView");

  /* ⚠️ กฎสำคัญ: ตัวเรนเดอร์ถูกใช้ใน "พรีวิวที่แก้ได้" (client) ⇒ ห้ามยิงฐานข้อมูลเอง */
  assert.ok(!renderer.includes("listProductCategoryCards"), "ห้ามตัวเรนเดอร์เรียกตัวอ่านฐานข้อมูล");
  assert.ok(!renderer.includes("@/lib/products/repository"), "ห้าม import ชั้นฐานข้อมูลในตัวเรนเดอร์");

  /* ผู้เรียก (เซิร์ฟเวอร์) เป็นคนโหลด: หน้าเว็บจริง + พรีวิว */
  const home = readFileSync("app/[lang]/page.tsx", "utf8");
  assert.ok(home.includes("productData={await loadProductShowcaseData(liveDocument)}"), "หน้าเว็บจริงต้องโหลดข้อมูลให้");
  const preview = readFileSync("app/[lang]/preview/[page]/page.tsx", "utf8");
  assert.ok(preview.includes("productData={await loadProductShowcaseData(document)}"), "พรีวิวต้องโหลดข้อมูลให้");
  const frame = readFileSync("features/blocks/ui/preview-frame.tsx", "utf8");
  assert.ok(frame.includes("productData={productData}"), "PreviewFrame ต้องส่งต่อให้ BlockDocumentView");
  assert.ok(!frame.includes("repository"), "พรีวิว (client) ห้ามแตะฐานข้อมูล");
});

test("★ product showcase: แผงแก้ในตัวสร้าง — แก้ตัวเลือกแล้วถูกบีบค่าทุกครั้ง (รอบที่ 215)", () => {
  const builder = readFileSync("features/admin/ui/block-builder.tsx", "utf8");
  assert.ok(builder.includes('case "productShowcase":'), "ตัวสร้างต้องมีแผงของบล็อกนี้");
  for (const needle of [
    "setProductShowcaseOptions",
    "blockShowcaseColumns",
    "blockShowcaseCount",
    "blockShowcaseFeatured",
    "blockShowcaseFeaturedCount",
    "blockShowcaseHint",
  ]) {
    assert.ok(builder.includes(needle), `แผงต้องมี: ${needle}`);
  }
  /* บล็อกไดนามิกไม่มีรายการให้แก้ในเอกสาร — แผงต้องไม่แตะ items */
  const panel = builder.slice(builder.indexOf('case "productShowcase":'), builder.indexOf('case "recipeCards": {'));
  assert.ok(!panel.includes("setRecipeCards"), "แผงนี้ต้องไม่ยุ่งกับรายการเมนู");

  const edit = readFileSync("lib/blocks/edit.ts", "utf8");
  assert.ok(edit.includes("clampShowcaseOptions({ ...block, ...patch })"), "ต้องบีบค่าทุกครั้งที่แก้จากแผง");

  /* พฤติกรรมจริงของ setter */
  const doc = { page: "home" as const, blocks: [createBlock("productShowcase", "b1")] };
  const fixed = setProductShowcaseOptions(doc, "b1", { featuredPerCategory: 99, showFeatured: false, showCount: false });
  const block = fixed.blocks[0];
  assert.equal(block?.type, "productShowcase");
  if (block?.type !== "productShowcase") return;
  assert.equal(block.featuredPerCategory, 3, "เกินเพดานถูกบีบ");
  assert.equal(block.showFeatured, false, "ปิดสินค้าแนะนำได้");
  assert.equal(block.showCount, false, "ปิดจำนวนสินค้าได้");
  const one = setProductShowcaseOptions(doc, "b1", { featuredPerCategory: 0 });
  assert.equal(one.blocks[0]?.type === "productShowcase" ? one.blocks[0].featuredPerCategory : -1, 1, "ต่ำกว่า 1 ถูกบีบ");
});

/** ★ รอบที่ 219 — "สินค้าแนะนำ" ต้องแสดงจริง (เจ้าของชี้ว่าบล็อกยังมาไม่ครบ) */
test("★ product showcase: แสดงสินค้าแนะนำ + หัวข้อจากพจนานุกรมชุดเดียวกับหน้าเว็บ", () => {
  const renderer = readFileSync("features/blocks/block-renderer.tsx", "utf8");
  assert.ok(renderer.includes("showcase.featured.map"), "ต้องเรนเดอร์รายการสินค้าแนะนำ");
  assert.ok(renderer.includes("block.showFeatured"), "ต้องเคารพสวิตช์ 'แสดงสินค้าแนะนำ'");
  assert.ok(renderer.includes("strings.showcase.featuredTitle"), "หัวข้อต้องมาจากพจนานุกรม (ห้ามพิมพ์ไทยใน .tsx)");
  assert.ok(renderer.includes('from "next/image"'), "ภาพสินค้าต้องใช้ next/image (alt บังคับ)");

  const strings = readFileSync("features/blocks/render-strings.ts", "utf8");
  assert.equal(strings.split("featuredTitle: products").length - 1, 2, "ต้องมีข้อความทั้ง th และ en");
  assert.ok(strings.includes("productsTh.featuredTitle") && strings.includes("productsEn.featuredTitle"), "ดึงจากพจนานุกรม products ชุดเดียวกับหน้าเว็บ");
});

/**
 * ★ รอบที่ 244 — 🐞 เคสจริงจากเจ้าของ: *"โลโก้หมวดสินค้าดันหายหมดเหลือแต่บล็อคข้อความ"*
 * วิวส่ง `category.image` มาให้อยู่แล้ว แต่ตัวเรนเดอร์ของการ์ดหมวด **ไม่วาดภาพ**
 * ⇒ ล็อกว่าการ์ดหมวดต้องมีภาพ + ใช้ next/image + มี alt (ชื่อหมวด) + แผงพื้นจางตามดีไซน์เดิม
 */
test("★ product showcase: การ์ดหมวดต้องมีภาพ (เคสจริงจากเจ้าของ — ภาพหมวดหายเหลือแต่ข้อความ)", () => {
  const renderer = codeOf("features/blocks/block-renderer.tsx");
  const start = renderer.indexOf('case "productShowcase"');
  const end = renderer.indexOf('case "marketplaceLinks"');
  assert.ok(start > 0 && end > start, "ต้องพบเคส productShowcase");
  const block = renderer.slice(start, end);

  assert.ok(block.includes("showcase.categories.map"), "ต้องเรนเดอร์การ์ดหมวด");
  assert.ok(block.includes("category.image === null ? null"), "ต้องวาดภาพเมื่อหมวดมีภาพ (และข้ามเมื่อไม่มี)");
  assert.ok(block.includes("src={category.image}"), "ต้องใช้พาธภาพจากวิว (ไม่ประกอบเอง)");
  assert.ok(block.includes("alt={category.title}"), "ภาพต้องมี alt (ใช้ชื่อหมวด)");
  assert.ok(block.includes("bg-bg-subtle"), "ต้องมีแผงพื้นจางรองภาพแบบดีไซน์เดิม");
  /* การ์ดทั้งใบคลิกได้ (เหมือนดีไซน์เดิม) — ลิงก์เดียวต่อการ์ด */
  const cardLinks = block.match(/<a href=\{localizedBlockHref\(category\.href, language\)\}/g) ?? [];
  assert.equal(cardLinks.length, 1, "การ์ดหมวดต้องมีลิงก์เดียว (ครอบทั้งการ์ด)");

  /*
    ⚠️ รอบที่ 247 (ตระกูลเดียวกับรอบ 101): ลิงก์ในบล็อกต้องผ่าน `localizedBlockHref()` — ห้ามใช้ค่าดิบ
    ไม่งั้นหน้า `/en` กดแล้วได้ 307 ไปหน้า **ไทย** (ผู้ชม EN หลุดภาษา) — เจอจริงตอนตรวจหน้าจริง
  */
  assert.equal(block.includes("href={category.href}"), false, "ห้ามใช้ category.href ดิบ (ต้องเติมภาษาที่นำหน้า)");
  assert.equal(block.includes("href={product.href}"), false, "ห้ามใช้ product.href ดิบ (สินค้าเด่นก็ต้องเติมภาษา)");
});

/** ★ รอบที่ 220 — หัวข้อส่วน + ปุ่ม "ดูผลิตภัณฑ์ทั้งหมด" (ให้ตรงหน้าเว็บจริง) */
test("★ product showcase: หัวข้อส่วน + ปุ่มท้ายส่วน (CTA) ครบและมาจากพจนานุกรม", () => {
  const renderer = readFileSync("features/blocks/block-renderer.tsx", "utf8");
  assert.ok(renderer.includes("strings.showcase.categoriesTitle"), "ต้องมีหัวข้อย่อย 'หมวดสินค้า' จากพจนานุกรม");
  assert.ok(renderer.includes("block.ctaLabel[language]"), "ปุ่มต้องมีข้อความจากเอกสาร (สองภาษา)");
  assert.ok(renderer.includes("localizedBlockHref(block.ctaHref, language)"), "ลิงก์ปุ่มต้องเติม /<ภาษา> ด้วยตัวช่วยกลาง (บทเรียนรอบ 101)");

  const strings = readFileSync("features/blocks/render-strings.ts", "utf8");
  assert.equal(strings.split("categoriesTitle: products").length - 1, 2, "หัวข้อย่อยต้องมีทั้ง th/en");

  const template = buildHomeTemplate();
  const block = template.blocks.find((row) => row.type === "productShowcase");
  assert.equal(block?.type, "productShowcase");
  if (block?.type !== "productShowcase") return;
  assert.equal(block.ctaHref, "/products", "ปุ่มต้องชี้พาธกลาง /products");
  assert.ok(block.ctaLabel.th !== "" && block.ctaLabel.en !== "", "ป้ายปุ่มสองภาษาต้องมาจากพจนานุกรม");
  assert.ok(block.heading.th !== "หมวดสินค้า", "หัวข้อส่วนต้องเป็นหัวข้อของส่วน (ไม่ใช่หัวข้อย่อยหมวด)");
});

/** ★ รอบที่ 222 (คิวข้อ 3) — บล็อก "เมนูล่าสุด": ลงทะเบียน + ตัวเรนเดอร์ + การส่งข้อมูล + แผง */
test("★ recipe showcase: ลงทะเบียนครบ + ตัวเรนเดอร์ไม่แตะฐานข้อมูล + มีแผง/คำแปล", () => {
  const types = readFileSync("lib/blocks/types.ts", "utf8");
  assert.ok(types.includes('"recipeShowcase"'), "ต้องอยู่ใน BLOCK_TYPES");
  assert.ok(types.includes("เมนูล่าสุด"), "ต้องมีป้ายในแคตตาล็อก");
  const renderer = readFileSync("features/blocks/block-renderer.tsx", "utf8");
  assert.ok(renderer.includes('case "recipeShowcase": {'), "ต้องมีกรณีเรนเดอร์");
  assert.ok(renderer.includes("recipeShowcaseView(recipeData.recipes, block, language)"), "ต้องใช้ชั้นข้อมูลบริสุทธิ์ (ไม่ยิง DB)");
  assert.ok(!renderer.includes("@/lib/recipes/repository"), "ห้ามตัวเรนเดอร์แตะชั้นฐานข้อมูล");
  assert.ok(renderer.includes("recipeData={recipeData}"), "ต้องส่งข้อมูลลงไปถึง BlockView");
  const panel = readFileSync("features/admin/ui/block-builder.tsx", "utf8");
  for (const needle of ["setRecipeShowcaseOptions", "blockRecipeLimit", "blockRecipeDates", "blockRecipeHint"]) {
    assert.ok(panel.includes(needle), `แผงต้องมี: ${needle}`);
  }
  const page = readFileSync("app/[lang]/page.tsx", "utf8");
  assert.ok(page.includes("loadRecipeShowcaseData(liveDocument)"), "หน้าเว็บจริงต้องโหลดเมนูให้");
  const template = buildHomeTemplate();
  assert.deepEqual(template.blocks.map((b) => b.type), ["productShowcase", "recipeShowcase", "newsShowcase", "form", "marketplaceLinks"]);
  const block = template.blocks[1];
  assert.equal(block?.type, "recipeShowcase");
  if (block?.type === "recipeShowcase") assert.equal(block.ctaHref, "/recipes", "ปุ่มต้องพาไปหน้าเมนูอาหาร");
});

/** ★ รอบที่ 223 (คิวข้อ 4) — บล็อก "ข่าวล่าสุด": ลงทะเบียน + เรนเดอร์ + ส่งข้อมูล + แผง */
test("★ news showcase: บล็อกข่าวล่าสุดครบวงจร (ไม่แตะฐานข้อมูลในตัวเรนเดอร์)", () => {
  const types = readFileSync("lib/blocks/types.ts", "utf8");
  assert.ok(types.includes('"newsShowcase"') && types.includes("ข่าวล่าสุด"), "ต้องลงทะเบียน + มีป้ายในแคตตาล็อก");
  const renderer = readFileSync("features/blocks/block-renderer.tsx", "utf8");
  assert.ok(renderer.includes('case "newsShowcase": {'), "ต้องมีกรณีเรนเดอร์");
  assert.ok(renderer.includes("newsShowcaseView(newsData.news, block, language)"), "ใช้ชั้นข้อมูลบริสุทธิ์");
  assert.ok(renderer.includes("localizedBlockHref(item.href, language)"), "ลิงก์ต้องพาไปหน้าข่าวชิ้นนั้น (เติม /<ภาษา>)");
  assert.ok(!renderer.includes("@/lib/news/repository"), "ห้ามตัวเรนเดอร์แตะชั้นฐานข้อมูล");
  assert.equal(renderer.split("newsData={newsData}").length - 1, 2, "ต้องส่งข้อมูลให้ BlockView ทั้งสองจุด (รวมที่ซ้อนในแถว)");
  const panel = readFileSync("features/admin/ui/block-builder.tsx", "utf8");
  for (const needle of ["setNewsShowcaseOptions", "blockNewsLimit", "blockNewsDates", "blockNewsExcerpts", "blockNewsHint"]) {
    assert.ok(panel.includes(needle), `แผงต้องมี: ${needle}`);
  }
  const page = readFileSync("app/[lang]/page.tsx", "utf8");
  assert.ok(page.includes("loadNewsShowcaseData(liveDocument)"), "หน้าเว็บจริงต้องโหลดข่าวให้");
  const template = buildHomeTemplate();
  const block = template.blocks.find((row) => row.type === "newsShowcase");
  assert.equal(block?.type, "newsShowcase");
  if (block?.type === "newsShowcase") {
    assert.equal(block.ctaHref, "/news", "ปุ่มต้องพาไปหน้าข่าวสาร");
    assert.equal(block.showExcerpts, true);
  }
});

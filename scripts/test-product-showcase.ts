import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  DEFAULT_PRODUCT_SHOWCASE,
  MAX_FEATURED_PER_CATEGORY,
  clampShowcaseOptions,
  productShowcaseView,
} from "@/lib/blocks/product-showcase";
import { isBlockType } from "@/lib/blocks/types";
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
  descriptionTh: `${label} — คำอธิบาย`,
  descriptionEn: "",
  imagePath: `/media/${id}`,
  imageWidth: 500,
  imageHeight: 500,
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
});

test("★ product showcase: ชื่อหมวดมาจากพจนานุกรม (ตารางไม่มีคอลัมน์ชื่อ) — สัญญากับชั้นข้อมูล", () => {
  const repo = readFileSync("lib/products/repository.ts", "utf8");
  assert.ok(!repo.includes("c.name_th"), "ห้ามอ้างคอลัมน์ที่ไม่มีในตาราง (product_category มีแค่คำอธิบาย/ภาพ)");
  assert.ok(repo.includes("c.description_th as \"descriptionTh\""), "คำอธิบายของจริงมาจากฐานข้อมูล");
  const helper = readFileSync("lib/blocks/product-showcase.ts", "utf8");
  assert.ok(helper.includes("catalogIdOfSlug.get(id)"), "ต้องแปลง id (slug) เป็นคีย์พจนานุกรมก่อนค้น");
  assert.ok(helper.includes("catalogTh[key]?.name ?? id"), "ชื่อหมวดมาจากพจนานุกรม แล้วถอยไปใช้ id");
  assert.ok(helper.includes("english.trim() !== \"\" ? english : thai"), "EN ว่าง = ถอยไทย");
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

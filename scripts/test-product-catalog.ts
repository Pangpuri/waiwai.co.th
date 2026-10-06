import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  decodeEntities,
  normalizeText,
  parseCategoryPage,
  parseDetailPage,
  pathOfHref,
  sourceIdOfDetailPath,
  splitDetailFields,
} from "@/lib/products/import-parse";
import {
  productIdOfSourceId,
  productImageAlt,
  validateCategoryInput,
  validateIngredientInput,
  validateProductInput,
  type ProductInput,
} from "@/lib/products/model";

/**
 * เทสต์ S3 ส่วนที่ 3 (รอบที่ 103) — นำเข้าสินค้าจากเว็บเดิม
 *
 * ตัวอย่าง HTML ในไฟล์นี้ **คัดลอกโครงสร้างจริง** จาก waiwai.co.th (2026-10-05):
 * หน้าหมวด = ตารางแถวรูป(+ลิงก์) → ชื่อไทย → ชื่ออังกฤษ → สายผลิตภัณฑ์
 * หน้ารายละเอียด = ตาราง ไทย|อังกฤษ|% ปิดท้ายด้วยข้อความรวมบรรทัดเดียว
 */

/* ── fixture: หน้าหมวด (ตัดมา 2 สินค้า) ───────────────────────────────────── */

const CATEGORY_HTML = `
<html><head>
<meta property="og:image" content="https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/filemanager/hero.png" />
<title>ไวไว - บะหมี่กึ่งสำเร็จรูปควิกแสบ</title>
</head><body>
<table><tbody>
<tr><td><strong>ด้วยรสชาติแสบถึงใจกับการคัดสรรวัตถุดิบเป็นอย่างดี และน้ำซุปเข้มข้นถึงเครื่อง</strong></td></tr>
<tr style="height: 159px;">
<td><a href="/th/pages/15136-%E0%B8%81"><img src="https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/filemanager/a_full.png" width="130" /></a></td>
<td><a href="https://waiwai.co.th/th/pages/15137-%E0%B8%82"><img src="https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/filemanager/b_full.png" width="130" /></a></td>
</tr>
<tr><td><strong>บะหมี่กึ่งสำเร็จรูปควิก รสต้มโคล้ง</strong></td><td><strong>บะหมี่กึ่งสำเร็จรูปควิก รสต้มยำกุ้ง</strong></td></tr>
<tr><td><span>Tom Klong Flavour</span></td><td><span>Tom Yum Shrimp Flavour</span></td></tr>
<tr><td>Instant Noodles Quick</td><td>Instant Noodles Quick</td></tr>
</tbody></table>
</body></html>
`;

/* ── fixture: หน้ารายละเอียด (ตัดมา 2 ส่วนผสม) ───────────────────────────── */

const DETAIL_HTML = `
<html><body>
<table><tbody>
<tr><td></td><td></td><td>บะหมี่กึ่งสำเร็จรูปควิก รสต้มโคล้ง ด้วยความหอมของปลาย่าง พร้อมกับเครื่องต้มโคล้งที่ผสานกันอย่างลงตัว รสชาติเผ็ด แสบ...ถึงใจ ส่วนประกอบที่สำคัญ / Ingredients</td></tr>
<tr><td>แป้งสาลี</td><td>Wheat Flour</td><td>53.00%</td></tr>
<tr><td>น้ำมันปาล์ม</td><td>Palm Oil</td><td>16.00%</td></tr>
<tr><td>วัตถุปรุงแต่งรสอาหาร (โมโนโซเดียมกลูตาเมต), ไม่ใช้วัตถุกันเสีย ข้อมูลสำหรับผู้แพ้อาหาร : มีแป้งสาลี ปลา น้ำหนักสุทธิ 60 กรัม (อย.) 73-1-30323-2-0059 ขนาดบรรจุ กล่อง 30 ซอง และจัดชุด 10 ซอง</td></tr>
</tbody></table>
<img src="https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/filemanager/a_full.png" />
<img src="https://waiwai.co.th/templates/default/assets/img/flag-th@2x.png" />
<img src="https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/filemanager/b.png" />
</body></html>
`;

/* ── 1) ตัวช่วยพื้นฐาน ───────────────────────────────────────────────────── */

test("import-parse: ถอด entity/ยุบช่องว่าง ตามที่เว็บเดิมใช้", () => {
  assert.equal(decodeEntities("น้ำตาล&nbsp;4.00% &amp; เกลือ"), "น้ำตาล 4.00% & เกลือ");
  assert.equal(decodeEntities("5&rsquo;-ไรโบนิวคลิโอไตด์"), "5\u2019-ไรโบนิวคลิโอไตด์");
  assert.equal(decodeEntities("&#3585;&#3634;"), "กา");
  assert.equal(decodeEntities("&unknown;"), "&unknown;", "entity ที่ไม่รู้จักต้องคงเดิม");
  assert.equal(normalizeText("  ก   ข \n ค  "), "ก ข ค");
});

test("import-parse: source id ออกมาจากพาธหน้าสินค้า · href ถูกแปลงเป็นพาธเสมอ", () => {
  assert.equal(sourceIdOfDetailPath("/th/pages/15136-%E0%B8%81"), "15136");
  assert.equal(sourceIdOfDetailPath("https://waiwai.co.th/th/pages/40513-%E0%B8%99"), "40513");
  assert.equal(sourceIdOfDetailPath("/products/instant-noodles"), "");

  /* เว็บเดิมมีทั้ง href แบบพาธและแบบ URL เต็ม — เราเก็บเป็นพาธ (มติ D9) */
  assert.equal(pathOfHref("/th/pages/15136-x"), "/th/pages/15136-x");
  assert.equal(pathOfHref("https://waiwai.co.th/th/pages/15136-x?y=1"), "/th/pages/15136-x?y=1");
  assert.equal(pathOfHref(""), "");
  assert.equal(pathOfHref("ไม่ใช่ที่อยู่"), "");
});

/* ── 2) หน้าหมวด ─────────────────────────────────────────────────────────── */

test("import-parse: แกะหน้าหมวดได้ครบ (คำอธิบาย · ภาพหัว · 2 สินค้าเรียงตามคอลัมน์)", () => {
  const parsed = parseCategoryPage(CATEGORY_HTML);

  assert.ok(parsed.descriptionTh.startsWith("ด้วยรสชาติแสบถึงใจ"), "ต้องได้คำอธิบายหมวด");
  assert.equal(parsed.heroImageUrl, "https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/filemanager/hero.png");
  assert.equal(parsed.products.length, 2);

  const first = parsed.products[0];
  const second = parsed.products[1];
  assert.ok(first !== undefined && second !== undefined, "ต้องได้สินค้า 2 รายการ");

  assert.equal(first.sourceId, "15136");
  assert.equal(first.detailPath, "/th/pages/15136-%E0%B8%81");
  assert.equal(first.nameTh, "บะหมี่กึ่งสำเร็จรูปควิก รสต้มโคล้ง");
  assert.equal(first.nameEn, "Tom Klong Flavour");
  assert.equal(first.groupEn, "Instant Noodles Quick");
  assert.ok(first.imageUrl.endsWith("a_full.png"));

  assert.equal(second.sourceId, "15137");
  assert.equal(second.nameTh, "บะหมี่กึ่งสำเร็จรูปควิก รสต้มยำกุ้ง");
  assert.equal(second.nameEn, "Tom Yum Shrimp Flavour");
});

test("import-parse: หน้าหมวดที่ไม่มีชื่ออังกฤษ/สายผลิตภัณฑ์ ก็ยังแกะได้ (ไม่พัง)", () => {
  const html = `<table><tr><td><a href="/th/pages/15324-x"><img src="https://cache-x/filemanager/c_full.png" /></a></td></tr>
    <tr><td><strong>เส้นหมี่อบแห้ง 500 กรัม</strong></td></tr></table>`;
  const parsed = parseCategoryPage(html);
  assert.equal(parsed.products.length, 1);
  const only = parsed.products[0];
  assert.ok(only !== undefined);
  assert.equal(only.nameEn, "");
  assert.equal(only.groupEn, "");
  assert.equal(parsed.descriptionTh, "");
  assert.equal(parsed.heroImageUrl, "");
});

/* ── 3) หน้ารายละเอียด ───────────────────────────────────────────────────── */

test("import-parse: แกะหน้ารายละเอียด (คำโปรย · ส่วนผสม · ฟิลด์ที่แยกจากข้อความรวม)", () => {
  const parsed = parseDetailPage(DETAIL_HTML, { nameTh: "บะหมี่กึ่งสำเร็จรูปควิก รสต้มโคล้ง" });

  assert.equal(parsed.taglineTh, "ด้วยความหอมของปลาย่าง พร้อมกับเครื่องต้มโคล้งที่ผสานกันอย่างลงตัว รสชาติเผ็ด แสบ...ถึงใจ");
  assert.deepEqual(parsed.ingredients, [
    { nameTh: "แป้งสาลี", nameEn: "Wheat Flour", percentText: "53.00%" },
    { nameTh: "น้ำมันปาล์ม", nameEn: "Palm Oil", percentText: "16.00%" },
  ]);

  assert.ok(parsed.detailsTh.includes("ไม่ใช้วัตถุกันเสีย"));
  assert.equal(parsed.allergensTh, "มีแป้งสาลี ปลา");
  assert.equal(parsed.netWeightTh, "60 กรัม");
  assert.equal(parsed.fdaNumber, "73-1-30323-2-0059");
  assert.equal(parsed.packagingTh, "กล่อง 30 ซอง และจัดชุด 10 ซอง");

  /* รูป: เก็บเฉพาะไฟล์จาก filemanager (ตัดธงภาษา/ของตกแต่งออก) */
  assert.deepEqual(parsed.images, [
    "https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/filemanager/a_full.png",
    "https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/filemanager/b.png",
  ]);
});

test("import-parse: ไม่พบเครื่องหมายในข้อความรวม ⇒ ฟิลด์นั้นว่าง (ไม่เดา)", () => {
  const fields = splitDetailFields("ส่วนประกอบที่สำคัญ : ข้าวเจ้า 100% ปราศจากสารฟอกสี");
  assert.equal(fields.allergensTh, "");
  assert.equal(fields.netWeightTh, "");
  assert.equal(fields.fdaNumber, "");
  assert.equal(fields.packagingTh, "");
});

test("import-parse: หน้าที่ไม่มีตารางส่วนผสมเลย ก็ไม่พัง", () => {
  const parsed = parseDetailPage("<html><body><p>ไม่มีตาราง</p></body></html>", { nameTh: "ก" });
  assert.deepEqual([...parsed.ingredients], []);
  assert.equal(parsed.taglineTh, "");
  assert.equal(parsed.detailsTh, "");
});

/* ── 4) ตัวตรวจข้อมูล ─────────────────────────────────────────────────────── */

const validProduct: ProductInput = {
  id: productIdOfSourceId("15136"),
  categoryId: "quick-zabb",
  sourceId: "15136",
  sourceUrl: "/th/pages/15136-x",
  nameTh: "บะหมี่กึ่งสำเร็จรูปควิก รสต้มโคล้ง",
  nameEn: "Tom Klong Flavour",
  groupTh: "",
  groupEn: "Instant Noodles Quick",
  taglineTh: "คำโปรย",
  taglineEn: "",
  detailsTh: "รายละเอียด",
  allergensTh: "",
  netWeightTh: "60 กรัม",
  fdaNumber: "73-1-30323-2-0059",
  packagingTh: "กล่อง 30 ซอง",
  detailsEn: "",
  allergensEn: "",
  netWeightEn: "",
  packagingEn: "",
  sortOrder: 0,
};

test("model: ข้อมูลที่ถูกต้องผ่าน · ที่ผิดถูกจับครบ", () => {
  assert.deepEqual([...validateProductInput(validProduct)], []);
  assert.deepEqual([...validateCategoryInput({ id: "quick-zabb", sourceId: "15235", descriptionTh: "ก", descriptionEn: "" })], []);

  const bad = validateProductInput({ ...validProduct, id: "product-15136", categoryId: "ไม่รู้จัก", nameTh: "  ", sortOrder: -1, sourceUrl: "https://waiwai.co.th/x" });
  const codes = bad.map((issue) => issue.code).sort();
  assert.deepEqual(codes, ["bad-order", "bad-source-url", "empty-name-th", "id-mismatch", "unknown-category"]);

  assert.ok(validateCategoryInput({ id: "quick-zabb", sourceId: "abc", descriptionTh: "", descriptionEn: "" }).some((issue) => issue.code === "bad-source-id"));
  assert.deepEqual([...validateIngredientInput({ nameTh: "แป้งสาลี", nameEn: "Wheat Flour", percentText: "53%" }, 0)], []);
  assert.ok(validateIngredientInput({ nameTh: "", nameEn: "", percentText: "" }, 2).some((issue) => issue.path === "ingredients[2].nameTh"));
});

test("model: id สินค้ามาจาก source id เสมอ · alt ภาพถอยไปใช้ชื่อไทยเมื่ออังกฤษว่าง", () => {
  assert.equal(productIdOfSourceId("15136"), "p15136");
  assert.equal(productIdOfSourceId(" 15136 "), "p15136");
  assert.equal(productImageAlt("บะหมี่ควิก", "Quick", "en"), "Quick");
  assert.equal(productImageAlt("บะหมี่ควิก", "", "en"), "บะหมี่ควิก", "ห้ามปล่อย alt ว่าง");
  assert.equal(productImageAlt("บะหมี่ควิก", "Quick", "th"), "บะหมี่ควิก");
});

test("model: ผลแกะจากหน้าหมวด → ข้อมูลสินค้า ผ่านตัวตรวจได้จริง (ต่อกันครบสาย)", () => {
  const parsed = parseCategoryPage(CATEGORY_HTML);
  for (const [index, item] of parsed.products.entries()) {
    const input: ProductInput = {
      ...validProduct,
      id: productIdOfSourceId(item.sourceId),
      sourceId: item.sourceId,
      sourceUrl: item.detailPath,
      nameTh: item.nameTh,
      nameEn: item.nameEn,
      groupEn: item.groupEn,
      sortOrder: index,
    };
    assert.deepEqual([...validateProductInput(input)], [], `${item.nameTh}: ต้องผ่านตัวตรวจ`);
  }
});

/* ── รอบที่ 147: ห้าม "บีบ" รายละเอียดสินค้าในการ์ด (ฟีดแบ็กเจ้าของ) ───────────── */

test("product catalog: เปิดรายละเอียดการ์ดแล้วต้องได้ความกว้างเต็ม (ไม่ถูกบีบเป็นแถวตั้ง)", () => {
  const list = readFileSync("features/products/ui/product-list.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.ok(list.includes("product-card-grid"), "กริดการ์ดต้องมีคลาสสำหรับกฎขยายการ์ดที่เปิดอยู่");
  assert.ok(
    /\.product-card-grid:has\(details\[open\]\)\s*\{[^}]*grid-template-columns:[\s\S]*?minmax\(0,\s*1fr\)/.test(css),
    "ต้องมีกฎ CSS :has(details[open]) ให้การ์ดที่เปิดขยายเต็มความกว้าง (ไม่ต้องใช้ JS)",
  );
  assert.ok(
    /<table className="[^"]*min-w-\[/.test(list),
    "ตารางส่วนผสมต้องมี min-width (ให้เลื่อนแนวนอนแทนการบีบคอลัมน์)",
  );
});

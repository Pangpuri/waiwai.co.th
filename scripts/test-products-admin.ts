import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { productIdOfSourceId, validateIngredientInput, validateProductInput, type ProductInput } from "@/lib/products/model";

/**
 * เทสต์หลังบ้านสินค้า (รอบที่ 132–134) — "จอ WordPress ง่าย ๆ" ที่ต้องไม่ทำข้อมูลเดิมเสียหาย
 *
 * หัวใจของรอบนี้
 * - **รหัสสินค้า (slug) ล็อก** — ฟอร์มถูกแก้ให้ส่ง id อื่นมาไม่ได้ (URL /products/<slug> ต้องคงที่)
 * - **ห้าม `<form>` ซ้อน** — บทเรียนรอบที่ 129 (React hydration error + เบราว์เซอร์ตัดฟอร์มชั้นในทิ้ง)
 * - **พรีวิวใช้ตัวเรนเดอร์ตัวเดียวกับหน้าเว็บ** (`ProductListSection`) — กัน "พรีวิวโกหก"
 * - **source_id ของหมวดต้องไม่ถูกลบ** ตอนบันทึกด้วยฟอร์ม (ช่องซ่อน + ด่านใน repo)
 */

/* ── ตรรกะล้วน (ไม่ต้องมี DB) ─────────────────────────────────────────────── */

test("products admin: รหัสสินค้าต้อง derive จาก source id เสมอ (p<source_id>)", () => {
  assert.equal(productIdOfSourceId("15136"), "p15136");
  assert.equal(productIdOfSourceId("  15136  "), "p15136", "ตัดช่องว่างหัวท้ายก่อน");
  assert.equal(productIdOfSourceId("999999"), "p999999", "รหัสที่สร้างใหม่จากเวลาใช้รูปแบบเดียวกัน");
});

test("products admin: validator กลางปฏิเสธเมื่อ id ไม่ตรงกับ source id (ด่านกันลิงก์เปลี่ยน)", () => {
  const base: ProductInput = {
    id: "p15136",
    categoryId: "instant-noodles",
    sourceId: "15136",
    sourceUrl: "",
    nameTh: "ทดสอบ",
    nameEn: "",
    groupTh: "",
    groupEn: "",
    taglineTh: "",
    taglineEn: "",
    detailsTh: "",
    allergensTh: "",
    netWeightTh: "",
    fdaNumber: "",
    packagingTh: "",
    sortOrder: 0,
  };

  assert.deepEqual(validateProductInput(base), [], "ค่าถูกต้องต้องผ่าน");
  assert.ok(
    validateProductInput({ ...base, id: "p999" }).some((issue) => issue.code === "id-mismatch"),
    "id ที่ไม่ตรงกับ source id ต้องถูกปฏิเสธ",
  );
  assert.ok(
    validateProductInput({ ...base, nameTh: "   " }).some((issue) => issue.code === "empty-name-th"),
    "ชื่อไทยว่างต้องถูกปฏิเสธ",
  );
  assert.ok(
    validateProductInput({ ...base, categoryId: "not-a-category" }).some((issue) => issue.code === "unknown-category"),
    "หมวดที่ไม่อยู่ในทะเบียนต้องถูกปฏิเสธ",
  );
  assert.ok(
    validateIngredientInput({ nameTh: "", nameEn: "Salt", percentText: "" }, 0).length > 0,
    "ส่วนผสมที่ไม่มีชื่อไทยต้องถูกปฏิเสธ",
  );
});

/* ── ตรวจซอร์ส: กฎที่ "ห้ามลืม" ───────────────────────────────────────────── */

const actions = readFileSync("app/admin/products/actions.ts", "utf8");
const repository = readFileSync("lib/products/repository.ts", "utf8");
const listPage = readFileSync("app/admin/products/page.tsx", "utf8");
const editorPage = readFileSync("app/admin/products/[id]/page.tsx", "utf8");
const editorForm = readFileSync("features/admin/ui/product-editor-form.tsx", "utf8");
const categoryForm = readFileSync("features/admin/ui/product-category-form.tsx", "utf8");
const publicList = readFileSync("features/products/ui/product-list.tsx", "utf8");

/** นับแท็กฟอร์มจริง (`<form` + ช่องว่าง/ขึ้นบรรทัดใหม่) — ไม่นับที่พูดถึงในคอมเมนต์ */
const formTags = (value: string): number => (value.match(/<form[ \n]/g) ?? []).length;

test("products admin: ทุก action ต้องตรวจสิทธิ์ + เขียน audit + สั่งสร้างหน้าเว็บใหม่", () => {
  const permissionChecks = (actions.match(/requireAdminUser\("content"\)/g) ?? []).length;
  assert.ok(permissionChecks >= 3, `ต้องตรวจสิทธิ์ทุก action (พบ ${String(permissionChecks)} ครั้ง)`);
  assert.equal((actions.match(/^export async function/gm) ?? []).length, 3, "ไฟล์นี้มี 3 action (บันทึกสินค้า · บันทึกหมวด · อัปโหลดภาพ)");
  assert.ok(actions.includes("recordAudit("), "ทุกการแก้เนื้อหาต้องมีร่องรอย audit");
  assert.ok(actions.includes('refreshPublicSite("page")'), "บันทึกแล้วต้องสั่งสร้างหน้าเว็บใหม่ (ISR)");
});

test("products admin: ฝั่งเซิร์ฟเวอร์ต้องตรวจค่าที่รับจากเบราว์เซอร์ด้วย validator กลาง", () => {
  assert.ok(actions.includes("validateProductInput("), "ต้องตรวจสินค้าด้วย validateProductInput");
  assert.ok(actions.includes("validateIngredientInput("), "ต้องตรวจส่วนผสมทีละรายการด้วย validateIngredientInput");
  assert.ok(actions.includes("isCatalogCategoryId("), "หมวดต้องอยู่ในทะเบียน 6 หมวดเท่านั้น");
  assert.ok(actions.includes("mediaIdFromPath("), "ภาพต้องแปลงเป็นรหัสภาพ (มติ D9: ห้ามเก็บ/ส่ง URL เต็ม)");
});

test("products admin: รหัสสินค้าถูกล็อก — ห้ามใช้ id ที่ส่งมาจากเบราว์เซอร์ตรง ๆ", () => {
  assert.ok(actions.includes("productIdOfSourceId("), "id ต้อง derive จาก source id ด้วยตัวช่วยกลาง");
  assert.ok(
    !/\?\s*`p\$\{/.test(actions),
    "ต้องไม่มีการประกอบ `p${...}` เองใน action (ต้องเรียก productIdOfSourceId เท่านั้น)",
  );
  assert.ok(actions.includes('reason: "id"'), "ถ้า id ที่ส่งมาไม่ตรงกับที่ derive ได้ ต้องปฏิเสธอย่างชัดเจน");
});

test("products admin: อัปโหลดภาพจากเครื่องต้องใช้ท่อกลาง storeImageFile (ย่อภาพ/ตรวจหัวไฟล์/เพดาน 5MB)", () => {
  assert.ok(actions.includes("storeImageFile("), "ต้องใช้ท่ออัปโหลดกลาง");
  assert.ok(editorForm.includes("ImageFileInput"), "ช่องอัปโหลดสินค้าต้องใช้ ImageFileInput (ย่อภาพในเบราว์เซอร์ก่อนส่ง)");
  assert.ok(categoryForm.includes("ImageFileInput"), "ช่องอัปโหลดภาพหมวดต้องใช้ ImageFileInput ด้วย");
});

test("products admin: พรีวิวต้องใช้ตัวเรนเดอร์เดียวกับหน้าเว็บจริง (กัน 'พรีวิวโกหก')", () => {
  assert.ok(
    /import \{ ProductListSection, type ProductListStrings \} from "@\/features\/products\/ui\/product-list"/.test(editorForm),
    "พรีวิวต้อง import ProductListSection ตัวเดียวกับหน้า /products/<slug>",
  );
  assert.ok(editorForm.includes("<ProductListSection"), "ต้องเรนเดอร์การ์ดผ่าน ProductListSection");
  assert.equal(
    (publicList.match(/export function ProductListSection/g) ?? []).length,
    1,
    "ต้องมีตัวเรนเดอร์การ์ดสินค้าเพียงตัวเดียวในระบบ",
  );
  assert.ok(!editorForm.includes("dangerouslySetInnerHTML"), "พรีวิวห้ามตีความเป็น HTML");
});

test("products admin: ห้ามมี <form> ซ้อน <form> (บทเรียนรอบที่ 129 ⇒ hydration error)", () => {
  assert.equal(formTags(editorForm), 1, "จอแก้สินค้ามีแท็ก <form> ได้เพียงตัวเดียว (ฟอร์มบันทึก)");
  assert.equal(formTags(categoryForm), 1, "ฟอร์มหมวดมีแท็ก <form> ได้เพียงตัวเดียว");
  assert.ok(editorForm.includes("uploadProductImageAction("), "ปุ่มอัปโหลดต้องเรียก Server Action เอง (ไม่ใช้ <form>)");
  assert.ok(categoryForm.includes("uploadProductImageAction("), "ปุ่มอัปโหลดภาพหมวดต้องเรียก Server Action เอง");
  assert.equal(formTags(listPage), 1, "หน้าจอ /admin/products มี <form> GET (ค้นหา) ได้เพียงตัวเดียว — ฟอร์มหมวดอยู่ใน client component");
});

test("products admin: จอหมวดต้องมีฟอร์มของตัวเองต่อหมวด (6 ใบ จากทะเบียนเดียวกับหน้าเว็บ)", () => {
  assert.ok(listPage.includes("<ProductCategoryForm"), "หน้าจอ /admin/products ต้องแสดงฟอร์มหมวด");
  assert.ok(listPage.includes("CATALOG_ITEMS.map"), "ต้องสร้างฟอร์มจาก CATALOG_ITEMS (แหล่งความจริงเดียวของ slug/ชื่อ)");
  assert.ok(categoryForm.includes('name="sourceId"'), "ต้องส่ง source_id กลับเป็นช่องซ่อน (ไม่งั้นบันทึกแล้ว id ต้นทางหาย)");
  assert.ok(categoryForm.includes("useActionState(saveProductCategoryAction"), "ฟอร์มหมวดต้องเรียก saveProductCategoryAction");
});

test("products admin: repo กัน source_id ของหมวดถูกลบด้วยค่าว่าง (ด่านชั้นสอง)", () => {
  assert.ok(
    repository.includes("coalesce(nullif(excluded.source_id, ''), product_category.source_id)"),
    "ห้ามเขียน source_id ทับด้วยค่าว่าง — ต้องคงค่าเดิมไว้",
  );
  assert.ok(repository.includes("listProductCategoriesForAdmin"), "ต้องมีตัวอ่านหมวดสำหรับหลังบ้าน");
});

test("products admin: การเขียนภาพแยก 2 โหมด — นำเข้า 'keep' · หลังบ้าน 'set'", () => {
  assert.ok(repository.includes('export type ImageWriteMode'), "ต้องมีชนิดโหมดการเขียนภาพให้ชัดเจน");
  assert.ok(repository.includes("coalesce(excluded.image_media_id"), "โหมด keep ต้องคงภาพเดิม (นำเข้าซ้ำไม่ลบภาพที่ผู้ดูแลเลือก)");
  assert.ok(
    (actions.match(/imageMode: "set"/g) ?? []).length >= 2,
    "หลังบ้านต้องเขียนภาพแบบ set ทั้งสินค้าและหมวด (เลือกล้างภาพได้จริง)",
  );
});

test("products admin: หน้าจอหลังบ้านต้องตรวจสิทธิ์ที่หน้าเพจด้วย", () => {
  assert.ok(listPage.includes('requireAdminUser("content")'), "/admin/products ต้องตรวจสิทธิ์ก่อนอ่านข้อมูล");
  assert.ok(editorPage.includes('requireAdminUser("content")'), "/admin/products/[id] ต้องตรวจสิทธิ์ก่อนอ่านข้อมูล");
});

test("products admin: จอแก้สินค้าต้องส่ง 'ลำดับการแสดง' เดิมกลับ (แก้แล้วลำดับในหมวดต้องไม่หาย)", () => {
  /* เคสจริงรอบที่ 134: หน้าจอฮาร์ดโค้ด sortOrder = 0 ⇒ กดบันทึกสินค้าที่นำเข้าแล้ว ลำดับทั้งหมดกลายเป็น 0 */
  assert.ok(editorPage.includes("existing?.sortOrder"), "ต้องเติม sortOrder จากข้อมูลเดิม ไม่ใช่ 0 คงที่");
  assert.ok(repository.includes("p.sort_order"), "ตัวอ่านหลังบ้านต้องดึง sort_order มาด้วย");
  assert.ok(!/sortOrder: 0,/.test(editorPage), "ห้ามฮาร์ดโค้ด sortOrder = 0 ในหน้าจอแก้");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";

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
    detailsEn: "",
    allergensEn: "",
    netWeightEn: "",
    packagingEn: "",
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

const actions = codeOf("app/admin/products/actions.ts");
const repository = readFileSync("lib/products/repository.ts", "utf8");
const listPage = codeOf("app/admin/products/page.tsx");
const editorPage = readFileSync("app/admin/products/[id]/page.tsx", "utf8");
const editorForm = readFileSync("features/admin/ui/product-editor-form.tsx", "utf8");
const categoryForm = readFileSync("features/admin/ui/product-category-form.tsx", "utf8");
const publicList = readFileSync("features/products/ui/product-list.tsx", "utf8");

/** นับแท็กฟอร์มจริง (`<form` + ช่องว่าง/ขึ้นบรรทัดใหม่) — ไม่นับที่พูดถึงในคอมเมนต์ */
const formTags = (value: string): number => (value.match(/<form[ \n]/g) ?? []).length;

test("products admin: ทุก action ต้องตรวจสิทธิ์ + เขียน audit + สั่งสร้างหน้าเว็บใหม่", () => {
  const permissionChecks = (actions.match(/requireAdminUser\("content"\)/g) ?? []).length;
  assert.ok(permissionChecks >= 6, `ต้องตรวจสิทธิ์ทุก action (พบ ${String(permissionChecks)} ครั้ง)`);
  assert.equal(
    (actions.match(/^export async function/gm) ?? []).length,
    6,
    "ไฟล์นี้มี 6 action (บันทึกสินค้า · บันทึกหมวด · อัปโหลดภาพ · ย้าย/กู้คืนถังขยะ · ลบถาวร · กู้คืนประวัติ)",
  );
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
  assert.equal(formTags(listPage), 3, "หน้ารายการมี <form> 3 ตัว (ค้นหา + ย้าย/กู้คืนถังขยะ + ลบถาวร) เป็นพี่น้องกัน");
  const searchFormEnd = listPage.indexOf("</form>");
  assert.ok(
    searchFormEnd >= 0 && listPage.indexOf("action={trashProductAction}") > searchFormEnd,
    "ฟอร์มถังขยะต้องอยู่นอกฟอร์มค้นหา",
  );
  assert.ok(
    listPage.indexOf("action={deleteProductForeverAction}") > searchFormEnd,
    "ฟอร์มลบถาวรต้องอยู่นอกฟอร์มค้นหา",
  );
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
  assert.ok(
    repository.includes("coalesce(excluded."),
    "โหมด keep ต้องคงภาพเดิม (นำเข้าซ้ำไม่ลบภาพที่ผู้ดูแลเลือก) — ใช้ร่วมกันทั้งภาพสินค้า/ภาพหมวด/โลโก้หมวด",
  );
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

/* ── รอบที่ 139: ถังขยะสินค้า + ลบถาวร (ประตูอยู่ที่ SQL ไม่ใช่ที่ปุ่ม) ─────────── */

test("products admin: ถังขยะสินค้า — ย้าย/กู้คืน/ลบถาวร ครบ และลบถาวรมีประตูที่ SQL", () => {
  assert.ok(repository.includes("export async function setProductTrashed"), "ต้องมีตัวย้าย/กู้คืน");
  assert.ok(repository.includes("export async function deleteProductForever"), "ต้องมีตัวลบถาวร");
  assert.ok(
    repository.includes("delete from product where id = $1 and deleted_at is not null"),
    "ประตูลบถาวรต้องอยู่ใน SQL (fail-closed) ⇒ ของที่ยังใช้งานอยู่ลบไม่ได้แม้ยิง action ตรง ๆ",
  );
  assert.ok(actions.includes("deleteProductForever("), "action ต้องเรียกผ่านตัวที่มีประตู");
  assert.ok(actions.includes('action: "product-delete"'), "ลบถาวรต้องมี audit");
  assert.ok(
    !/\bdeleteProduct\(/.test(actions),
    "action ห้ามเรียก `deleteProduct()` (ตัวที่ข้ามประตูถังขยะ) — ใช้ได้แค่ในสคริปต์/ด่านตรวจ",
  );
});

test("products admin: หน้าเว็บสาธารณะต้องกรองสินค้าในถังออกทุกเส้นทาง (การ์ดหมวด/สินค้า/สินค้าเด่น/ตัวนับ)", () => {
  const uses = (repository.match(/PUBLIC_PRODUCT_CONDITION/g) ?? []).length;
  assert.ok(
    uses >= 5,
    `ต้องใช้เงื่อนไขกลางในทุกคำสั่งอ่านฝั่งเว็บ (1 ประกาศ + 4 คำสั่งอ่าน — พบ ${String(uses)})`,
  );
  assert.ok(repository.includes('const PUBLIC_PRODUCT_CONDITION = "p.deleted_at is null"'), "นิยามเงื่อนไขต้องชัด");
  assert.ok(
    repository.includes("left join product p on p.category_id = c.id and ${PUBLIC_PRODUCT_CONDITION}"),
    "การ์ดหมวดต้องใส่เงื่อนไขใน join (ไม่ใช่ where) เพื่อไม่ให้หมวดที่ไม่มีสินค้าเหลือหายไปทั้งใบ",
  );
});

test("products admin: ปุ่มลบถาวร/กู้คืนโผล่เฉพาะที่ที่ควร + บอกผู้ใช้ว่าของอยู่ในถัง", () => {
  assert.ok(listPage.includes("deleteProductForeverAction"), "แท็บถังขยะต้องมีปุ่มลบถาวร");
  assert.ok(
    listPage.includes("item.trashed ? m.adminProductsRestore : m.adminProductsTrash"),
    "ปุ่มเดียวสลับ ย้าย/กู้คืน ตามสถานะ",
  );
  assert.ok(listPage.includes("adminProductCounts"), "หัวแท็บต้องมีตัวนับจากฐานข้อมูล");
  assert.ok(listPage.includes('query.tab === "trash"'), "ต้องอ่านแท็บจาก query (ไม่เชื่อค่าดิบ)");
  assert.ok(editorPage.includes("trashProductAction"), "จอแก้ต้องกู้คืนของที่อยู่ในถังได้");
  assert.ok(editorPage.includes("adminProductsTrashedNotice"), "ต้องบอกว่าอยู่ในถังและหน้าเว็บไม่แสดง");
  assert.ok(listPage.includes("adminProductsDeleteForeverWarning"), "ปุ่มลบถาวรต้องมีคำเตือนกำกับ");
});

test("products admin: ไม่มี 'ลบหมวด' — 6 หมวดถูกล็อกตามมติ Q-D (กันเผลอทำหน้าสินค้าพัง)", () => {
  assert.ok(!/deleteProductCategoryAction/.test(actions), "ห้ามมี action ลบหมวด");
  assert.ok(!/deleteProductCategory/.test(listPage), "หน้ารายการห้ามมีปุ่มลบหมวด");
  assert.ok(
    !repository.includes("deleted_at") || !/product_category\s+set\s+deleted_at/.test(repository),
    "product_category ต้องไม่มี deleted_at (หมวดถูกล็อก 6 หมวด)",
  );
});

/* ── รอบที่ 140: นำเข้าสินค้าซ้ำต้องไม่ทับงานที่แก้จากหลังบ้าน ────────────────── */

test("products admin: สคริปต์นำเข้าใช้โหมด 'protect-edited' เป็นค่าเริ่มต้น และมี --force", () => {
  const importer = readFileSync("scripts/import-products.ts", "utf8");
  assert.ok(importer.includes('arg === "--force"'), "ต้องมีธง --force");
  assert.ok(
    importer.includes('const writeMode = options.force ? "replace" : "protect-edited";'),
    "ค่าเริ่มต้นต้องเป็น protect-edited (ไม่ทับงานคน) · --force จึงทับจริง",
  );
  assert.ok(importer.includes("stats.protectedEdits"), "ต้องนับและรายงานจำนวนที่คงค่าเดิมไว้");
  assert.ok(importer.includes("if (result.protectedEdit)"), "ต้องตรวจผลจากชั้นข้อมูล (ไม่เดาเอง)");
  assert.ok(
    importer.includes("npm run products:import -- --force"),
    "ต้องบอกผู้ใช้ว่าจะทับจริงต้องทำอย่างไร",
  );
});

test("products admin: ชั้นข้อมูลมีประตูกันทับที่ SQL + คง updated_at/by (ไม่งั้นรอบ 2 ทับ)", () => {
  assert.ok(repository.includes('export type ProductWriteMode'), "ต้องมีชนิดโหมดการเขียนให้ชัดเจน");
  assert.ok(
    repository.includes('"replace" | "protect-edited"'),
    "ต้องมีสองโหมด: replace (หลังบ้าน) · protect-edited (นำเข้า)",
  );
  assert.ok(
    repository.includes('const PROTECTED_EDIT_CONDITION = "product.updated_by is distinct from excluded.updated_by"'),
    "เงื่อนไขต้องเทียบ updated_by ของแถวเดิมกับผู้ที่กำลังเขียน",
  );
  assert.ok(
    repository.includes("function guardedNow(") && repository.includes("then product.updated_at else now() end"),
    "⚠️ โหมดป้องกันต้องคง updated_at เดิม ⇒ ถ้าไม่คง การนำเข้าครั้งที่สองจะทับงานคน",
  );
  assert.ok(
    repository.includes('guardedColumn(options.writeMode, "updated_by")'),
    "⚠️ ต้องคง updated_by เดิมด้วยเหตุผลเดียวกัน",
  );
  assert.ok(repository.includes("protectedEdit"), "ต้องคืนผลว่าป้องกันไว้ไหม (ให้สคริปต์รายงาน)");
});

test("products admin: หลังบ้านต้องยังเขียนทับได้ (โหมด replace เป็นค่าเริ่มต้น)", () => {
  /* ถ้าหลังบ้านเผลอส่ง protect-edited: กดบันทึกจากหลังบ้านจะไม่ทับค่าที่นำเข้ามา = ผู้ดูแลแก้ไม่ได้ */
  assert.ok(!/writeMode:\s*"protect-edited"/.test(actions), "action ของหลังบ้านห้ามใช้โหมดป้องกัน");
  assert.ok(actions.includes('imageMode: "set"'), "หลังบ้านต้องใช้โหมดภาพ set (ค่าเริ่มต้นของ writeMode = replace)");
});

/* ── รอบที่ 141: ช่อง EN ให้การตลาดกรอกเอง (ทีมเว็บไม่แปล) ──────────────────── */

test("products admin: จอแก้ต้องมีช่อง EN ครบ 5 ช่อง (รายละเอียด/สารก่อภูมิแพ้/น้ำหนัก/บรรจุภัณฑ์ + คำโปรยเดิม)", () => {
  for (const name of ["detailsEn", "allergensEn", "netWeightEn", "packagingEn", "taglineEn", "nameEn", "groupEn"]) {
    assert.ok(editorForm.includes(`name="${name}"`), `จอแก้ต้องมีช่อง ${name}`);
  }
  assert.ok(editorForm.includes("adminProductsFieldEnHint"), "ต้องบอกว่าช่องอังกฤษเว้นว่างได้ (ถอยไปใช้ไทย)");
  /* ค่าที่พิมพ์ต้องส่งกลับเซิร์ฟเวอร์ + เข้าพรีวิว (ไม่งั้นกรอกแล้วเหมือนไม่บันทึก) */
  assert.ok(editorForm.includes("fields.detailsEn"), "ต้องส่งค่า EN กลับเซิร์ฟเวอร์");
  assert.ok(editorForm.includes("detailsEn: fields.detailsEn"), "พรีวิวต้องใช้ค่าที่พิมพ์");
});

test("products admin: action ต้องรับ-บันทึกฟิลด์ EN (ไม่ทิ้งค่าที่การตลาดกรอก)", () => {
  for (const name of ["detailsEn", "allergensEn", "netWeightEn", "packagingEn"]) {
    assert.ok(actions.includes(`field(formData, "${name}")`), `action ต้องอ่าน ${name} จากฟอร์ม`);
  }
});

test("products admin: พรีวิวสลับ ไทย/EN ได้ (การตลาดตรวจงานตัวเองได้)", () => {
  assert.ok(editorForm.includes("setPreviewLanguage"), "ต้องมี state ภาษาของพรีวิว");
  assert.ok(editorForm.includes("language={previewLanguage}"), "ต้องส่งภาษาที่เลือกเข้า ProductListSection");
  assert.ok(editorForm.includes("aria-pressed={previewLanguage === item}"), "ปุ่มสลับต้องบอกสถานะให้ screen reader");
});

test("products admin: พรีวิวต้องเรนเดอร์ที่ความกว้างเท่าหน้าเว็บจริง (กันข้อความถูกบีบ — รอบที่ 146)", () => {
  /* ฟีดแบ็กเจ้าของ: การ์ดในพรีวิวถูกบีบ เพราะเรนเดอร์ในคอลัมน์แคบแต่ breakpoint อิง viewport */
  assert.ok(editorForm.includes("PreviewFrame"), "พรีวิวต้องอยู่ในกรอบ PreviewFrame");
  assert.ok(
    /<PreviewFrame[\s\S]*?<ProductListSection/.test(editorForm),
    "ต้องเรนเดอร์ ProductListSection (ตัวเรนเดอร์เดียวกับเว็บ) ภายในกรอบความกว้างจริง",
  );
  const frame = readFileSync("features/admin/ui/preview-frame.tsx", "utf8");
  assert.ok(frame.includes("SITE_PREVIEW_WIDTH"), "ต้องมีความกว้างอ้างอิงของเว็บ");
  assert.ok(
    /style=\{\{ width \}\}/.test(frame) || frame.includes("width, "),
    "กรอบต้องตั้งความกว้างจริง (ไม่ปล่อยให้บีบตามคอลัมน์)",
  );
  assert.ok(frame.includes("scale("), "ต้องย่อด้วย transform scale (ไม่ปล่อยให้ล้น/ต้องเลื่อน)");
  assert.ok(!frame.includes("overflow-x-auto"), "ห้ามใช้การเลื่อนแนวนอน (ฟีดแบ็กเจ้าของ: ต้องย่อพอดีช่อง)");
  assert.ok(frame.includes("1216"), "ความกว้างเนื้อหาเว็บต้องมาจากของจริง (80rem − padding = 1216px)");
  assert.ok(
    frame.includes("export const SITE_CARD_WIDTH"),
    "ต้องมี 'ความกว้างการ์ดจริง' ที่คำนวณไว้ (พรีวิวการ์ดใช้ 1:1 ไม่ย่อทั้งหน้า)",
  );
  assert.ok(
    editorForm.includes("width={SITE_CARD_WIDTH}") && editorForm.includes("singleCard"),
    "พรีวิวการ์ดต้องเรนเดอร์ที่ความกว้างการ์ดจริง + โหมดการ์ดเดียว ⇒ ตัวอักษรเท่าหน้าเว็บ",
  );
  assert.ok(readFileSync("app/globals.css", "utf8").includes(".preview-single-card .product-card-grid"), "ต้องมีกฎบังคับกริด 1 คอลัมน์ในการ์ดเดียว");
});

/* ── รอบที่ 254: หมวดสินค้าแก้ "ชื่อ + โลโก้" ได้จากหลังบ้าน (มติ D24 · หนี้ D-253-3) ── */

test("products admin: ฟอร์มหมวดมีช่องชื่อ (TH/EN) + โลโก้การ์ด + พรีวิวการ์ดจริง", () => {
  assert.ok(categoryForm.includes('name="nameTh"'), "ต้องมีช่องชื่อหมวดไทย");
  assert.ok(categoryForm.includes('name="nameEn"'), "ต้องมีช่องชื่อหมวดอังกฤษ");
  assert.ok(categoryForm.includes('name="logoPath"'), "ต้องมีช่องโลโก้บนการ์ด");
  assert.ok(categoryForm.includes("adminProductsCategoryNameHint"), "ต้องบอกว่าเว้นว่าง = ใช้ชื่อเดิม");
  /* พรีวิวต้องใช้การ์ดตัวเดียวกับหน้าเว็บ + ไม่เป็นลิงก์ + ความกว้างการ์ดจริง */
  assert.ok(categoryForm.includes("ProductCategoryCard"), "พรีวิวต้องใช้ ProductCategoryCard ตัวเดียวกับหน้า /products");
  assert.ok(categoryForm.includes("href={null}"), "พรีวิวต้องไม่เป็นลิงก์");
  assert.ok(categoryForm.includes("SITE_CATEGORY_CARD_WIDTH"), "ต้องเรนเดอร์ที่ความกว้างการ์ดจริง (ไม่ย่อทั้งหน้า)");
  assert.ok(categoryForm.includes("category-card-grid"), "ต้องใช้กริดเดียวกับหน้าเว็บ (มีกฎบังคับ 1 คอลัมน์ในพรีวิว)");
});

test("products admin: หน้า /products ใช้ชื่อ/โลโก้จากฐานข้อมูลก่อน แล้วถอยค่าในโค้ด", () => {
  const page = readFileSync("app/[lang]/products/page.tsx", "utf8");
  assert.ok(page.includes("listProductCategoryCards"), "ต้องอ่านชื่อ/โลโก้จากฐานข้อมูล");
  assert.ok(page.includes("categoryNameOf(") && page.includes("categoryLogoOf("), "ต้องใช้ตัวช่วยเลือกค่ากลาง (ไม่ประกอบเอง)");
  assert.ok(page.includes("ProductCategoryCard"), "ใช้การ์ดตัวเดียวกับพรีวิวหลังบ้าน");
  assert.ok(!page.includes("cardCta"), "ไม่มีข้อความ CTA 'ดูรายละเอียด' แล้ว (รอบที่ 254)");
});

test("products admin: ชั้นข้อมูลหมวดมีชื่อ/โลโก้ + ตัวนำเข้าแบบ fill-only (ไม่ทับงานคน)", () => {
  assert.ok(repository.includes("export async function importCategoryLogo"), "ต้องมีตัวนำเข้าโลโก้เข้าหมวด");
  assert.ok(
    repository.includes("where id = $1 and logo_media_id is null"),
    "ตัวนำเข้าโลโก้ต้องเขียนเฉพาะเมื่อยังว่าง ⇒ รันซ้ำไม่ทับโลโก้ที่เจ้าของเปลี่ยน",
  );
  assert.ok(repository.includes("export type NameWriteMode") && repository.includes('"keep" | "replace"'), "ต้องมีโหมดเขียนชื่อให้ชัดเจน");
  assert.ok(actions.includes('nameMode: "replace"'), "หลังบ้านกดบันทึก = ค่าที่กรอกต้องชนะ");
  assert.ok(actions.includes("logoMode: \"set\""), "หลังบ้านต้องล้างโลโก้ได้จริง (กลับไปใช้ไฟล์ใน public)");
});

test("products admin: migration 0037 เพิ่มชื่อ/โลโก้หมวดแบบ idempotent + สคริปต์นำเข้าโลโก้", () => {
  const sql = readFileSync("db/migrations/0037-product-category-name-logo.sql", "utf8");
  for (const column of ["name_th", "name_en", "logo_media_id"]) {
    assert.ok(sql.includes(column), `migration ต้องมีคอลัมน์ ${column}`);
  }
  assert.ok(sql.includes("add column if not exists"), "ต้องรันซ้ำได้ (idempotent)");

  const importer = readFileSync("scripts/import-products-logos.ts", "utf8");
  assert.ok(importer.includes("importCategoryLogo("), "สคริปต์ต้องผูกโลโก้เข้ากับหมวด");
  assert.ok(importer.includes("ensureImportedMedia("), "ต้องใช้ท่อนำเข้ากลาง (dedupe sha256)");
});

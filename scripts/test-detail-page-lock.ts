import assert from "node:assert/strict";
import { test } from "node:test";

import { codeOf, rawOf, stripComments } from "./source-scan.ts";
import { loadMigrationFiles } from "./migration-files.ts";

/**
 * เทสต์ของรอบที่ 286 — ปิดหนี้ 4 ข้อต่อเนื่องจากแผนหมวดสินค้าแบบไดนามิก (D30)
 *
 * · **D-281-1** ชื่อหมวด vs ชื่อหน้า = สองที่ ⇒ เหลือแหล่งเดียว (จอหมวด) + ซิงก์อัตโนมัติ + ซ่อนช่องในตัวสร้าง
 * · **D-281-2** `page.in_menu` ของหน้า detail สลับเป็น true ได้ ⇒ บังคับ false ที่ SQL + กรองที่ตัวอ่าน
 * · **D-280-3** ที่อยู่เดิมของหมวดที่ถูกลบ = 404 ⇒ เก็บประวัติแบบ "ปลดระวาง" แล้วเด้ง 308 ไป /products
 * (D-283-2 อยู่ใน `scripts/test-check-target.ts` — เป็นเรื่องของด่านปลายทาง)
 *
 * ⚠️ เทสต์ชุดนี้ **ไม่ต่อฐานข้อมูล** — ตรวจตรรกะ + สแกนซอร์ส (วงจรจริงอยู่ใน `check:db` วงจรที่ 40/41/42)
 */

/* ── D-281-1: ชื่อหน้า = ชื่อหมวด (แหล่งเดียว) ─────────────────────────────────── */

test("D-281-1: ชั้นข้อมูลซิงก์ 'ชื่อหน้า' จาก 'ชื่อหมวด' ในคำสั่งเดียว (และไม่ทับด้วยค่าว่าง)", () => {
  const repository = codeOf("lib/products/categories-repository.ts");
  assert.ok(repository.includes("syncPageNameSql"), "ต้องมีคำสั่งซิงก์ชื่อหน้า");
  assert.ok(
    repository.includes("coalesce(nullif(trim($2), ''), name_th)"),
    "ชื่อไทยว่างต้องไม่ทับของเดิม (ค่าว่างทำให้ toPage() ทิ้งแถว ⇒ จอตัวสร้าง 404)",
  );
  assert.ok(
    repository.includes("case when trim($3) = '' then name_en else $3 end"),
    "ชื่ออังกฤษว่างต้องไม่ทับของเดิม",
  );
  /* คืนค่าเริ่มต้น (รายหมวด + ทั้งชุด) ต้องซิงก์ชื่อหน้าด้วย */
  assert.equal(
    (repository.match(/update page p/g) ?? []).length,
    2,
    "ต้องมีคำสั่งซิงก์ชื่อหน้าทั้งใน restore รายหมวดและทั้งชุด",
  );
});

test("D-281-1: จอตัวสร้างไม่ให้แก้ชื่อหน้า detail — แสดงอย่างเดียว + ลิงก์ไปจอหมวด", () => {
  const settings = codeOf("features/admin/ui/page-settings.tsx");
  assert.ok(settings.includes("lock?: PageSettingsLock"), "ต้องรับ prop โหมดล็อกได้");
  assert.ok(settings.includes("data-page-name-locked"), "ต้องมีบล็อกชื่อแบบอ่านอย่างเดียว");
  assert.ok(
    settings.includes("lock === undefined ?"),
    "ช่องกรอกชื่อต้องอยู่ในสาขา 'ไม่ล็อก' เท่านั้น ⇒ ล็อกแล้วไม่มีช่องให้แก้",
  );
  /* ช่องชื่อต้องมีเฉพาะในสาขาไม่ล็อก (นับ `name="nameTh"` ได้ 1 ครั้ง) */
  assert.equal((settings.match(/name="nameTh"/g) ?? []).length, 1, "ต้องมีช่องชื่อไทยช่องเดียว (ในสาขาไม่ล็อก)");

  const builder = codeOf("app/admin/builder/[page]/page.tsx");
  assert.ok(builder.includes("productDetailCategoryIdOfPageId(page)"), "ต้องรู้ว่าหน้านี้เป็นของหมวดไหน");
  assert.ok(builder.includes("lock={pageLock}"), "ต้องส่งโหมดล็อกให้จอตั้งค่าหน้า");
  assert.ok(
    builder.includes("/admin/product-categories#category-"),
    "ลิงก์ต้องพาไปการ์ดของหมวดนั้นในจอหมวดสินค้า",
  );

  /* จอหมวดสินค้าต้องมี `id` ที่ลิงก์ชี้ถึงจริง */
  const categoriesPage = codeOf("app/admin/product-categories/page.tsx");
  assert.ok(categoriesPage.includes("id={`category-${row.id}`}"), "การ์ดหมวดต้องมี id ให้ลิงก์กระโดดถึง");
  /* ฟอร์มแก้หมวดต้องบอกว่าชื่อนี้คือชื่อหน้าด้วย (คนแก้จะได้รู้ว่าแก้ที่เดียว) */
  const editorForm = codeOf("features/admin/ui/category-editor-form.tsx");
  assert.ok(editorForm.includes("nameSyncHint"), "จอหมวดต้องบอกว่าชื่อนี้คือชื่อหน้าด้วย");
});

test("D-281-1: จอตัวสร้างส่งฟอร์มโดยไม่มีชื่อ ⇒ ต้องไม่แตะชื่อเดิม (ไม่ใช่ปฏิเสธเงียบ)", () => {
  const actions = codeOf("app/admin/builder/page-actions.ts");
  assert.ok(actions.includes('formData.get("nameTh")'), "ต้องอ่านคีย์ชื่อจากฟอร์มก่อนตัดสิน");
  assert.ok(actions.includes("rawNameTh !== null || rawNameEn !== null"), "ไม่มีคีย์ = ข้ามการตรวจชื่อ");
  const repository = codeOf("lib/pages/repository.ts");
  assert.ok(repository.includes("readonly nameTh?: string"), "ชื่อต้องเป็น optional (undefined = ไม่แตะ)");
  assert.ok(repository.includes("coalesce($2::text, name_th)"), "คำสั่ง SQL ต้องไม่เขียนทับด้วย null");
});

/* ── D-281-2: หน้า detail ขึ้นเมนูหลักไม่ได้ ───────────────────────────────────── */

test("D-281-2: ประตู 'ห้ามขึ้นเมนูหลัก' อยู่ที่คำสั่ง SQL (ไม่พึ่งความตั้งใจของผู้เรียก)", () => {
  const repository = codeOf("lib/pages/repository.ts");
  assert.ok(repository.includes("isProductDetailPageLike(id)"), "ต้องตรวจรูปทรงของ id");
  assert.ok(
    repository.includes("case when $7::boolean then false else $4::boolean end"),
    "in_menu ต้องถูกบังคับเป็น false ที่คำสั่ง",
  );
  /* ด่านที่สอง: ตัวอ่านเมนูต้องกรองออกด้วย แม้ในฐานข้อมูลจะมี true ค้าง */
  assert.ok(repository.includes("pageMenuLabels"), "ต้องมีตัวอ่านป้ายเมนู");
  const loader = codeOf("lib/chrome/loader.ts");
  assert.ok(
    loader.includes("page.inMenu && !isProductDetailPageLike(page.id)"),
    "เมนู navbar ต้องกรองหน้า detail ออก (ด่านที่สอง)",
  );
  /* จอ: ไม่มีสวิตช์ 'ขึ้นเมนูหลัก' ให้กดในโหมดล็อก */
  const settings = codeOf("features/admin/ui/page-settings.tsx");
  assert.ok(settings.includes("data-page-menu-locked"), "ต้องบอกเหตุผลแทนสวิตช์");
  assert.equal((settings.match(/name="inMenu"/g) ?? []).length, 1, "ต้องมีสวิตช์เดียว (ในสาขาไม่ล็อก)");
  /* หน้าอื่น ๆ ยังสลับได้ตามปกติ (ไม่ปิดความสามารถเดิมทั้งเว็บ) */
  assert.ok(!repository.includes('id like \'product-%\''), "ห้ามใช้ LIKE ตรง ๆ (ต้องใช้ตรรกะกลางของ id)");
});

/* ── D-280-3: ที่อยู่ของหมวดที่ถูกลบ ⇒ เก็บไว้ + เด้งไป /products ────────────────── */

test("D-280-3: migration 0044 เปลี่ยน FK เป็น set null + เพิ่มคอลัมน์ retired", () => {
  const files = loadMigrationFiles();
  const entry = files.find((file) => file.id === "0044");
  assert.ok(entry !== undefined, "ต้องมีไฟล์ migration 0044");
  assert.ok(entry.name.includes("retired"), `ชื่อไฟล์ต้องสื่อความหมาย (${entry.name})`);

  const sql = entry.sql;
  assert.ok(sql.includes("drop constraint if exists") && sql.includes("add column if not exists"), "ต้องรันซ้ำได้");
  assert.ok(sql.includes("on delete set null"), "FK ต้องเป็น set null (ไม่ลบประวัติตามหมวด)");
  assert.ok(sql.includes("retired_at") && sql.includes("retired_by"), "ต้องเก็บเวลา/คนปลดระวาง");

  /* `db/schema.sql` ต้องตรงกับของจริง */
  const schema = rawOf("db/schema.sql");
  assert.ok(schema.includes("retired_at"), "schema.sql ต้องมีคอลัมน์ retired_at");
  assert.ok(
    schema.includes("references product_category (id) on delete set null"),
    "schema.sql ต้องมี FK แบบ set null",
  );
});

test("D-280-3: ประวัติที่อยู่ของหมวดที่ถูกลบต้องไม่ถูกลบตาม (FK cascade ต้องหายไป)", () => {
  const files = loadMigrationFiles();
  const sql = files.find((file) => file.id === "0044")?.sql ?? "";
  /* ⚠️ ตัดคอมเมนต์ด้วยตัวช่วยกลาง (`stripComments`) — ตัวอธิบายเรื่อง cascade ไม่ใช่คำสั่งที่รันจริง */
  const statements = stripComments(sql);
  assert.equal(
    statements.includes("on delete cascade"),
    false,
    "คำสั่งที่รันจริงต้องไม่เหลือ cascade ของประวัติ slug (ไม่งั้นที่อยู่เดิมหาย = 404)",
  );
  assert.ok(statements.includes("on delete set null"), "คำสั่งที่รันจริงต้องตั้ง FK เป็น set null");
  /* ⚠️ ลำดับสำคัญ (บทเรียนจากบั๊กจริงในรอบนี้): ประตู/ลบ ต้องมาก่อนการปลดระวาง
     ถ้าปลดระวางก่อนแล้วลบไม่สำเร็จ การ `return false` = commit ของที่ปลดระวางไปแล้ว (พิษกับหมวดที่ยังอยู่) */
  const repository = codeOf("lib/products/categories-repository.ts").replace(/\r\n/g, "\n");
  /* ⚠️ ต้องระบุท้ายคำสั่งให้ชัด ไม่งั้นจะไปโดน `delete from product_category_slug_history` ที่อยู่ก่อนหน้า */
  const deleteIndex = repository.indexOf("delete from product_category where id = $1");
  const retireIndex = repository.indexOf("set category_id = null, retired_at = now()");
  assert.ok(deleteIndex > 0, "ต้องมีคำสั่งลบหมวด");
  assert.ok(retireIndex > 0, "ต้องมีคำสั่งปลดระวาง");
  assert.ok(deleteIndex < retireIndex, "ต้องลบ (หลังผ่านประตู) **ก่อน** ปลดระวาง");
  assert.ok(
    repository.includes("if (currentSlug === undefined) return false;"),
    "ประตูต้องคืน false ก่อนมีการเขียนใด ๆ",
  );
});

/* ── พจนานุกรม: พื้นที่ใหม่ต้องมีครบสองภาษา ──────────────────────────────────── */

test("i18n: พื้นที่ `adminPages` มีครบทั้ง th/en และถูก import จริง", () => {
  const th = rawOf("lib/i18n/messages/areas/th/adminPages.ts");
  const en = rawOf("lib/i18n/messages/areas/en/adminPages.ts");
  for (const key of ["pageNameLockedTitle", "pageNameLockedLink", "pageMenuLockedNote"]) {
    assert.ok(th.includes(key), `th ต้องมีคีย์ ${key}`);
    assert.ok(en.includes(key), `en ต้องมีคีย์ ${key}`);
  }
  for (const file of ["lib/i18n/messages/th.ts", "lib/i18n/messages/en.ts"]) {
    const source = rawOf(file);
    assert.ok(source.includes("areas/"), `${file} ต้อง import พื้นที่`);
    assert.ok(source.includes("adminPages"), `${file} ต้องใช้พื้นที่ adminPages`);
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { parseBlockDocument } from "@/lib/blocks/parse";
import { BLOCK_TEMPLATE_PAGE_IDS, buildBlockTemplate, hasBlockTemplate } from "@/lib/blocks/templates";
import { countRawBlocks } from "@/lib/blocks/migrate";
import { documentErrorsOf, validateDocument } from "@/lib/blocks/validate";
import { MAX_BLOCKS_TOTAL } from "@/lib/blocks/types";
import { PAGE_PATHS, PREVIEWABLE_PAGE_IDS, isPreviewablePage } from "@/lib/pages/paths";

/**
 * เทสต์ S2 — ตัวสร้างหน้าเว็บรองรับหลายหน้า (รอบที่ 82)
 *
 * จุดที่ต้องคุม
 * 1. เทมเพลตทุกตัว **ผ่าน parser + validator ของระบบเอง** (ไม่ใช่แค่ "หน้าตาดูดี")
 *    ⇒ ไม่งั้นปุ่ม "เริ่มจากเทมเพลต" จะสร้างฉบับร่างที่บันทึกไม่ได้/เผยแพร่ไม่ได้
 * 2. ทะเบียนเป็น **แหล่งความจริงเดียว**: ปุ่มในหลังบ้าน · รายการพรีวิว · ตัวเลือกลิงก์พรีวิว
 * 3. หน้าที่แปลงแล้ว **ต้องเรนเดอร์เอกสารที่เผยแพร่ได้จริง** และยังมีเลย์เอาต์เดิมเป็นทางถอย
 * 4. หน้าที่ไม่มีเทมเพลตต้องไม่ถูกเปิดพรีวิว/ไม่ถูกเขียนทับด้วยเทมเพลต
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/* ── 1) ทะเบียนเทมเพลต ─────────────────────────────────────────────────────── */

test("templates: ทะเบียนมีหน้าแรก + 3 หน้าที่แปลงรอบนี้ และทุกตัวสร้างเอกสารที่ใช้ได้จริง", () => {
  assert.deepEqual([...BLOCK_TEMPLATE_PAGE_IDS], ["home", "about", "careers", "contact"]);

  for (const page of BLOCK_TEMPLATE_PAGE_IDS) {
    const template = buildBlockTemplate(page);
    assert.ok(template !== null, `${page}: ต้องสร้างเทมเพลตได้`);
    assert.equal(template.page, page, `${page}: ช่อง page ของเอกสารต้องตรงกับหน้าที่ขอ`);

    const parsed = parseBlockDocument(page, template);
    assert.ok(parsed.ok, `${page}: เทมเพลตต้องผ่าน parser (${parsed.ok ? "" : parsed.problems.join(", ")})`);
    if (!parsed.ok) continue;

    const errors = documentErrorsOf(validateDocument(parsed.document));
    assert.deepEqual(errors, [], `${page}: เทมเพลตต้องไม่มี error จาก validator`);

    assert.ok(parsed.document.blocks.length > 0, `${page}: เทมเพลตต้องมีบล็อกอย่างน้อย 1`);
    assert.ok(countRawBlocks(parsed.document) <= MAX_BLOCKS_TOTAL, `${page}: ต้องไม่เกินเพดานบล็อกรวม`);
  }
});

test("templates: หน้าที่ไม่มีเทมเพลตต้องไม่ถูกเขียนทับด้วยเทมเพลตของคนอื่น", () => {
  for (const page of ["products", "recipes", "news", "executives", "certifications"]) {
    assert.equal(hasBlockTemplate(page), false, `${page}: ยังไม่มีเทมเพลตในรอบนี้`);
    assert.equal(buildBlockTemplate(page), null, `${page}: ต้องไม่คืนเทมเพลต`);
  }

  assert.equal(hasBlockTemplate("home"), true);
  assert.equal(hasBlockTemplate("about"), true);
});

test("templates: บล็อกในเทมเพลตมี id ไม่ซ้ำ และทุก id ตรงรูปแบบของโปรเจกต์", () => {
  for (const page of BLOCK_TEMPLATE_PAGE_IDS) {
    const template = buildBlockTemplate(page);
    assert.ok(template !== null);
    if (template === null) continue;

    const ids = template.blocks.map((block) => block.id);
    assert.equal(new Set(ids).size, ids.length, `${page}: id ของบล็อกต้องไม่ซ้ำ`);
    for (const id of ids) assert.match(id, /^block-\d+$/, `${page}: id "${id}" ต้องเป็นรูปแบบ block-<เลข>`);
  }
});

/* ── 2) แหล่งความจริงเดียว ──────────────────────────────────────────────────── */

test("templates: รายการหน้าที่พรีวิวได้มาจากทะเบียนเทมเพลต (ไม่ใช่การพิมพ์ซ้ำ)", () => {
  assert.deepEqual([...PREVIEWABLE_PAGE_IDS], [...BLOCK_TEMPLATE_PAGE_IDS]);
  assert.equal(isPreviewablePage("about"), true);
  assert.equal(isPreviewablePage("products"), false, "หน้าที่ยังไม่มีเทมเพลตต้องไม่เปิดพรีวิว");

  const paths = sourceOf("lib/pages/paths.ts");
  assert.ok(paths.includes("BLOCK_TEMPLATE_PAGE_IDS"), "paths ต้องอ่านจากทะเบียน ไม่ใช่พิมพ์รายการเอง");
  assert.ok(!paths.includes('["home"]'), "ห้ามเหลือรายการที่พิมพ์เองแบบเดิม");
});

test("templates: ปุ่มในหลังบ้านใช้ทะเบียน (ไม่ใช่ home อย่างเดียว)", () => {
  const actions = sourceOf("app/admin/builder/actions.ts");
  assert.ok(actions.includes("buildBlockTemplate(page)"), "action ต้องสร้างเทมเพลตตามหน้าจากทะเบียน");
  assert.ok(actions.includes("hasBlockTemplate(page)"), "ต้องกันหน้าที่ไม่มีเทมเพลต");
  assert.ok(!actions.includes("buildHomeTemplate"), "ห้ามผูกกับเทมเพลตหน้าแรกอย่างเดียวอีก");
  assert.ok(actions.includes("parseBlockDocument(page, template)"), "เทมเพลตต้องผ่าน parse ก่อนบันทึก");

  const page = sourceOf("app/admin/builder/[page]/page.tsx");
  assert.ok(page.includes("hasBlockTemplate(page)"), "หน้าจอต้องแสดงปุ่มเฉพาะหน้าที่มีเทมเพลต");
  assert.ok(page.includes("templateMissingBody"), "หน้าที่ไม่มีเทมเพลตต้องบอกผู้ใช้ตรง ๆ");
});

test("templates: ตัวเลือกลิงก์พรีวิวครอบทุกหน้าที่พรีวิวได้ (ไม่ใช่แค่หน้าแรก)", () => {
  const page = sourceOf("app/admin/preview-links/page.tsx");
  assert.ok(page.includes("PREVIEWABLE_PAGE_IDS.map"), "ตัวเลือกหน้าต้องมาจากรายการกลาง");
  assert.ok(page.includes("listPages("), "ชื่อหน้าต้องมาจากตาราง page (W1)");
  assert.ok(!page.includes("previewLinkPageHome"), "ห้ามเหลือตัวเลือกหน้าแรกแบบตายตัว");

  const manager = sourceOf("features/admin/ui/preview-link-manager.tsx");
  assert.ok(manager.includes("pages.map"), "ฟอร์มต้องเรนเดอร์ตัวเลือกจากรายการที่ส่งมา");
});

/* ── 3) หน้าสาธารณะที่แปลงแล้ว ─────────────────────────────────────────────── */

test("templates: 3 หน้าที่แปลงต้องเรนเดอร์เอกสารที่เผยแพร่ได้ และมีทางถอยเป็นเลย์เอาต์เดิม", () => {
  for (const page of ["about", "careers", "contact"]) {
    assert.ok(PAGE_PATHS[page] !== undefined, `${page}: ต้องมี path ในเว็บ`);

    const source = sourceOf(`app/[lang]/${page}/page.tsx`);
    assert.ok(source.includes(`loadLiveBlockDocument("${page}")`), `${page}: ต้องโหลดเอกสารที่เผยแพร่`);
    assert.ok(source.includes("<BlockDocumentView"), `${page}: ต้องใช้ตัวเรนเดอร์ตัวเดียวกับหน้าแรก`);
    assert.ok(source.includes("return ("), `${page}: ต้องมีเลย์เอาต์เดิมเป็นทางถอย`);

    /* สวิตช์ "ใช้กับหน้าเว็บจริง" เปิดได้เฉพาะหน้าที่มีเอกสาร — ต้องมีสวิตช์ในหน้าจอสร้าง */
    const builder = sourceOf("app/admin/builder/[page]/page.tsx");
    assert.ok(builder.includes("isPageLive(page)"), "หน้าจอสร้างต้องอ่านสถานะสวิตช์ของหน้านั้น");
  }
});

test("templates: พรีวิวโหมด 'หน้าเว็บจริง' ต้องชี้หน้าที่กำลังแก้ (ไม่ใช่หน้าแรกเสมอ)", () => {
  const builder = sourceOf("features/admin/ui/block-builder.tsx");
  assert.ok(builder.includes("previewLiveSrc"), "ต้องรับที่อยู่พรีวิวสดจากหน้าจอ");
  assert.ok(!builder.includes('previewMode === "live" ? "/th"'), "ห้ามตรึงที่อยู่พรีวิวสดเป็น /th อีก");

  const page = sourceOf("app/admin/builder/[page]/page.tsx");
  assert.ok(page.includes("previewLiveSrc={localePath("), "หน้าจอต้องส่งที่อยู่จริงของหน้านั้น");
  assert.ok(page.includes("pathForPage("), "ที่อยู่ต้องมาจากแหล่งกลาง (PAGE_PATHS)");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";

import { MAX_NEWS_BLOCKS, MAX_NEWS_IMAGES } from "@/lib/news/body";
import {
  newsBlocksToText,
  newsImageToken,
  newsTextLosses,
  newsTextToBlocks,
  parseNewsImageToken,
} from "@/lib/news/editor-text";
import { countEditorImages, newsBlocksToEditor, parseNewsEditorBlocks } from "@/lib/news/editor-blocks";

/**
 * เทสต์หลังบ้านข่าว (รอบที่ 123) — "ฟอร์มง่าย" ที่ต้องไม่ทำข้อมูลเดิมเสียหาย
 *
 * หัวใจของรอบนี้: ข่าว 151 ชิ้นถูกนำเข้าเป็น **บล็อก JSONB** แต่หลังบ้านแก้ด้วย **ข้อความช่องเดียว**
 * ⇒ ตัวแปลงสองทางต้อง **ไป-กลับได้ไม่เพี้ยน** ไม่งั้นกดบันทึกแล้วเนื้อหาข่าวเดิมจะเสียรูป (เคสจริงที่ต้องกัน)
 */

test("news admin: ข้อความ → บล็อก ตามกติกามาร์กอัป (ย่อหน้า/หัวข้อ/ภาพ)", () => {
  const blocks = newsTextToBlocks(
    ["ย่อหน้าแรก", "## หัวข้อย่อย", "[[img:m1|ภาพประกอบ]]", "ย่อหน้าสุดท้าย"].join("\n\n"),
  );

  assert.deepEqual(blocks, [
    { type: "paragraph", text: "ย่อหน้าแรก" },
    { type: "heading", text: "หัวข้อย่อย" },
    { type: "image", mediaId: "m1", alt: "ภาพประกอบ" },
    { type: "paragraph", text: "ย่อหน้าสุดท้าย" },
  ]);
});

test("news admin: บล็อก → ข้อความ → บล็อก ต้องได้ค่าเดิม (round-trip)", () => {
  const original = [
    { type: "paragraph", text: "ย่อหน้าแรกของข่าว" },
    { type: "heading", text: "หัวข้อย่อย" },
    { type: "image", mediaId: "abc123", alt: "ภาพที่ 1" },
    { type: "paragraph", text: "ปิดท้าย" },
  ] as const;

  const text = newsBlocksToText(original);
  const back = newsTextToBlocks(text);
  assert.deepEqual(back, original, "ไป-กลับแล้วต้องได้บล็อกเดิมเป๊ะ");
  assert.equal(newsBlocksToText(back), text, "แปลงซ้ำต้องได้ข้อความเดิม (idempotent)");
});

test("news admin: บรรทัดว่างหลายตัว/ช่องว่างหัวท้าย ไม่ทำให้เกิดบล็อกเปล่า", () => {
  const blocks = newsTextToBlocks("\n\n  ย่อหน้าเดียว  \n\n\n\n");
  assert.deepEqual(blocks, [{ type: "paragraph", text: "ย่อหน้าเดียว" }]);
});

test("news admin: ขึ้นบรรทัดใหม่ภายในย่อหน้าถูกยุบเป็นช่องว่างเดียว (ไม่กลายเป็นสองย่อหน้า)", () => {
  const blocks = newsTextToBlocks("บรรทัดหนึ่ง\nบรรทัดสอง");
  assert.deepEqual(blocks, [{ type: "paragraph", text: "บรรทัดหนึ่ง บรรทัดสอง" }]);
});

test("news admin: โทเคนภาพอ่านค่าได้ และตัดอักขระที่ทำให้รูปแบบเพี้ยน", () => {
  const token = newsImageToken("m9", "คำบรรยาย|ที่มี|ตัวคั่น");
  assert.equal(parseNewsImageToken(token)?.mediaId, "m9");
  assert.equal(parseNewsImageToken(token)?.alt, "คำบรรยายที่มีตัวคั่น");
  assert.equal(parseNewsImageToken("ย่อหน้าธรรมดา"), null);
  assert.equal(parseNewsImageToken("[[img:|ไม่มีรหัส]]"), null);
});

test("news admin: เกินเพดานแล้วต้องรายงานว่ามีของถูกตัด (ไม่บันทึกเงียบ ๆ)", () => {
  const tooMany = Array.from({ length: MAX_NEWS_BLOCKS + 5 }, (_, index) => `ย่อหน้า ${String(index)}`).join("\n\n");
  const losses = newsTextLosses(tooMany);
  assert.ok(losses.droppedBlocks > 0, "ต้องรู้ว่ามีบล็อกถูกตัด");

  const tooManyImages = Array.from({ length: MAX_NEWS_IMAGES + 3 }, (_, index) => `[[img:m${String(index)}|]]`).join("\n\n");
  assert.ok(newsTextLosses(tooManyImages).droppedImages > 0, "ต้องรู้ว่ามีรูปถูกตัด");

  assert.deepEqual(newsTextLosses("ย่อหน้าปกติ"), { droppedBlocks: 0, droppedImages: 0 });
});

/* ── ตรวจซอร์ส: กฎที่ "ห้ามลืม" ของรอบนี้ ───────────────────────────────────── */

const repo = readFileSync("lib/news/repository.ts", "utf8");
const actions = codeOf("app/admin/news/actions.ts");

test("news admin: ฝั่งเว็บสาธารณะต้องกรองเฉพาะ 'เผยแพร่และไม่ถังขยะ' ทุกคำสั่ง", () => {
  assert.ok(repo.includes("PUBLIC_NEWS_CONDITION"), "ต้องมีค่าคงที่เงื่อนไขกลาง");
  assert.equal(
    (repo.match(/PUBLIC_NEWS_CONDITION/g) ?? []).length >= 5,
    true,
    "ต้องใช้เงื่อนไขนี้ในทุกคำสั่งอ่านฝั่งเว็บ (นิยาม 1 + ใช้ ≥4)",
  );
  assert.ok(
    /n\.status = 'published' and n\.deleted_at is null/.test(repo),
    "เงื่อนไขต้องกันทั้งสถานะร่างและของในถังขยะ",
  );
});

test("news admin: ทุก action ต้องตรวจสิทธิ์ + เขียน audit + สั่งสร้างหน้าเว็บใหม่", () => {
  /* 5 action ในไฟล์นี้ (บันทึก · ย้าย/กู้ถังขยะ · ลบถาวร · อัปโหลดภาพ · กู้คืนประวัติ) — นับแบบ >= เพราะมีการอ้างถึงในคอมเมนต์ด้วย */
  const permissionChecks = (actions.match(/requireAdminUser\("content"\)/g) ?? []).length;
  assert.ok(permissionChecks >= 5, `ต้องตรวจสิทธิ์ทุก action (พบ ${String(permissionChecks)} ครั้ง)`);
  assert.equal(
    (actions.match(/^export async function/gm) ?? []).length,
    5,
    "ไฟล์นี้มี 5 action (บันทึก · ถังขยะ · ลบถาวร · อัปโหลดภาพ · กู้คืนประวัติ)",
  );
  assert.ok(actions.includes("recordAudit("), "ทุกการแก้เนื้อหาต้องมีร่องรอย audit");
  assert.ok(actions.includes('refreshPublicSite("page")'), "บันทึกแล้วต้องสั่งสร้างหน้าเว็บใหม่ (ISR)");
  assert.ok(
    actions.includes("parseNewsEditorBlocks("),
    "ต้องตรวจบล็อกที่รับจากเบราว์เซอร์ด้วย parseNewsEditorBlocks (ห้ามเชื่อฝั่ง client)",
  );
});

/* ── ตัวแก้แบบบล็อก (รอบที่ 125) ─────────────────────────────────────────── */

test("news admin: บล็อกจาก DB ↔ ตัวแก้ และ JSON จากเบราว์เซอร์ต้องไป-กลับไม่เพี้ยน", () => {
  const fromDb = [
    { type: "paragraph", text: "ย่อหน้าแรก" },
    { type: "heading", text: "หัวข้อย่อย" },
    { type: "image", mediaId: "m1", alt: "คำบรรยาย" },
    { type: "paragraph", text: "ปิดท้าย" },
  ] as const;

  const editor = newsBlocksToEditor(fromDb);
  assert.deepEqual(
    editor.map((item) => item.kind),
    ["paragraph", "heading", "image", "paragraph"],
    "ลำดับการ์ดต้องตรงกับบล็อกเดิม (ห้ามย้ายภาพไปท้ายข่าว)",
  );

  const asJson = JSON.stringify(
    editor.map((item) =>
      item.kind === "image" ? { kind: "image", mediaId: item.mediaId, alt: item.alt } : { kind: item.kind, text: item.text },
    ),
  );
  assert.deepEqual(parseNewsEditorBlocks(JSON.parse(asJson)), fromDb, "JSON ที่ตัวแก้ส่งมา ต้องแปลงกลับเป็นบล็อกเดิมเป๊ะ");
});

test("news admin: ตรวจค่าจากเบราว์เซอร์ — ทิ้งของว่าง/ผิดชนิด และกันภาพไม่มีรหัส", () => {
  assert.deepEqual(parseNewsEditorBlocks(null), []);
  assert.deepEqual(parseNewsEditorBlocks("ไม่ใช่ array"), []);
  assert.deepEqual(
    parseNewsEditorBlocks([
      { kind: "paragraph", text: "  เก็บ  " },
      { kind: "paragraph", text: "   " },
      { kind: "heading", text: "" },
      { kind: "image", mediaId: "", alt: "ไม่มีรหัส" },
      { kind: "image", mediaId: "ok1", alt: "" },
      { kind: "อะไรก็ไม่รู้", text: "ถือเป็นย่อหน้า" },
    ]),
    [
      { type: "paragraph", text: "เก็บ" },
      { type: "image", mediaId: "ok1", alt: "" },
      { type: "paragraph", text: "ถือเป็นย่อหน้า" },
    ],
  );
});

test("news admin: ภาพไม่มีคำบรรยาย = ยอมรับได้ (มติเจ้าของ: ไม่บังคับ)", () => {
  const blocks = parseNewsEditorBlocks([{ kind: "image", mediaId: "m9", alt: "" }]);
  assert.deepEqual(blocks, [{ type: "image", mediaId: "m9", alt: "" }]);
  assert.equal(countEditorImages(newsBlocksToEditor(blocks)), 1);
});

test("news admin: โทเคนภาพที่ค้างในข้อความเดิม ต้องกลายเป็นการ์ดภาพ (เคสจริง '5 บล็อก · 0 รูป')", () => {
  /* ข่าวที่สร้างก่อนรอบ 125 มีโทเคนฝังในย่อหน้า ⇒ ตัวนับรูปใน DB ได้ 0 และคนใช้เห็นเป็นข้อความประหลาด */
  const legacy = [
    { type: "paragraph", text: "ย่อหน้าแรก" },
    { type: "paragraph", text: "ก่อนภาพ [[img:m1|คำบรรยายภาพ]] หลังภาพ" },
  ] as const;

  const editor = newsBlocksToEditor(legacy);
  assert.deepEqual(
    editor.map((item) => (item.kind === "image" ? `image:${item.mediaId}` : `${item.kind}:${item.text}`)),
    ["paragraph:ย่อหน้าแรก", "paragraph:ก่อนภาพ", "image:m1", "paragraph:หลังภาพ"],
    "ต้องแยกโทเคนออกเป็นการ์ดภาพ และเก็บบรรทัดที่เหลือครบ",
  );

  /* พอบันทึก ต้องกลายเป็นบล็อกภาพจริง (นับรูปได้ 1) */
  const saved = parseNewsEditorBlocks(
    editor.map((item) =>
      item.kind === "image" ? { kind: "image", mediaId: item.mediaId, alt: item.alt } : { kind: item.kind, text: item.text },
    ),
  );
  assert.deepEqual(saved.map((block) => block.type), ["paragraph", "paragraph", "image", "paragraph"]);
  assert.equal(countEditorImages(newsBlocksToEditor(saved)), 1);
});

test("news admin: อัปโหลดภาพจากเครื่อง — action ต้องตรวจสิทธิ์และใช้ท่อกลาง storeImageFile", () => {
  assert.ok(actions.includes("uploadNewsImageAction"), "ต้องมี action อัปโหลดภาพในหน้าจอแก้ข่าว");
  assert.ok(actions.includes("storeImageFile("), "ต้องใช้ท่ออัปโหลดกลาง (ย่อภาพ/ตรวจหัวไฟล์/เพดาน 5MB)");
  const blocks = readFileSync("features/admin/ui/news-body-blocks.tsx", "utf8");
  assert.ok(blocks.includes("ImageFileInput"), "ช่องอัปโหลดต้องใช้ ImageFileInput (ย่อภาพในเบราว์เซอร์ก่อนส่ง)");
  assert.ok(blocks.includes("mediaIdFromPath"), "ต้องแปลงพาธ /media/<id> เป็นรหัสภาพก่อนเก็บลงบล็อก (มติ D9)");
});

test("news admin: พรีวิวต้องใช้ตัวเรนเดอร์เดียวกับหน้าเว็บจริง (กัน 'พรีวิวโกหก')", () => {
  const preview = readFileSync("features/admin/ui/news-preview.tsx", "utf8");
  const form = readFileSync("features/admin/ui/news-editor-form.tsx", "utf8");
  const publicBody = readFileSync("features/news/ui/news-body.tsx", "utf8");

  /* ตัวเรนเดอร์เนื้อหาหน้าเว็บจริง = NewsBody — พรีวิวต้อง import ตัวเดียวกัน ไม่เขียนใหม่ */
  assert.ok(
    /import \{ NewsBody \} from "@\/features\/news\/ui\/news-body"/.test(preview),
    "พรีวิวต้องใช้ NewsBody ตัวเดียวกับหน้า /news/<id>",
  );
  assert.ok(/<NewsBody blocks={props.blocks} sizes={sizes}/.test(preview), "ต้องเรนเดอร์เนื้อหาผ่าน NewsBody");
  assert.ok(!preview.includes("dangerouslySetInnerHTML"), "พรีวิวห้ามตีความเป็น HTML");
  assert.equal(
    (publicBody.match(/export function NewsBody/g) ?? []).length,
    1,
    "ต้องมีตัวเรนเดอร์เนื้อหาเพียงตัวเดียวในระบบ",
  );
  assert.ok(form.includes("<NewsPreview"), "หน้าจอแก้ข่าวต้องแสดงพรีวิว");
});

test("news admin: ตัวแก้เนื้อหาต้องไม่มี <form> (กัน <form> ซ้อน <form> ⇒ hydration error)", () => {
  /* เคสจริง (รอบที่ 129): กล่องอัปโหลดเคยเป็น <form> ซ้อนอยู่ในฟอร์มบันทึกข่าว
     ⇒ React ขึ้น "In HTML, <form> cannot be a descendant of <form>" และเบราว์เซอร์ตัดฟอร์มชั้นในทิ้ง */
  const blocks = readFileSync("features/admin/ui/news-body-blocks.tsx", "utf8");
  const form = readFileSync("features/admin/ui/news-editor-form.tsx", "utf8");

  /*
    นับ "แท็กฟอร์มจริง" = `<form` ตามด้วยช่องว่างหรือขึ้นบรรทัดใหม่
    (ในไฟล์มีคอมเมนต์ที่พูดถึง `<form>` ได้ จึงต้องไม่ใช้การนับแบบกว้าง)
  */
  const formTags = (value: string): number => (value.match(/<form[ \n]/g) ?? []).length;
  assert.equal(formTags(blocks), 0, "ตัวแก้เนื้อหาต้องไม่มีแท็ก <form> เลย");
  assert.equal(formTags(form), 1, "หน้าจอแก้ข่าวมีแท็ก <form> ได้เพียงตัวเดียว (ฟอร์มบันทึก)");
  assert.ok(blocks.includes("uploadNewsImageAction("), "ปุ่มอัปโหลดต้องเรียก Server Action เอง (ไม่ใช้ <form>)");
});

test("news admin: คำบรรยายใต้ภาพต้องแสดงจริงทั้งหน้าเว็บและพรีวิว (รอบที่ 130)", () => {
  const body = readFileSync("features/news/ui/news-body.tsx", "utf8");
  const preview = readFileSync("features/admin/ui/news-preview.tsx", "utf8");

  /* หน้าเว็บจริง: ผู้อ่านต้องเห็นคำบรรยาย (ไม่ใช่ซ่อนใน alt อย่างเดียว) */
  assert.ok(body.includes("<figcaption"), "ภาพที่มีคำบรรยายต้องเรนเดอร์ <figcaption> ให้เห็นจริง");
  assert.ok(body.includes("const caption = block.alt.trim();"), "ต้องใช้ alt เป็นข้อความคำบรรยาย");
  assert.ok(
    body.includes("captionPlaceholder === undefined ? null"),
    "ภาพที่ไม่มีคำบรรยายบนหน้าเว็บจริง = ต้องไม่แสดงบรรทัดว่าง",
  );

  /* พรีวิว: ต้องส่งข้อความตัวอย่าง เพื่อให้คนแก้เห็นตำแหน่งที่คำบรรยายจะไปโผล่ */
  assert.ok(
    preview.includes("captionPlaceholder={m.newsAdminCaptionSample}"),
    "พรีวิวต้องแสดง 'ตัวอย่างคำบรรยาย' เมื่อช่องคำบรรยายว่าง",
  );
});

/* ── รอบที่ 155: หน้าข่าวสาธารณะต้องเรียงตามลำดับที่จัดจากหลังบ้าน ────────────── */

test("news: หน้าข่าวสาธารณะเรียงตาม sort_order (จัดจากหลังบ้านแล้วหน้าบ้านต้องขยับ)", () => {
  const repo = readFileSync("lib/news/repository.ts", "utf8");
  assert.ok(
    repo.includes("PUBLIC_NEWS_ORDER"),
    "ต้องมีค่าลำดับกลางสำหรับหน้าข่าวสาธารณะ (ที่เดียว ไม่กระจัดกระจาย)",
  );
  assert.ok(
    repo.includes("case when n.sort_order = 0 then 1 else 0 end"),
    "sort_order = 0 (ยังไม่จัด) ต้องอยู่ท้าย ไม่ใช่ขึ้นหน้า",
  );
  assert.ok(
    repo.includes("n.sort_order, n.published_at desc nulls last"),
    "จัดแล้วเรียงตาม sort_order แล้วค่อยถอยไปใช้วันที่",
  );
  /* ของเดิม 151 ข่าว sort_order = 0 ทั้งหมด ⇒ ลำดับต้องเหมือนเดิมเป๊ะ (ตามวันที่) */
  assert.ok(
    repo.includes("when n.sort_order = 0 then 1 else 0 end, n.sort_order, n.published_at desc nulls last, n.id desc"),
    "ค่าเริ่มต้นต้องไม่เปลี่ยนลำดับข่าวเดิม",
  );
});

/* ── รอบที่ 174: ลบข่าวถาวรจากถังขยะ (ประตูอยู่ที่ SQL) ───────────────────────── */

test("news admin: ลบถาวรได้เฉพาะของในถัง + มีปุ่มเฉพาะแท็บถังขยะ", () => {
  const repo = readFileSync("lib/news/repository.ts", "utf8");
  assert.ok(
    repo.includes("delete from news where id = $1 and deleted_at is not null"),
    "deleteNewsForever ต้องมีประตู 'ต้องอยู่ในถัง' ที่ SQL (fail-closed)",
  );

  const actions = readFileSync("app/admin/news/actions.ts", "utf8");
  assert.ok(actions.includes("deleteNewsForeverAction"), "ต้องมี Server Action ลบถาวร");
  assert.ok(actions.includes('requireAdminUser("content")'), "ต้องตรวจสิทธิ์ก่อนลบ");
  assert.ok(actions.includes('action: "news-delete"'), "ต้องมี audit log ของการลบถาวร");

  const page = readFileSync("app/admin/news/page.tsx", "utf8");
  assert.ok(page.includes("deleteNewsForeverAction"), "ปุ่มลบถาวรต้องอยู่ในหน้ารายการ");
  assert.ok(page.includes("m.newsAdminDeleteForeverWarning"), "ต้องมีคำเตือน 'ลบแล้วกู้คืนไม่ได้'");
  assert.ok(
    page.includes("action={deleteNewsForeverAction}") && page.includes("{item.trashed ? ("),
    "ปุ่มลบถาวรต้องแสดงเฉพาะของที่อยู่ในถัง",
  );

  /* ป้ายเหตุการณ์ใน audit log ต้องมี (กันหน้าจอโชว์รหัสดิบ) */
  const labels = readFileSync("features/admin/audit-labels.ts", "utf8");
  assert.ok(labels.includes('"news-delete"'), "ต้องมีป้ายเหตุการณ์ news-delete");
});

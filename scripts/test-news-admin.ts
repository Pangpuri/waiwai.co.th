import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { MAX_NEWS_BLOCKS, MAX_NEWS_IMAGES } from "@/lib/news/body";
import {
  newsBlocksToText,
  newsImageToken,
  newsTextLosses,
  newsTextToBlocks,
  parseNewsImageToken,
} from "@/lib/news/editor-text";

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
const actions = readFileSync("app/admin/news/actions.ts", "utf8");

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
  /* 2 action ในไฟล์นี้ (บันทึก · ย้าย/กู้ถังขยะ) — นับแบบ >= เพราะมีการอ้างถึงในคอมเมนต์อธิบายกติกาด้วย */
  const permissionChecks = (actions.match(/requireAdminUser\("content"\)/g) ?? []).length;
  assert.ok(permissionChecks >= 2, `ต้องตรวจสิทธิ์ทุก action (พบ ${String(permissionChecks)} ครั้ง)`);
  assert.equal(
    (actions.match(/^export async function/gm) ?? []).length,
    2,
    "ไฟล์นี้ควรมี 2 action เท่านั้น (ถ้าเพิ่ม ต้องตรวจสิทธิ์และมี audit ครบด้วย)",
  );
  assert.ok(actions.includes("recordAudit("), "ทุกการแก้เนื้อหาต้องมีร่องรอย audit");
  assert.ok(actions.includes('refreshPublicSite("page")'), "บันทึกแล้วต้องสั่งสร้างหน้าเว็บใหม่ (ISR)");
  assert.ok(actions.includes("newsTextToBlocks("), "ต้องแปลงข้อความ→บล็อกฝั่งเซิร์ฟเวอร์ (ห้ามเชื่อเบราว์เซอร์)");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { MAX_UPLOAD_BYTES, extensionFor, readImageInfo } from "@/lib/media/image-info";
import {
  MAX_UPLOAD_EDGE,
  SHRINK_MIN_BYTES,
  WEBP_QUALITY,
  scaleToFit,
  shouldAttemptShrink,
  shrinkSummary,
  webpFilename,
} from "@/features/admin/ui/image-resize";

/**
 * เทสต์การย่อ/แปลงภาพในเบราว์เซอร์ก่อนอัปโหลด (รอบที่ 99)
 *
 * ตรรกะที่ทดสอบได้โดยไม่ต้องมีเบราว์เซอร์ = คณิตศาสตร์/การตัดสินใจ/ชื่อไฟล์
 * ส่วนที่ต้องใช้ canvas จริง (ตัว `shrinkImageFile`) ทดสอบได้แค่ "สัญญาว่าห้ามโยน error"
 * ⇒ ปิดด้วยเทสต์สแกนซอร์ส: ต้องมี try/catch และต้องใช้ผลลัพธ์เฉพาะเมื่อเล็กลงจริง
 */

const root = join(import.meta.dirname, "..");
const read = (...parts: readonly string[]): string => readFileSync(join(root, ...parts), "utf8");

test("resize: ย่อตามด้านที่ยาวที่สุด และไม่ขยายภาพเล็ก", () => {
  /* ภาพเล็กกว่าเพดาน = คงขนาดเดิม */
  assert.deepEqual(scaleToFit(800, 600, MAX_UPLOAD_EDGE), { width: 800, height: 600 });
  assert.deepEqual(scaleToFit(2400, 1000, MAX_UPLOAD_EDGE), { width: 2400, height: 1000 });

  /* ภาพใหญ่ = ย่อด้านยาวเป็นเพดาน อัตราส่วนคงเดิม */
  assert.deepEqual(scaleToFit(4800, 2400, MAX_UPLOAD_EDGE), { width: 2400, height: 1200 });
  assert.deepEqual(scaleToFit(2400, 4800, MAX_UPLOAD_EDGE), { width: 1200, height: 2400 });

  /* ภาพแคบยาวผิดปกติ ต้องไม่เหลือด้านใดเป็น 0 */
  const tall = scaleToFit(10, 9000, MAX_UPLOAD_EDGE);
  assert.ok(tall.width >= 1 && tall.height >= 1, "ห้ามได้ด้านที่เป็น 0");

  /* ค่าเพี้ยน = คืน 0 (ผู้เรียกรู้ว่าใช้ไม่ได้ แล้วส่งไฟล์เดิม) */
  assert.deepEqual(scaleToFit(0, 100, MAX_UPLOAD_EDGE), { width: 0, height: 0 });
  assert.deepEqual(scaleToFit(Number.NaN, 100, MAX_UPLOAD_EDGE), { width: 0, height: 0 });
});

test("resize: ตัดสินใจย่อเฉพาะภาพที่รับได้และใหญ่พอ", () => {
  assert.equal(shouldAttemptShrink({ type: "image/jpeg", size: 3_000_000 }), true);
  assert.equal(shouldAttemptShrink({ type: "image/png", size: 3_000_000 }), true);
  assert.equal(shouldAttemptShrink({ type: "image/webp", size: 3_000_000 }), true);

  /* เล็กเกินกว่าจะคุ้ม = ไม่แตะ */
  assert.equal(shouldAttemptShrink({ type: "image/jpeg", size: SHRINK_MIN_BYTES - 1 }), false);
  /* ชนิดที่เซิร์ฟเวอร์ไม่รับ = ไม่แตะ (ให้ด่านเซิร์ฟเวอร์ปฏิเสธตามเดิม) */
  assert.equal(shouldAttemptShrink({ type: "image/gif", size: 3_000_000 }), false);
  assert.equal(shouldAttemptShrink({ type: "application/pdf", size: 3_000_000 }), false);
  assert.equal(shouldAttemptShrink({ type: "", size: 3_000_000 }), false);
});

test("resize: ชื่อไฟล์หลังแปลงเป็น WebP", () => {
  assert.equal(webpFilename("photo.jpg"), "photo.webp");
  assert.equal(webpFilename("ภาพ ถ่าย.JPEG"), "ภาพ ถ่าย.webp");
  assert.equal(webpFilename("no-extension"), "no-extension.webp");
  assert.equal(webpFilename("หลาย.จุด.png"), "หลาย.จุด.webp");
  assert.equal(webpFilename("   "), "image.webp");
  assert.equal(webpFilename(".png"), "image.webp");
});

test("resize: สรุปตัวเลขบอกผู้ใช้ (แสดงเฉพาะเมื่อย่อจริง)", () => {
  const file = new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" });
  assert.equal(
    shrinkSummary({ file, shrunken: true, originalBytes: 3_072_000, bytes: 409_600, skipped: null }),
    "3000 KB → 400 KB",
  );
  assert.equal(
    shrinkSummary({ file, shrunken: false, originalBytes: 3_072_000, bytes: 3_072_000, skipped: "failed" }),
    null,
    "ไม่ย่อ = ไม่แสดงข้อความ",
  );
});

test("resize: ไม่มีทางทำให้แย่ลง — ใช้ผลเฉพาะเมื่อเล็กลง และไม่โยน error", () => {
  const source = read("features", "admin", "ui", "image-resize.ts");

  assert.ok(source.includes("if (blob.size >= file.size) return { ...base, skipped: \"not-smaller\" }"), "ต้องใช้ผลเฉพาะเมื่อเล็กลงจริง");
  assert.ok(source.includes("} catch {"), "ต้องมี try/catch ครอบเส้นทางที่ใช้ canvas");
  assert.ok(source.includes("typeof createImageBitmap !== \"function\""), "ต้องเช็คความสามารถของเบราว์เซอร์ก่อนใช้");
  assert.ok(source.includes("typeof document === \"undefined\""), "ต้องไม่พังตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์");
  assert.ok(WEBP_QUALITY > 0.5 && WEBP_QUALITY < 1, "คุณภาพต้องอยู่ในช่วงที่สมเหตุสมผล");
  assert.ok(MAX_UPLOAD_EDGE >= 1600 && MAX_UPLOAD_EDGE <= 4000, "เพดานด้านยาวต้องพอสำหรับจอ 2x แต่ไม่ใหญ่เกินจำเป็น");

  /* ⚠️ เซิร์ฟเวอร์ยังเป็นด่านจริง: เพดาน/warning ของฝั่งเซิร์ฟเวอร์ต้องไม่ถูกแก้จากรอบนี้ */
  const server = read("lib", "media", "image-info.ts");
  assert.ok(server.includes("MAX_UPLOAD_BYTES"), "เพดาน 5MB ฝั่งเซิร์ฟเวอร์ต้องยังอยู่");
});

test("resize: ช่องอัปโหลดทุกจุดใช้เส้นทางที่ย่อก่อนส่ง", () => {
  const drop = read("features", "admin", "ui", "image-drop.tsx");
  assert.ok(drop.includes("await shrinkImageFile(file)"), "ช่องภาพในตัวแก้ต้องย่อก่อนส่ง");
  assert.ok(drop.includes("shrinkImageFile"), "ต้อง Import ตัวย่อ");
  assert.ok(drop.includes("outcome.file"), "ต้องใส่ไฟล์ผลลัพธ์ลง input ก่อน requestSubmit");

  const library = read("features", "admin", "ui", "media-library.tsx");
  assert.ok(library.includes("ImageFileInput"), "หน้าคลังภาพต้องใช้ช่องไฟล์ที่ย่ออัตโนมัติ");
  assert.ok(!library.includes("type=\"file\""), "ห้ามเหลือ input ไฟล์ดิบในหน้าคลังภาพ (จะข้ามการย่อ)");
  assert.ok(library.includes("imageShrinkNote"), "ต้องบอกผู้ใช้ว่ามีการย่ออัตโนมัติ");

  const field = read("features", "admin", "ui", "image-file-input.tsx");
  assert.ok(field.includes("new DataTransfer()"), "ต้องใส่ไฟล์ที่ย่อแล้วกลับเข้า input");
  assert.ok(field.includes("try {"), "ต้องมีทางถอยเมื่อเบราว์เซอร์ไม่รองรับ");
  assert.ok(field.includes("name=\"file\""), "ชื่อฟิลด์ต้องเป็น `file` เหมือนเดิม (Server Action ไม่ต้องแก้)");
});

test("resize: สิ่งที่เบราว์เซอร์ส่งออก (WebP) ต้องผ่านด่านเซิร์ฟเวอร์ได้จริง", () => {
  /*
    ตัวอย่างไฟล์ WebP รูปแบบ VP8X (มีขนาดอยู่ในหัวไฟล์) — จำลองสิ่งที่ canvas ส่งออกแบบง่ายสุด
    เซิร์ฟเวอร์อ่านหัวไฟล์เอง (ไม่เชื่อ File.type) ⇒ ต้องได้ image/webp + ขนาดที่ถูกต้อง
  */
  const bytes = new Uint8Array(30);
  bytes.set(Buffer.from("RIFF", "ascii"), 0);
  bytes.set(Buffer.from("WEBP", "ascii"), 8);
  bytes.set(Buffer.from("VP8X", "ascii"), 12);
  const width = 2399;
  const height = 1199;
  bytes.set([width & 0xff, (width >> 8) & 0xff, (width >> 16) & 0xff], 24);
  bytes.set([height & 0xff, (height >> 8) & 0xff, (height >> 16) & 0xff], 27);

  const info = readImageInfo(bytes);
  assert.equal(info?.mime, "image/webp", "WebP ที่เบราว์เซอร์สร้างต้องถูกตรวจว่าเป็น image/webp");
  assert.equal(info?.width, 2400, "ต้องอ่านขนาดจากหัวไฟล์ได้ (2399 + 1 ตามสเปก VP8X)");
  assert.equal(info?.height, 1200);
  assert.equal(extensionFor("image/webp"), "webp", "นามสกุลที่เก็บต้องเป็น .webp");

  /* เพดานฝั่งเซิร์ฟเวอร์ยัง 5MB เท่าเดิม — การย่อฝั่งเบราว์เซอร์ไม่ใช่การผ่อนด่าน */
  assert.equal(MAX_UPLOAD_BYTES, 5 * 1024 * 1024, "เพดานเซิร์ฟเวอร์ต้องไม่ถูกแก้จากรอบนี้");
});

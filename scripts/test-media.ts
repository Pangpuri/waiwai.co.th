import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";

import { MAX_UPLOAD_BYTES, extensionFor, readImageInfo, safeFilename } from "@/lib/media/image-info";

/** เทสต์การตรวจภาพจากหัวไฟล์ (ไม่เชื่อ File.type จากเบราว์เซอร์) */

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** PNG สังเคราะห์: magic + IHDR (ความกว้าง/สูงที่ offset 16/20) */
function syntheticPng(width: number, height: number): Uint8Array {
  const header = new Uint8Array(24);
  header.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(header.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return header;
}

/** JPEG สังเคราะห์: SOI + APP0 + SOF0 (สูง 640 · กว้าง 800) */
function syntheticJpeg(width: number, height: number): Uint8Array {
  const app0 = concat(bytes(0xff, 0xe0), bytes(0x00, 0x10), new Uint8Array(14));
  const sof0 = concat(
    bytes(0xff, 0xc0),
    bytes(0x00, 0x11),
    bytes(0x08),
    bytes((height >> 8) & 0xff, height & 0xff),
    bytes((width >> 8) & 0xff, width & 0xff),
    new Uint8Array(8),
  );
  return concat(bytes(0xff, 0xd8), app0, sof0, bytes(0xff, 0xd9));
}

/** WebP แบบ VP8X (ขยาย): RIFF…WEBP + VP8X + ขนาด-1 (LE 3 ไบต์) */
function syntheticWebp(width: number, height: number): Uint8Array {
  const out = new Uint8Array(30);
  out.set([0x52, 0x49, 0x46, 0x46], 0);
  out.set([0x57, 0x45, 0x42, 0x50], 8);
  out.set([0x56, 0x50, 0x38, 0x58], 12);
  const w = width - 1;
  const h = height - 1;
  out.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  out.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27);
  return out;
}

test("image: อ่าน PNG จริง (1x1) ได้", () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64",
  );
  const info = readImageInfo(new Uint8Array(png));

  assert.ok(info);
  assert.equal(info.mime, "image/png");
  assert.equal(info.width, 1);
  assert.equal(info.height, 1);
});

test("image: อ่านขนาดจาก PNG ขนาดใหญ่ได้", () => {
  const info = readImageInfo(syntheticPng(1200, 630));
  assert.ok(info);
  assert.equal(info.mime, "image/png");
  assert.equal(info.width, 1200);
  assert.equal(info.height, 630);
});

test("image: อ่านขนาดจาก JPEG ได้ (เดินหา marker SOF)", () => {
  const info = readImageInfo(syntheticJpeg(800, 640));
  assert.ok(info);
  assert.equal(info.mime, "image/jpeg");
  assert.equal(info.width, 800);
  assert.equal(info.height, 640);
});

test("image: อ่านขนาดจาก WebP ได้", () => {
  const info = readImageInfo(syntheticWebp(1024, 768));
  assert.ok(info);
  assert.equal(info.mime, "image/webp");
  assert.equal(info.width, 1024);
  assert.equal(info.height, 768);
});

test("image: ปฏิเสธไฟล์ที่ไม่ใช่ภาพ (แม้เบราว์เซอร์จะบอกว่าเป็นภาพ)", () => {
  const notImages = [
    new TextEncoder().encode("<html><script>alert(1)</script></html>"),
    new TextEncoder().encode("GIF89a"),
    new TextEncoder().encode("<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\"/>"),
    new TextEncoder().encode("%PDF-1.7"),
    new Uint8Array(0),
    bytes(0xff, 0xd8), // เริ่มเหมือน JPEG แต่ขาดข้อมูล
  ];

  for (const candidate of notImages) {
    const info = readImageInfo(candidate);
    /* ไฟล์ที่ขึ้นต้นด้วย FF D8 แต่ไม่มี SOF → อ่านขนาดไม่ได้ = ต้องไม่ผ่านเช่นกัน */
    assert.equal(info, null, `ต้องปฏิเสธ: ${new TextDecoder().decode(candidate.slice(0, 12))}`);
  }
});

test("image: ไฟล์เสียหาย/ตัดกลางทางไม่ทำให้โยน error", () => {
  const png = syntheticPng(800, 600);
  for (let cut = 0; cut < png.length; cut += 1) {
    const info = readImageInfo(png.slice(0, cut));
    if (info !== null && cut < 24) {
      assert.fail(`ไม่ควรอ่านขนาดได้จากไฟล์ที่ตัดสั้นกว่า 24 ไบต์ (ตัด ${cut})`);
    }
  }
});

test("image: เพดานขนาดไฟล์ 5MB และนามสกุลปลอดภัย", () => {
  assert.equal(MAX_UPLOAD_BYTES, 5 * 1024 * 1024);
  assert.equal(extensionFor("image/png"), "png");
  assert.equal(extensionFor("image/jpeg"), "jpg");
  assert.equal(extensionFor("image/webp"), "webp");
});

test("image: ล้างชื่อไฟล์ที่ผู้ใช้ส่งมา (กัน path traversal)", () => {
  assert.equal(safeFilename("../../etc/passwd", "image.png"), "..-..-etc-passwd");
  assert.equal(safeFilename("รูป ถ่าย.jpg", "image.png"), "รูป ถ่าย.jpg");
  assert.equal(safeFilename("   ", "image.png"), "image.png");
  assert.equal(safeFilename("", "image.png"), "image.png");
  assert.ok(safeFilename("ก".repeat(300), "x").length <= 120);
});

/* ── เลือกภาพจากคลังในหน้าแก้เนื้อหา (รอบที่ 93) ─────────────────────────────── */

test("media: ช่องภาพใช้คลังจาก context และหน้าตัวสร้างส่งเฉพาะผู้มีสิทธิ์ media", () => {
  const root = join(import.meta.dirname, "..");
  const drop = readFileSync(join(root, "features", "admin", "ui", "image-drop.tsx"), "utf8");
  const library = readFileSync(join(root, "features", "admin", "ui", "image-library.tsx"), "utf8");
  const page = codeOf("app/admin/builder/[page]/page.tsx");

  /* 1) ช่องภาพทุกช่องใช้คลังผ่าน context (ไม่ต้องแก้ทุกจุดเรียก — จุดเดียวคือในตัว ImageDrop) */
  assert.ok(drop.includes("useImageLibrary()"), "ImageDrop ต้องอ่านคลังจาก context");
  assert.ok(drop.includes("`/media/${item.id}`"), "การเลือกต้องตั้งพาธภายในโปรเจกต์ (มติ D9) ไม่ใช่ URL เต็ม");
  assert.ok(drop.includes("mediaPickFromLibrary"), "ต้องมีป้ายจากพจนานุกรม (ห้ามข้อความฝัง)");

  /* 2) ค่าเริ่มต้นของ context = ว่าง ⇒ ที่ไม่มีผู้ให้บริการ ช่องภาพยังทำงานได้เหมือนเดิม */
  assert.ok(library.includes("createContext<readonly ImageLibraryItem[]>([])"), "ค่าเริ่มต้นต้องว่าง");

  /* 3) หน้าตัวสร้างส่งรายการเฉพาะเมื่อมีสิทธิ์ `media` (ผู้ไม่มีสิทธิ์ไม่เห็นภาพในคลัง) */
  assert.ok(page.includes('can(user.role, "media")'), "ต้องเช็คสิทธิ์ media ก่อนส่งคลัง");
  assert.ok(page.includes("ImageLibraryProvider"), "ต้องมีผู้ให้บริการคลังครอบตัวสร้าง");
  assert.ok(page.includes("listMedia("), "ต้องอ่านรายการจากคลังจริง");
});

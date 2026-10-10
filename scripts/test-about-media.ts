import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { CERTIFICATIONS } from "@/features/about/certifications";
import { buildBlockTemplate, hasBlockTemplate, isImportedContentPage } from "@/lib/blocks/templates";
import { ABOUT_MEDIA, aboutImagePath, aboutMediaByKey, certificateMediaKey } from "@/lib/blocks/about-media";

/**
 * เทสต์รอบที่ 253 — "ย้ายเนื้อหาบริษัท (/about) เข้า DB + รูปเข้าคลังภาพ"
 *
 * มติเจ้าของ 2026-10-09: *"ย้ายข้อมูลบริษัทที่ hardcode เข้าไปเก็บในฐานข้อมูล … รวมถึงจุดที่อัปโหลดภาพด้วย"*
 *
 * เทสต์ชุดนี้กันถอยหลัง 4 กลุ่ม
 *   1. **ทะเบียนรูป** — ไฟล์จริงใน `public/` ต้องมี + `sha256` ที่เขียนไว้ต้องตรง (แก้ภาพแล้วต้องนำเข้าใหม่)
 *      และต้องครอบใบรับรองทุกใบใน `CERTIFICATIONS`
 *   2. **ตรรกะเลือกพาธ** — ยังไม่นำเข้า = ถอยไปใช้ `public/` · นำเข้าแล้ว = `/media/<id>` · คีย์ไม่รู้จัก = ไม่เดา
 *   3. **กับดักที่ถอดออก (รอบที่ 260)** — หน้า /about ต้องไม่มีปุ่ม "เริ่มจากเทมเพลต" อีก
 *      (เทมเพลตเก่าจากพจนานุกรมจะทับเนื้อหาที่นำเข้าจากหน้าต้นทาง — หนี้ D-255-1)
 *   4. **เครื่องมือ** — `npm run about:media` ยังอยู่ + อ่านไฟล์ในเครื่อง (ไม่ต่ออินเทอร์เน็ต)
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** ไฟล์ใน public/ ของพาธนั้น (พาธในทะเบียนขึ้นต้นด้วย `/` เสมอ) */
function publicFile(publicPath: string): string {
  return path.join(ROOT, "public", publicPath.replace(/^\//, ""));
}

function sha256OfFile(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/* ── 1) ทะเบียนรูป ───────────────────────────────────────────────────────── */

test("about-media: ไฟล์ใน public/ มีจริงทุกไฟล์ และ sha256 ตรงกับค่าที่เขียนไว้", () => {
  assert.ok(ABOUT_MEDIA.length > 0, "ทะเบียนต้องไม่ว่าง");

  for (const asset of ABOUT_MEDIA) {
    const file = publicFile(asset.publicPath);
    assert.ok(existsSync(file), `${asset.key}: ไม่พบไฟล์ ${asset.publicPath}`);

    assert.equal(
      sha256OfFile(file),
      asset.sha256,
      `${asset.key}: ไฟล์ ${asset.publicPath} ถูกแก้ ⇒ ต้องคำนวณ sha256 ใหม่ + นำเข้าใหม่ (npm run about:media)`,
    );
  }
});

test("about-media: คีย์/พาธไม่ซ้ำ และเก็บเป็นพาธในเว็บ (ไม่ใช่ URL เต็ม — มติ D9)", () => {
  const keys = ABOUT_MEDIA.map((asset) => asset.key);
  const paths = ABOUT_MEDIA.map((asset) => asset.publicPath);
  const hashes = ABOUT_MEDIA.map((asset) => asset.sha256);

  assert.equal(new Set(keys).size, keys.length, "คีย์ต้องไม่ซ้ำ");
  assert.equal(new Set(paths).size, paths.length, "พาธต้องไม่ซ้ำ");
  assert.equal(new Set(hashes).size, hashes.length, "สองไฟล์ต่างกันต้องมีลายนิ้วมือต่างกัน (ถ้าซ้ำ = นำเข้าเก็บไม่ครบ)");

  for (const asset of ABOUT_MEDIA) {
    assert.ok(asset.publicPath.startsWith("/"), `${asset.key}: ต้องเป็นพาธในเว็บ (ขึ้นต้นด้วย /)`);
    assert.equal(/^https?:/i.test(asset.publicPath), false, `${asset.key}: ห้ามเก็บ URL เต็ม`);
    assert.match(asset.sha256, /^[0-9a-f]{64}$/, `${asset.key}: sha256 ต้องเป็น hex 64 ตัว`);
  }
});

test("about-media: ครอบใบรับรองทุกใบใน CERTIFICATIONS (ไม่มีใบไหนตกหล่น)", () => {
  assert.equal(ABOUT_MEDIA.length, CERTIFICATIONS.length + 2, "ทะเบียน = ใบรับรองทุกใบ + ผังผู้บริหาร + แผนที่");

  for (const certification of CERTIFICATIONS) {
    const key = certificateMediaKey(certification.image.src);
    assert.notEqual(key, "", `${certification.id}: พาธ ${certification.image.src} ไม่มีในทะเบียนรูปหน้าบริษัท`);
    assert.ok(aboutMediaByKey(key) !== null, `${certification.id}: คีย์ ${key} ต้องมีในทะเบียน`);
  }
});

/* ── 2) ตรรกะเลือกพาธ ────────────────────────────────────────────────────── */

test("aboutImagePath: ยังไม่นำเข้า = ถอยไปใช้ไฟล์ใน public/ (หน้าเว็บไม่พัง)", () => {
  const asset = ABOUT_MEDIA[0];
  assert.ok(asset !== undefined);

  assert.equal(aboutImagePath(asset.key), asset.publicPath, "ไม่มีข้อมูลจากคลัง = ใช้พาธเดิม");
  assert.equal(aboutImagePath(asset.key, () => null), asset.publicPath, "คลังตอบ null = ใช้พาธเดิม");
  assert.equal(aboutImagePath("ไม่มีคีย์นี้"), "", "คีย์ที่ไม่รู้จักต้องคืนสตริงว่าง ไม่โยน error");
});

test("aboutImagePath: นำเข้าแล้ว = ใช้ /media/<id> จากคลังภาพ", () => {
  const asset = ABOUT_MEDIA[0];
  assert.ok(asset !== undefined);

  const library: ReadonlyMap<string, string> = new Map([[asset.sha256, "abc123"]]);
  const path0 = aboutImagePath(asset.key, (sha256) => {
    const id = library.get(sha256);
    return id === undefined ? null : `/media/${id}`;
  });
  assert.equal(path0, "/media/abc123");

  /* ลายนิ้วมือของภาพอื่นไม่ถูกใช้ ⇒ ยังถอยไปพาธเดิม (แยกตามไฟล์ ไม่เหมารวม) */
  const other = ABOUT_MEDIA[1];
  assert.ok(other !== undefined);
  assert.equal(aboutImagePath(other.key, () => "/media/abc123"), "/media/abc123", "คลังตอบ id เดียวกันได้ (dedupe ระดับผู้เรียก)");
});

test("certificateMediaKey: พาธที่ไม่รู้จัก = \"\" (ไม่เดา)", () => {
  assert.equal(certificateMediaKey("/certifications/ไม่มีไฟล์นี้.jpg"), "");
  assert.equal(certificateMediaKey(""), "");

  const known = CERTIFICATIONS[0];
  assert.ok(known !== undefined);
  assert.notEqual(certificateMediaKey(known.image.src), "");
});

/* ── 3) กับดักที่ถอดออก (รอบที่ 260 · หนี้ D-255-1) ───────────────────────────
   เทมเพลตหน้า /about ยุคแรก (20 บล็อกที่ประกอบจากพจนานุกรม) ถูกลบทั้งไฟล์
   เพราะกด "เริ่มจากเทมเพลต" แล้วจะ **ทับเนื้อหาที่นำเข้าจากหน้าต้นทางทั้งหน้า**
   ⇒ ผู้ใช้แก้/ตรวจไปแล้วหายหมด · เทสต์นี้กันไม่ให้กับดักกลับมา
*/

test("about: ต้องไม่มีเทมเพลตตั้งต้นแล้ว — กันกด \"เริ่มจากเทมเพลต\" ทับงานที่นำเข้า (D-255-1)", () => {
  assert.equal(isImportedContentPage("about"), true, "about ต้องถูกประกาศว่ามาจากตัวนำเข้า");
  assert.equal(hasBlockTemplate("about"), false, "ห้ามเสนอปุ่ม 'เริ่มจากเทมเพลต' ให้หน้า /about");
  assert.equal(buildBlockTemplate("about"), null, "เรียกสร้างเทมเพลต about ต้องได้ null (ไม่ใช่เอกสารทับของเดิม)");

  /* หน้าอื่นยังมีเทมเพลตตามเดิม — ต้องไม่เผลอปิดทั้งระบบ */
  assert.equal(hasBlockTemplate("home"), true);
  assert.equal(hasBlockTemplate("executives"), true);
  assert.equal(hasBlockTemplate("careers"), true);

  assert.equal(
    existsSync(path.join(ROOT, "lib/blocks", "about-template.ts")),
    false,
    "ไฟล์เทมเพลตเก่า (พจนานุกรม 20 บล็อก) ถูกลบแล้ว — ห้ามสร้างกลับมา",
  );
});

/* ── 4) เครื่องมือนำเข้า ──────────────────────────────────────────────────── */

test("about:media — มีสคริปต์ใน package.json + อ่านไฟล์ในเครื่อง (ไม่ต่ออินเทอร์เน็ต)", () => {
  const pkg = JSON.parse(sourceOf("package.json")) as { readonly scripts?: Record<string, string> };
  assert.ok(pkg.scripts?.["about:media"]?.includes("scripts/import-about-media.ts"), "ต้องมี npm run about:media");

  const source = sourceOf("scripts/import-about-media.ts");
  for (const flag of ["--dry-run", "--report"]) {
    assert.ok(source.includes(flag), `ต้องรองรับ ${flag}`);
  }
  assert.ok(source.includes("readFileSync"), "ต้องอ่านไฟล์จาก public/ ในเครื่อง");
  assert.ok(source.includes("findMediaIdsBySha256"), "ต้องเช็คว่าภาพไหนอยู่ในคลังแล้วได้ในคำสั่งเดียว");
  assert.equal(source.includes("fetch("), false, "ห้ามต่ออินเทอร์เน็ต (ไฟล์อยู่ในเครื่องนี้แล้ว)");
  assert.ok(source.includes("ensureImportedMedia"), "ต้องใช้ตัวช่วยกลาง (dedupe sha256 + ตรวจหัวไฟล์เป็นภาพจริง)");
});

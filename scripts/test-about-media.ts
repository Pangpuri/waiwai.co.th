import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { CERTIFICATIONS } from "@/features/about/certifications";
import { buildAboutTemplate } from "@/lib/blocks/about-template";
import { ABOUT_MEDIA, aboutImagePath, aboutMediaByKey, certificateMediaKey } from "@/lib/blocks/about-media";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { documentErrorsOf, documentWarningsOf, validateDocument } from "@/lib/blocks/validate";
import { PENDING_PAGE_PATHS } from "@/lib/pages/pending";

/**
 * เทสต์รอบที่ 253 — "ย้ายเนื้อหาบริษัท (/about) เข้า DB + รูปเข้าคลังภาพ"
 *
 * มติเจ้าของ 2026-10-09: *"ย้ายข้อมูลบริษัทที่ hardcode เข้าไปเก็บในฐานข้อมูล … รวมถึงจุดที่อัปโหลดภาพด้วย"*
 *
 * เทสต์ชุดนี้กันถอยหลัง 4 กลุ่ม
 *   1. **ทะเบียนรูป** — ไฟล์จริงใน `public/` ต้องมี + `sha256` ที่เขียนไว้ต้องตรง (แก้ภาพแล้วต้องนำเข้าใหม่)
 *      และต้องครอบใบรับรองทุกใบใน `CERTIFICATIONS`
 *   2. **ตรรกะเลือกพาธ** — ยังไม่นำเข้า = ถอยไปใช้ `public/` · นำเข้าแล้ว = `/media/<id>` · คีย์ไม่รู้จัก = ไม่เดา
 *   3. **เทมเพลต** — ผ่าน parser + ไม่มี error · ภาพชี้พาธที่ตรวจสอบได้ · ไม่มีลิงก์ไปหน้า "กำลังจัดทำ" ·
 *      ลิงก์ภายในเป็นพาธกลาง (ไม่ฝังภาษา) · ไม่มีลิงก์ที่มองไม่เห็น (`linkHref` ไม่มีข้อความบนปุ่ม)
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

/** รูปแบบข้อมูลของสื่อในเอกสารบล็อก (พอสำหรับเทสต์ — ไม่ต้องพึ่งชนิดของ union ทั้งชุด) */
type MediaLike = { readonly path: string; readonly altTh: string; readonly altEn: string };

/**
 * ไล่เก็บ "สื่อ" ทุกใบในเอกสารแบบไม่ผูกชนิดบล็อก
 * ⇒ เพิ่มชนิดบล็อกใหม่ที่มีภาพก็ยังถูกตรวจ ไม่ต้องแก้เทสต์
 * (ไม่ใช้ type assertion — ตรวจรูปร่างจากค่าจริง)
 */
function collectMedia(value: unknown, out: MediaLike[] = []): MediaLike[] {
  if (Array.isArray(value)) {
    for (const item of value) collectMedia(item, out);
    return out;
  }
  if (value === null || typeof value !== "object") return out;

  const record: Record<string, unknown> = { ...value };
  if (
    typeof record.path === "string" &&
    typeof record.altTh === "string" &&
    typeof record.altEn === "string" &&
    typeof record.hasWatermark === "boolean"
  ) {
    out.push({ path: record.path, altTh: record.altTh, altEn: record.altEn });
  }

  for (const nested of Object.values(record)) collectMedia(nested, out);

  return out;
}

/** ไล่เก็บลิงก์ของเอกสาร (การ์ด/ปุ่ม/แผนที่) */
function collectHrefs(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectHrefs(item, out);
    return out;
  }
  if (value === null || typeof value !== "object") return out;

  const record: Record<string, unknown> = { ...value };
  for (const key of ["href", "linkHref"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim() !== "") out.push(candidate);
  }

  for (const nested of Object.values(record)) collectHrefs(nested, out);

  return out;
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

/* ── 3) เทมเพลต ──────────────────────────────────────────────────────────── */

test("buildAboutTemplate: ผ่าน parser · ไม่มี error · 20 บล็อก (ครบทุกส่วนของหน้าจริง)", () => {
  const document = buildAboutTemplate();
  assert.equal(document.page, "about");
  assert.equal(document.blocks.length, 20, "จำนวนบล็อกต้องตรงกับส่วนต่าง ๆ ของหน้าบริษัทเดิม");

  const parsed = parseBlockDocument("about", document);
  assert.ok(parsed.ok, "เทมเพลตต้องผ่าน parser (ผู้เรียกใช้ผลนี้ก่อนเขียน DB)");
  if (!parsed.ok) return;

  const issues = validateDocument(parsed.document);
  assert.deepEqual(documentErrorsOf(issues), [], "เทมเพลตต้องไม่มี error");
});

test("buildAboutTemplate: ไม่มีลิงก์ที่มองไม่เห็น (linkHref ต้องมีข้อความบนปุ่มเสมอ)", () => {
  const parsed = parseBlockDocument("about", buildAboutTemplate());
  assert.ok(parsed.ok);
  if (!parsed.ok) return;

  const issues = validateDocument(parsed.document);
  const warnings = documentWarningsOf(issues).map((entry) => entry.code);
  assert.equal(
    warnings.includes("map-link-without-label"),
    false,
    "ห้ามใส่ลิงก์เปิดแผนที่โดยไม่มีข้อความบนปุ่ม — ลิงก์จะไม่แสดงบนหน้าเว็บ (กรอกล่วงหน้าไม่ได้)",
  );
});

test("buildAboutTemplate: ไม่มีลิงก์ไปหน้า \"กำลังจัดทำ\" และลิงก์ภายในเป็นพาธกลาง", () => {
  const document = buildAboutTemplate();
  const hrefs = collectHrefs(document, []);
  assert.ok(hrefs.length > 0, "เทมเพลตต้องมีลิงก์จริง (ปุ่มดูใบรับรอง/ลิงก์ต่อ)");

  const pending = new Set<string>(Object.values(PENDING_PAGE_PATHS));
  for (const href of hrefs) {
    assert.equal(pending.has(href), false, `ห้ามลิงก์ไปหน้า "กำลังจัดทำ": ${href}`);
    assert.equal(
      href.startsWith("/th/") || href.startsWith("/en/"),
      false,
      `${href}: ต้องเป็นพาธกลาง (ตัวเรนเดอร์เติมภาษาให้เอง — บทเรียนรอบที่ 101)`,
    );
    assert.ok(href.startsWith("/") || /^(https?:|mailto:|tel:|#)/.test(href), `${href}: ลิงก์ต้องมีรูปแบบที่รู้จัก`);
  }
});

test("buildAboutTemplate: ภาพทุกใบชี้พาธที่ตรวจสอบได้ (ไม่ตกหล่นเป็นพาธลอย)", () => {
  const publicPaths = new Set(ABOUT_MEDIA.map((asset) => asset.publicPath));

  /* (ก) ไม่ส่งตัวช่วย = ต้องเป็นพาธใน public/ ที่อยู่ในทะเบียนเท่านั้น */
  const fallback = collectMedia(buildAboutTemplate(), []);
  assert.ok(fallback.length > 0, "เทมเพลตต้องมีภาพจริง (แผนที่/ผังผู้บริหาร/ใบรับรอง)");
  for (const media of fallback) {
    assert.ok(
      publicPaths.has(media.path),
      `${media.path}: ภาพของเทมเพลตต้องอยู่ในทะเบียน ABOUT_MEDIA (ไม่งั้นนำเข้าคลังไม่ครบ)`,
    );
    assert.ok(media.altTh.trim() !== "" && media.altEn.trim() !== "", `${media.path}: ภาพต้องมี alt ทั้งสองภาษา`);
  }

  /* (ข) ส่งตัวช่วยจากคลัง = ทุกใบต้องกลายเป็น /media/<id> (พิสูจน์ว่าไม่ได้ลืมต่อสาย) */
  const resolved = collectMedia(buildAboutTemplate({ image: (key) => `/media/test-${key}` }), []);
  assert.equal(resolved.length, fallback.length, "จำนวนภาพต้องเท่าเดิม (เปลี่ยนแค่พาธ)");
  for (const media of resolved) {
    assert.ok(media.path.startsWith("/media/"), `${media.path}: ต้องมาจากคลังภาพเมื่อผู้เรียกส่งตัวช่วย`);
  }
});

test("buildAboutTemplate: ไทม์ไลน์ต้องพาปีไปด้วย (ไทย = พ.ศ. · อังกฤษ = ค.ศ.)", () => {
  const document = buildAboutTemplate();

  /* เก็บทุกคู่ข้อความ TH|EN ในเอกสาร */
  const texts: string[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value === null || typeof value !== "object") return;
    const record: Record<string, unknown> = { ...value };
    if (typeof record.th === "string" && typeof record.en === "string") texts.push(`${record.th}|${record.en}`);
    for (const nested of Object.values(record)) walk(nested);
  };
  walk(document);

  const foundedTh = texts.find((entry) => entry.includes("ก่อตั้งบริษัท"));
  assert.ok(foundedTh !== undefined, "ต้องมีการ์ดเหตุการณ์ 'ก่อตั้งบริษัท'");
  assert.match(
    foundedTh,
    /พ\.ศ\. 2515 · .+\|1972 · /,
    "การ์ดไทม์ไลน์ต้องมีปี (ไทย พ.ศ. 2515 · อังกฤษ 1972) — ห้ามเหลือแต่ชื่อเหตุการณ์",
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

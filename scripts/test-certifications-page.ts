import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { buildCertificationsTemplate } from "@/lib/blocks/certifications-template";
import { ABOUT_MEDIA, aboutImagePath, certificateMediaKey } from "@/lib/blocks/about-media";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { documentErrorsOf, documentWarningsOf, validateDocument } from "@/lib/blocks/validate";
import { CERTIFICATIONS } from "@/features/about/certifications";

/**
 * เทสต์รอบที่ 262 — หน้า **"ใบรับรองมาตรฐาน"** เหลือแต่ภาพจากฐานข้อมูล
 *
 * มติเจ้าของ 2026-10-10: *"เก็บภาพที่เป็นภาพใบรับรองทั้งหมดที่โชว์หน้าบ้านลง db แล้วเอาขึ้นมาโชว์แบบหน้าบ้าน
 * ตัด…คำอธิบาย…ออกไป · ขยายดูใบรับรอง → ออกไป เหลือเพียงแค่รูปของใบรับรองเปล่า ๆ
 * ส่วนบล็อคบน ที่เขียนว่า 'บริษัทได้รับการรับรอง…' เอาออกไปด้วยครับ เอาแต่ภาพเพียว ๆ
 * กดขยายดูได้พอแล้ว คำอธิบายภาพก็ไม่ต้องนะ เค้าโครงก็แบบเดียวกับหน้าบ้านครับ"*
 *
 * เทสต์ชุดนี้กันถอยหลัง 4 เรื่อง
 *   1. **เหลือแต่ภาพ** — ไม่มีหัวข้อ/ข้อความเปิดเรื่อง · ไม่มีคำบรรยายใต้ภาพ (มีเทสต์บังคับตรง ๆ)
 *   2. **ภาพมาจากคลัง DB** — ส่งตัวช่วยจากคลังแล้วทุกใบต้องเป็น `/media/<id>`
 *   3. **ไม่ครอปเอกสาร** — ต้องเป็นกรอบแนวตั้ง (A4) + `object-contain` · ห้าม `object-cover`
 *   4. **กดขยายดูได้** — ใช้ lightbox ของบล็อกแกลเลอรี (และยังมีอยู่จริง)
 */

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** เก็บค่า localized (th/en) ทุกตัวในเอกสาร เพื่อตรวจว่าไม่มีข้อความโผล่บนจอ */
function localizedValues(value: unknown, out: { th: string; en: string }[] = []): { th: string; en: string }[] {
  if (Array.isArray(value)) {
    for (const item of value) localizedValues(item, out);
    return out;
  }
  if (value === null || typeof value !== "object") return out;
  const record: Record<string, unknown> = { ...value };
  if (typeof record.th === "string" && typeof record.en === "string") out.push({ th: record.th, en: record.en });
  for (const nested of Object.values(record)) localizedValues(nested, out);
  return out;
}

/* ── 1) เหลือแต่ภาพ ─────────────────────────────────────────────────────── */

test("certifications: เทมเพลตเหลือบล็อกเดียว = แกลเลอรี (ไม่มี hero/หัวข้อ/คำบรรยาย)", () => {
  const document = buildCertificationsTemplate();

  assert.equal(document.page, "certifications");
  assert.deepEqual(
    document.blocks.map((block) => block.type),
    ["gallery"],
    "ต้องเหลือบล็อกแกลเลอรีเดียว — บล็อกบน (hero + ข้อความเปิดเรื่อง) ถูกถอดตามคำสั่งเจ้าของ",
  );

  const gallery = document.blocks[0];
  assert.ok(gallery !== undefined && gallery.type === "gallery");
  if (gallery === undefined || gallery.type !== "gallery") return;

  /* หัวข้อว่าง (ไม่มีข้อความบนจอ) + ทุกใบไม่มีคำบรรยาย */
  assert.equal(gallery.heading.th.trim(), "");
  assert.equal(gallery.heading.en.trim(), "");
  for (const item of gallery.items) {
    assert.equal(item.caption.th.trim(), "", `คำบรรยายต้องว่าง (${item.id})`);
    assert.equal(item.caption.en.trim(), "", `คำบรรยายต้องว่าง (${item.id})`);
  }

  /* กันถอยหลัง: ทั้งเอกสารต้องไม่มี "ข้อความที่ผู้ใช้อ่าน" เหลืออยู่เลยนอกจาก alt */
  const onScreenTexts = localizedValues(document).filter((entry) => entry.th.trim() !== "" || entry.en.trim() !== "");
  assert.deepEqual(onScreenTexts, [], `เอกสารต้องไม่มีข้อความบนจอเลย (เหลือแต่ภาพ) — พบ ${onScreenTexts.length} คู่`);
});

test("certifications: เอกสารต้องผ่าน parser + validator 0 error (พร้อมเผยแพร่ได้)", () => {
  const parsed = parseBlockDocument("certifications", buildCertificationsTemplate());
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.problems.join(" · "));
  if (!parsed.ok) return;

  const issues = validateDocument(parsed.document);
  assert.deepEqual(documentErrorsOf(issues), [], "ต้องไม่มี error");
  assert.deepEqual(documentWarningsOf(issues), [], "ต้องไม่มีคำเตือนค้าง (หัวข้อว่างไม่นับเป็นคำเตือน)");
});

/* ── 2) ภาพมาจากคลัง DB ──────────────────────────────────────────────────── */

test("certifications: ภาพทุกใบมาจากทะเบียนคลังภาพ และส่งตัวช่วยแล้วกลายเป็น /media/<id>", () => {
  assert.equal(CERTIFICATIONS.length, 11, "ใบรับรองจริงมี 11 ใบ");

  /* (ก) ไม่ส่งตัวช่วย = พาธใน public/ ที่อยู่ในทะเบียน (ตรวจได้ว่ามีไฟล์จริง — มีเทสต์ทะเบียนคุมอยู่แล้ว) */
  const fallback = buildCertificationsTemplate();
  const publicPaths = new Set(ABOUT_MEDIA.map((asset) => asset.publicPath));
  const galleryFallback = fallback.blocks[0];
  assert.ok(galleryFallback !== undefined && galleryFallback.type === "gallery");
  if (galleryFallback === undefined || galleryFallback.type !== "gallery") return;
  assert.equal(galleryFallback.items.length, CERTIFICATIONS.length, "ต้องมีภาพครบทุกใบ (ไม่ตกหล่น)");
  for (const item of galleryFallback.items) {
    const imagePath = item.image?.path ?? "";
    assert.ok(publicPaths.has(imagePath), `${imagePath}: ต้องเป็นพาธที่อยู่ในทะเบียน ABOUT_MEDIA`);
  }

  /* (ข) ส่งตัวช่วยจากคลัง = ทุกใบต้องเป็น /media/<id> (พิสูจน์ว่าไม่ได้ลืมต่อสาย) */
  const resolved = buildCertificationsTemplate({ image: (key) => `/media/test-${key}` });
  const galleryResolved = resolved.blocks[0];
  assert.ok(galleryResolved !== undefined && galleryResolved.type === "gallery");
  if (galleryResolved === undefined || galleryResolved.type !== "gallery") return;
  for (const item of galleryResolved.items) {
    assert.ok((item.image?.path ?? "").startsWith("/media/"), `${item.id}: ต้องมาจากคลังภาพเมื่อผู้เรียกส่งตัวช่วย`);
  }

  /* คีย์ของแต่ละใบต้องมีจริงในทะเบียน (กันพิมพ์คีย์ผิดแล้วเงียบ) */
  for (const certificate of CERTIFICATIONS) {
    /* ⚠️ `certificateMediaKey()` รับพาธภาพ — ไม่ใช่ id (เทสต์นี้เคยจับบั๊กนี้ได้ตอนรอบ 262) */
    const key = certificateMediaKey(certificate.image.src);
    assert.ok(
      ABOUT_MEDIA.some((asset) => asset.key === key),
      `${key}: ไม่มีในทะเบียน ⇒ ภาพใบนี้จะไม่ถูกนำเข้าคลัง`,
    );
    assert.equal(aboutImagePath(key), certificate.image.src, `${key}: พาธถอยหลังต้องตรงกับไฟล์เดิม`);
  }
});

test("certifications: alt ต้องบอกชื่อมาตรฐาน + ขอบเขตโรงงาน (ไม่ซ้ำกันทั้ง 11 ใบ)", () => {
  const document = buildCertificationsTemplate();
  const gallery = document.blocks[0];
  assert.ok(gallery !== undefined && gallery.type === "gallery");
  if (gallery === undefined || gallery.type !== "gallery") return;

  const alts = gallery.items.map((item) => item.image?.altTh ?? "");
  for (const alt of alts) {
    assert.ok(alt.trim() !== "", "alt ต้องไม่ว่าง (มติ D7 + a11y)");
    assert.ok(alt.includes(" · "), `${alt}: ต้องมีชื่อมาตรฐาน + ขอบเขตโรงงาน`);
  }
  assert.equal(new Set(alts).size, alts.length, "alt ต้องไม่ซ้ำกัน (มาตรฐานเดียวกันคนละโรงงานต้องแยกออก)");
});

/* ── 3) ไม่ครอปเอกสาร ────────────────────────────────────────────────────── */

test("certifications: ช่องภาพต้องเป็นแนวตั้ง (A4) — ห้ามใช้ object-cover กับใบรับรอง", () => {
  const document = buildCertificationsTemplate();
  const gallery = document.blocks[0];
  assert.ok(gallery !== undefined && gallery.type === "gallery");
  if (gallery === undefined || gallery.type !== "gallery") return;
  assert.equal(gallery.imageShape, "portrait", "ใบรับรองเป็น A4 ตั้ง ⇒ ต้องใช้กรอบแนวตั้ง");
  assert.equal(gallery.columns, 3, "โครงเดียวกับหน้าบ้าน = 3 คอลัมน์");

  /* ตัวเรนเดอร์จริง: โหมด portrait ต้อง contain (ไม่ครอป) และห้าม cover */
  const lightbox = sourceOf("features/blocks/ui/gallery-lightbox.tsx");
  const start = lightbox.indexOf("const CELL_CLASS");
  assert.ok(start > 0, "ต้องพบตารางคลาสของช่องภาพ");
  const table = lightbox.slice(start, lightbox.indexOf("};", start));
  assert.ok(table.includes("portrait:"), "ต้องมีโหมด portrait");
  const portraitLine = table.slice(table.indexOf("portrait:"));
  assert.ok(portraitLine.includes("object-contain"), "โหมด portrait ต้อง contain (ไม่ตัดขอบเอกสาร)");
  assert.ok(!portraitLine.includes("object-cover"), "โหมด portrait ห้าม cover เด็ดขาด (ข้อมูลบนเอกสารจะหาย)");
  assert.ok(portraitLine.includes("aspect-[1/1.414]"), "กรอบต้องเป็น A4 (1:1.414) ให้เต็มใบพอดี");
});

/* ── 4) กดขยายดูได้ ──────────────────────────────────────────────────────── */

test("certifications: ยังกดขยายดูได้ (lightbox ของบล็อกแกลเลอรี) — ไม่มีป้ายข้อความบนจอ", () => {
  const renderer = sourceOf("features/blocks/block-renderer.tsx");
  assert.ok(
    renderer.includes("<GalleryLightbox items={visible} columns={block.columns} shape={block.imageShape}"),
    "ตัวเรนเดอร์ต้องส่งสัดส่วนช่องภาพเข้า lightbox",
  );

  /* ป้าย "ขยายดู" มีเฉพาะใน aria-label ของ lightbox ⇒ ไม่มีข้อความบนจอ (ตามคำสั่งเจ้าของ) */
  const lightbox = sourceOf("features/blocks/ui/gallery-lightbox.tsx");
  assert.ok(lightbox.includes("aria-label={`${strings.open}"), "ต้องมีป้ายสำหรับโปรแกรมอ่านหน้าจอ");

  /* หน้าที่เหลือแต่ภาพต้องยังมี h1 (sr-only) — ส่ง heading ให้ตัวเรนเดอร์ */
  const page = sourceOf("app/[lang]/about/certifications/page.tsx");
  assert.ok(
    page.includes('heading={messages.about.certifications.meta.title}'),
    "ต้องส่ง heading ⇒ ตัวเรนเดอร์ใส่ <h1 class=\"sr-only\"> ให้ (a11y)",
  );
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { ABOUT_TEXT_FIXES, applyAboutTextFixes } from "@/lib/about/corrections";
import { ABOUT_IMAGE_FIT, aboutSourceImageUrls, buildAboutDocument } from "@/lib/about/document";
import { parseAboutPage } from "@/lib/about/import-parse";
import { ABOUT_SOURCE_ASSETS } from "@/lib/about/source-assets";
import { parseBlockDocument } from "@/lib/blocks/parse";
import type { BlockWidth } from "@/lib/blocks/types";
import { documentErrorsOf, validateDocument } from "@/lib/blocks/validate";

/**
 * เทสต์ตัวนำเข้า **หน้า "บริษัท" (/about) จากหน้าต้นทาง** — รอบที่ 255 · หนี้ D-253-1
 *
 * มติเจ้าของ 2026-10-09: ยึดของจริงจากหน้าต้นทาง · **คงตัวเลขที่ขัดกันเองไว้ทั้งคู่** · แก้เฉพาะคำพิมพ์ผิด
 * ⇒ เทสต์นี้ล็อก 3 เรื่องที่พังเงียบได้ง่าย
 *   1. "แก้คำผิด" ต้องไม่ลามไปแก้เนื้อหา/ตัวเลขของต้นทาง
 *   2. การแบ่งส่วน/กลุ่มภาพต้องตรงกับลำดับเอกสารจริง (หัวข้ออยู่ใน `<p><strong>` — ไม่มี `<h*>`)
 *   3. เอกสารที่ประกอบได้ต้อง **ผ่าน parser กลาง** และภาพต้องเป็นพาธ `/media/<id>` เท่านั้น
 */

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

/* ── 1) ตารางแก้คำผิด (มติเจ้าของ) ─────────────────────────────────────────── */

test("about import: แก้คำผิดตามตารางที่เจ้าของยืนยัน (3 คำแรก) + คำผิดซ้ำที่เจอเพิ่ม", () => {
  const authorized = ABOUT_TEXT_FIXES.slice(0, 3).map((fix) => fix.from);
  assert.deepEqual(authorized, ["เพขรเกษม", "เป็๋น", "บุคคลากร"], "3 คำแรกต้องเป็นคำที่เจ้าของยืนยันในมติ");

  assert.equal(applyAboutTextFixes("ถนนเพขรเกษม ตำบลอ้อมใหญ่"), "ถนนเพชรเกษม ตำบลอ้อมใหญ่");
  assert.equal(applyAboutTextFixes("จัดทำเป็๋นหอพักพนักงาน"), "จัดทำเป็นหอพักพนักงาน");
  assert.equal(applyAboutTextFixes("การพัฒนาบุคคลากร"), "การพัฒนาบุคลากร");
  /* แทนที่ทุกจุดที่พบ ไม่ใช่แค่จุดแรก */
  assert.equal(applyAboutTextFixes("บุคคลากร + บุคคลากร"), "บุคลากร + บุคลากร");
});

test("about import: ตัวเลขที่ต้นทางขัดกันเองต้องคงไว้ทั้งคู่ (ห้ามเลือกข้าง)", () => {
  const source =
    "อีก 24 ไร่ เป็นพื้นที่ที่ใช้ในการกำจัดน้ำเสีย และที่เหลืออีก 57 ไร่ เป็นอาคารสำนักงานและโรงงาน " +
    "ซึ่งทางบริษัทฯ จัดให้มีบ่อบำบัด ที่ใช้พื้นที่ถึง 25% ของพื้นที่ทั้งหมด";
  const fixed = applyAboutTextFixes(source);

  assert.ok(fixed.includes("24 ไร่"), "ต้องคง \"24 ไร่\" ตามต้นทาง");
  assert.ok(fixed.includes("25% ของพื้นที่ทั้งหมด"), "ต้องคง \"25%\" ตามต้นทาง");
  assert.ok(fixed.includes("57 ไร่"), "ตัวเลขอื่นต้องไม่ถูกแตะ");
  assert.equal(fixed, source, "ข้อความนี้ไม่มีคำผิด ⇒ ต้องไม่เปลี่ยนแม้แต่ตัวอักษรเดียว");
});

/* ── 2) ตัวแกะหน้า (fixture ที่เลียนโครงจริง) ──────────────────────────────── */

/**
 * โครง fixture = โครงจริงของหน้าต้นทาง (ตรวจจาก HTML 61 KB · 2026-10-10)
 * - หน้าใช้ `<table>` ครอบทุกอย่าง · ไม่มี `<h*>` ⇒ หัวข้ออยู่ใน `<p><strong>` ที่สั้น
 * - ภาพใบแรก = แบนเนอร์ · ที่เหลือมาเป็นกลุ่มติดกัน
 * - มี `modal-content` ต่อท้าย (ต้องไม่ถูกดูดเข้ามา)
 */
const FIXTURE = `<!doctype html>
<html><head><title>ไวไว - บริษัท</title></head>
<body>
  <div class="page-header">
    <div class="title">บริษัท</div>
  </div>
  <div class="item-content">
    <table><tbody>
      <tr><td><p><img src="https://cdn.example/banner.gif" width="800" /></p></td></tr>
      <tr><td><p><strong></strong></p></td></tr>
      <tr><td><p><strong>บริษัท โรงงานทดสอบ จำกัด ก่อตั้งขึ้นเมื่อปี พ.ศ.2515 ในเขตพื้นที่ตั้ง 42/1 หมู่ 2 ถนนเพขรเกษม ตำบลอ้อมใหญ่ จังหวัดนครปฐม และมีเนื้อที่โดยรวมประมาณ 99 ไร่</strong></p></td></tr>
      <tr><td>
        <p><strong>วิสัยทัศน์ (Vision Statement)</strong></p>
        <p>บริษัทเป็นผู้ผลิตและจัดจำหน่ายผลิตภัณฑ์อาหารชั้นนำ และตระหนักถึงความสำคัญของการพัฒนาบุคคลากร</p>
      </td></tr>
      <tr><td>
        <p><strong>พันธกิจ (Mission Statement)</strong></p>
        <p>เพื่อให้บริษัทบรรลุผลตามวิสัยทัศน์ ร่วมกันปฏิบัติดังต่อไปนี้</p>
        <p>1. ดำเนินการผลิตและจัดจำหน่ายอาหารที่มีคุณภาพ</p>
        <p>2. เจาะตลาดโดยเข้าถึงความต้องการของลูกค้า</p>
      </td></tr>
      <tr><td>
        <img src="https://cdn.example/photo-1_full.jpg" width="200" />
        <img src="https://cdn.example/photo-2_full.jpg" width="200" />
      </td></tr>
      <tr><td>
        <p><strong>การวิจัยและพัฒนาผลิตภัณฑ์</strong></p>
        <p>บริษัทฯ ให้ความสำคัญต่อการวิจัยและพัฒนาผลิตภัณฑ์อย่างต่อเนื่อง จัดทำเป็๋นระบบ</p>
      </td></tr>
    </tbody></table>
  </div>
  <div class="modal-content">
    <img src="https://cdn.example/should-not-be-imported.jpg" />
    <p>ข้อความใน modal ที่ต้องไม่ถูกนำเข้า</p>
  </div>
</body></html>`;

test("about import: แกะชื่อหน้า + แบนเนอร์ + ลำดับส่วน/กลุ่มภาพ ตามเอกสารจริง", () => {
  const source = parseAboutPage(FIXTURE);

  assert.equal(source.pageTitle, "บริษัท", "ชื่อหน้าจาก page-header → div.title");
  assert.equal(source.bannerUrl, "https://cdn.example/banner.gif", "ภาพใบแรก = แบนเนอร์");
  assert.deepEqual(
    source.nodes.map((node) => node.kind),
    ["section", "section", "section", "images", "section"],
    "ลำดับ: เปิดเรื่อง → วิสัยทัศน์ → พันธกิจ → กลุ่มภาพ → วิจัย",
  );

  const [intro, vision, mission, images, rnd] = source.nodes;
  assert.equal(intro?.kind === "section" ? intro.heading : "?", "", "ส่วนเปิดเรื่องไม่มีหัวข้อ");
  assert.equal(vision?.kind === "section" ? vision.heading : "?", "วิสัยทัศน์ (Vision Statement)");
  assert.equal(mission?.kind === "section" ? mission.paragraphs.length : 0, 3, "พันธกิจ = คำนำ + 2 ข้อ");
  assert.deepEqual(
    images?.kind === "images" ? [...images.urls] : [],
    ["https://cdn.example/photo-1_full.jpg", "https://cdn.example/photo-2_full.jpg"],
    "กลุ่มภาพต้องเรียงตามต้นทาง",
  );
  assert.equal(rnd?.kind === "section" ? rnd.heading : "?", "การวิจัยและพัฒนาผลิตภัณฑ์");
});

test("about import: ย่อหน้า <strong> ที่ยาว = เนื้อความ (ไม่ใช่หัวข้อ) · คำผิดถูกแก้แล้ว", () => {
  const source = parseAboutPage(FIXTURE);
  const intro = source.nodes[0];
  assert.ok(intro?.kind === "section");
  assert.equal(intro.heading, "", "ย่อหน้ายาวที่ตัวหนาทั้งย่อหน้า ต้องไม่ถูกตีความเป็นหัวข้อ");
  assert.ok(!intro.paragraphs[0]?.includes("เพขรเกษม"), "คำผิดต้องถูกแก้ตั้งแต่ชั้นแกะ");
  assert.ok(intro.paragraphs[0]?.includes("เพชรเกษม"));

  const vision = source.nodes[1];
  assert.ok(vision?.kind === "section");
  assert.ok(vision.paragraphs[0]?.includes("บุคลากร") && !vision.paragraphs[0]?.includes("บุคคลากร"));
});

test("about import: ต้องไม่ดูดเนื้อหา/ภาพที่อยู่นอกบล็อกเนื้อหา (modal)", () => {
  const source = parseAboutPage(FIXTURE);
  const urls = aboutSourceImageUrls(source);
  assert.ok(!urls.some((url) => url.includes("should-not-be-imported")), "ภาพใน modal ต้องไม่ถูกนำเข้า");
  const allText = source.nodes
    .filter((node) => node.kind === "section")
    .flatMap((node) => (node.kind === "section" ? [...node.paragraphs] : []))
    .join(" ");
  assert.ok(!allText.includes("modal"), "ข้อความใน modal ต้องไม่ถูกนำเข้า");
});

test("about import: HTML ที่ใช้ไม่ได้ = โครงว่าง (ไม่โยน error)", () => {
  for (const input of ["", "<html></html>", "<div class='item-content'></div>"]) {
    const source = parseAboutPage(input);
    assert.deepEqual(source.nodes, []);
    assert.equal(source.bannerUrl, null);
    assert.equal(source.pageTitle, "");
  }
});

/* ── 3) ตัวประกอบเอกสาร ───────────────────────────────────────────────────── */

test("about import: ประกอบเอกสาร — hero + richText ต่อส่วน + gallery ต่อกลุ่มภาพ", () => {
  const source = parseAboutPage(FIXTURE);
  const urls = aboutSourceImageUrls(source);
  assert.equal(urls.length, 3, "แบนเนอร์ + 2 ภาพ");

  const resolve = (url: string): string | null => `/media/${createHash("sha1").update(url).digest("hex").slice(0, 12)}`;
  const document = buildAboutDocument(source, resolve);

  assert.equal(document.page, "about");
  const types = document.blocks.map((block) => block.type);
  assert.deepEqual(types, ["hero", "richText", "richText", "richText", "gallery", "richText"]);

  const [hero, , , , gallery] = document.blocks;
  assert.ok(hero?.type === "hero");
  /* มติเจ้าของ 2026-10-10: แบนเนอร์เป็น **ภาพล้วน** — ห้ามใส่ "บริษัท" ซ้ำกับบล็อกถัดไป */
  assert.equal(hero.title.th, "", "แบนเนอร์ต้องไม่มีหัวข้อ (ชื่อเต็มของบริษัทอยู่บล็อกถัดไป)");
  assert.ok(hero.image !== null && hero.image.path.startsWith("/media/"), "แบนเนอร์ต้องเป็นพาธคลังภาพ");
  assert.ok(gallery?.type === "gallery");
  assert.equal(gallery.items.length, 2);
  assert.equal(gallery.columns, 3);
  for (const item of gallery.items) {
    assert.ok(item.image !== null && item.image.path.startsWith("/media/"));
    assert.ok((item.image?.altTh ?? "").length > 0, "ภาพต้องมีคำบรรยาย (a11y)");
  }

  /* เอกสารที่ได้ต้องผ่าน parser กลาง (รหัสบล็อกไม่ซ้ำ · รูปทรงถูกต้อง) */
  const parsed = parseBlockDocument("about", document);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.problems.join(" · "));
});

test("about import: ยังไม่นำเข้ารูป = ไม่ขึ้นกล่องว่างเปล่า (ทั้งแบนเนอร์และแกลเลอรี) แต่ข้อความครบ", () => {
  const source = parseAboutPage(FIXTURE);
  const document = buildAboutDocument(source, () => null);
  const types = document.blocks.map((block) => block.type);
  assert.ok(!types.includes("gallery"), "ไม่มีภาพที่ใช้ได้ ⇒ ต้องไม่ใส่บล็อกแกลเลอรี");
  assert.ok(!types.includes("hero"), "แบนเนอร์เป็นภาพล้วน ⇒ ไม่มีภาพ = ไม่ต้องมีบล็อกที่ว่างเปล่า");
  assert.equal(types.filter((type) => type === "richText").length, 4, "ข้อความทุกส่วนยังอยู่ครบ");
  assert.ok(parseBlockDocument("about", document).ok);
  assert.equal(documentErrorsOf(validateDocument(document)).length, 0, "เอกสารต้องผ่าน validator แม้ไม่มีภาพเลย");
});

test("about import: กล่องภาพต้องไม่ขยายภาพต้นทาง (มติเจ้าของ 2026-10-10 — \"ลดขนาดภาพให้เหมาะสม\")", () => {
  /*
    ความกว้างจริงของพรีเซ็ต (= `lib/blocks/style.ts` → `WIDTH`) และ `containerClass` ใส่ `px-4` เสมอ (32px)
    ⚠️ ตัวเลขนี้คือ "สัญญา" ระหว่างค่าดีฟอลต์ของเทมเพลตกับขนาดไฟล์จริงของภาพต้นทาง
  */
  const CONTAINER_PX: Record<BlockWidth, number> = { narrow: 672, normal: 896, wide: 1152, full: 1280 };
  const PAGE_PADDING = 32; /* px-4 ซ้าย+ขวา */
  const GRID_GAP = 16; /* gap-4 */

  const source = parseAboutPage(FIXTURE);
  const document = buildAboutDocument(source, (url) => `/media/id-${url.slice(-8)}`);

  /* ── แบนเนอร์ (ไฟล์ 800px) — ขยายได้ไม่เกิน 10% ── */
  const hero = document.blocks[0];
  assert.ok(hero?.type === "hero");
  const heroBox = CONTAINER_PX[hero.style.width] - PAGE_PADDING;
  const bannerScale = heroBox / ABOUT_IMAGE_FIT.sourceBannerWidth;
  assert.ok(
    bannerScale <= 1.1,
    `แบนเนอร์แสดง ${String(heroBox)}px จากไฟล์ ${String(ABOUT_IMAGE_FIT.sourceBannerWidth)}px = ขยาย ${bannerScale.toFixed(2)}× ⇒ จะเบลอ`,
  );

  /* ── การ์ดภาพ (ไฟล์ 244px) — ต้องแสดงไม่เกินขนาดไฟล์จริง ── */
  const gallery = document.blocks.find((block) => block.type === "gallery");
  assert.ok(gallery?.type === "gallery");
  assert.equal(gallery.columns, ABOUT_IMAGE_FIT.galleryColumns, "3 คอลัมน์ = ตรงกับที่ต้นทางวาง (แถวละ 3 ใบ)");
  const gridInner = CONTAINER_PX[gallery.style.width] - PAGE_PADDING;
  const cell = (gridInner - GRID_GAP * (gallery.columns - 1)) / gallery.columns;
  assert.ok(
    cell <= ABOUT_IMAGE_FIT.sourcePhotoWidth,
    `การ์ดแสดง ${String(Math.round(cell))}px จากไฟล์ ${String(ABOUT_IMAGE_FIT.sourcePhotoWidth)}px ⇒ ภาพจะถูกขยาย`,
  );

  /* ── กันถอยหลัง: ค่าเดิม (`wide`) ขยายภาพจริง ⇒ เทสต์ต้องจับได้ถ้ามีคนเปลี่ยนกลับ ── */
  const previousCell = (CONTAINER_PX.wide - PAGE_PADDING - GRID_GAP * (gallery.columns - 1)) / gallery.columns;
  assert.ok(
    previousCell > ABOUT_IMAGE_FIT.sourcePhotoWidth,
    "ต้องยืนยันได้ว่าค่าเดิม (wide) ขยายภาพจริง — ไม่งั้นเทสต์นี้ไม่ได้ป้องกันอะไร",
  );
});

test("about import: 🔴 เอกสารต้องผ่าน validator จริง 0 error (บทเรียนบั๊ก 'กดเผยแพร่แล้วเว็บไม่เปลี่ยน')", () => {
  /*
    บั๊กจริง 2026-10-10: รอบ 255 รันแค่ `parseBlockDocument` ตอนนำเข้า ⇒ พลาด `empty-th` ที่
    `blocks[1].heading.th` ⇒ `prepare()` ปฏิเสธก่อนเขียน DB ⇒ เจ้าของกด "เผยแพร่" แล้วเงียบ
    ⇒ เทสต์นี้บังคับให้เอกสารที่ตัวนำเข้าสร้าง **ผ่านด่านเดียวกับที่ปุ่มเผยแพร่ใช้**
  */
  const source = parseAboutPage(FIXTURE);
  const document = buildAboutDocument(source, (url) => `/media/id-${url.slice(-8)}`);
  const errors = documentErrorsOf(validateDocument(document));
  assert.deepEqual(
    errors.map((entry) => `${entry.path} ${entry.code}`),
    [],
    "เอกสารต้องไม่มี error — ไม่งั้นกดเผยแพร่จะไม่ผ่านและหน้าบ้านไม่เปลี่ยน",
  );
});

test("about import: ส่วนที่ต้นทางไม่มีหัวข้อ ต้องเติมหัวข้อจากคำของต้นทางเอง (ห้ามว่าง ห้ามแต่งใหม่)", () => {
  const source = parseAboutPage(FIXTURE);
  const document = buildAboutDocument(source, () => null);
  const intro = document.blocks.find((block) => block.type === "richText");
  assert.ok(intro?.type === "richText");
  assert.equal(intro.heading.th, "บริษัท โรงงานทดสอบ จำกัด", "ตัดที่ป้าย 'ก่อตั้งขึ้น' = ชื่อบริษัทตามต้นทาง");
  assert.ok(!intro.heading.th.includes("ก่อตั้งขึ้น"), "หัวข้อต้องไม่ดูดทั้งประโยคมายาว");

  /* ไม่มีป้ายในประโยคเลย ⇒ ถอยไปใช้ชื่อหน้าจาก page-header (ไม่ปล่อยว่าง) */
  const fallback = buildAboutDocument(
    { pageTitle: "บริษัท", bannerUrl: null, nodes: [{ kind: "section", heading: "", paragraphs: ["ข้อความล้วนไม่มีป้าย"] }] },
    () => null,
  );
  const fallbackIntro = fallback.blocks.find((block) => block.type === "richText");
  assert.ok(fallbackIntro?.type === "richText");
  assert.equal(fallbackIntro.heading.th, "บริษัท");
  assert.equal(documentErrorsOf(validateDocument(fallback)).length, 0);
});

test("about import: ภาพทุกใบต้องไม่มี URL เต็มหลุดเข้าเอกสาร (มติ D9)", () => {
  const source = parseAboutPage(FIXTURE);
  const document = buildAboutDocument(source, (url) => `/media/id-${url.slice(-10)}`);
  const serialized = JSON.stringify(document);
  assert.ok(!serialized.includes("http://") && !serialized.includes("https://"), "ห้ามเก็บ URL เต็มในเอกสาร");
  assert.ok(!serialized.includes("cdn.example"), "ต้องไม่มีที่อยู่ต้นทางหลุดเข้าเอกสาร");
});

/* ── 4) ไฟล์ต้นทางที่เตรียมไว้ล่วงหน้า ─────────────────────────────────────── */

test("about import: แบนเนอร์ที่แปลงไว้ล่วงหน้ามีจริงและตรงกับ sha256 ในทะเบียน", () => {
  assert.ok(ABOUT_SOURCE_ASSETS.length > 0, "ต้องมีไฟล์ที่เตรียมไว้อย่างน้อย 1 ไฟล์ (แบนเนอร์)");

  for (const asset of ABOUT_SOURCE_ASSETS) {
    assert.ok(asset.sourceUrl.startsWith("https://"), `${asset.key}: sourceUrl ต้องเป็น URL ต้นทาง`);
    assert.ok(asset.publicPath.startsWith("/"), `${asset.key}: publicPath ต้องเป็นพาธ`);
    assert.match(asset.sha256, /^[0-9a-f]{64}$/, `${asset.key}: sha256 ต้องเป็น hex 64 ตัว`);
    assert.ok(asset.reason.trim().length > 0, `${asset.key}: ต้องมีเหตุผลว่าทำไมต้องเตรียมล่วงหน้า`);

    const file = path.join(PROJECT_ROOT, "public", asset.publicPath.replace(/^\//, ""));
    assert.ok(existsSync(file), `${asset.key}: ไม่พบไฟล์ ${file}`);
    const bytes = readFileSync(file);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      asset.sha256,
      `${asset.key}: ไฟล์ถูกแก้ — ต้องแปลง/อัปเดต sha256 ในทะเบียน`,
    );
    /* ต้องเป็น PNG จริง (คลังภาพรับ PNG/JPEG/WebP เท่านั้น) */
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${asset.key}: ต้องเป็นไฟล์ PNG`);
  }
});

test("about import: สคริปต์ใช้ท่อนำเข้ากลาง + guard ห้ามทับงานคน", () => {
  const script = readFileSync(path.join(PROJECT_ROOT, "scripts", "import-about.ts"), "utf8");
  assert.ok(script.includes("ensureImportedMedia("), "ต้องใช้ท่อนำเข้ากลาง (ตรวจหัวไฟล์ + dedupe sha256)");
  assert.ok(script.includes("saveDraft("), "บันทึกเป็น 'ฉบับร่าง' ของหน้า about");
  assert.ok(script.includes("parseBlockDocument("), "ต้องตรวจเอกสารด้วย parser กลางก่อนเขียน");
  assert.ok(
    script.includes("validateDocument(") && script.includes("documentErrorsOf("),
    "ต้องตรวจด้วย validator จริงด้วย (บั๊ก 2026-10-10: รันแต่ parser ⇒ กดเผยแพร่ไม่ผ่าน)",
  );
  assert.ok(script.includes("--force"), "ต้องมีทางเลือก --force สำหรับทับงานคน");
  assert.ok(script.includes("updatedBy !== ACTOR"), "ค่าเริ่มต้นต้องไม่ทับงานที่คนแก้");
  assert.ok(!script.includes("dangerouslySetInnerHTML"), "ห้ามตีความ HTML ต้นทางเป็น markup ตรง ๆ");
});

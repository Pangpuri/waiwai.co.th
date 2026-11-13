import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ABOUT_ENGLISH_ROLES,
  ABOUT_ENGLISH_SECTIONS,
  ABOUT_ENGLISH_SOURCE_CHECKED_AT,
  ABOUT_ENGLISH_SOURCE_URL,
  ABOUT_IMAGE_ALT_EN,
  ABOUT_EN_TEXT_FIXES,
  aboutEnglishBodyOf,
  aboutEnglishRoleOfHeading,
  aboutEnglishSectionOfRole,
  applyAboutEnglishTextFixes,
  withAboutEnglish,
} from "@/lib/about/english";
import { buildAboutDocument } from "@/lib/about/document";
import type { AboutSource } from "@/lib/about/import-parse";
import { parseBlockDocument } from "@/lib/blocks/parse";
import type { BlockDocument } from "@/lib/blocks/types";
import { documentErrorsOf, validateDocument } from "@/lib/blocks/validate";

/**
 * เทสต์ **ข้อความ EN ของหน้าบริษัท (/about)** — รอบที่ 349
 *
 * เรื่องที่ล็อกไว้:
 * 1. ข้อมูล EN ครบ 9 ส่วนและตรงลำดับกับหน้าต้นทางภาษาไทย
 * 2. แก้เฉพาะคำผิดที่อยู่ในตาราง · ตัวเลข/ข้อความอื่นของต้นทางไม่ถูกแตะ
 * 3. `buildAboutDocument(..., { english: true })` เติม EN ให้เอกสารใหม่
 * 4. `withAboutEnglish()` เติม EN ให้เอกสารเดิมโดย **ไม่แตะ TH/รหัส/สไตล์**
 *    และค่าเริ่มต้นไม่ทับ EN ที่มีอยู่ (กันงานคนหาย)
 */

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

/* ── 1) ข้อมูลต้นทาง EN ─────────────────────────────────────────────────────── */

test("about english: มีครบ 9 ส่วน ตามลำดับเดียวกับหน้าต้นทางไทย", () => {
  assert.deepEqual(
    ABOUT_ENGLISH_SECTIONS.map((section) => section.role),
    [...ABOUT_ENGLISH_ROLES],
    "ลำดับส่วนต้องคงที่: intro → vision → mission → policy → research → products → distribution → people → awards",
  );
  assert.equal(ABOUT_ENGLISH_SECTIONS.length, 9);

  for (const section of ABOUT_ENGLISH_SECTIONS) {
    assert.ok(section.heading.trim() !== "", `${section.role}: หัวข้อ EN ต้องไม่ว่าง`);
    assert.ok(section.paragraphs.length > 0, `${section.role}: ต้องมีอย่างน้อย 1 ย่อหน้า`);
    for (const paragraph of section.paragraphs) {
      assert.ok(paragraph.trim() !== "", `${section.role}: ย่อหน้าต้องไม่ว่าง`);
      assert.ok(!/https?:\/\//.test(paragraph), `${section.role}: ห้ามมี URL รูป/ลิงก์ในข้อความ (มติ D9)`);
    }
  }

  assert.ok(ABOUT_ENGLISH_SOURCE_URL.startsWith("https://waiwai.co.th/"));
  assert.match(ABOUT_ENGLISH_SOURCE_CHECKED_AT, /^\d{4}-\d{2}-\d{2}$/);
});

test("about english: เนื้อหา EN วางตรงกับส่วนไทย (เปิดเรื่อง 2 ย่อหน้า · พันธกิจ 12 ย่อหน้า)", () => {
  const intro = aboutEnglishSectionOfRole("intro");
  assert.equal(intro.paragraphs.length, 2, "เปิดเรื่อง EN = ที่ตั้ง + เครื่องหมายการค้า (ย่อหน้า 3 เป็น Policy)");
  assert.ok(intro.paragraphs[1]?.includes("WAI WAI"));

  const policy = aboutEnglishSectionOfRole("policy");
  assert.equal(policy.heading, "Policy");
  assert.ok(policy.paragraphs[0]?.includes("good manufacturing practice (GMP)"));

  const mission = aboutEnglishSectionOfRole("mission");
  assert.equal(mission.paragraphs.length, 12, "พันธกิจ = ประโยคนำ + ข้อ 1–11");
  assert.ok(mission.paragraphs[0]?.includes("commits to the following"));
  assert.ok(mission.paragraphs[11]?.startsWith("11."));

  const awards = aboutEnglishSectionOfRole("awards");
  assert.equal(awards.heading, "The Company's Proud Awards and Certificates", "แก้ Pround → Proud");
  assert.ok(awards.paragraphs.some((line) => line.includes("ISO 9001 : 2018")));
});

/* ── 2) ตารางแก้คำผิด ───────────────────────────────────────────────────────── */

test("about english: แก้เฉพาะคำผิดในตาราง และไม่แตะตัวเลข/ข้อความอื่น", () => {
  assert.ok(ABOUT_EN_TEXT_FIXES.length >= 10);

  assert.equal(applyAboutEnglishTextFixes("Nakornphthom Province"), "Nakhon Pathom Province");
  assert.equal(applyAboutEnglishTextFixes("Nakornpathom Province"), "Nakhon Pathom Province");
  assert.equal(applyAboutEnglishTextFixes("the employees's dormitory"), "the employees' dormitory");
  assert.equal(applyAboutEnglishTextFixes("Mr.Charn and Mr.Pricha"), "Mr. Charn and Mr. Pricha");
  assert.equal(applyAboutEnglishTextFixes("activities for porsonnel safety"), "activities for personnel safety");
  assert.equal(applyAboutEnglishTextFixes("ensure that thequality standard"), "ensure that the quality standard");
  assert.equal(applyAboutEnglishTextFixes("products ot the outlets"), "products to the outlets");
  assert.equal(applyAboutEnglishTextFixes("The Company's Pround Awards"), "The Company's Proud Awards");
  assert.equal(applyAboutEnglishTextFixes("Tom Klong Favour instant noodle"), "Tom Klong Flavour instant noodle");
  assert.equal(
    applyAboutEnglishTextFixes("of the important of human resource"),
    "of the importance of human resource",
  );

  const untouched = "24 rais · 25% of total area · ISO 9001 : 2018 · 57 rais";
  assert.equal(applyAboutEnglishTextFixes(untouched), untouched, "ตัวเลข/ข้อความที่ไม่มีคำผิดต้องไม่ถูกแก้");
});

/* ── 3) ตัวจับคู่ส่วนไทย → EN ──────────────────────────────────────────────── */

test("about english: จับคู่หัวข้อไทยได้ครบ 9 ส่วน และไม่จับข้อความอื่น", () => {
  const cases: readonly [string, string][] = [
    ["บริษัท โรงงานผลิตภัณฑ์อาหารไทย จำกัด", "intro"],
    ["วิสัยทัศน์ (Vision Statement) ", "vision"],
    ["พันธกิจ (Mission Statement)", "mission"],
    ["นโยบาย (Policy)", "policy"],
    ["การวิจัยและพัฒนาผลิตภัณฑ์", "research"],
    ["ผลิตภัณฑ์", "products"],
    ["ช่องทางการจัดจำหน่าย", "distribution"],
    ["พัฒนาบุคลากร ... พัฒนาสิ่งแวดล้อม", "people"],
    ["รางวัลและเกียรติบัตรความภูมิใจขององค์กร", "awards"],
  ];
  for (const [heading, role] of cases) {
    assert.equal(aboutEnglishRoleOfHeading(heading), role, heading);
  }

  assert.equal(aboutEnglishRoleOfHeading(""), null);
  assert.equal(aboutEnglishRoleOfHeading("ประกาศ"), null);
  /* ชื่อบริษัทมีคำว่า "ผลิตภัณฑ์" — ต้องจับเป็น intro ไม่ใช่ products */
  assert.equal(aboutEnglishRoleOfHeading("บริษัท โรงงานผลิตภัณฑ์อาหารไทย จำกัด"), "intro");
  /* "การวิจัยและพัฒนาผลิตภัณฑ์" ต้องเป็น research ไม่ใช่ products */
  assert.equal(aboutEnglishRoleOfHeading("การวิจัยและพัฒนาผลิตภัณฑ์"), "research");
});

/* ── 4) ตัวประกอบเอกสาร (นำเข้าใหม่) ───────────────────────────────────────── */

const FIXTURE: AboutSource = {
  pageTitle: "บริษัท",
  bannerUrl: "https://cdn.example/banner.gif",
  nodes: [
    {
      kind: "section",
      heading: "",
      paragraphs: ["บริษัท โรงงานทดสอบ จำกัด ก่อตั้งขึ้นเมื่อปี พ.ศ.2515 และมีเนื้อที่ 99 ไร่"],
    },
    { kind: "section", heading: "วิสัยทัศน์ (Vision Statement)", paragraphs: ["วิสัยทัศน์ภาษาไทย"] },
    { kind: "section", heading: "พันธกิจ (Mission Statement)", paragraphs: ["พันธกิจภาษาไทย"] },
    { kind: "section", heading: "นโยบาย (Policy)", paragraphs: ["นโยบายภาษาไทย"] },
    { kind: "images", urls: ["https://cdn.example/photo-1_full.jpg"] },
    { kind: "section", heading: "การวิจัยและพัฒนาผลิตภัณฑ์", paragraphs: ["วิจัยภาษาไทย"] },
    { kind: "section", heading: "ผลิตภัณฑ์", paragraphs: ["ผลิตภัณฑ์ภาษาไทย"] },
    { kind: "section", heading: "ช่องทางการจัดจำหน่าย", paragraphs: ["ช่องทางภาษาไทย"] },
    { kind: "section", heading: "พัฒนาบุคลากร ... พัฒนาสิ่งแวดล้อม", paragraphs: ["บุคลากรภาษาไทย"] },
    { kind: "section", heading: "รางวัลและเกียรติบัตรความภูมิใจขององค์กร", paragraphs: ["รางวัลภาษาไทย"] },
  ],
};

function buildFixture(english: boolean): BlockDocument {
  return buildAboutDocument(FIXTURE, (url) => `/media/id-${url.slice(-8)}`, { english });
}

test("about english: นำเข้าใหม่ (english: true) ได้เอกสาร TH+EN ครบทุกส่วน", () => {
  const document = buildFixture(true);
  const richText = document.blocks.filter((block) => block.type === "richText");
  assert.equal(richText.length, 9);

  for (const block of richText) {
    if (block.type !== "richText") continue;
    assert.ok(block.heading.th.trim() !== "", "TH heading ต้องยังอยู่");
    assert.ok(block.heading.en.trim() !== "", `ต้องมี EN heading: ${block.heading.th}`);
    assert.ok(block.body.en.trim() !== "", `ต้องมี EN body: ${block.heading.th}`);
  }

  const policy = richText.find((block) => block.type === "richText" && block.heading.th.includes("นโยบาย"));
  assert.ok(policy?.type === "richText");
  assert.equal(policy.heading.en, "Policy");
  assert.equal(policy.body.en, aboutEnglishBodyOf(aboutEnglishSectionOfRole("policy")));

  const intro = richText[0];
  assert.ok(intro?.type === "richText");
  assert.equal(intro.heading.en, "Thai Preserved Food Factory Co., Ltd.");
  assert.equal(intro.body.en.split("\n\n").length, 2, "เปิดเรื่อง EN ต้องมี 2 ย่อหน้า");

  const hero = document.blocks.find((block) => block.type === "hero");
  assert.ok(hero?.type === "hero");
  assert.equal(hero.image?.altEn, ABOUT_IMAGE_ALT_EN, "แบนเนอร์ต้องมี altEn");

  const gallery = document.blocks.find((block) => block.type === "gallery");
  assert.ok(gallery?.type === "gallery");
  for (const item of gallery.items) assert.equal(item.image?.altEn, ABOUT_IMAGE_ALT_EN);

  assert.ok(parseBlockDocument("about", document).ok);
  assert.deepEqual(
    documentErrorsOf(validateDocument(document)).map((entry) => `${entry.path} ${entry.code}`),
    [],
  );
});

test("about english: ส่วนที่จับคู่ไม่ได้ = โยน error (ไม่ปล่อยหน้าไทยครึ่ง ๆ กลาง ๆ)", () => {
  const source: AboutSource = {
    pageTitle: "บริษัท",
    bannerUrl: null,
    nodes: [{ kind: "section", heading: "ประกาศใหม่", paragraphs: ["ข้อความ"] }],
  };
  assert.throws(
    () => buildAboutDocument(source, () => null, { english: true }),
    /ไม่พบข้อความ EN สำหรับส่วน "ประกาศใหม่"/,
  );
  /* ค่าเริ่มต้น (ไม่เปิด EN) ยังทำงานเหมือนเดิม */
  assert.equal(buildAboutDocument(source, () => null).blocks[0]?.type, "richText");
});

/* ── 5) เติม EN ให้เอกสารเดิม ──────────────────────────────────────────────── */

test("about english: เติมเอกสารเดิมโดยไม่แตะ TH/รหัสบล็อก/สไตล์", () => {
  const before = buildFixture(false);
  assert.ok(before.blocks.every((block) => block.type !== "richText" || block.body.en === ""));

  const { document: after, report } = withAboutEnglish(before);

  assert.equal(report.filled.length, 9, "ต้องเติมครบ 9 ส่วน");
  assert.equal(report.imageAltsFilled, 2, "แบนเนอร์ 1 + ภาพในแกลเลอรี 1");
  assert.deepEqual(report.skipped, []);

  assert.deepEqual(
    after.blocks.map((block) => ({ id: block.id, type: block.type, style: block.style })),
    before.blocks.map((block) => ({ id: block.id, type: block.type, style: block.style })),
    "รหัส/ชนิด/สไตล์ต้องเหมือนเดิม",
  );

  for (const [index, block] of after.blocks.entries()) {
    const original = before.blocks[index];
    assert.ok(original !== undefined);
    if (block.type === "richText" && original.type === "richText") {
      assert.equal(block.heading.th, original.heading.th, "ห้ามแก้ heading TH");
      assert.equal(block.body.th, original.body.th, "ห้ามแก้ body TH");
      assert.ok(block.heading.en !== "" && block.body.en !== "");
    }
    if (block.type === "gallery" && original.type === "gallery") {
      assert.deepEqual(
        block.items.map((item) => item.image?.path),
        original.items.map((item) => item.image?.path),
        "ห้ามเปลี่ยนรูป",
      );
    }
  }

  assert.deepEqual(
    documentErrorsOf(validateDocument(after)).map((entry) => `${entry.path} ${entry.code}`),
    [],
  );
});

test("about english: รันซ้ำไม่เปลี่ยนอะไร (idempotent) · --force จึงเขียนทับ", () => {
  const first = withAboutEnglish(buildFixture(false));
  const second = withAboutEnglish(first.document);

  assert.equal(second.report.filled.length, 0, "รอบสองต้องไม่เติมซ้ำ");
  assert.equal(second.report.skipped.length, 9, "ทั้ง 9 ส่วนถูกรายงานว่ามี EN อยู่แล้ว");
  assert.ok(second.report.skipped.every((entry) => entry.reason === "already-filled"));
  assert.deepEqual(second.document, first.document);

  const forced = withAboutEnglish(first.document, { overwrite: true });
  assert.equal(forced.report.filled.length, 9);
  assert.deepEqual(forced.document, first.document, "เขียนทับด้วยข้อความชุดเดิม = ผลเท่าเดิม");
});

test("about english: หัวข้อไม่รู้จัก/บทบาทซ้ำ = ข้าม ไม่เขียนทับผิดส่วน", () => {
  const before = buildFixture(false);
  const style = before.blocks[0]?.style;
  assert.ok(style !== undefined);

  const extra = {
    id: "block-extra",
    version: 2,
    type: "richText" as const,
    style,
    heading: { th: "ประกาศ", en: "" },
    body: { th: "ข้อความประกาศ", en: "" },
    ctaLabel: { th: "", en: "" },
    ctaHref: "",
  };

  const duplicated = {
    ...extra,
    id: "block-duplicate",
    heading: { th: "วิสัยทัศน์ (Vision Statement)", en: "" },
    body: { th: "วิสัยทัศน์ซ้ำ", en: "" },
  };

  const { document, report } = withAboutEnglish({ page: "about", blocks: [...before.blocks, extra, duplicated] });

  assert.equal(report.skipped.filter((entry) => entry.reason === "unknown-heading").length, 1);
  assert.equal(report.skipped.filter((entry) => entry.reason === "duplicate-role").length, 1);

  const unknown = document.blocks.find((block) => block.id === "block-extra");
  assert.ok(unknown?.type === "richText");
  assert.equal(unknown.heading.en, "", "หัวข้อไม่รู้จักต้องไม่ถูกเติม");
  assert.equal(unknown.body.en, "");

  const duplicate = document.blocks.find((block) => block.id === "block-duplicate");
  assert.ok(duplicate?.type === "richText");
  assert.equal(duplicate.body.en, "", "บทบาทซ้ำต้องไม่ถูกเติม (กันข้อความผิดส่วน)");
});

/* ── 6) สายไฟของสคริปต์ ────────────────────────────────────────────────────── */

test("about english: สคริปต์ใช้ท่อเดียวกับปุ่มเผยแพร่ + ค่าเริ่มต้นเป็น dry-run", () => {
  const script = readFileSync(path.join(PROJECT_ROOT, "scripts", "import-about-english.ts"), "utf8");
  assert.ok(script.includes("withAboutEnglish("), "ต้องใช้ตรรกะเติม EN กลาง");
  assert.ok(script.includes("saveDraft("), "ต้องบันทึกฉบับร่าง");
  assert.ok(script.includes("publishDraft("), "ต้องเผยแพร่ผ่าน repository (มี revision + audit)");
  assert.ok(script.includes("setPageLive("), "ต้องเปิดใช้กับหน้าเว็บเหมือนปุ่มในหลังบ้าน");
  assert.ok(script.includes("validateDocument(") && script.includes("documentErrorsOf("), "ต้องผ่านด่าน validator");
  assert.ok(script.includes("--apply") && script.includes("--publish"), "ต้องมีธง apply/publish");
  assert.ok(script.includes("dry-run"), "ค่าเริ่มต้นต้องเป็น dry-run");
  assert.ok(!script.includes("dangerouslySetInnerHTML"), "ห้ามตีความ HTML เป็น markup");

  const importer = readFileSync(path.join(PROJECT_ROOT, "scripts", "import-about.ts"), "utf8");
  assert.ok(importer.includes("{ english: true }"), "ตัวนำเข้าต้องสร้างเอกสาร TH+EN");
  assert.ok(importer.includes("ABOUT_IMAGE_ALT_EN"), "รูปที่นำเข้าต้องมี altEn");
});

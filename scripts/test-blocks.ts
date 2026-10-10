import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { addCard, insertPresetBlock, moveBlockTo, moveCardTo, replaceBlockWithPreset, setBlockVisibility, setCardText } from "@/lib/blocks/edit";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { normalizePresetName } from "@/lib/blocks/presets";
import { STYLE_CHOICES, alignClass, containerClass, headingClass, heroHeightClass, shellClass } from "@/lib/blocks/style";
import {
  BLOCK_CATALOG,
  BLOCK_TYPES,
  DEFAULT_BLOCK_STYLE,
  MAX_BLOCKS_PER_PAGE,
  createBlock,
  hiddenSizesOf,
  isSafeHref,
  nextBlockId,
  readVisibility,
  type Block,
  type BlockDocument,
  type BlockStyle,
} from "@/lib/blocks/types";
import { documentErrorsOf, documentWarningsOf, missingEnglishCount, validateDocument } from "@/lib/blocks/validate";

/** เทสต์ของแกน "บล็อกอิสระ" (ตรรกะล้วน — ไม่ต้องมี DB/React) */

/** รากโปรเจกต์ — ใช้กับเทสต์ที่ "สแกนซอร์ส" (ตัวเรนเดอร์เป็น server component ⇒ เรนเดอร์ใน `node --test` ไม่ได้) */
const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

/**
 * ชนิดข้อมูลจริงเป็น readonly ทั้งหมด (ตั้งใจ — กันการแก้พลาดในโค้ดแอป)
 * เทสต์ต้องแก้ค่าเพื่อจำลอง "ผู้ใช้แก้ในหน้าจอ" → ใช้ตัวช่วยนี้ถอด readonly เฉพาะในเทสต์
 */
type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;

function mutable<T>(value: T): DeepMutable<T> {
  return structuredClone(value) as DeepMutable<T>;
}

function style(overrides: Partial<BlockStyle> = {}): BlockStyle {
  return { ...DEFAULT_BLOCK_STYLE, ...overrides };
}

function docOf(blocks: readonly Block[]): BlockDocument {
  return { page: "home", blocks };
}

/* ── แคตตาล็อก + การสร้างบล็อก ─────────────────────────────────────────── */

test("blocks: แคตตาล็อกครอบทุกชนิดที่มีในชนิดข้อมูล", () => {
  const catalogTypes = BLOCK_CATALOG.map((entry) => entry.type).sort();
  assert.deepEqual(catalogTypes, [...BLOCK_TYPES].sort());
});

test("blocks: สร้างบล็อกใหม่ได้ทุกชนิด และได้ id/สไตล์เริ่มต้นที่พร้อมใช้", () => {
  for (const type of BLOCK_TYPES) {
    const block = createBlock(type, "b1");
    assert.equal(block.id, "b1");
    assert.equal(block.type, type);
    assert.ok(block.style.align === "left" || block.style.align === "center");
    assert.ok(["none", "sm", "md", "lg"].includes(block.style.spacing));
  }

  const hero = createBlock("hero", "b2");
  assert.ok(hero.type === "hero");
  assert.equal(hero.style.size, "lg", "แบนเนอร์เปิดหน้าเริ่มที่ขนาดใหญ่");
  assert.equal(hero.image, null);
});

test("blocks: nextBlockId ไม่ซ้ำกับของเดิม", () => {
  const existing = [createBlock("divider", "block-1"), createBlock("divider", "block-2")];
  const id = nextBlockId(existing);
  assert.ok(!existing.some((block) => block.id === id), `id ใหม่ต้องไม่ซ้ำ: ${id}`);
});

/* ── ลิงก์ที่ปลอดภัย ────────────────────────────────────────────────────── */

test("blocks: รับลิงก์ที่ปลอดภัย และปฏิเสธ javascript:", () => {
  for (const safe of ["", "/products", "#top", "mailto:a@b.co.th", "tel:+6621234567", "https://waiwai.co.th/x"]) {
    assert.equal(isSafeHref(safe), true, `ควรรับได้: ${safe}`);
  }
  for (const unsafe of ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,x", "http://insecure.test", "ftp://x"]) {
    assert.equal(isSafeHref(unsafe), false, `ต้องปฏิเสธ: ${unsafe}`);
  }
});

/* ── พรีเซ็ต → คลาสของธีม (ห้ามมีสีดิบ/hex) ────────────────────────────── */

test("style: ทุกคลาสที่สร้างมาจาก token และไม่มีสีดิบ/hex", () => {
  const rawColour = /(^|\s)(bg|text|border)-(white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d{2,3})?(\s|$)/;
  const hex = /#[0-9a-f]{3,8}/i;

  for (const align of STYLE_CHOICES.align) {
    for (const width of STYLE_CHOICES.width) {
      for (const spacing of STYLE_CHOICES.spacing) {
        for (const background of STYLE_CHOICES.background) {
          for (const size of STYLE_CHOICES.size) {
            const candidate = style({
              align: align.value,
              width: width.value,
              spacing: spacing.value,
              background: background.value,
              size: size.value,
            });
            const classes = [
              shellClass(candidate),
              containerClass(candidate),
              alignClass(candidate),
              headingClass(candidate),
              heroHeightClass(candidate),
            ].join(" ");

            assert.ok(!hex.test(classes), `ห้ามมี hex: ${classes}`);
            assert.ok(!rawColour.test(classes), `ห้ามมีคลาสสีดิบ: ${classes}`);
          }
        }
      }
    }
  }
});

test("style: พรีเซ็ตเดียวกันให้คลาสเดิมเสมอ (ผลซ้ำได้) และค่าเริ่มต้นคือชุดว่าง", () => {
  assert.equal(shellClass(style()), "py-10", "ค่าเริ่มต้น = ระยะปกติ ไม่มีพื้นหลัง");
  assert.equal(shellClass(style({ background: "cream", spacing: "lg" })), "bg-bg-cream py-16");
  assert.equal(containerClass(style({ width: "narrow" })), "mx-auto w-full px-4 max-w-2xl");
  assert.equal(alignClass(style({ align: "center" })), "text-center");
  assert.ok(heroHeightClass(style({ size: "lg" })).startsWith("min-h-"));
});

/* ── ตรวจเอกสาร ─────────────────────────────────────────────────────────── */

test("validate: บล็อกที่ยังว่างถูกจับเป็น error (ไทยห้ามว่าง)", () => {
  const issues = validateDocument(docOf([createBlock("heading", "b1")]));
  const errors = documentErrorsOf(issues);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.code, "empty-th");
  assert.equal(errors[0]?.path, "blocks[0].text.th");
});

test("validate: แบนเนอร์มีภาพแต่ไม่มีหัวข้อ = ผ่าน · ไม่มีทั้งคู่ = error (เคสจริง 2026-10-10)", () => {
  /*
    เจ้าของลบหัวข้อของแบนเนอร์ (ชื่อเต็มบริษัทอยู่บล็อกถัดไป ⇒ "บริษัท" ซ้ำ) แต่เผยแพร่ไม่ผ่าน
    เพราะกฎเดิมบังคับ `hero.title` ⇒ แก้เป็น "แบนเนอร์ต้องไม่ว่างเปล่า" (หัวข้อหรือภาพ อย่างน้อยหนึ่ง)
  */
  const hero = mutable(createBlock("hero", "b1"));
  assert.ok(hero.type === "hero");
  hero.image = { path: "/media/example", altTh: "ภาพแบนเนอร์", altEn: "", hasWatermark: false };
  assert.equal(documentErrorsOf(validateDocument(docOf([hero]))).length, 0, "มีภาพ = ผ่านแม้ไม่มีหัวข้อ");

  const empty = mutable(createBlock("hero", "b2"));
  assert.ok(empty.type === "hero");
  const codes = documentErrorsOf(validateDocument(docOf([empty]))).map((entry) => entry.code);
  assert.ok(codes.includes("hero-empty"), "ไม่มีหัวข้อและไม่มีภาพ = แบนเนอร์ว่างเปล่า ต้องเป็น error");
});

test("renderer: แบนเนอร์ไม่มีหัวข้อต้องไม่เรนเดอร์ <h2> เปล่า และทุกเลย์เอาต์ต้องมี h1 (a11y)", () => {
  /*
    เคสจริง 2026-10-10: เจ้าของลบหัวข้อของแบนเนอร์ (กันคำซ้ำ) แล้วพบว่า
    (1) ตัวเรนเดอร์ยังพ่น `<h2></h2>` เปล่า ๆ ออกมา และ (2) หน้าไม่มี `<h1>` เลย (เดิมใส่ให้เฉพาะเลย์เอาต์ sidebar)
  */
  const source = readFileSync(path.join(PROJECT_ROOT, "features", "blocks", "block-renderer.tsx"), "utf8");

  const titleAttrs = source.indexOf('editAttrs(editable, "title")');
  assert.ok(titleAttrs > 0, "ต้องพบจุดเรนเดอร์หัวข้อของแบนเนอร์");
  const aroundTitle = source.slice(Math.max(0, titleAttrs - 400), titleAttrs);
  assert.ok(aroundTitle.includes("hasText(block.title)"), "หัวข้อแบนเนอร์ต้องถูกครอบด้วย hasText (ไม่มีข้อความ = ไม่มีแท็ก)");

  assert.ok(
    source.includes('const pageHeading = heading.trim() === "" ? null : <h1 className="sr-only">{heading}</h1>;'),
    "ต้องมีตัวแปรกลาง pageHeading สำหรับ h1 ของหน้า",
  );
  assert.equal(
    [...source.matchAll(/\{pageHeading\}/g)].length,
    3,
    "ต้องใช้ h1 ในทุกเลย์เอาต์ (sidebar + landing + full) — เดิมมีเฉพาะ sidebar",
  );
  assert.ok(!source.includes('heading === "" ? null : <h1'), "ห้ามเหลือการเช็ค h1 แบบเดิม (ใช้เฉพาะ sidebar)");
});

test("validate: ยังไม่มีคำแปลอังกฤษเป็น 'คำเตือน' ไม่บล็อกการบันทึก", () => {
  const hero = mutable(createBlock("hero", "b1"));
  assert.ok(hero.type === "hero");
  hero.title.th = "หัวข้อไทย";

  const issues = validateDocument(docOf([hero]));
  assert.equal(documentErrorsOf(issues).length, 0, "ไม่มี error");
  assert.equal(missingEnglishCount(issues), 1, "ต้องเตือนว่ายังไม่มี EN ของหัวข้อ");
});

test("validate: ภาพต้องมีพาธในโปรเจกต์ + ต้องมี alt", () => {
  const card = mutable(createBlock("imageText", "b1"));
  assert.ok(card.type === "imageText");
  card.heading.th = "หัวข้อ";
  card.image = { path: "https://example.com/a.jpg", altTh: "", altEn: "", hasWatermark: true };

  const codes = documentErrorsOf(validateDocument(docOf([card]))).map((entry) => entry.code);
  assert.ok(codes.includes("media-path-is-url"), "ต้องจับ URL เต็ม (มติ D9)");
  assert.ok(codes.includes("missing-alt"), "ต้องจับภาพที่ไม่มี alt (มติ D7)");

  const warnings = documentWarningsOf(validateDocument(docOf([card]))).map((entry) => entry.code);
  assert.ok(warnings.includes("watermark"), "ภาพติดลายน้ำ = คำเตือน");
});

test("validate: ลิงก์อันตรายเป็น error และ id ซ้ำถูกจับได้", () => {
  const cta = mutable(createBlock("cta", "dup"));
  assert.ok(cta.type === "cta");
  cta.heading.th = "ชวน";
  cta.label.th = "กด";
  cta.href = "javascript:alert(1)";

  const divider = createBlock("divider", "dup");
  const issues = validateDocument(docOf([cta, divider]));
  const codes = documentErrorsOf(issues).map((entry) => entry.code);

  assert.ok(codes.includes("bad-href"));
  assert.ok(codes.includes("duplicate-id"));
});

test("validate: การ์ดต้องมีหัวข้อ และเตือนเมื่อยังไม่มีใบเลย", () => {
  const cards = mutable(createBlock("cards", "b1"));
  assert.ok(cards.type === "cards");
  cards.items = [{ title: { th: "", en: "" }, body: { th: "", en: "" }, href: "", image: null }];

  const issues = validateDocument(docOf([cards]));
  assert.ok(documentErrorsOf(issues).some((entry) => entry.code === "empty-th"));
  assert.ok(documentWarningsOf(issues).some((entry) => entry.code === "cards-empty") === false, "มีการ์ดแล้วไม่ต้องเตือนว่าว่าง");

  const empty = createBlock("cards", "b2");
  assert.ok(empty.type === "cards");
  assert.ok(documentWarningsOf(validateDocument(docOf([empty]))).some((entry) => entry.code === "cards-empty"));
});

/* ── parse (ไม่เชื่อข้อมูลจากเบราว์เซอร์) ───────────────────────────────── */

test("parse: เอกสารที่ถูกต้องผ่าน และไปกลับได้เท่าเดิม", () => {
  const doc = docOf([createBlock("divider", "b1"), createBlock("heading", "b2")]);
  const outcome = parseBlockDocument("home", JSON.parse(JSON.stringify(doc)));

  assert.equal(outcome.ok, true);
  assert.ok(outcome.ok);
  assert.deepEqual(outcome.document, doc);
});

test("parse: ชนิดบล็อกที่ไม่รู้จักถูกข้ามพร้อมรายงาน (ไม่ทำให้ทั้งหน้าพัง)", () => {
  const outcome = parseBlockDocument("home", {
    blocks: [{ id: "b1", type: "divider", style: {} }, { id: "b2", type: "carousel-จากอนาคต" }],
  });

  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok);
  assert.ok(outcome.problems.some((problem) => problem.includes("carousel-จากอนาคต")));
});

test("parse: สไตล์ที่ผิดชนิดถูกแทนด้วยค่าเริ่มต้น + รายงาน", () => {
  const outcome = parseBlockDocument("home", {
    blocks: [{ id: "b1", type: "heading", text: { th: "ก", en: "a" }, style: { background: "#ff0000", size: "ยักษ์" } }],
  });

  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok);
  assert.ok(outcome.problems.some((problem) => problem.includes("style.background")));
  assert.ok(outcome.problems.some((problem) => problem.includes("style.size")));
});

test("parse: id ซ้ำถูกสร้างใหม่ให้อัตโนมัติ", () => {
  const outcome = parseBlockDocument("home", {
    blocks: [
      { id: "ซ้ำ", type: "divider" },
      { id: "ซ้ำ", type: "divider" },
    ],
  });

  assert.equal(outcome.ok, false, "ต้องรายงานว่ามี id ซ้ำ");
  assert.ok(!outcome.ok);
  assert.ok(outcome.problems.some((problem) => problem.includes("id")));
});

test("parse: ข้อมูลที่ไม่ใช่เอกสาร → ปฏิเสธพร้อมเหตุผล", () => {
  for (const bad of [null, 7, "ข้อความ", [], {}]) {
    const outcome = parseBlockDocument("home", bad);
    assert.equal(outcome.ok, false, `ต้องปฏิเสธ: ${JSON.stringify(bad)}`);
  }
});

test("parse: จำนวนบล็อกเกินเพดานถูกตัดและรายงาน", () => {
  const blocks = Array.from({ length: MAX_BLOCKS_PER_PAGE + 2 }, (_unused, index) => ({ id: `b${index}`, type: "divider" }));
  const outcome = parseBlockDocument("home", { blocks });

  assert.equal(outcome.ok, false);
  assert.ok(!outcome.ok);
  assert.ok(outcome.problems.some((problem) => problem.includes("เกินที่อนุญาต")));
});


/* ── ลาก-วางสลับตำแหน่ง (L1 — รอบที่ 50) ─────────────────────────────────── */

test("moveBlockTo: ย้ายบล็อกจากบนสุดไปล่างสุด และกลับกัน", () => {
  const doc = docOf([createBlock("heading", "b1"), createBlock("richText", "b2"), createBlock("cta", "b3")]);

  const toLast = moveBlockTo(doc, "b1", 2);
  assert.deepEqual(toLast.blocks.map((block) => block.id), ["b2", "b3", "b1"]);

  const toFirst = moveBlockTo(toLast, "b1", 0);
  assert.deepEqual(toFirst.blocks.map((block) => block.id), ["b1", "b2", "b3"]);
});

test("moveBlockTo: ตำแหน่งเดิม = ไม่แตะเอกสาร (ไม่เกิด state update เปล่า)", () => {
  const doc = docOf([createBlock("heading", "b1"), createBlock("cta", "b2")]);
  assert.equal(moveBlockTo(doc, "b1", 0), doc);
  assert.equal(moveBlockTo(doc, "ไม่มีอยู่จริง", 1), doc);
});

test("moveBlockTo: ตำแหน่งหลุดช่วงถูกบีบให้อยู่ในช่วง (ไม่พัง)", () => {
  const doc = docOf([createBlock("heading", "b1"), createBlock("cta", "b2"), createBlock("quote", "b3")]);
  assert.deepEqual(moveBlockTo(doc, "b1", 99).blocks.map((block) => block.id), ["b2", "b3", "b1"]);
  assert.deepEqual(moveBlockTo(doc, "b3", -5).blocks.map((block) => block.id), ["b3", "b1", "b2"]);
});

test("moveCardTo: สลับการ์ดในบล็อกการ์ดตามตำแหน่งที่วาง", () => {
  let doc = docOf([createBlock("cards", "c1")]);
  doc = addCard(doc, "c1");
  doc = addCard(doc, "c1");
  doc = addCard(doc, "c1");

  /* ตั้งชื่อการ์ดให้ต่างกัน เพื่อตรวจลำดับได้ชัด (การ์ดไม่มี id — ใช้ลำดับเป็นตัวอ้าง) */
  const names = ["A", "B", "C"];
  names.forEach((name, index) => {
    doc = setCardText(doc, "c1", index, "title", "th", name);
  });

  const before = doc.blocks[0];
  assert.ok(before !== undefined && before.type === "cards");
  assert.deepEqual(before.items.map((item) => item.title.th), names);

  const moved = moveCardTo(doc, "c1", 0, 2);
  const after = moved.blocks[0];
  assert.ok(after !== undefined && after.type === "cards");
  assert.deepEqual(after.items.map((item) => item.title.th), ["B", "C", "A"]);

  /* ตำแหน่งเดิม / ช่วงหลุด / บล็อกที่ไม่ใช่การ์ด = ไม่พัง */
  assert.equal(moveCardTo(doc, "c1", 1, 1), doc);
  assert.equal(moveCardTo(doc, "c1", 9, 0), doc);
  assert.equal(moveCardTo(doc, "b-not-cards", 0, 1), doc);

  const toEnd = moveCardTo(doc, "c1", 0, 99);
  const endBlock = toEnd.blocks[0];
  assert.ok(endBlock !== undefined && endBlock.type === "cards");
  assert.deepEqual(endBlock.items.map((item) => item.title.th), ["B", "C", "A"]);
});

/* ── พรีเซ็ต: วางในหน้า / ทับของเดิม (รอบที่ 52) ───────────────────────────── */

test("insertPresetBlock: วางพรีเซ็ตเป็นบล็อกใหม่ท้ายหน้า โดยได้ id ใหม่เสมอ", () => {
  const doc = docOf([createBlock("heading", "b1")]);
  const preset = createBlock("hero", "block-999");

  const next = insertPresetBlock(doc, preset);
  assert.equal(next.blocks.length, 2);

  const added = next.blocks[1];
  assert.ok(added !== undefined);
  assert.equal(added.type, "hero");
  assert.notEqual(added.id, "block-999", "ต้องไม่ใช้ id ของพรีเซ็ตตรง ๆ");
  assert.deepEqual(
    next.blocks.map((block) => block.id),
    [...new Set(next.blocks.map((block) => block.id))],
    "id ต้องไม่ซ้ำกันในหน้า",
  );
});

test("replaceBlockWithPreset: ทับบล็อกที่เลือกโดยคงตำแหน่งเดิม", () => {
  const doc = docOf([createBlock("heading", "b1"), createBlock("cta", "b2"), createBlock("quote", "b3")]);
  const preset = createBlock("hero", "block-1");

  const next = replaceBlockWithPreset(doc, "b2", preset);
  const replaced = next.blocks[1];
  assert.ok(replaced !== undefined);
  assert.equal(replaced.type, "hero", "ตำแหน่งเดิมถูกแทนด้วยพรีเซ็ต");
  assert.equal(next.blocks.length, 3, "จำนวนบล็อกเท่าเดิม");
  assert.deepEqual(next.blocks.map((block) => block.id).slice(1, 2), [replaced.id], "id ใหม่แต่ตำแหน่งเดิม");

  /* ไม่พบเป้าหมาย = ไม่แตะเอกสาร */
  assert.equal(replaceBlockWithPreset(doc, "ไม่มีอยู่จริง", preset), doc);
});

test("normalizePresetName: ตัดช่องว่าง · ว่างใช้ไม่ได้ · ยาวเกินถูกตัด", () => {
  assert.equal(normalizePresetName("  แบนเนอร์สงกรานต์  "), "แบนเนอร์สงกรานต์");
  assert.equal(normalizePresetName("หลาย   ช่องว่าง"), "หลาย ช่องว่าง");
  assert.equal(normalizePresetName("   "), null);
  assert.equal(normalizePresetName("x".repeat(200))?.length, 60);
});

/* ── ซ่อน/แสดงตามขนาดจอ (X1.6) ───────────────────────────────────────────── */

test("setBlockVisibility: ตั้งค่าแล้วอ่านกลับได้ · แสดงทุกขนาด = ลบฟิลด์ทิ้ง", () => {
  const block = createBlock("heading", "vis-1");
  const base = docOf([block]);
  const id = block.id;

  const hidden = setBlockVisibility(base, id, { mobile: false });
  assert.deepEqual(hidden.blocks[0]?.visibility, { desktop: true, tablet: true, mobile: false });

  const both = setBlockVisibility(hidden, id, { tablet: false });
  assert.deepEqual(both.blocks[0]?.visibility, { desktop: true, tablet: false, mobile: false });

  const back = setBlockVisibility(both, id, { tablet: true, mobile: true });
  assert.equal(back.blocks[0]?.visibility, undefined, "แสดงครบ = ไม่เก็บฟิลด์");
});

test("hiddenSizesOf: บอกขนาดที่ต้องซ่อน · ซ่อนครบทุกขนาด = ไม่ซ่อน (กันบล็อกหาย)", () => {
  assert.deepEqual(hiddenSizesOf(undefined), [], "ไม่ระบุ = ไม่ซ่อนอะไร");
  assert.deepEqual(hiddenSizesOf({ desktop: true, tablet: true, mobile: true }), []);
  assert.deepEqual(hiddenSizesOf({ desktop: true, tablet: true, mobile: false }), ["mobile"]);
  assert.deepEqual(hiddenSizesOf({ desktop: false, tablet: true, mobile: false }), ["desktop", "mobile"]);
  assert.deepEqual(hiddenSizesOf({ desktop: false, tablet: false, mobile: false }), [], "ซ่อนหมด = ถือว่าไม่ต้องใส่ attribute");
});

test("readVisibility: ข้อมูลผิดรูป/ไม่ครบ = แสดงทุกขนาด (ไม่ทำให้ไฟล์เสียหาย)", () => {
  assert.equal(readVisibility(undefined), undefined);
  assert.equal(readVisibility("ไม่ใช่ออบเจ็กต์"), undefined);
  assert.equal(readVisibility({ desktop: true }), undefined, "ขาดฟิลด์ = ไม่ใช้");
  assert.equal(readVisibility({ desktop: true, tablet: true, mobile: true }), undefined, "แสดงครบ = ไม่ต้องเก็บ");
  assert.deepEqual(readVisibility({ desktop: false, tablet: true, mobile: true }), { desktop: false, tablet: true, mobile: true });
});

test("parseBlockDocument: อ่าน visibility จากข้อมูลที่บันทึกไว้ และทิ้งค่าที่ผิดรูป", () => {
  const document = docOf([createBlock("heading", "vis-2")]);
  const id = document.blocks[0]?.id ?? "";

  const withHidden = { ...document, blocks: [{ ...document.blocks[0], visibility: { desktop: true, tablet: true, mobile: false } }] };
  const parsed = parseBlockDocument("home", JSON.parse(JSON.stringify(withHidden)));
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.deepEqual(parsed.document.blocks[0]?.visibility, { desktop: true, tablet: true, mobile: false });
  }

  const broken = { ...document, blocks: [{ ...document.blocks[0], visibility: { desktop: "ใช่", tablet: 1, mobile: null } }] };
  const fallback = parseBlockDocument("home", JSON.parse(JSON.stringify(broken)));
  assert.equal(fallback.ok, true);
  if (fallback.ok) assert.equal(fallback.document.blocks[0]?.visibility, undefined, "ค่าผิดรูป = แสดงทุกขนาด");
  assert.ok(id !== "");
});

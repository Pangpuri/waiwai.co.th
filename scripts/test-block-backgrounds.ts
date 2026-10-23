import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { parseBlockDocument } from "@/lib/blocks/parse";
import { STYLE_CHOICES, shellClass } from "@/lib/blocks/style";
import { BLOCK_BACKGROUNDS, DEFAULT_BLOCK_STYLE, createBlock, type BlockStyle } from "@/lib/blocks/types";

/**
 * เทสต์ "สีพื้นหลังของบล็อกต้องตรงกับชื่อตัวเลือก" (รอบที่ 314)
 *
 * 🐞 เคสจริงจากเจ้าของ: *"ครีมเป็นครีม เทาเป็นครีม โปร่งเป็นขาว … ขาวเป็นขาว แดงเป็นขาว"*
 * - "เทาอ่อน" ชี้ไปที่ `bg-bg-subtle` (#fdf8e9) ซึ่งเป็น **โทนครีม** (ต่างจากครีมจริงแค่เฉด)
 * - "สีแบรนด์อ่อน" ชี้ไปที่ `bg-surface-raised` (#ffffff) ⇒ **ขาว** (ไม่มีกลิ่นแบรนด์เลย)
 * - ไม่มีตัวเลือก "ขาว" ที่ชัดเจน
 *
 * เทสต์ชุดนี้ล็อก 3 อย่าง:
 *  1. ทุกตัวเลือกต้องได้คลาส **ไม่ซ้ำกัน** (ห้ามมีสองตัวเลือกที่ให้ผลเหมือนกัน)
 *  2. ชื่อตัวเลือกต้องตรงกับคลาสที่ได้ (เทา → เทาจริง · แดงอ่อน → แดงอ่อนจริง · ขาว → ขาว)
 *  3. ตัวอักษร `--fg` บนทุกพื้นต้องผ่าน AA (≥ 4.5:1)
 */

const ROOT = process.cwd();
const sourceOf = (relative: string): string => readFileSync(path.join(ROOT, relative), "utf8");
const CSS = sourceOf("app/globals.css");

function tokenOf(css: string, name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  assert.ok(match !== null, `ไม่พบ token ${name}`);
  return (match[1] as string).toLowerCase();
}

function channels(hex: string): readonly number[] {
  return (hex.replace("#", "").match(/../g) ?? []).map((part) => Number.parseInt(part, 16));
}

function luminance(hex: string): number {
  const linear = channels(hex).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (linear[0] as number) + 0.7152 * (linear[1] as number) + 0.0722 * (linear[2] as number);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** ผสมสีโปร่งใส (opacity) ทับพื้นขาว — ใช้หาค่าสีจริงของ `bg-brand-red/10` บนหน้าเว็บ */
function blendOverWhite(hex: string, alpha: number): string {
  const base = channels(hex);
  const mixed = base.map((value) => Math.round(value * alpha + 255 * (1 - alpha)));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

const styleWith = (background: BlockStyle["background"]): BlockStyle => ({ ...DEFAULT_BLOCK_STYLE, background });

test("★ ทุกตัวเลือกพื้นหลังต้องได้คลาสไม่ซ้ำกัน (ต้นเหตุ 'เทา = ครีม' / 'แดง = ขาว')", () => {
  const classes = BLOCK_BACKGROUNDS.map((background) => shellClass(styleWith(background)).trim());
  const nonEmpty = classes.filter((value) => value !== "");

  assert.equal(new Set(classes).size, classes.length, `มีตัวเลือกที่ให้คลาสซ้ำกัน: ${classes.join(" | ")}`);
  assert.equal(new Set(nonEmpty).size, nonEmpty.length, `มีตัวเลือกที่ให้สีเดียวกัน: ${nonEmpty.join(" | ")}`);
});

test("ชื่อตัวเลือกต้องตรงกับสีที่ได้ (ครีม/เทา/ขาว/แดงอ่อน)", () => {
  /* shellClass รวมระยะห่าง (py-*) มาด้วย ⇒ ตรวจเฉพาะคลาสสี */
  assert.ok(shellClass(styleWith("cream")).includes("bg-bg-cream"), "ครีม = โทนครีม");
  assert.ok(shellClass(styleWith("subtle")).includes("bg-bg-muted"), "เทาอ่อน = เทาจริง (ไม่ใช่ครีม)");
  assert.ok(shellClass(styleWith("white")).includes("bg-surface"), "ขาว = พื้นผิวขาว");
  assert.ok(shellClass(styleWith("brand")).includes("bg-brand-red/10"), "แดงอ่อน = แดงแบรนด์จาง");
  assert.equal(shellClass(styleWith("none")).trim(), "py-10", "โปร่ง = ไม่มีคลาสพื้นหลัง (เหลือแต่ระยะห่าง)");
});

test("ตัวเลือกในหน้าจอ = ค่าที่ระบบรับจริง (ไม่มีตัวเลือกผี/ค่าที่เลือกไม่ได้)", () => {
  const fromChoices = STYLE_CHOICES.background.map((entry) => entry.value);
  assert.deepEqual([...fromChoices].sort(), [...BLOCK_BACKGROUNDS].sort());
  assert.ok(fromChoices.includes("white"), "ต้องมีตัวเลือก 'ขาว'");
  assert.ok(
    STYLE_CHOICES.background.some((entry) => entry.value === "none" && entry.label.includes("โปร่ง")),
    "ตัวเลือก 'โปร่ง' ต้องบอกใบ้ว่าไม่มีพื้นหลัง",
  );
});

test("เทา ≠ ครีม: โทนเทาต้องเป็นกลาง (ค่าสีใกล้กันทั้งสามช่อง) มากกว่าครีม", () => {
  const cream = channels(tokenOf(CSS, "--bg-cream"));
  const neutral = channels(tokenOf(CSS, "--bg-muted"));
  const spread = (values: readonly number[]): number => Math.max(...values) - Math.min(...values);

  assert.ok(spread(cream) > spread(neutral), `ครีมต้องติดโทนอุ่นกว่าเทา — ครีม ${spread(cream)} / เทา ${spread(neutral)}`);
  assert.ok(spread(neutral) <= 10, `เทาต้องใกล้เคียงสีกลาง (spread ≤ 10) — ได้ ${spread(neutral)}`);
});

test("ตัวอักษร --fg บนทุกพื้นของบล็อกต้องผ่าน AA (≥ 4.5:1)", () => {
  const foreground = tokenOf(CSS, "--fg");
  const surfaces: readonly [string, string][] = [
    ["ครีม", tokenOf(CSS, "--bg-cream")],
    ["เทาอ่อน", tokenOf(CSS, "--bg-muted")],
    ["ขาว", "#ffffff"],
    ["แดงอ่อน (แดง 10% บนขาว)", blendOverWhite(tokenOf(CSS, "--brand-red"), 0.1)],
  ];

  for (const [name, surface] of surfaces) {
    const ratio = contrast(foreground, surface);
    assert.ok(ratio >= 4.5, `ข้อความบนพื้น ${name} ต้องผ่าน AA — ได้ ${ratio.toFixed(2)}:1`);
  }
});

test("parse: รับค่า 'white' ที่เพิ่มใหม่ได้ และค่าที่ไม่รู้จักถูกปฏิเสธอย่างเปิดเผย", () => {
  const accepted = { ...createBlock("divider", "b1"), style: { ...DEFAULT_BLOCK_STYLE, background: "white" } };
  const okParsed = parseBlockDocument("home", { page: "home", blocks: [accepted] });

  assert.equal(okParsed.ok, true);
  assert.ok(okParsed.ok);
  assert.equal(okParsed.document.blocks[0]?.style.background, "white", "ค่า 'white' ต้องไม่ถูกตีกลับเป็นค่าเริ่มต้น");

  const bogus = { ...createBlock("divider", "b2"), style: { ...DEFAULT_BLOCK_STYLE, background: "ม่วงนีออน" } };
  const rejected = parseBlockDocument("home", { page: "home", blocks: [bogus] });
  assert.equal(rejected.ok, false, "ค่าที่ไม่รู้จักต้องถูกปฏิเสธ (ไม่ใช่ตัดเงียบ ๆ)");
  assert.ok(!rejected.ok);
  assert.ok(
    rejected.problems.some((problem) => problem.includes("style.background")),
    `ต้องบอกช่องที่ผิด (ได้: ${rejected.problems.join(" · ")})`,
  );
});

test("หน้าจอหลังบ้าน: ตัวเลือกพื้นหลังใช้ค่าที่รวม 'white' ไว้ (ไม่ตกหล่นตอน cast)", () => {
  const builder = sourceOf("features/admin/ui/block-builder.tsx");
  assert.ok(
    builder.includes('"none" | "cream" | "subtle" | "white" | "brand"'),
    "cast ของตัวเลือกพื้นหลังต้องมี white",
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

/**
 * ด่านคอนทราสต์ของ "ข้อความ hero" ซึ่งตอนนี้อยู่ **บนพื้นหน้าเว็บ** (ไม่ทับบนภาพแล้ว)
 *
 * ประวัติย่อ
 * - รอบที่ 21 (ก่อนหน้า): ข้อความทับบนภาพ → ต้องใช้เงา/ออร่าช่วยอ่าน
 *   (คำหลักแดง+ออร่าขาว 4.6:1 · คำรองเหลือง+เงามืด 8.5:1 และเหลืองบนออร่าขาวได้แค่ 1.4:1)
 * - รอบที่ 21 (นี้): การตลาดขอให้ย้ายข้อความลงมาใต้สไลด์ → ข้อความอยู่บนพื้นปกติ
 *   จึงต้องเปลี่ยนสีให้เหมาะกับพื้น และ **ต้องผ่านทั้งโหมดสว่างและโหมดมืด**
 *   (โหมดมืดเป็นกับดัก: แดงเข้ม `--accent-on-yellow` บนพื้นมืดให้แค่ ~1.7:1 → ใช้ไม่ได้)
 *
 * ด่านนี้อ่านค่าจริงจาก `app/globals.css` (ไม่ hardcode สี) → ถ้ามีใครแก้ token จนตกเกณฑ์ จะฟ้องทันที
 * เกณฑ์ WCAG: ตัวอักษรใหญ่ (>= 24px หรือ >= 18.66px ตัวหนา) ต้องได้ ≥ 3:1 · ตัวอักษรปกติ ≥ 4.5:1
 *   - h1 ของ hero = 36px ตัวหนาขึ้นไป → ใช้เกณฑ์ 3:1
 *   - เนื้อหา/คำโปรย/หมายเหตุ = 12–18px → ใช้เกณฑ์ 4.5:1
 */

const MIN_LARGE_TEXT_RATIO = 3;
const MIN_BODY_TEXT_RATIO = 4.5;

type Rgb = readonly [number, number, number];

/** อ่าน token จากข้อความ CSS (คืนค่าแรกที่เจอ) */
function readToken(source: string, name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(source);
  const value = match?.[1]?.trim();
  if (!value) throw new Error(`ไม่พบ token ${name} ใน app/globals.css`);
  return value;
}

/**
 * ตัดบล็อกของธีมมืด (`.dark { … }`) ออกมา
 *
 * ใช้วิธีนับวงเล็บปีกกาเอง เพราะ CSS ไม่ได้ซ้อนกันลึก และ regex แบบง่ายจะพลาดเมื่อมีคอมเมนต์
 */
function readDarkBlock(css: string): string {
  const start = css.indexOf(".dark {");
  if (start < 0) throw new Error("ไม่พบบล็อก .dark ใน app/globals.css");

  let depth = 0;
  for (let index = start; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, index + 1);
    }
  }

  throw new Error("บล็อก .dark ไม่ปิดวงเล็บ");
}

function parseHex(value: string): Rgb {
  assert.match(value, /^#[0-9a-f]{6}$/i, `ต้องเป็น hex 6 หลัก แต่ได้ "${value}"`);
  const raw = value.replace("#", "");
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
}

function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

async function readThemes() {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const dark = readDarkBlock(css);

  /*
    โหมดมืด: token ที่ไม่ได้ประกาศซ้ำในบล็อก .dark จะสืบทอดค่าจาก :root
    (เช่น --brand-red เป็นสีแบรนด์คงที่ทั้งสองโหมด) → จึงต้อง fallback กลับไปที่ค่าต้นทาง
  */
  const resolve = (name: string): string => {
    const inDark = new RegExp(`${name}:\\s*([^;]+);`).exec(dark)?.[1];
    return inDark?.trim() ?? readToken(css, name);
  };

  return {
    light: {
      bg: parseHex(readToken(css, "--bg")),
      brandRed: parseHex(readToken(css, "--brand-red")),
      accent: parseHex(readToken(css, "--accent")),
      fg: parseHex(readToken(css, "--fg")),
      fgMuted: parseHex(readToken(css, "--fg-muted")),
    },
    dark: {
      bg: parseHex(resolve("--bg")),
      brandRed: parseHex(resolve("--brand-red")),
      accent: parseHex(resolve("--accent")),
      fg: parseHex(resolve("--fg")),
      fgMuted: parseHex(resolve("--fg-muted")),
    },
  };
}

test("hero: หัวข้อ (คำหลัก) ต้องผ่านเกณฑ์ตัวอักษรใหญ่ทั้งสองโหมด", async () => {
  const { light, dark } = await readThemes();

  for (const [theme, tokens] of [
    ["โหมดสว่าง", light],
    ["โหมดมืด", dark],
  ] as const) {
    const ratio = contrastRatio(tokens.brandRed, tokens.bg);
    assert.ok(
      ratio >= MIN_LARGE_TEXT_RATIO,
      `${theme}: แดงแบรนด์บนพื้นได้ ${ratio.toFixed(2)}:1 (ต้องการ >= ${MIN_LARGE_TEXT_RATIO})`,
    );
  }
});

test("hero: คำรอง (แดงเข้ม --accent) ต้องผ่านเกณฑ์ตัวอักษรใหญ่ทั้งสองโหมด", async () => {
  const { light, dark } = await readThemes();

  for (const [theme, tokens] of [
    ["โหมดสว่าง", light],
    ["โหมดมืด", dark],
  ] as const) {
    const ratio = contrastRatio(tokens.accent, tokens.bg);
    assert.ok(
      ratio >= MIN_LARGE_TEXT_RATIO,
      `${theme}: แดงเข้ม (--accent) บนพื้นได้ ${ratio.toFixed(2)}:1 (ต้องการ >= ${MIN_LARGE_TEXT_RATIO})`,
    );
  }
});

test("hero: เนื้อหาและคำโปรย ต้องผ่านเกณฑ์ตัวอักษรปกติทั้งสองโหมด", async () => {
  const { light, dark } = await readThemes();

  for (const [theme, tokens] of [
    ["โหมดสว่าง", light],
    ["โหมดมืด", dark],
  ] as const) {
    for (const [name, color] of [
      ["เนื้อหา (--fg)", tokens.fg],
      ["คำโปรย (--fg-muted)", tokens.fgMuted],
    ] as const) {
      const ratio = contrastRatio(color, tokens.bg);
      assert.ok(
        ratio >= MIN_BODY_TEXT_RATIO,
        `${theme}: ${name} บนพื้นได้ ${ratio.toFixed(2)}:1 (ต้องการ >= ${MIN_BODY_TEXT_RATIO})`,
      );
    }
  }
});

test("hero: ห้ามใช้เหลืองแบรนด์กับข้อความบนพื้นหน้าเว็บ (เหลืองจะกลืนหาย)", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const yellow = parseHex(readToken(css, "--brand-yellow"));
  const bgLight = parseHex(readToken(css, "--bg"));
  const ratio = contrastRatio(yellow, bgLight);

  /*
    เทสต์นี้ "ยกเว้น" ให้ค่าที่ควรไม่ผ่าน — ถ้าวันหนึ่งมีคนแก้ token จนเหลืองต่างจากพื้นสว่างพอ
    (ratio ผ่านเกณฑ์) เทสต์จะฟ้องว่า กฎ "ห้ามเหลืองบนพื้นสว่าง" อาจไม่จำเป็นแล้ว
    → ให้กลับมาทบทวน ไม่ใช่แก้ตัวเลขทิ้ง
  */
  assert.ok(
    ratio < MIN_LARGE_TEXT_RATIO,
    `เหลืองบนพื้นสว่างได้ ${ratio.toFixed(2)}:1 ซึ่งผ่านเกณฑ์แล้ว — ทบทวนกฎนี้และคอมเมนต์ใน hero.tsx ใหม่`,
  );
});

test("hero: ข้อความต้องไม่ทับบนภาพอีกแล้ว (การตลาดขอให้ย้ายลงมาใต้สไลด์)", async () => {
  const raw = await readFile(new URL("../features/home/ui/hero.tsx", import.meta.url), "utf8");

  /*
    ⚠️ ต้องตัดคอมเมนต์ก่อนตรวจ — คอมเมนต์อธิบายในไฟล์นั้นเอ่ยชื่อ utility เดิมไว้ (text-shadow-photo ฯลฯ)
    ทำให้เทสต์แดงทั้งที่โค้ดถูก · เจอจริงในรอบที่ 21 (บทเรียนเดียวกับตอนตรวจ CSS ที่มีวงเล็บปีกกาในคอมเมนต์)
  */
  const hero = raw
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");

  // 1) ต้องไม่มี utility เงา/ออร่าที่ใช้กับ "ข้อความบนภาพ" อีก (ถอดออกจาก globals.css แล้ว)
  assert.ok(
    !hero.includes("text-shadow-photo") && !hero.includes("text-glow-soft"),
    "ข้อความ hero อยู่บนพื้นแล้ว จึงต้องไม่ใช้เงา/ออร่าของข้อความบนภาพ",
  );

  // 2) หัวข้อต้องใช้คู่สีที่ผ่านทั้งสองโหมด (แดงแบรนด์ + แดงเข้ม)
  const heading = /<h1 className="([^"]+)"/.exec(hero);
  assert.ok(heading?.[1], "ไม่พบ <h1 className=…> ใน hero.tsx");
  assert.ok(heading[1].includes("text-brand-red"), "คำหลักต้องเป็นแดงแบรนด์");

  const accent = /<span className="([^"]*)">\{m\.titleAccent\}/.exec(hero);
  assert.ok(accent?.[1], "ไม่พบ span ของ m.titleAccent ใน hero.tsx");
  assert.ok(
    accent[1].includes("text-accent"),
    "คำรองต้องใช้ --accent (แดงเข้ม) ไม่ใช่เหลือง เพราะเหลืองบนพื้นสว่างอ่านไม่ออก",
  );

  // 3) แถบภาพต้องไม่มีข้อความอยู่ข้างในแล้ว (ข้อความอยู่ในบล็อกถัดไป)
  const band = /<div className="relative min-h-\[[^\]]+\][^"]*"/.exec(hero);
  assert.ok(band?.[0], "ไม่พบแถบภาพสไลด์ใน hero.tsx");
  assert.ok(
    !/\{m\.title\}/.test(hero.slice(0, hero.indexOf("<h1"))),
    "ข้อความหัวข้อต้องอยู่หลังแถบภาพ ไม่ใช่ข้างใน",
  );
});

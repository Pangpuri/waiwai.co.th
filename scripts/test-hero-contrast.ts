import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

/**
 * ด่านคอนทราสต์ของ "ข้อความที่ทับอยู่บนภาพ" ใน hero หน้าแรก
 *
 * ที่มา (รอบที่ 21): ผู้ใช้เจอปัญหาว่า *"ความอร่อยที่คนไทยไว้วางใจ ในทุกมื้อของวัน — ไม่ว่าสีอะไรก็จม"*
 * แล้วขอให้ล้อมด้วยออร่าแสงขาวฟุ้ง ปรากฏว่า **ออร่าขาวแก้ได้เฉพาะตัวอักษรสีเข้ม**
 * แต่ทำให้ตัวอักษรสีเหลืองจมหนักกว่าเดิม (วัดได้ 1.4:1) จึงต้องใช้คนละ treatment:
 *   - คำหลัก  สีแดงแบรนด์ + ออร่าขาว
 *   - คำรอง   สีเหลืองแบรนด์ + เงามืด
 *
 * ด่านนี้คำนวณ WCAG contrast จาก **ค่าจริงใน app/globals.css** (ไม่ hardcode สี)
 * → ถ้ามีใครแก้ token ของแบรนด์ในอนาคตจนคู่สีที่ใช้จริงตกเกณฑ์ เทสต์จะฟ้องทันที
 * เกณฑ์ที่ใช้: ตัวอักษรขนาดใหญ่ (>= 24px หรือ >= 18.66px ตัวหนา) ต้องได้อย่างน้อย 3:1
 *             — h1 ใน hero เป็น 36px ตัวหนาขึ้นไปทั้งสิ้น
 */

const MIN_LARGE_TEXT_RATIO = 3;

type Rgb = readonly [number, number, number];

/** อ่านค่า token จากไฟล์ CSS ของโปรเจกต์ (ต้องอ่านค่าจริง ไม่คัดลอกมาไว้ในเทสต์) */
function readToken(css: string, name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
  const value = match?.[1]?.trim();
  if (!value) throw new Error(`ไม่พบ token ${name} ใน app/globals.css`);
  return value;
}

function parseHex(value: string): Rgb {
  const trimmed = value.replace("#", "");
  return [
    Number.parseInt(trimmed.slice(0, 2), 16),
    Number.parseInt(trimmed.slice(2, 4), 16),
    Number.parseInt(trimmed.slice(4, 6), 16),
  ];
}

/** `rgb(20 17 12 / 0.82)` → สี + alpha */
function parseRgbFunction(value: string): { readonly rgb: Rgb; readonly alpha: number } {
  const match = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+)\s*)?\)$/.exec(value);
  if (!match) throw new Error(`รูปแบบสีที่อ่านไม่ได้: ${value}`);
  return {
    rgb: [Number(match[1]), Number(match[2]), Number(match[3])],
    alpha: match[4] === undefined ? 1 : Number(match[4]),
  };
}

/** วางสีทึบครึ่งโปร่งทับพื้นหลัง (ใช้หาสีจริงของ "ขอบเงา" บนพื้นสว่างสุด) */
function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [0, 1, 2].map((index) => {
    const f = fg[index] ?? 0;
    const b = bg[index] ?? 0;
    return f * alpha + b * (1 - alpha);
  }) as unknown as Rgb;
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

async function readTokens() {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  const yellowHex = readToken(css, "--brand-yellow");
  const redHex = readToken(css, "--brand-red");
  const onBrandHex = readToken(css, "--on-brand");
  const overlay = parseRgbFunction(readToken(css, "--overlay"));

  // กันเหนียว: ถ้ารูปแบบค่าสีใน globals.css เปลี่ยนไป regex ต้องไม่คืนค่าขยะ
  for (const [name, hex] of [
    ["--brand-yellow", yellowHex],
    ["--brand-red", redHex],
    ["--on-brand", onBrandHex],
  ] as const) {
    assert.match(hex, /^#[0-9a-f]{6}$/i, `${name} ต้องเป็น hex 6 หลัก`);
  }

  return {
    yellow: parseHex(yellowHex),
    red: parseHex(redHex),
    onBrand: parseHex(onBrandHex),
    overlay,
  };
}

test("hero: แดงแบรนด์บนออร่าขาว ต้องผ่านเกณฑ์ตัวอักษรใหญ่", async () => {
  const { red, onBrand } = await readTokens();
  const ratio = contrastRatio(red, onBrand);

  assert.ok(
    ratio >= MIN_LARGE_TEXT_RATIO,
    `แดงบนออร่าขาวได้ ${ratio.toFixed(2)}:1 (ต้องการ >= ${MIN_LARGE_TEXT_RATIO}) — ` +
      "ถ้าแก้ token สีแดง/ขาวนวล ต้องแก้ treatment ของหัวข้อด้วย",
  );
});

test("hero: เหลืองแบรนด์บนเงามืด ต้องผ่านเกณฑ์ตัวอักษรใหญ่", async () => {
  const { yellow, overlay } = await readTokens();

  // เคสหนักสุด: เงามืดวางทับพื้นเหลืองจัด (สีพื้นสว่างที่สุดเท่าที่เป็นไปได้ในเว็บนี้)
  const shadowOverBrightest = composite(overlay.rgb, overlay.alpha, yellow);
  const ratio = contrastRatio(yellow, shadowOverBrightest);

  assert.ok(
    ratio >= MIN_LARGE_TEXT_RATIO,
    `เหลืองบนเงามืดได้ ${ratio.toFixed(2)}:1 (ต้องการ >= ${MIN_LARGE_TEXT_RATIO})`,
  );
});

test("hero: ห้ามใช้ 'ออร่าขาว' กับตัวอักษรเหลือง (เหลืองจะกลืนหาย)", async () => {
  const { yellow, onBrand } = await readTokens();
  const ratio = contrastRatio(yellow, onBrand);

  /*
    เทสต์นี้ "ยกเว้น" ให้ค่าที่ควรไม่ผ่าน — ถ้าวันหนึ่งมีคนแก้ token จนเหลืองต่างจากขาวนวลพอ
    (ratio ผ่านเกณฑ์) เทสต์จะฟ้องว่า กฎ "ห้ามใช้เหลืองกับออร่าขาว" อาจไม่จำเป็นแล้ว
    → ให้กลับมาทบทวน ไม่ใช่แก้ตัวเลขทิ้ง
  */
  assert.ok(
    ratio < MIN_LARGE_TEXT_RATIO,
    `เหลืองบนออร่าขาวได้ ${ratio.toFixed(2)}:1 ซึ่งผ่านเกณฑ์แล้ว — ` +
      "ทบทวนกฎในคอมเมนต์ของ hero.tsx และเทสต์นี้ใหม่อีกครั้ง",
  );
});

test("hero: หัวข้อต้องแยก treatment ตามสี (แดง=ออร่าขาว · เหลือง=เงามืด)", async () => {
  /*
    ล็อกการตัดสินใจที่วัดมาแล้ว (ไม่ใช่แค่เรื่องรสนิยม):
    ถ้ามีใคร "รวบ" ให้หัวข้อใช้ treatment เดียว ตัวอักษรส่วนหนึ่งจะจมอีกครั้ง
  */
  const hero = await readFile(new URL("../features/home/ui/hero.tsx", import.meta.url), "utf8");

  const heading = /<h1 className="([^"]+)"/.exec(hero);
  assert.ok(heading?.[1], "ไม่พบ <h1 className=…> ใน hero.tsx");
  assert.ok(
    heading[1].includes("text-glow-soft"),
    "คำหลักของหัวข้อต้องใช้ออร่าขาว (text-glow-soft)",
  );

  const accent = /<span className="([^"]*)">\{m\.titleAccent\}/.exec(hero);
  assert.ok(accent?.[1], "ไม่พบ span ของ m.titleAccent ใน hero.tsx");
  assert.ok(
    accent[1].includes("text-shadow-photo"),
    "คำรอง (เหลือง) ต้องใช้เงามืด (text-shadow-photo) ไม่ใช่ออร่าขาว",
  );
  assert.ok(accent[1].includes("text-brand-yellow"), "คำรองต้องเป็นเหลืองแบรนด์ตามดีไซน์");
});

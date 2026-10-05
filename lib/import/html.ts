/**
 * ตัวช่วยอ่าน HTML ที่ใช้ร่วมกันทุกตัวนำเข้า (S3 ส่วนที่ 3–4 · รอบที่ 103–104) — **ตรรกะล้วน ไม่มี dependency**
 *
 * ทำไมต้องมีไฟล์กลาง
 * - ตัวนำเข้าสินค้า (รอบที่ 103) และตัวนำเข้าเมนูอาหาร (รอบที่ 104) อ่านเว็บเดิมเดียวกัน (CMS "iGetWeb")
 *   ⇒ ตัวถอด entity / ตัดแท็ก / ยุบช่องว่าง / แปลง href ต้องเป็นชุดเดียวกัน (แก้ที่เดียว)
 * - กฎโปรเจกต์: **ห้ามเพิ่ม dependency โดยไม่ถาม** ⇒ เขียนเอง + ทดสอบด้วย fixture
 */

/** ถอด entity ที่พบบ่อยในเว็บเดิม */
export function decodeEntities(input: string): string {
  const named: Readonly<Record<string, string>> = {
    nbsp: " ",
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    rsquo: "\u2019",
    lsquo: "\u2018",
    ldquo: "\u201C",
    rdquo: "\u201D",
    hellip: "\u2026",
    ndash: "\u2013",
    mdash: "\u2014",
  };

  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return named[body.toLowerCase()] ?? whole;
  });
}

/** ตัดแท็กออกแล้วเหลือข้อความ (ยังไม่ยุบช่องว่าง) */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "));
}

/** ยุบช่องว่างซ้ำ/ตัดหัวท้าย — ใช้กับทุกข้อความที่นำเข้า */
export function normalizeText(value: string): string {
  return value.replace(/[\s\u00A0]+/g, " ").trim();
}

export function textOf(html: string): string {
  return normalizeText(stripTags(html));
}

const THAI = /[\u0E00-\u0E7F]/;
const LATIN = /[A-Za-z]/;

export function hasThai(value: string): boolean {
  return THAI.test(value);
}

export function isLatinOnly(value: string): boolean {
  return LATIN.test(value) && !THAI.test(value);
}

/** แท็กทั้งหมดในเอกสาร (จับคู่แบบไม่ซ้อน — พอสำหรับตารางของเว็บเดิม) */
export function tablesOf(html: string): readonly string[] {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((match) => match[0]);
}

/** แถว/เซลล์ของตาราง (ตัดแท็กให้แล้วไม่ได้ — คืน HTML ของเซลล์) */
export function rowsOf(table: string): readonly (readonly string[])[] {
  return [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...(row[1] ?? "").matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cell[1] ?? ""),
  );
}

export function attributeOf(html: string, name: string): string {
  const match = html.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return decodeEntities(match?.[1] ?? "").trim();
}

/**
 * ทำให้ href เป็น **พาธ** เสมอ (เว็บเดิมมีทั้งแบบ `/th/pages/…` และแบบ URL เต็ม)
 * ⚠️ เราเก็บพาธ ไม่เก็บ URL เต็ม (มติ D9) และทำให้ย้ายโดเมนได้โดยไม่ต้องแก้ข้อมูล
 */
export function pathOfHref(href: string): string {
  const value = href.trim();
  if (value === "") return "";
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

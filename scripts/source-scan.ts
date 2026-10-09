import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ตัวช่วยกลางสำหรับ "ด่านที่สแกนซอร์ส" (รอบที่ 243 — ปิดหนี้ "คอมเมนต์ทำให้ผ่านด่าน")
 *
 * ## หนี้ที่ปิด
 * ด่าน/เทสต์หลายตัวสแกนซอร์สด้วย `readFileSync` + `includes` เพื่อยืนยันว่า **มีโค้ด** บางอย่าง
 * (เช่น "ทุก action ต้องมี `requireAdminUser("content")`") — ถ้าข้อความนั้นอยู่ใน **คอมเมนต์**
 * การสแกนแบบดิบจะ **ผ่านทั้งที่โค้ดไม่มี** = ด่านปลอม
 *
 * เคสจริง (รอบที่ 242): `app/admin/layout.tsx` ผ่านด่านสิทธิ์เพราะคอมเมนต์มีข้อความ
 * `requireAdminUser("<permission>")` อยู่ · พอลบคอมเมนต์นั้นออก ด่านจึงจับได้ว่าขาดของจริง
 *
 * ## ข้อตกลงการใช้
 * - ตรวจ "มีโค้ด X" → ใช้ `codeOf()` **เสมอ** (ต้องมี X ในโค้ดจริง)
 * - ตรวจ "ไม่มี X ที่ไหนเลย รวมคอมเมนต์" (เช่นลบรูปแบบเก่าออกจากทั้งไฟล์) → ใช้ `rawOf()` **โดยเจตนา**
 *   แล้วเขียนคอมเมนต์กำกับว่าทำไมต้องดิบ
 *
 * ⚠️ ไฟล์นี้ **ไม่ขึ้นต้นด้วย `test-`** โดยตั้งใจ — จะได้ไม่ถูกนับเป็นไฟล์เทสต์
 *    (แบบเดียวกับ `scripts/css-source.ts`)
 */

export const REPO_ROOT = join(import.meta.dirname, "..");

/**
 * ตัดคอมเมนต์ออกจากซอร์ส โดย **คงจำนวนบรรทัดเดิม** (คอมเมนต์กลายเป็นช่องว่าง)
 * ⇒ เลขบรรทัดที่รายงาน/ชี้ตำแหน่งยังตรง
 *
 * เข้าใจ 3 อย่างที่การตัดด้วย regex ธรรมดาพลาด:
 * 1. `//` ในสตริง เช่น `"https://…"` **ไม่ใช่คอมเมนต์** (เดิมใช้วิธีเดาจาก `://` → ยังพลาดเคสอื่น)
 * 2. `/* … *​/` ที่คร่อมหลายบรรทัด (คงบรรทัดว่างไว้)
 * 3. `//` ในเทมเพลตสตริง/เครื่องหมายคำพูดเดี่ยว ก็ไม่ใช่คอมเมนต์
 *
 * ไม่ได้ตัดคอมเมนต์ **ใน** regex literal ออก (เขียน regex ที่มี `//` ดิบได้ยากอยู่แล้ว)
 */
export function stripComments(source: string): string {
  const out: string[] = [];
  let quote: '"' | "'" | "`" | null = null;
  let index = 0;

  while (index < source.length) {
    const char = source[index] ?? "";
    const next = source[index + 1] ?? "";

    if (quote === null) {
      /* คอมเมนต์แบบบล็อก → ช่องว่าง (คง \n เพื่อรักษาเลขบรรทัด) */
      if (char === "/" && next === "*") {
        out.push(" ", " ");
        index += 2;
        while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
          out.push(source[index] === "\n" ? "\n" : " ");
          index += 1;
        }
        if (index < source.length) {
          out.push(" ", " ");
          index += 2;
        }
        continue;
      }

      /* คอมเมนต์แบบบรรทัด → ช่องว่างจนจบบรรทัด */
      if (char === "/" && next === "/") {
        while (index < source.length && source[index] !== "\n") {
          out.push(" ");
          index += 1;
        }
        continue;
      }

      if (char === '"' || char === "'" || char === "`") quote = char;
      out.push(char);
      index += 1;
      continue;
    }

    /* อยู่ในสตริง — คัดลอกทั้งก้อน (รวม `\X` และ `//` ที่ไม่ใช่คอมเมนต์) */
    if (char === "\\") {
      out.push(char, next);
      index += 2;
      continue;
    }
    if (char === quote) quote = null;
    out.push(char);
    index += 1;
  }

  return out.join("");
}

/** อ่านไฟล์จากรากโปรเจกต์ (ยังไม่ตัดคอมเมนต์) — ใช้เมื่อต้องตรวจ "ทั้งไฟล์รวมคอมเมนต์" โดยเจตนา */
export function rawOf(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

/** อ่านไฟล์จากรากโปรเจกต์แล้ว **ตัดคอมเมนต์** — ใช้กับการตรวจ "มีโค้ด X" ทุกกรณี */
export function codeOf(relativePath: string): string {
  return stripComments(rawOf(relativePath));
}

import { readFile } from "node:fs/promises";

/**
 * อ่าน `app/globals.css` สำหรับเทสต์ — **ตัดคอมเมนต์ออกก่อนเสมอ**
 *
 * บทเรียนรอบที่ 21: คอมเมนต์อธิบายในไฟล์ CSS มีวงเล็บปีกกาอยู่ในนั้น (เช่น `body { overflow: hidden }`)
 * ทำให้ regex ที่ไล่จับบล็อก `html { … }` ขาดกลางทาง → เทสต์แดงทั้งที่โค้ดถูก
 * (วิธีเดียวกับที่ scripts/check-i18n.ts ตัดคอมเมนต์ก่อนสแกนไฟล์ .tsx)
 *
 * ไฟล์นี้ไม่ขึ้นต้นด้วย `test-` โดยตั้งใจ — จะได้ไม่ถูกนับเป็นไฟล์เทสต์
 */
export async function readStrippedCss(): Promise<string> {
  const raw = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  return raw.replace(/\/\*[\s\S]*?\*\//g, " ");
}

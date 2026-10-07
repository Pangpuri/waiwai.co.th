/**
 * ถังขยะ (X2.4) — **ตรรกะล้วน ทดสอบได้ ไม่มี Next/DB/env**
 *
 * ทำไมต้องมีถังขยะ
 * - ก่อนรอบที่ 78 การ "ลบ" ทุกจุดเป็นการลบถาวรทันที (ภาพในคลัง · พรีเซ็ตบล็อก)
 *   ⇒ ผู้ดูแลที่ไม่ใช่ช่างเทคนิคเผลอกดลบ = ข้อมูลหายถาวร กู้ได้จาก backup ทั้งก้อนเท่านั้น
 * - วิธีของโปรเจกต์นี้คือ **soft delete** เก็บของไว้ `TRASH_RETENTION_DAYS` วัน (30)
 *   แล้วให้ `lib/retention/purge.ts` ลบถาวรตามกำหนด ⇒ ต้องมีนโยบาย "กี่วัน/เมื่อไรหมดอายุ"
 *   ที่ทดสอบได้โดยไม่ต้องมีฐานข้อมูล
 *
 * ⚠️ ชื่อตาราง/คอลัมน์อยู่ที่ `lib/trash/repository.ts` — ที่นี่เป็นแค่ "กติกา"
 */

import { TRASH_RETENTION_DAYS, MS_PER_DAY, trashCutoffFor } from "@/lib/retention/plan";

/** ชนิดของที่อยู่ในถัง — เพิ่มชนิดใหม่ต้องอัปเดตทุกที่ที่ผูกกับค่านี้ (type บังคับให้รู้ตัว) */
export const TRASH_KINDS = ["media", "preset", "chromePreset"] as const;

export type TrashKind = (typeof TRASH_KINDS)[number];

/** ชื่อ action ใน audit log ของงานถังขยะ (ใช้ทั้งตอนย้ายเข้า/กู้คืน/ลบถาวร/ลบตามกำหนด) */
export const TRASH_AUDIT_ACTIONS = {
  /** ย้ายเข้าถังขยะ */
  move: "trash-move",
  /** กู้คืนจากถัง */
  restore: "trash-restore",
  /** ลบถาวรด้วยมือ (ผู้ดูแลกดเอง) */
  permanent: "trash-delete",
  /** ลบถาวรอัตโนมัติเมื่อพ้นระยะเก็บ */
  purge: "trash-purge",
} as const;

/** target ของ audit log (ใช้ค่าเดียวทั้งชนิด — ชนิดจริงอยู่ใน `target` เช่น `media:<id>`) */
export const TRASH_AUDIT_TARGET = "trash";

/**
 * จำนวนชนิดของที่อยู่ในถัง (นับเป็น 0 ทุกชนิด)
 * ⚠️ เขียนเป็นรายการตรง ๆ โดยเจตนา — เพิ่มชนิดใหม่ใน  แล้ว type จะฟ้องที่นี่ทันที
 *    (ดีกว่าวนสร้างจากอาร์เรย์แล้วลืมอัปเดตหน้าจอ)
 */
export function emptyTrashCounts(): Record<TrashKind, number> {
  return { media: 0, preset: 0, chromePreset: 0 };
}

export function isTrashKind(value: string): value is TrashKind {
  return (TRASH_KINDS as readonly string[]).includes(value);
}

/**
 * อีกกี่วันจะถูกลบถาวร (ปัดขึ้น — "เหลือ 1 วัน" หมายถึงยังกู้คืนได้ในวันนี้)
 * คืน `null` ถ้าอ่านวันที่ไม่ได้ (ไม่เดา) · คืน 0 ถ้าหมดอายุแล้ว
 */
export function daysLeftInTrash(deletedAtIso: string | null, now: Date): number | null {
  if (deletedAtIso === null || deletedAtIso.trim() === "") return null;

  const deletedAt = new Date(deletedAtIso);
  if (Number.isNaN(deletedAt.getTime())) return null;

  const remaining = deletedAt.getTime() - trashCutoffFor(now).getTime();
  if (remaining <= 0) return 0;

  return Math.ceil(remaining / MS_PER_DAY);
}

/**
 * หมดอายุหรือยัง — ใช้ **"เก่ากว่าจุดตัดเท่านั้น"** เหมือน `isExpired` ของชั้นข้อมูลอื่น
 * (ของที่เพิ่งลบ = ยังอยู่ครบ แม้เวลาจะพอดีจุดตัด)
 * ⚠️ ค่าที่อ่านไม่ได้ = `false` (ไม่ลบ) — ปลอดภัยกว่าสำหรับถังขยะ เพราะกู้คืนได้เสมอ
 */
export function isTrashExpired(deletedAtIso: string | null, now: Date): boolean {
  if (deletedAtIso === null || deletedAtIso.trim() === "") return false;

  const deletedAt = new Date(deletedAtIso);
  if (Number.isNaN(deletedAt.getTime())) return false;

  return deletedAt.getTime() < trashCutoffFor(now).getTime();
}

/** ยอดรวมของทุกชนิด */
export function trashTotal(counts: Readonly<Record<TrashKind, number>>): number {
  return TRASH_KINDS.reduce((sum, kind) => sum + counts[kind], 0);
}

/** สรุปผลเป็นข้อความสั้น ๆ สำหรับ `detail` ของ audit log (รูปแบบเดียวกับ summarizePurge) */
export function summarizeTrash(counts: Readonly<Record<TrashKind, number>>): string {
  return TRASH_KINDS.map((kind) => `${kind}=${counts[kind]}`).join(" ");
}

/** ข้อความบอกระยะเก็บของถังขยะเป็น "รหัส" — หน้าจอแปลจากพจนานุกรมพร้อมตัวเลขจากค่ากลาง */
export function trashRetentionDays(): number {
  return TRASH_RETENTION_DAYS;
}

/* ── ถังขยะ "เนื้อหา" (รอบที่ 170) — สินค้า/เมนูอาหาร/ข่าว ─────────────────────────
 *
 * แยกจาก `TRASH_KINDS` ข้างบนโดยเจตนา:
 * - `TRASH_KINDS` = ของที่จัดการรวมที่ `/admin/trash` (ภาพในคลัง · พรีเซ็ตบล็อก · พรีเซ็ตส่วนกลาง)
 * - `CONTENT_TRASH_KINDS` = สินค้า/เมนู/ข่าว ที่มี **แท็บถังขยะของตัวเอง** ในหน้าจอของแต่ละชนิด
 *   (กู้คืน/ลบถาวรอยู่ที่นั่น) — ที่นี่มีไว้เพื่อให้ **ตัวลบอัตโนมัติ** รู้จักและลบถาวรเมื่อพ้นกำหนด
 *   เดิมของ 3 ชนิดนี้ค้างในถังตลอดไป (ไม่มีตัวลบ) ⇒ ปิดหนี้รอบที่ 170
 * ⚠️ ใช้ระยะเก็บเดียวกัน (`TRASH_RETENTION_DAYS`) และไม่ขึ้นหน้า /privacy (ไม่ใช่ข้อมูลส่วนบุคคล)
 */

export const CONTENT_TRASH_KINDS = ["product", "recipe", "news"] as const;

export type ContentTrashKind = (typeof CONTENT_TRASH_KINDS)[number];

/** จำนวนเนื้อหาในถังแยกชนิด (นับเป็น 0 ทุกชนิด) — เขียนตรง ๆ ให้ type ฟ้องเมื่อเพิ่มชนิดใหม่ */
export function emptyContentTrashCounts(): Record<ContentTrashKind, number> {
  return { product: 0, recipe: 0, news: 0 };
}

export function contentTrashTotal(counts: Readonly<Record<ContentTrashKind, number>>): number {
  return CONTENT_TRASH_KINDS.reduce((sum, kind) => sum + counts[kind], 0);
}

/** สรุปผลเป็นข้อความสั้น ๆ สำหรับ `detail` ของ audit log (รูปแบบเดียวกับ summarizeTrash) */
export function summarizeContentTrash(counts: Readonly<Record<ContentTrashKind, number>>): string {
  return CONTENT_TRASH_KINDS.map((kind) => `${kind}=${counts[kind]}`).join(" ");
}

/**
 * หน้าจอที่ "กู้คืน/ลบถาวร" ของในถังของแต่ละชนิดเนื้อหา (รอบที่ 175)
 *
 * ทำไมต้องเป็นค่ากลางตัวเดียว
 * - การ์ดถังขยะบน `/admin` + หน้าถังขยะ ต้อง **ลิงก์ไปที่เดียวกันเสมอ**
 *   ถ้าพิมพ์พาธซ้ำสองที่ วันหนึ่งมีคนเปลี่ยนชื่อแท็บแล้วลิงก์เสียโดยไม่มีใครรู้
 *   (มีเทสต์สแกนว่าพาธนี้ตรงกับแท็บจริงของหน้าจอนั้น)
 * - ⚠️ **เจตนาเดิมจากรอบที่ 170 ยังอยู่:** เนื้อหาไม่มีหน้า "ถังขยะกลาง" —
 *   ของแต่ละชนิดกู้คืน/ลบถาวรใน **แท็บ `trash` ของหน้าจอนั้น** (ที่เห็นบริบทของข้อมูลครบกว่า)
 */
export const CONTENT_TRASH_SCREENS: Readonly<Record<ContentTrashKind, string>> = {
  product: "/admin/products?tab=trash",
  recipe: "/admin/recipes?tab=trash",
  news: "/admin/news?tab=trash",
};

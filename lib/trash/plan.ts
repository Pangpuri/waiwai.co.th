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
export const TRASH_KINDS = ["media", "preset"] as const;

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

/** จำนวนชนิดของที่อยู่ในถัง (นับเป็น 0 ทุกชนิด) */
export function emptyTrashCounts(): Record<TrashKind, number> {
  return { media: 0, preset: 0 };
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

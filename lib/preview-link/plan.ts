/**
 * ลิงก์พรีวิวชั่วคราว (X2.6) — **ตรรกะล้วน ทดสอบได้ ไม่มี Next/DB/env**
 *
 * ทำไมต้องมี
 * - ผู้จัดการ/ฝ่ายการตลาดต้อง **ดูงานที่ยังไม่เผยแพร่** ได้ แต่ไม่ควรมีบัญชีหลังบ้าน (มติ D4: บัญชีน้อยที่สุด)
 * - ทางออกคือ "ลิงก์อายุสั้น" ที่ผู้ดูแลสร้างและส่งให้เป็นรายครั้ง ⇒ ต้องมีนโยบายที่ชัดและทดสอบได้ว่า
 *   อะไรคือโทเคนที่ถูกรูปแบบ · หมดอายุเมื่อไร · เก็บกวาดเมื่อไร
 *
 * ⚠️ ไฟล์นี้เป็น "นโยบาย" เท่านั้น — การเขียน/อ่านฐานข้อมูลอยู่ที่ `lib/preview-link/repository.ts`
 */

import { MS_PER_DAY } from "@/lib/retention/plan";

/**
 * อายุของลิงก์พรีวิว = **24 ชั่วโมง** (สั้นโดยเจตนา)
 * เหตุผล: ลิงก์นี้ไม่ต้องล็อกอิน ⇒ ยิ่งอยู่นานยิ่งเสี่ยงถ้าถูกส่งต่อ · งานพรีวิวปกติจบในวันเดียว
 * ⚠️ ถ้าต้องการยาวขึ้นให้แก้ **ที่นี่ที่เดียว** (มีเทสต์กันไม่ให้พิมพ์ซ้ำที่อื่น)
 */
export const PREVIEW_LINK_TTL_HOURS = 24;

/**
 * จำนวนลิงก์ที่ยังใช้ได้สูงสุดต่อหนึ่งหน้า
 * เหตุผล: กันโตไม่จำกัดจากกดซ้ำ/ลืมปิด · เกินแล้วให้ผู้ดูแลยกเลิกลิงก์เก่าก่อน (ข้อความบอกบนหน้าจอ)
 */
export const PREVIEW_LINK_MAX_ACTIVE = 20;

/**
 * เก็บกวาดลิงก์ที่หมดอายุ/ถูกยกเลิกแล้วหลังพ้นกำหนดนี้ = **30 วัน**
 * (ร่องรอยของเจ้าหน้าที่ — เก็บไว้อ่านย้อนหลังระยะหนึ่งแล้วลบ ไม่ใช่ข้อมูลสาธารณะของคนนอก)
 */
export const PREVIEW_LINK_KEEP_DAYS = 30;

/** โทเคน = 32 ไบต์สุ่ม เข้ารหัส base64url ⇒ 43 ตัวอักษร (เดาไม่ได้ในทางปฏิบัติ) */
export const PREVIEW_TOKEN_BYTES = 32;
export const PREVIEW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** จำนวนครั้งที่ใช้ได้สูงสุดต่อลิงก์? — ไม่จำกัดโดยเจตนา (ผู้จัดการอาจเปิดซ้ำหลายรอบ) แต่ *นับ* ไว้ดู */

export const PREVIEW_LINK_AUDIT_ACTIONS = {
  create: "preview-link-create",
  revoke: "preview-link-revoke",
  purge: "preview-link-purge",
} as const;

export const PREVIEW_LINK_AUDIT_TARGET = "preview-link";

/** ตรวจ "รูปทรง" ของโทเคนก่อนแตะฐานข้อมูล — ค่าขยะไม่ควรทำให้เกิดคิวรี */
export function isPreviewTokenShape(value: string): boolean {
  return PREVIEW_TOKEN_PATTERN.test(value);
}

/** path สาธารณะของลิงก์พรีวิว (ผู้จัดการเปิดอันนี้) — อยู่ใต้ `/[lang]` จึงได้หัวเว็บ/ท้ายเว็บจริง */
export function previewLinkPath(locale: string, token: string): string {
  return `/${locale}/preview/t/${token}`;
}

/** เวลาหมดอายุของลิงก์ที่สร้างตอน `now` */
export function previewLinkExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + PREVIEW_LINK_TTL_HOURS * 60 * 60 * 1000);
}

/**
 * หมดอายุหรือยัง — ใช้ขอบเขต **"ถึงเวลาแล้ว = หมดอายุ"** (`<=`)
 * ต่างจากระยะเก็บข้อมูล (ที่ใช้ `<`) เพราะลิงก์เป็นสิทธิ์เข้าถึง ⇒ พอครบเวลาต้องปิดทันที
 */
export function isPreviewLinkExpired(expiresAtIso: string | null, now: Date): boolean {
  if (expiresAtIso === null || expiresAtIso.trim() === "") return true;
  const expiresAt = new Date(expiresAtIso);
  if (Number.isNaN(expiresAt.getTime())) return true;
  return expiresAt.getTime() <= now.getTime();
}

/** เวลาที่ควรเก็บกวาดลิงก์นี้ (หมดอายุ/ยกเลิกแล้ว + PREVIEW_LINK_KEEP_DAYS) */
export function previewLinkCleanupCutoff(now: Date): Date {
  return new Date(now.getTime() - PREVIEW_LINK_KEEP_DAYS * MS_PER_DAY);
}

export type PreviewLinkStatus = "active" | "expired" | "revoked";

/** สถานะที่ผู้ดูแลเห็นบนหน้าจอ (ยกเลิกมาก่อนหมดอายุเสมอ — บอกความจริงว่าปิดเพราะอะไร) */
export function previewLinkStatus(
  link: { readonly expiresAt: string; readonly revokedAt: string | null },
  now: Date,
): PreviewLinkStatus {
  if (link.revokedAt !== null && link.revokedAt.trim() !== "") return "revoked";
  return isPreviewLinkExpired(link.expiresAt, now) ? "expired" : "active";
}

/** อีกกี่ชั่วโมงจะหมดอายุ (ปัดขึ้น · คืน 0 ถ้าหมดแล้ว) */
export function hoursLeftInPreviewLink(expiresAtIso: string, now: Date): number {
  const expiresAt = new Date(expiresAtIso);
  if (Number.isNaN(expiresAt.getTime())) return 0;

  const remaining = expiresAt.getTime() - now.getTime();
  if (remaining <= 0) return 0;

  return Math.ceil(remaining / (60 * 60 * 1000));
}

/** หน้านี้ยังสร้างลิงก์เพิ่มได้ไหม (นับเฉพาะลิงก์ที่ยังใช้ได้) */
export function canCreateMoreLinks(activeCount: number): boolean {
  return activeCount < PREVIEW_LINK_MAX_ACTIVE;
}

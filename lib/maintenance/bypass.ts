import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * "บัตรผ่านชั่วคราว" สำหรับดูเว็บจริงระหว่างเปิดโหมดปิดปรับปรุง (X2.5 ต่อ · รอบที่ 96)
 *
 * ## ปัญหาที่ปิด
 * รอบที่ 95 ทำให้เซสชันหลังบ้าน "เพิกถอนได้" แต่ **proxy อ่านฐานข้อมูลไม่ได้**
 * (เอกสาร Next รุ่นที่ติดตั้งจริงห้ามไว้ + มีเทสต์สแกนซอร์สกันการเผลอ import DB)
 * ⇒ proxy จึงตรวจได้แค่ "ลายเซ็นคุกกี้ยังถูก + ยังไม่หมดอายุ" ทำให้เซสชันที่ถูกเพิกถอน
 *    **ยังบายพาสโหมดปิดปรับปรุงได้จนคุกกี้หมดอายุ (≤8 ชม.)**
 *
 * ## ทางออก: แยก "บัตรผ่าน" ออกจากคุกกี้เซสชัน แล้วให้อายุสั้นมาก
 * - proxy ตรวจแค่บัตรผ่าน (ลายเซ็น + อายุ ≤ 15 นาที) — ยังไม่มี I/O ตามเดิม
 * - บัตรผ่านถูกออก/ต่ออายุโดย **ตัวที่มีฐานข้อมูลเท่านั้น** (`/admin/bypass` → `getSessionUser()`)
 *   ⇒ เซสชันที่ถูกเพิกถอน/บัญชีที่ถูกปิด = ต่ออายุไม่ได้ ⇒ บัตรผ่านเก่าตายภายใน ≤ 15 นาที (เดิม 8 ชม.)
 * - ออกจากระบบ = ลบบัตรผ่านทิ้งทันที
 *
 * ⚠️ สิ่งที่ยังเหลือ (บันทึกไว้ตรง ๆ): ช่วงทับซ้อนสูงสุด ~15 นาทีหลังเพิกถอน ยังดูเว็บที่ปิดอยู่ได้
 *    (เป็นการ "ดู" เท่านั้น — การแก้เนื้อหายังต้องผ่าน `/admin` ที่ตรวจฐานข้อมูลทุกคำขอ)
 *    ยอมรับได้เพราะลดจาก 8 ชั่วโมงเหลือ 15 นาที และแลกกับการไม่ให้ proxy แตะ DB
 */

export const MAINTENANCE_BYPASS_COOKIE = "waiwai_maint_bypass";

/** อายุบัตรผ่าน (15 นาที) — สั้นพอให้เพิกถอนแล้ว "ตายเร็ว" แต่ยาวพอให้เปิดดูหลายหน้าได้ */
export const MAINTENANCE_BYPASS_TTL_MS = 15 * 60 * 1000;

/** ต่ออายุเมื่อเหลืออายุน้อยกว่านี้ (5 นาที) — กันต่ออายุถี่เกินไป */
export const MAINTENANCE_BYPASS_REFRESH_MS = 5 * 60 * 1000;

/** ข้อมูลในบัตรผ่าน — เก็บน้อยที่สุด (ไม่ใส่ชื่อ/อีเมล/รหัสเซสชัน) */
export type MaintenanceBypassPayload = {
  /** เวลาหมดอายุ (epoch ms) */
  readonly expiresAt: number;
};

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function readPayload(decoded: string): MaintenanceBypassPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const candidate = parsed as { expiresAt?: unknown };
  if (typeof candidate.expiresAt !== "number" || !Number.isFinite(candidate.expiresAt)) return null;
  return { expiresAt: candidate.expiresAt };
}

/** สร้างบัตรผ่าน (เรียกจากฝั่งที่มีฐานข้อมูลเท่านั้น) */
export function createMaintenanceBypassToken(expiresAt: number, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ expiresAt }), "utf8").toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * ตรวจบัตรผ่าน — คืน payload เมื่อลายเซ็นถูกและยังไม่หมดอายุ · คืน `null` ทุกกรณีอื่น
 * (ไม่แยกว่า "ลายเซ็นผิด" หรือ "หมดอายุ" — เหมือนคุกกี้เซสชัน)
 */
export function parseMaintenanceBypassToken(
  token: string,
  secret: string,
  now: number,
): MaintenanceBypassPayload | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payloadPart = token.slice(0, separator);
  const signaturePart = token.slice(separator + 1);

  const expected = Buffer.from(sign(payloadPart, secret), "utf8");
  const received = Buffer.from(signaturePart, "utf8");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  const payload = readPayload(Buffer.from(payloadPart, "base64url").toString("utf8"));
  if (payload === null) return null;
  if (payload.expiresAt <= now) return null;

  return payload;
}

/** ควรต่ออายุบัตรผ่านไหม (ไม่มี/ใกล้หมดอายุ = ต่อ) */
export function shouldRefreshMaintenanceBypass(expiresAt: number | null, now: number): boolean {
  if (expiresAt === null || !Number.isFinite(expiresAt)) return true;
  return expiresAt - now < MAINTENANCE_BYPASS_REFRESH_MS;
}

/** หมดอายุของบัตรผ่านใบใหม่ */
export function nextMaintenanceBypassExpiry(now: number): number {
  return now + MAINTENANCE_BYPASS_TTL_MS;
}

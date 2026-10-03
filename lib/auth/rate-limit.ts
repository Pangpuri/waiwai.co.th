/**
 * ตรรกะ "จำกัดการพยายามล็อกอิน" (X2.1) — **บริสุทธิ์ ทดสอบได้ ไม่ต้องมี DB**
 *
 * กติกาที่เลือก (อธิบายให้ผู้ใช้เข้าใจได้)
 * - ล็อกอิน **ผิด** ติดกัน 5 ครั้ง ⇒ ล็อก 15 นาที (นับเฉพาะ "ล้มเหลว" หลังความสำเร็จครั้งล่าสุด)
 * - **ล็อกอินสำเร็จ = ล้างประวัติ** (คนที่ลืมรหัสแล้วจำได้ ไม่ต้องรอ)
 * - ความล้มเหลวที่ **เก่ากว่าช่วงเวลาที่นับ (15 นาที)** ไม่ถูกนำมาคิด ⇒ ไม่ล็อกยาวขึ้นเรื่อย ๆ จากอดีตเก่า
 *
 * ⚠️ ข้อควรรู้ด้านความปลอดภัย: ล็อกตาม "อีเมลที่พยายาม" ทุกอีเมล (ไม่ว่ามีในระบบหรือไม่)
 *    ⇒ ข้อความ "ถูกล็อก" ไม่ได้บอกใบ้ว่าอีเมลไหนมีบัญชีอยู่จริง
 */

export const MAX_FAILURES = 5;
/** ช่วงเวลาที่นับความล้มเหลว (15 นาที) */
export const FAILURE_WINDOW_MS = 15 * 60 * 1000;
/** ระยะเวลาล็อก (15 นาที) */
export const LOCKOUT_MS = 15 * 60 * 1000;

export type LoginAttempt = {
  /** เวลาที่พยายาม (epoch ms) */
  readonly at: number;
  readonly succeeded: boolean;
};

export type RateLimitState = {
  readonly locked: boolean;
  /** ล็อกอยู่ = อีกกี่มิลลิวินาทีจึงลองใหม่ได้ (0 = ไม่ล็อก) */
  readonly retryAfterMs: number;
  /** จำนวนความล้มเหลวที่นับ (ไว้แสดง/บันทึก) */
  readonly failures: number;
};

export function evaluateAttempts(attempts: readonly LoginAttempt[], now: number): RateLimitState {
  /* เรียงจากใหม่ → เก่า แล้วดู "ตั้งแต่ความสำเร็จครั้งล่าสุด" */
  const ordered = [...attempts].sort((left, right) => right.at - left.at);
  const sinceSuccess: LoginAttempt[] = [];
  for (const attempt of ordered) {
    if (attempt.succeeded) break;
    sinceSuccess.push(attempt);
  }

  const failures = sinceSuccess.filter((attempt) => now - attempt.at <= FAILURE_WINDOW_MS);

  if (failures.length < MAX_FAILURES) {
    return { locked: false, retryAfterMs: 0, failures: failures.length };
  }

  const latest = failures.reduce((newest, attempt) => Math.max(newest, attempt.at), 0);
  const retryAfterMs = Math.max(0, latest + LOCKOUT_MS - now);

  return { locked: retryAfterMs > 0, retryAfterMs, failures: failures.length };
}

/** ข้อความจำนวนนาทีที่ต้องรอ (ปัดขึ้นขั้นต่ำ 1 นาที — ไม่ให้ขึ้น "0 นาที") */
export function retryAfterMinutes(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 60_000));
}

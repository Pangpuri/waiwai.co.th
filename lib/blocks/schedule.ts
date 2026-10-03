/**
 * "ตั้งเวลาเผยแพร่หน้าเว็บ" (X2.7 ส่วนที่ 1 · รอบที่ 100) — **ตรรกะล้วน**
 * ไม่มี DB · ไม่มี Next · ไม่มี env ⇒ ทดสอบได้ด้วย `node --test` ตรง ๆ
 *
 * บริบท
 * - เดิม "เผยแพร่" ทำได้แค่ตอนมีคนกดเอง ⇒ งานที่ต้องออกพร้อมกัน (เช่น 09:00 หรือเที่ยงคืน)
 *   ต้องมีคนนั่งเฝ้าหน้าจอ
 * - รอบนี้ให้ตั้ง "เวลาที่จะเผยแพร่" ไว้ล่วงหน้าได้ · ตัวเผยแพร่ตามกำหนดอยู่ที่
 *   `lib/blocks/publish-scheduler.ts` (แตะ DB) และหน้าจอหลังบ้านเป็นคนตั้งค่า
 *
 * ⚠️ เวลาที่เก็บคือ **timestamptz (UTC)** เสมอ — ฝั่งเบราว์เซอร์แปลง "เวลาท้องถิ่น" ของผู้ใช้
 *    เป็น epoch ms ก่อนส่ง (ดู `features/admin/ui/block-builder.tsx`) ⇒ ตรรกะนี้ไม่ต้องรู้จักเขตเวลาเลย
 * ⚠️ ไฟล์นี้เป็นตัวตัดสิน "ค่าที่รับมาใช้ได้ไหม" เท่านั้น — ไม่เขียนอะไรลงฐานข้อมูล
 */

/** ระยะเวลาที่ยอมให้ตั้ง "ย้อนหลังเล็กน้อย" — กันปัญหาช่อง `datetime-local` ปัดวินาที/นาทีทิ้ง */
export const SCHEDULE_PAST_GRACE_MS = 60 * 1000;

/** ไกลสุดที่ยอมให้ตั้งล่วงหน้า (วัน) — กันพิมพ์ปีผิด เช่น 2062 แล้วกำหนดค้างไปตลอด */
export const SCHEDULE_MAX_AHEAD_DAYS = 365;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * เหตุผลที่ค่าที่ส่งมาใช้ไม่ได้ (รหัสเท่านั้น — ข้อความที่ผู้ใช้เห็นอยู่ในพจนานุกรม)
 * ⚠️ หน้าจอแมปครบทุกกรณีด้วย `switch` แบบ exhaustive ⇒ เพิ่มรหัสใหม่แล้วลืมแปล = compile error
 */
export type ScheduleProblem = "missing" | "invalid" | "past" | "too-far";

export type ScheduleParseResult =
  | { readonly ok: true; readonly at: Date }
  | { readonly ok: false; readonly problem: ScheduleProblem };

function fail(problem: ScheduleProblem): ScheduleParseResult {
  return { ok: false, problem };
}

/**
 * ตรวจ "ค่าเวลาที่ส่งมาจากฟอร์ม" (epoch ms เป็นสตริง)
 *
 * - ว่าง/ไม่ใช่สตริง → `missing`
 * - ไม่ใช่จำนวนเต็มบวกที่อ่านได้ → `invalid`
 * - เก่ากว่า `now` เกิน `SCHEDULE_PAST_GRACE_MS` → `past` (เผยแพร่ย้อนหลังไม่มีความหมาย และน่าจะพิมพ์ผิด)
 * - ไกลกว่า `SCHEDULE_MAX_AHEAD_DAYS` → `too-far`
 */
export function parseScheduleEpoch(raw: unknown, now: Date): ScheduleParseResult {
  if (typeof raw !== "string") return fail("missing");

  const text = raw.trim();
  if (text === "") return fail("missing");

  /* รับเฉพาะสตริงตัวเลข (ไม่ใช้ Number() ตรง ๆ เพราะ "" → 0 และ "1e9" → ผ่านทั้งที่ไม่ใช่ epoch ที่ตั้งใจ) */
  if (!/^\d+$/.test(text)) return fail("invalid");

  const ms = Number(text);
  if (!Number.isSafeInteger(ms) || ms <= 0) return fail("invalid");

  const at = new Date(ms);
  if (Number.isNaN(at.getTime())) return fail("invalid");

  const nowMs = now.getTime();
  if (at.getTime() < nowMs - SCHEDULE_PAST_GRACE_MS) return fail("past");
  if (at.getTime() > nowMs + SCHEDULE_MAX_AHEAD_DAYS * MS_PER_DAY) return fail("too-far");

  return { ok: true, at };
}

/**
 * ถึงกำหนดเผยแพร่หรือยัง (ใช้แสดงผล/ตัดสินบนหน้าจอ)
 * ค่าที่อ่านไม่ได้ = **ไม่ครบกำหนด** (ปลอดภัยกว่า: ไม่เผยแพร่เพราะข้อมูลเพี้ยน)
 */
export function isDueAt(value: Date | string, now: Date): boolean {
  const at = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(at.getTime())) return false;
  return at.getTime() <= now.getTime();
}

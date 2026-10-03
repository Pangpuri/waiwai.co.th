/**
 * "ระยะเวลาเก็บข้อมูลส่วนบุคคล" (X2b) — **ตรรกะล้วน ทดสอบได้ ไม่มี Next/DB/env**
 *
 * ทำไมต้องมี
 * - ฟอร์มหน้าเว็บเก็บชื่อ/อีเมล/เบอร์/ข้อความ (+ เรซูเม่) และตารางร่องรอยการใช้งานเก็บอีเมลผู้ดูแล
 *   ⇒ ทั้งหมดเป็น **ข้อมูลส่วนบุคคล** (PDPA) ต้องมีกำหนดระยะเวลาเก็บและต้องลบจริงเมื่อครบ
 * - ระยะเวลาที่ **ตัวลบ** ใช้ กับที่ **หน้า `/privacy` ประกาศ** ต้องเป็นค่าเดียวกัน
 *   ⇒ รวมไว้ที่ไฟล์นี้ที่เดียว (ถ้าแก้ตัวเลข เอกสารสาธารณะก็เปลี่ยนตาม — ไม่มีทางหลุดจากกัน)
 *
 * มติผู้ใช้ 2026-10-03 (รอบที่ 74)
 *   ติดต่อ/ข่าวสาร 1 ปี (365 วัน) · ใบสมัครงาน 6 เดือน (180 วัน)
 *   · พยายามล็อกอินหลังบ้าน 30 วัน · บันทึกการแก้ไขเนื้อหา 90 วัน (มติ Q16 เดิม)
 *
 * ⚠️ ไฟล์นี้เป็น "นโยบาย" เท่านั้น — การอ่าน/ลบจริงอยู่ที่ `lib/retention/purge.ts`
 */

/** จำนวนวันที่เก็บของแต่ละชั้นข้อมูล (หน่วย: วัน) */
export const RETENTION_DAYS = {
  /** ข้อความจากฟอร์มติดต่อ */
  contact: 365,
  /** อีเมลจากฟอร์มรับข่าวสาร */
  newsletter: 365,
  /** ใบสมัครงาน + ไฟล์เรซูเม่ (ไฟล์ถูกลบตามแถวแม่ด้วย `on delete cascade`) */
  careers: 180,
  /** ร่องรอยการพยายามล็อกอินหลังบ้าน (ใช้คำนวณ rate limit) */
  loginAttempt: 30,
  /** บันทึกว่าผู้ดูแลทำอะไร (audit log) */
  auditLog: 90,
} as const;

export type RetentionClass = keyof typeof RETENTION_DAYS;

/** ลำดับที่ใช้ทั้งในหน้าจอและรายงาน — เรียงจาก "ข้อมูลบุคคลทั่วไป" ไป "ร่องรอยของเจ้าหน้าที่" */
export const RETENTION_CLASSES: readonly RetentionClass[] = [
  "contact",
  "newsletter",
  "careers",
  "loginAttempt",
  "auditLog",
];

/** ชั้นข้อมูลที่มาจากฟอร์มหน้าเว็บ (ตาราง `form_submission`) */
export const FORM_RETENTION_CLASSES: readonly RetentionClass[] = ["contact", "newsletter", "careers"];

/** ชั้นข้อมูลที่เป็นร่องรอยการใช้งาน (เฉพาะเจ้าหน้าที่) */
export const LOG_RETENTION_CLASSES: readonly RetentionClass[] = ["loginAttempt", "auditLog"];

/** ชื่อ action ใน audit log ที่ใช้บันทึกว่า "รอบนี้ลบไปเท่าไร" (และใช้เช็คว่าถึงรอบลบถัดไปหรือยัง) */
export const PURGE_AUDIT_ACTION = "retention-purge";

/** ตรวจซ้ำไม่ถี่กว่านี้ เมื่อลบแบบ "ตามรอบ" (ผู้ดูแลยังกดลบเองได้เสมอ) */
export const LAZY_PURGE_INTERVAL_HOURS = 24;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type PurgeStep = {
  readonly cls: RetentionClass;
  readonly days: number;
  /** เวลาตัด (ISO) — แถวที่เก่ากว่านี้ถูกลบ */
  readonly cutoffIso: string;
};

/** จำนวนวันของชั้นข้อมูล — โยน error ถ้าค่าคงที่ถูกแก้เป็นค่าที่ไม่มีความหมาย (กันลบผิดพลาด) */
export function retentionDaysFor(cls: RetentionClass): number {
  const days = RETENTION_DAYS[cls];
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`retention days of "${cls}" must be a positive integer (got ${String(days)})`);
  }
  return days;
}

/** เวลาตัดของชั้นข้อมูล (แถวที่ `created_at` เก่ากว่านี้ = หมดอายุ) */
export function cutoffFor(cls: RetentionClass, now: Date): Date {
  return new Date(now.getTime() - retentionDaysFor(cls) * MS_PER_DAY);
}

export function cutoffIsoFor(cls: RetentionClass, now: Date): string {
  return cutoffFor(cls, now).toISOString();
}

export function isExpired(createdAt: Date | string, cls: RetentionClass, now: Date): boolean {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return created.getTime() < cutoffFor(cls, now).getTime();
}

/**
 * แผนลบของรอบนี้ — ทุกชั้นข้อมูลพร้อมเวลาตัด
 * คืนเป็นข้อมูลล้วน ⇒ เอาไปแสดงบนหน้าจอ/เขียนเทสต์ได้โดยไม่ต้องมี DB
 */
export function planPurge(now: Date): readonly PurgeStep[] {
  return RETENTION_CLASSES.map((cls) => ({
    cls,
    days: retentionDaysFor(cls),
    cutoffIso: cutoffIsoFor(cls, now),
  }));
}

/**
 * ถึงรอบลบหรือยัง — ใช้กับการลบอัตโนมัติ (ไม่ได้ตั้ง cron ไว้ ก็ยังมีตาข่ายกันลืม)
 *
 * - ไม่เคยลบ / ค่าที่อ่านมาเพี้ยน → **ลบ** (ปลอดภัยกว่า: ปล่อยข้อมูลค้างคือความเสี่ยง PDPA)
 * - เคยลบไม่ถึง `LAZY_PURGE_INTERVAL_HOURS` ชั่วโมงก่อน → ยังไม่ต้องลบซ้ำ (ไม่ยิงทุกล็อกอิน)
 */
export function shouldRunPurge(lastRunAtIso: string | null, now: Date): boolean {
  if (lastRunAtIso === null || lastRunAtIso.trim() === "") return true;

  const last = new Date(lastRunAtIso);
  if (Number.isNaN(last.getTime())) return true;

  const elapsed = now.getTime() - last.getTime();
  /* เวลาในอนาคต (นาฬิกาเพี้ยน/ข้อมูลเพี้ยน) → ถือว่ายังไม่ต้องลบ เพื่อไม่ให้ยิงซ้ำรัว ๆ */
  if (elapsed < 0) return false;

  return elapsed >= LAZY_PURGE_INTERVAL_HOURS * 60 * 60 * 1000;
}

/** เวลาที่จะถึงรอบลบถัดไป (ใช้บอกผู้ดูแลบนหน้าจอ) — คืน null ถ้าควรลบเดี๋ยวนี้แล้ว */
export function nextPurgeDueAt(lastRunAtIso: string | null): Date | null {
  if (lastRunAtIso === null || lastRunAtIso.trim() === "") return null;
  const last = new Date(lastRunAtIso);
  if (Number.isNaN(last.getTime())) return null;
  return new Date(last.getTime() + LAZY_PURGE_INTERVAL_HOURS * 60 * 60 * 1000);
}

/** สรุปผลการลบเป็นข้อความสั้น ๆ สำหรับ `detail` ของ audit log */
export function summarizePurge(counts: Readonly<Record<RetentionClass, number>>): string {
  return RETENTION_CLASSES.map((cls) => `${cls}=${counts[cls]}`).join(" ");
}

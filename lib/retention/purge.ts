import { getPool, withTransaction } from "@/db/pool";
import { recordAudit } from "@/lib/audit/log";
import { isDatabaseConfigured } from "@/lib/content/repository";
import {
  PURGE_AUDIT_ACTION,
  RETENTION_CLASSES,
  nextPurgeDueAt,
  planPurge,
  shouldRunPurge,
  summarizePurge,
  type PurgeStep,
  type RetentionClass,
} from "@/lib/retention/plan";

/**
 * "ตัวลบข้อมูลที่หมดอายุ" (X2b) — **ชั้นที่แตะฐานข้อมูล**
 *
 * นโยบาย/ตัวเลขทั้งหมดอยู่ใน `lib/retention/plan.ts` (บริสุทธิ์ + มีเทสต์)
 * ที่นี่ทำแค่ "อ่าน/ลบจริง" ตามแผนนั้น
 *
 * กติกาที่ตั้งใจ
 * - **ทำงานใน transaction เดียว** — ลบครึ่งทางแล้วล้ม = ไม่เกิด (ตัวนับที่รายงานจึงตรงกับความจริง)
 * - **`dryRun` ใช้เส้นทางเดียวกัน** ต่างกันแค่คำสั่ง SQL เป็น count แทน delete ⇒ ตัวเลขบนหน้าจอตรงกับสิ่งที่จะถูกลบจริง
 * - **ไม่มี DB / อ่านไม่ได้ = คืน null ไม่โยน error** — หน้าเว็บและล็อกอินต้องไม่พังเพราะงานลบรอบนี้
 * - ไฟล์เรซูเม่ถูกลบตามแถวแม่เอง (`form_attachment ... on delete cascade` — migration 0007)
 */

export type PurgeCounts = Readonly<Record<RetentionClass, number>>;

export type PurgeReport = {
  /** เวลาที่คำนวณรอบนี้ (ISO) */
  readonly at: string;
  readonly dryRun: boolean;
  readonly counts: PurgeCounts;
  readonly total: number;
};

export type RetentionOverview = {
  /** ลบรอบล่าสุดเมื่อไร (null = ยังไม่เคยลบ) */
  readonly lastPurgeAt: string | null;
  /** จะถึงรอบลบอัตโนมัติถัดไปเมื่อไร (null = ลบได้เลยเมื่อมีคนล็อกอิน) */
  readonly nextDueAt: string | null;
  /** แถวที่หมดอายุและจะถูกลบในรอบถัดไป (อ่านล้วน) */
  readonly due: PurgeCounts;
  readonly dueTotal: number;
  /** ตารางระยะเก็บทั้งหมด — ใช้ทั้งบนหน้าจอหลังบ้านและหน้า `/privacy` */
  readonly steps: readonly PurgeStep[];
};

const ZERO: PurgeCounts = { contact: 0, newsletter: 0, careers: 0, loginAttempt: 0, auditLog: 0 };

function emptyCounts(): Record<RetentionClass, number> {
  return { ...ZERO };
}

function totalOf(counts: PurgeCounts): number {
  return RETENTION_CLASSES.reduce((sum, cls) => sum + counts[cls], 0);
}

/**
 * ลบแถวที่หมดอายุตามแผน (หรือ "นับเฉย ๆ" เมื่อ `dryRun`)
 * คืน `null` = ยังไม่ได้ตั้งฐานข้อมูล
 */
export async function purgeExpired(options: { readonly now?: Date; readonly dryRun?: boolean } = {}): Promise<PurgeReport | null> {
  if (!isDatabaseConfigured()) return null;

  const now = options.now ?? new Date();
  const dryRun = options.dryRun === true;
  const steps = planPurge(now);

  const counts = await withTransaction(async (client) => {
    const result = emptyCounts();

    for (const step of steps) {
      if (step.cls === "loginAttempt") {
        if (dryRun) {
          const { rows } = await client.query<{ n: number }>(
            "select count(*)::int as n from login_attempt where created_at < $1",
            [step.cutoffIso],
          );
          result.loginAttempt = rows[0]?.n ?? 0;
        } else {
          const deleted = await client.query("delete from login_attempt where created_at < $1", [step.cutoffIso]);
          result.loginAttempt = deleted.rowCount ?? 0;
        }
        continue;
      }

      if (step.cls === "auditLog") {
        if (dryRun) {
          const { rows } = await client.query<{ n: number }>(
            "select count(*)::int as n from audit_log where created_at < $1",
            [step.cutoffIso],
          );
          result.auditLog = rows[0]?.n ?? 0;
        } else {
          const deleted = await client.query("delete from audit_log where created_at < $1", [step.cutoffIso]);
          result.auditLog = deleted.rowCount ?? 0;
        }
        continue;
      }

      /* ที่เหลือคือฟอร์มหน้าเว็บ — ชื่อค่าในคอลัมน์ `form` ตรงกับชื่อชั้นข้อมูล (migration 0007) */
      if (dryRun) {
        const { rows } = await client.query<{ n: number }>(
          "select count(*)::int as n from form_submission where form = $1 and created_at < $2",
          [step.cls, step.cutoffIso],
        );
        result[step.cls] = rows[0]?.n ?? 0;
      } else {
        const deleted = await client.query("delete from form_submission where form = $1 and created_at < $2", [
          step.cls,
          step.cutoffIso,
        ]);
        result[step.cls] = deleted.rowCount ?? 0;
      }
    }

    return result;
  });

  return { at: now.toISOString(), dryRun, counts, total: totalOf(counts) };
}

/** ลบรอบล่าสุดเกิดขึ้นเมื่อไร (อ่านจาก audit log — ไม่ต้องมีตารางเพิ่ม) */
export async function lastPurgeAt(): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const { rows } = await getPool().query<{ at: Date | null }>(
      `select max(created_at) as at from audit_log where action = $1 and target = 'retention'`,
      [PURGE_AUDIT_ACTION],
    );
    const at = rows[0]?.at ?? null;
    return at === null ? null : new Date(at).toISOString();
  } catch {
    return null;
  }
}

/** ข้อมูลสำหรับการ์ด "ระยะเก็บข้อมูล" บนหน้าภาพรวมหลังบ้าน */
export async function retentionOverview(options: { readonly now?: Date } = {}): Promise<RetentionOverview | null> {
  if (!isDatabaseConfigured()) return null;

  const now = options.now ?? new Date();
  const last = await lastPurgeAt();
  const due = await purgeExpired({ now, dryRun: true });
  const counts = due?.counts ?? emptyCounts();

  return {
    lastPurgeAt: last,
    nextDueAt: nextPurgeDueAt(last)?.toISOString() ?? null,
    due: counts,
    dueTotal: totalOf(counts),
    steps: planPurge(now),
  };
}

async function purgeAndRecord(options: { readonly now: Date; readonly actorEmail: string | null }): Promise<PurgeReport | null> {
  const report = await purgeExpired({ now: options.now });
  if (report === null) return null;

  /* บันทึกทุกครั้งที่รัน (แม้ลบ 0 แถว) — แถวนี้คือ "หมุดเวลา" ที่ทำให้รอบถัดไปไม่ยิงซ้ำทันที */
  await recordAudit({
    action: PURGE_AUDIT_ACTION,
    actorEmail: options.actorEmail,
    target: "retention",
    detail: `total=${report.total} ${summarizePurge(report.counts)}`,
  });

  return report;
}

/**
 * ลบตามรอบ (เรียกตอนล็อกอินหลังบ้าน) — **ไม่ยิงถี่กว่า 24 ชม.** และ **ห้ามทำให้ล็อกอินล้ม**
 * ⇒ ถ้าฐานข้อมูลมีปัญหา คืน `null` เงียบ ๆ แล้วให้การล็อกอินเดินต่อ
 * (ตาข่ายกันลืม: ถึงไม่มี cron ข้อมูลก็ไม่ค้างเกิน 24 ชม. + ระยะเก็บ)
 */
export async function runScheduledPurge(
  options: { readonly actorEmail?: string | null; readonly now?: Date } = {},
): Promise<PurgeReport | null> {
  if (!isDatabaseConfigured()) return null;

  const now = options.now ?? new Date();
  try {
    const last = await lastPurgeAt();
    if (!shouldRunPurge(last, now)) return null;
    return await purgeAndRecord({ now, actorEmail: options.actorEmail ?? null });
  } catch {
    return null;
  }
}

/** ลบเดี๋ยวนี้ (ผู้ดูแลกดเอง) — ข้ามการกัน 24 ชม. แต่ยังบันทึก audit เสมอ */
export async function purgeNow(options: { readonly actorEmail: string | null; readonly now?: Date }): Promise<PurgeReport | null> {
  if (!isDatabaseConfigured()) return null;
  return purgeAndRecord({ now: options.now ?? new Date(), actorEmail: options.actorEmail });
}

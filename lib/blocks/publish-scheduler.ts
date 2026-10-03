import { isDatabaseConfigured } from "@/db/pool";
import { recordAudit } from "@/lib/audit/log";
import { listDueSchedules, listPublishSchedules, publishDuePage, type DueSchedule } from "@/lib/blocks/repository";
import { isDueAt } from "@/lib/blocks/schedule";

/**
 * "ตัวเผยแพร่ตามกำหนดเวลา" (X2.7 ส่วนที่ 1 · รอบที่ 100) — ฝั่งเซิร์ฟเวอร์ · **ไม่แตะ `next/cache`**
 *
 * ทำไมไม่แตะ `next/cache`
 * - ต้องเรียกได้จาก **สคริปต์ CLI** (`npm run db:publish-scheduled` สำหรับ cron) ซึ่งไม่มีบริบทของ Next
 * - การทำให้หน้าเว็บสดใหม่เป็นหน้าที่ของผู้เรียกที่มีบริบท Server Action (`refreshPublicSite`)
 *   หรือปล่อยให้ ISR (300 วิ) จัดการเองในกรณี cron
 *
 * ใครเรียก
 *   1. ตอน **ล็อกอินหลังบ้าน** (`app/admin/actions.ts`) — ตาข่ายกันลืมเมื่อไม่มี cron
 *   2. ปุ่มบน `/admin` (ผู้ดูแลกดเองเมื่อเห็นว่ามีงานครบกำหนด)
 *   3. `npm run db:publish-scheduled` — สำหรับตั้ง cron บนเซิร์ฟเวอร์จริง
 *
 * ⚠️ **ไม่ตั้ง cron = กำหนดเวลาจะคลาดเคลื่อนได้** (โปรเจกต์นี้ไม่มีตัวจับเวลา/worker)
 *    นี่คือเหตุผลที่ตัวเรียก 2 ตัวแรกมีอยู่ — และมีเทสต์กันลืมว่าต้องมีครบ
 */

/** ชื่อผู้กระทำเมื่อแถวกำหนดเวลาไม่มีเจ้าของ (ข้อมูลจากรุ่นก่อน/ถูกล้าง) */
export const SCHEDULED_ACTOR_FALLBACK = "scheduled";

/** หมายเหตุในประวัติการเผยแพร่ — บอกว่ามาจากกำหนดเวลา ไม่ใช่การกดเอง (ไม่ผูกภาษา) */
export const SCHEDULED_REVISION_NOTE = "scheduled";

export type ScheduledPublishResult = {
  readonly page: string;
  readonly revision: number;
};

export type ScheduledPublishFailure = {
  readonly page: string;
  /** ข้อความสั้น ๆ สำหรับ CLI/ร่องรอย — ไม่ใช่ข้อความที่ส่งให้ผู้ใช้หน้าเว็บ */
  readonly reason: string;
};

export type ScheduledPublishReport = {
  readonly at: string;
  readonly published: readonly ScheduledPublishResult[];
  readonly failed: readonly ScheduledPublishFailure[];
  /** ครบกำหนดแล้วแต่มีตัวอื่นยึดไปก่อน/กำหนดถูกล้างไประหว่างนั้น */
  readonly skipped: number;
};

/**
 * เผยแพร่ทุกหน้าที่ครบกำหนด ณ เวลานั้น
 *
 * - **หน้าเดียวพังไม่ทำให้ทั้งรอบพัง** — เก็บเข้าลิสต์ `failed` แล้วไปหน้าถัดไป
 *   (กำหนดเวลาของหน้าที่พังยังอยู่ ⇒ รอบถัดไปลองใหม่)
 * - คืน `null` เมื่อยังไม่ได้ตั้ง `DATABASE_URL` (ผู้เรียกตัดสินใจเงียบ ๆ ได้)
 * - ⚠️ ไม่บันทึก audit ตอน "ไม่มีอะไรครบกำหนด" (ต่างจากการลบตามระยะเก็บที่ต้องมีหมุดเวลา)
 */
export async function publishDueScheduled(
  options: { readonly now?: Date; readonly actorEmail?: string | null } = {},
): Promise<ScheduledPublishReport | null> {
  if (!isDatabaseConfigured()) return null;

  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const due = await listDueSchedules(nowIso);

  const published: ScheduledPublishResult[] = [];
  const failed: ScheduledPublishFailure[] = [];

  for (const item of due) {
    try {
      const result = await publishDuePage(item.page, nowIso, SCHEDULED_ACTOR_FALLBACK, SCHEDULED_REVISION_NOTE);
      if (result === null) continue; /* มีตัวอื่นเผยแพร่ไปแล้ว */

      published.push({ page: item.page, revision: result.revision });
      await recordAudit({
        action: "publish-scheduled",
        actorEmail: options.actorEmail ?? null,
        target: item.page,
        detail: `at=${item.at} by=${result.by ?? "-"}`,
      });
    } catch (error) {
      failed.push({ page: item.page, reason: error instanceof Error ? error.message : "unknown" });
    }
  }

  return { at: nowIso, published, failed, skipped: due.length - published.length - failed.length };
}

/**
 * เรียกแบบ "ตามรอบ" จากงานที่ไม่ใช่คำสั่งของผู้ใช้ (เช่น ตอนล็อกอิน)
 * **ห้ามทำให้งานหลักล้ม** ⇒ กลืนข้อผิดพลาดทั้งหมดแล้วคืน `null`
 */
export async function runScheduledPublish(
  options: { readonly now?: Date; readonly actorEmail?: string | null } = {},
): Promise<ScheduledPublishReport | null> {
  try {
    return await publishDueScheduled(options);
  } catch {
    return null;
  }
}

export type ScheduledPublishOverview = {
  /** กำหนดเวลาทั้งหมดที่ยังรออยู่ (ใหม่สุดก่อน) */
  readonly upcoming: readonly DueSchedule[];
  /** จำนวนที่ครบกำหนดแล้ว ณ ตอนอ่าน */
  readonly dueCount: number;
  /** กำหนดถัดไป (null = ไม่มีเลย) */
  readonly nextAt: string | null;
};

/** ข้อมูลสำหรับการ์ด "ตั้งเวลาเผยแพร่" บนหน้าภาพรวมหลังบ้าน — อ่านล้วน ไม่ทำให้หน้าจอพัง */
export async function scheduledPublishOverview(
  options: { readonly now?: Date } = {},
): Promise<ScheduledPublishOverview | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const now = options.now ?? new Date();
    const upcoming = await listPublishSchedules(20);
    return {
      upcoming,
      dueCount: upcoming.filter((row) => isDueAt(row.at, now)).length,
      nextAt: upcoming[0]?.at ?? null,
    };
  } catch {
    return null;
  }
}

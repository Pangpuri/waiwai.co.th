import type { PoolClient } from "pg";

import { getPool, withTransaction } from "@/db/pool";
import { recordAudit } from "@/lib/audit/log";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { purgeExpiredTrash } from "@/lib/trash/repository";
import { purgeExpiredContentTrash } from "@/lib/trash/content";
import { purgeExpiredHeroTrash } from "@/lib/trash/hero";
import { purgeExpiredPreviewLinks } from "@/lib/preview-link/repository";
import {
  PURGE_AUDIT_ACTION,
  RETENTION_CLASSES,
  REVISIONS_KEPT_PER_PAGE,
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
  /**
   * จำนวน **เนื้อหาในถังขยะ** (สินค้า/เมนูอาหาร/ข่าว) ที่พ้นกำหนดและจะถูกลบถาวรในรอบถัดไป (รอบที่ 174)
   * ⚠️ ไม่ใช่ข้อมูลส่วนบุคคล ⇒ ไม่รวมใน `due`/`dueTotal` (คนละนโยบายกับตารางด้านบน)
   */
  readonly contentTrashDue: number;
  /** จำนวนสไลด์ในถังขยะที่พ้นกำหนด (รอบที่ 191) */
  readonly heroTrashDue: number;
  /** ตารางระยะเก็บทั้งหมด — ใช้ทั้งบนหน้าจอหลังบ้านและหน้า `/privacy` */
  readonly steps: readonly PurgeStep[];
};

const ZERO: PurgeCounts = {
  contact: 0,
  newsletter: 0,
  careers: 0,
  blockRevision: 0,
  contentRevision: 0,
  entityRevision: 0,
  loginAttempt: 0,
  auditLog: 0,
  adminSession: 0,
};

function emptyCounts(): Record<RetentionClass, number> {
  return { ...ZERO };
}

function totalOf(counts: PurgeCounts): number {
  return RETENTION_CLASSES.reduce((sum, cls) => sum + counts[cls], 0);
}

/**
 * ลบประวัติเนื้อหาที่หมดอายุ — **ยกเว้นรุ่นล่าสุดของแต่ละหน้า** (`REVISIONS_KEPT_PER_PAGE`)
 *
 * เหตุผล: ประวัติคือ "ตาข่ายกันพลาด" เวลามีคนแก้เนื้อหาผิด ⇒ ถ้าลบจนเกลี้ยง หน้าที่ไม่ได้แก้มานาน
 * จะย้อนกลับไม่ได้เลย · ราคาที่จ่ายคือ 1 แถวต่อหน้า (ไม่โตตามเวลา) · เลขรุ่นยังเดินหน้าต่อ ไม่ถูกนำกลับมาใช้ซ้ำ
 *
 * ⚠️ ชื่อตารางมาจากค่าคงที่ในโค้ดเท่านั้น (ไม่รับจากผู้ใช้) — ไม่มีทางกลายเป็น SQL injection
 */
async function purgeRevisions(options: {
  readonly table: "page_document_revision" | "content_revision" | "entity_revision";
  readonly cutoffIso: string;
  readonly dryRun: boolean;
  readonly client: PoolClient;
}): Promise<number> {
  const { table, cutoffIso, dryRun, client } = options;

  /*
    เก็บรุ่นล่าสุดไว้เสมอ — `page_document_revision`/`content_revision` ใช้คอลัมน์ `page`
    · `entity_revision` ใช้คู่ (kind, entity_id) เพราะเก็บหลายชนิดในตารางเดียว
  */
  const groupBy =
    table === "entity_revision"
      ? `keep.kind = ${table}.kind and keep.entity_id = ${table}.entity_id`
      : `keep.page = ${table}.page`;
  const predicate = `created_at < $1 and id not in (
      select keep.id from ${table} keep
       where ${groupBy}
       order by keep.revision desc, keep.id desc
       limit $2
    )`;

  if (dryRun) {
    const { rows } = await client.query<{ n: number }>(
      `select count(*)::int as n from ${table} where ${predicate}`,
      [cutoffIso, REVISIONS_KEPT_PER_PAGE],
    );
    return rows[0]?.n ?? 0;
  }

  const deleted = await client.query(`delete from ${table} where ${predicate}`, [cutoffIso, REVISIONS_KEPT_PER_PAGE]);
  return deleted.rowCount ?? 0;
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

      /*
        เซสชันหลังบ้าน (รอบที่ 95) — วัดเวลาจาก "หมดอายุ/ถูกเพิกถอน" ไม่ใช่เวลาสร้าง
        ⚠️ เซสชันที่ยังใช้งานได้ (revoked_at null + expires_at อนาคต) **ต้องไม่ถูกลบ**
      */
      if (step.cls === "adminSession") {
        const predicate = "coalesce(revoked_at, expires_at) < $1";
        if (dryRun) {
          const { rows } = await client.query<{ n: number }>(
            `select count(*)::int as n from admin_session where ${predicate}`,
            [step.cutoffIso],
          );
          result.adminSession = rows[0]?.n ?? 0;
        } else {
          const deleted = await client.query(`delete from admin_session where ${predicate}`, [step.cutoffIso]);
          result.adminSession = deleted.rowCount ?? 0;
        }
        continue;
      }

      /* ประวัติเนื้อหา/ประวัติรุ่น — เก็บรุ่นล่าสุดของแต่ละรายการไว้เสมอ (มติรอบ 77 · 143) */
      if (step.cls === "blockRevision" || step.cls === "contentRevision" || step.cls === "entityRevision") {
        const table =
          step.cls === "blockRevision"
            ? "page_document_revision"
            : step.cls === "contentRevision"
              ? "content_revision"
              : "entity_revision";
        result[step.cls] = await purgeRevisions({ table, cutoffIso: step.cutoffIso, dryRun, client });
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
  const [due, contentTrash, heroTrash] = await Promise.all([
    purgeExpired({ now, dryRun: true }),
    purgeExpiredContentTrash({ now, dryRun: true }),
    /* ถังขยะสไลด์หน้าแรก (รอบที่ 191) */
    purgeExpiredHeroTrash({ now, dryRun: true }),
  ]);
  const counts = due?.counts ?? emptyCounts();

  return {
    lastPurgeAt: last,
    nextDueAt: nextPurgeDueAt(last)?.toISOString() ?? null,
    due: counts,
    dueTotal: totalOf(counts),
    /* ถังขยะเนื้อหา (รอบที่ 174) — ลบในรอบเดียวกัน แต่ไม่ใช่ข้อมูลส่วนบุคคล */
    contentTrashDue: contentTrash?.total ?? 0,
    /* ถังขยะสไลด์ (รอบที่ 191) — ลบในรอบเดียวกัน ไม่ใช่ข้อมูลส่วนบุคคล */
    heroTrashDue: heroTrash ?? 0,
    steps: planPurge(now),
  };
}

async function purgeAndRecord(options: { readonly now: Date; readonly actorEmail: string | null }): Promise<PurgeReport | null> {
  const report = await purgeExpired({ now: options.now });
  if (report === null) return null;

  /*
    ถังขยะ (X2.4) — ลบถาวรของที่พ้นระยะเก็บในรอบเดียวกัน
    ⚠️ ไม่รวมใน `report.counts` เพราะไม่ใช่ข้อมูลส่วนบุคคล (คนละนโยบายกับตารางด้านบน)
       ⇒ `lib/trash/repository.ts` บันทึก audit ของตัวเอง (`trash-purge`) เมื่อมีของถูกลบจริง
  */
  await purgeExpiredTrash({ now: options.now });

  /*
    ถังขยะ "เนื้อหา" (รอบที่ 170 — สินค้า/เมนูอาหาร/ข่าว) — ลบถาวรเมื่อพ้นระยะเก็บ
    ⚠️ คนละชุดกับถังขยะภาพ/พรีเซ็ต: ของ 3 ชนิดนี้มีแท็บถังขยะในหน้าจอของตัวเอง
       ที่นี่มีหน้าที่แค่ "เก็บกวาดตามกำหนด" · บันทึก audit ของตัวเอง (`trash-purge` · target `trash-content`)
  */
  await purgeExpiredContentTrash({ now: options.now });

  /*
    ถังขยะ "สไลด์หน้าแรก" (รอบที่ 191) — ต่อเข้าตัวลบกลางเพื่อไม่ให้ของค้างในถังตลอดไป
    ⚠️ ลบสไลด์แล้วลิงก์แคมเปญของสไลด์นั้นหายตาม (cascade) · audit ของตัวเองบันทึกในชั้นข้อมูล
  */
  await purgeExpiredHeroTrash({ now: options.now });

  /*
    ลิงก์พรีวิวชั่วคราว (X2.6) — เก็บกวาดลิงก์ที่ปิดแล้วและพ้นอายุเก็บ
    ⚠️ ลิงก์ที่ยังใช้ได้ไม่ถูกแตะ · ร่องรอยของเจ้าหน้าที่ (ไม่ขึ้นหน้า /privacy เช่นเดียวกับถังขยะ)
  */
  await purgeExpiredPreviewLinks({ now: options.now });

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

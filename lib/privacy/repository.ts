import { getPool, withTransaction } from "@/db/pool";
import { recordAudit } from "@/lib/audit/log";
import { isDatabaseConfigured } from "@/lib/content/repository";
import {
  EMPTY_ERASURE_COUNTS,
  erasureTotal,
  maskEmail,
  normalizeEmail,
  summarizeErasure,
  type ErasureCounts,
} from "@/lib/privacy/erasure";

/**
 * ชั้นฐานข้อมูลของ "ลบข้อมูลทั้งหมดของอีเมลนี้" (PDPA)
 *
 * กติกาเดียวกับ `lib/retention/purge.ts`
 * - **transaction เดียว** — ลบครึ่งทางแล้วล้ม = ไม่เกิด (และรายงานที่คืนจึงตรงกับความจริง)
 * - **ไม่เชื่อข้อมูลจากเบราว์เซอร์** — ตรวจที่ `checkErasureRequest()` ก่อน แล้วส่งอีเมลที่ normalize แล้วมาที่นี่
 * - **ไม่มี DB = คืน null ไม่โยน error** (หลังบ้านต้องไม่พังเพราะเรื่องนี้)
 * - **เทียบอีเมลแบบ normalize ทั้งสองฝั่ง** — `lower(btrim(email))` กับค่าที่ส่งมา
 *   ⇒ ถ้าเก็บไว้เป็น `Someone@Example.com` ก็ยังลบเจอ (ไม่งั้น "ลบไม่ครบ" แบบเงียบ ๆ)
 */

export type ErasurePreview = {
  readonly counts: ErasureCounts;
  /** จำนวนร่องรอยความปลอดภัยของอีเมลนี้ที่ **ไม่ลบ** (บอกตามจริง) */
  readonly keptLoginAttempts: number;
};

export type ErasureReport = {
  readonly at: string;
  /** อีเมลที่ปิดบางส่วน (สำหรับรายงานบนหน้าจอ) */
  readonly masked: string;
  readonly counts: ErasureCounts;
  readonly total: number;
  /** true = ลบได้ 0 แถว (ไม่พบข้อมูลของอีเมลนี้) */
  readonly nothingFound: boolean;
};

function toCounts(rows: readonly { readonly form: string; readonly n: number }[], attachments: number): ErasureCounts {
  const counts: Record<string, number> = { ...EMPTY_ERASURE_COUNTS, attachments };
  for (const row of rows) {
    if (row.form === "contact" || row.form === "newsletter" || row.form === "careers") counts[row.form] = row.n;
  }
  return {
    contact: counts["contact"] ?? 0,
    newsletter: counts["newsletter"] ?? 0,
    careers: counts["careers"] ?? 0,
    attachments,
  };
}

/** นับว่าจะลบอะไรบ้าง (อ่านล้วน — ใช้ยืนยันก่อนกดลบจริง) */
export async function erasurePreview(email: string): Promise<ErasurePreview | null> {
  if (!isDatabaseConfigured()) return null;
  const normalized = normalizeEmail(email);

  const pool = getPool();
  const { rows } = await pool.query<{ form: string; n: number }>(
    `select form, count(*)::int as n
       from form_submission
      where lower(btrim(email)) = $1
      group by form`,
    [normalized],
  );

  const { rows: attachmentRows } = await pool.query<{ n: number }>(
    `select count(*)::int as n
       from form_attachment a
       join form_submission s on s.id = a.submission_id
      where lower(btrim(s.email)) = $1`,
    [normalized],
  );

  const { rows: attemptRows } = await pool.query<{ n: number }>(
    "select count(*)::int as n from login_attempt where lower(btrim(email)) = $1",
    [normalized],
  );

  return {
    counts: toCounts(rows, attachmentRows[0]?.n ?? 0),
    keptLoginAttempts: attemptRows[0]?.n ?? 0,
  };
}

/**
 * ลบข้อมูลทั้งหมดของอีเมลนี้ (ทุกฟอร์ม + ไฟล์แนบ) แล้วบันทึกการกระทำลง audit
 * คืน `null` = ยังไม่ได้ตั้งฐานข้อมูล
 *
 * ⚠️ บันทึก audit ด้วยอีเมล **แบบปิดบางส่วน** — ไม่เขียนอีเมลเต็มกลับเข้าไประบบหลังลบ
 */
export async function eraseSubject(options: {
  readonly email: string;
  readonly actorEmail: string | null;
  readonly now?: Date;
}): Promise<ErasureReport | null> {
  if (!isDatabaseConfigured()) return null;

  const normalized = normalizeEmail(options.email);
  const now = options.now ?? new Date();

  const counts = await withTransaction(async (client) => {
    const { rows } = await client.query<{ form: string; n: number }>(
      `select form, count(*)::int as n
         from form_submission
        where lower(btrim(email)) = $1
        group by form`,
      [normalized],
    );

    const { rows: attachmentRows } = await client.query<{ n: number }>(
      `select count(*)::int as n
         from form_attachment a
         join form_submission s on s.id = a.submission_id
        where lower(btrim(s.email)) = $1`,
      [normalized],
    );

    /* ลบแถวแม่ — ไฟล์แนบ (เรซูเม่) หายตาม `on delete cascade` (migration 0007) */
    await client.query("delete from form_submission where lower(btrim(email)) = $1", [normalized]);

    return toCounts(rows, attachmentRows[0]?.n ?? 0);
  });

  const total = erasureTotal(counts);

  await recordAudit({
    action: "erase-subject",
    actorEmail: options.actorEmail,
    target: "privacy-erasure",
    detail: `${maskEmail(normalized)} ${summarizeErasure(counts)}`,
  });

  return {
    at: now.toISOString(),
    masked: maskEmail(normalized),
    counts,
    total,
    nothingFound: total === 0,
  };
}

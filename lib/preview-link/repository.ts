import { createHash, randomBytes } from "node:crypto";

import { getPool } from "@/db/pool";
import { recordAudit } from "@/lib/audit/log";
import { isDatabaseConfigured } from "@/lib/content/repository";
import {
  PREVIEW_LINK_AUDIT_ACTIONS,
  PREVIEW_LINK_AUDIT_TARGET,
  PREVIEW_LINK_MAX_ACTIVE,
  PREVIEW_TOKEN_BYTES,
  isPreviewLinkExpired,
  isPreviewTokenShape,
  previewLinkCleanupCutoff,
  previewLinkExpiryFrom,
} from "@/lib/preview-link/plan";

/**
 * ลิงก์พรีวิวชั่วคราว (X2.6) — **ชั้นที่แตะฐานข้อมูล**
 *
 * กติกาความปลอดภัย (สำคัญที่สุดของไฟล์นี้)
 * 1. **เก็บเฉพาะ `sha256(โทเคน)`** — ไม่มีคอลัมน์ไหนเก็บโทเคนดิบ และ `listPreviewLinks()` **ไม่คืน hash ออกไป**
 *    ⇒ ต่อให้ฐานข้อมูลรั่ว ก็เอาไปเปิดลิงก์ไม่ได้ · และหน้าจอหลังบ้านก็แสดงลิงก์เดิมซ้ำไม่ได้ (ต้องสร้างใหม่)
 * 2. **ตรวจรูปทรงโทเคนก่อนคิวรี** (`isPreviewTokenShape`) — ค่าขยะจาก URL ไม่แตะฐานข้อมูล
 * 3. ตรวจ **หมดอายุ + ยกเลิก** ที่เซิร์ฟเวอร์ทุกครั้งที่เปิดลิงก์ (ไม่เชื่ออะไรจากฝั่งเบราว์เซอร์)
 * 4. ทุกการสร้าง/ยกเลิกลง audit log · การเปิดลิงก์นับ `use_count`/`last_used_at` (ล้มเหลวได้ ไม่ทำให้หน้าพัง)
 * 5. **ไม่มี DB = คืนค่าว่าง/`null`** — หน้าจอหลังบ้านและหน้าเว็บต้องไม่พังเพราะเรื่องนี้
 */

type PreviewLinkRow = {
  readonly id: string;
  readonly page: string;
  readonly expires_at: Date;
  readonly created_at: Date;
  readonly created_by: string | null;
  readonly revoked_at: Date | null;
  readonly last_used_at: Date | null;
  readonly use_count: number;
};

export type PreviewLinkListItem = {
  readonly id: string;
  readonly page: string;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly createdBy: string | null;
  readonly revokedAt: string | null;
  readonly lastUsedAt: string | null;
  readonly useCount: number;
};

/** ผลของการเปิดลิงก์: ใช้ได้ (คืนหน้าเป้าหมาย) หรือใช้ไม่ได้ */
export type PreviewLinkResolution = {
  readonly ok: boolean;
  readonly page: string | null;
};

function newPreviewLinkId(): string {
  return randomBytes(9).toString("base64url");
}

/** โทเคนดิบ → hash ที่เก็บในฐานข้อมูล (ที่เดียวในระบบที่ทำแบบนี้) */
export function hashPreviewToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toListItem(row: PreviewLinkRow): PreviewLinkListItem {
  return {
    id: row.id,
    page: row.page,
    expiresAt: new Date(row.expires_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: row.created_by,
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at).toISOString(),
    lastUsedAt: row.last_used_at === null ? null : new Date(row.last_used_at).toISOString(),
    useCount: row.use_count,
  };
}

/**
 * รายการลิงก์สำหรับหน้าจอหลังบ้าน — **ไม่คืนโทเคน/hash** (แสดงซ้ำไม่ได้โดยเจตนา)
 * เรียงใหม่สุดก่อน แล้วให้ผู้เรียกแยกสถานะเองด้วย `previewLinkStatus()`
 */
export async function listPreviewLinks(limit = 100): Promise<readonly PreviewLinkListItem[]> {
  if (!isDatabaseConfigured()) return [];

  const { rows } = await getPool().query<PreviewLinkRow>(
    `select id, page, expires_at, created_at, created_by, revoked_at, last_used_at, use_count
       from preview_link
      order by created_at desc
      limit $1`,
    [Math.max(1, Math.min(limit, 300))],
  );

  return rows.map(toListItem);
}

/** จำนวนลิงก์ที่ยังใช้ได้ (ไม่หมดอายุ/ไม่ถูกยกเลิก) ของหน้านั้น */
export async function countActivePreviewLinks(page: string, now: Date = new Date()): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  const { rows } = await getPool().query<{ n: number }>(
    `select count(*)::int as n from preview_link
      where page = $1 and revoked_at is null and expires_at > $2`,
    [page, now.toISOString()],
  );
  return rows[0]?.n ?? 0;
}

export type CreatePreviewLinkResult =
  | { readonly ok: true; readonly token: string; readonly expiresAt: string }
  | { readonly ok: false; readonly reason: "no-database" | "too-many" };

/**
 * สร้างลิงก์ใหม่ — **คืนโทเคนดิบเพียงครั้งเดียว** (เก็บลงฐานข้อมูลแค่ hash)
 * ⚠️ ผู้เรียกต้องแสดงลิงก์ให้ผู้ดูแลคัดลอกทันที แล้วไม่เก็บไว้ที่ไหนอีก
 */
export async function createPreviewLink(input: {
  readonly page: string;
  readonly actorEmail: string | null;
  readonly now?: Date;
}): Promise<CreatePreviewLinkResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "no-database" };

  const now = input.now ?? new Date();

  /* กันโตไม่จำกัด: ลิงก์ที่ยังใช้ได้ของหน้านี้ครบเพดานแล้วให้ยกเลิกของเก่าก่อน */
  const active = await countActivePreviewLinks(input.page, now);
  if (active >= PREVIEW_LINK_MAX_ACTIVE) return { ok: false, reason: "too-many" };

  const token = randomBytes(PREVIEW_TOKEN_BYTES).toString("base64url");
  const expiresAt = previewLinkExpiryFrom(now);

  await getPool().query(
    `insert into preview_link (id, token_hash, page, expires_at, created_by)
       values ($1, $2, $3, $4, $5)`,
    [newPreviewLinkId(), hashPreviewToken(token), input.page, expiresAt.toISOString(), input.actorEmail],
  );

  await recordAudit({
    action: PREVIEW_LINK_AUDIT_ACTIONS.create,
    actorEmail: input.actorEmail,
    target: `${PREVIEW_LINK_AUDIT_TARGET}:${input.page}`,
    /* ⚠️ ห้ามเขียนโทเคนลง audit — เก็บแค่วันหมดอายุ */
    detail: `expires=${expiresAt.toISOString()}`,
  });

  return { ok: true, token, expiresAt: expiresAt.toISOString() };
}

/**
 * เปิดลิงก์: ตรวจรูปแบบ → hash → หาแถวที่ยังใช้ได้
 * - คืน `{ ok: false }` ทุกกรณีที่ใช้ไม่ได้ (รูปแบบผิด · ไม่พบ · ยกเลิกแล้ว · หมดอายุ)
 * - **ไม่บอกว่าล้มเพราะอะไร** ออกไปด้านนอก (ไม่ให้เป็นช่องเดาว่าโทเคนไหนเคยมีอยู่)
 * - นับการใช้งานแบบ "พยายาม" — ล้มเหลวก็ไม่ทำให้หน้าเว็บพัง
 */
export async function resolvePreviewLink(token: string, now: Date = new Date()): Promise<PreviewLinkResolution> {
  if (!isDatabaseConfigured() || !isPreviewTokenShape(token)) return { ok: false, page: null };

  const { rows } = await getPool().query<{ id: string; page: string; expires_at: Date; revoked_at: Date | null }>(
    `select id, page, expires_at, revoked_at from preview_link where token_hash = $1`,
    [hashPreviewToken(token)],
  );

  const row = rows[0];
  if (row === undefined) return { ok: false, page: null };
  if (row.revoked_at !== null) return { ok: false, page: null };
  if (isPreviewLinkExpired(new Date(row.expires_at).toISOString(), now)) return { ok: false, page: null };

  try {
    await getPool().query(`update preview_link set last_used_at = $2, use_count = use_count + 1 where id = $1`, [
      row.id,
      now.toISOString(),
    ]);
  } catch {
    /* ร่องรอยใช้ไม่ได้ = ไม่เป็นไร — การเปิดลิงก์ต้องไม่พังเพราะเรื่องนี้ */
  }

  return { ok: true, page: row.page };
}

/** ยกเลิกลิงก์ (ใช้ `id` เพราะโทเคนดิบแสดงซ้ำไม่ได้) — คืน `false` ถ้าไม่พบหรือยกเลิกไปแล้ว */
export async function revokePreviewLink(id: string, actorEmail: string | null, now: Date = new Date()): Promise<boolean> {
  if (!isDatabaseConfigured() || id === "") return false;

  const result = await getPool().query(
    `update preview_link set revoked_at = $2 where id = $1 and revoked_at is null`,
    [id, now.toISOString()],
  );

  const revoked = (result.rowCount ?? 0) > 0;
  if (revoked) {
    await recordAudit({
      action: PREVIEW_LINK_AUDIT_ACTIONS.revoke,
      actorEmail,
      target: `${PREVIEW_LINK_AUDIT_TARGET}:${id}`,
      detail: "revoked",
    });
  }
  return revoked;
}

export type PreviewLinkPurgeReport = {
  readonly at: string;
  readonly dryRun: boolean;
  readonly deleted: number;
};

/**
 * เก็บกวาดลิงก์ที่ **หมดอายุหรือถูกยกเลิกแล้ว** และพ้นอายุเก็บ (`PREVIEW_LINK_KEEP_DAYS`)
 * เรียกจากตัวลบกลาง (ล็อกอิน/cron) — ดู `lib/retention/purge.ts`
 */
export async function purgeExpiredPreviewLinks(
  options: { readonly now?: Date; readonly dryRun?: boolean } = {},
): Promise<PreviewLinkPurgeReport | null> {
  if (!isDatabaseConfigured()) return null;

  const now = options.now ?? new Date();
  const dryRun = options.dryRun === true;
  const cutoffIso = previewLinkCleanupCutoff(now).toISOString();

  /* เก็บเฉพาะที่ "ปิดแล้วจริง" (หมดอายุหรือถูกยกเลิก) และพ้นอายุเก็บ — ลิงก์ที่ยังใช้ได้ไม่ถูกแตะ */
  const predicate = `(revoked_at is not null or expires_at <= $1) and coalesce(revoked_at, expires_at) < $1`;

  if (dryRun) {
    const { rows } = await getPool().query<{ n: number }>(`select count(*)::int as n from preview_link where ${predicate}`, [
      cutoffIso,
    ]);
    return { at: now.toISOString(), dryRun: true, deleted: rows[0]?.n ?? 0 };
  }

  const result = await getPool().query(`delete from preview_link where ${predicate}`, [cutoffIso]);
  const deleted = result.rowCount ?? 0;

  if (deleted > 0) {
    await recordAudit({
      action: PREVIEW_LINK_AUDIT_ACTIONS.purge,
      actorEmail: null,
      target: PREVIEW_LINK_AUDIT_TARGET,
      detail: `deleted=${deleted}`,
    });
  }

  return { at: now.toISOString(), dryRun: false, deleted };
}

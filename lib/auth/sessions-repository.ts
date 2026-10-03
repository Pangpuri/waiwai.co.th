import { createHash, randomBytes } from "node:crypto";

import { getPool } from "@/db/pool";
import { recordAudit } from "@/lib/audit/log";
import { isDatabaseConfigured } from "@/lib/content/repository";

/**
 * เซสชันหลังบ้านที่ **เพิกถอนได้** (B3 ต่อ · รอบที่ 95)
 *
 * ทำไมต้องมี (หนี้ที่ค้างจากรอบที่ 84)
 * - คุกกี้เดิมเป็นโทเคนที่เซ็นชื่อแบบไม่เก็บสถานะ ⇒ **ยกเลิกไม่ได้** — ปิดบัญชี/ลบบัญชี/ตั้งรหัสใหม่
 *   แล้วคนที่ถือคุกกี้เดิมยังใช้ได้จนหมดอายุ (≤8 ชม.)
 * - ผู้ดูแลไม่มีทางเห็นว่า "ตอนนี้มีใครล็อกอินอยู่บ้าง"
 *
 * หลักการ
 * - ฐานข้อมูลเก็บ **sha256(sid)** ไม่เก็บค่าดิบ (ค่าดิบอยู่ในคุกกี้ที่เซ็นแล้วเท่านั้น)
 * - ตรวจทุกคำขอที่ `getSessionUser()`: ต้องมีแถว · ไม่ถูกเพิกถอน · ไม่หมดอายุ · ตรงกับบัญชี
 * - **ไม่เก็บ IP** · user-agent ตัดความยาว 200 ตัวอักษร (พอให้รู้ว่า "เครื่องไหน")
 * - ล้มเหลว/ไม่มี DB = คืนค่าว่าง ไม่โยน error (ยกเว้นตอนสร้างเซสชัน ซึ่งผู้เรียกต้องรู้ว่าล้มเหลว)
 * - ระยะเก็บ 30 วันหลังหมดอายุ/เพิกถอน (`lib/retention/plan.ts` ชั้น `adminSession`)
 */

/** เพดานเซสชันที่ใช้งานได้ต่อหนึ่งบัญชี (กันเปิดค้างไม่จำกัด/กดล็อกอินซ้ำ ๆ) */
export const MAX_ACTIVE_SESSIONS_PER_USER = 10;

/** อัปเดต "เห็นล่าสุด" ไม่ถี่กว่านี้ (นาที) — ให้รายการเซสชันมีข้อมูลจริงโดยไม่เขียนทุกคำขอ */
export const SESSION_TOUCH_MINUTES = 5;

const USER_AGENT_MAX = 200;

export type AdminSessionSummary = {
  /** sha256 ของ sid — ใช้เป็นคีย์บนหน้าจอ (ไม่ใช่รหัสลับที่เอาไปสวมรอยได้) */
  readonly id: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly revokedBy: string | null;
  readonly userAgent: string | null;
  /** ใช้งานได้จริงหรือยัง (ไม่ถูกเพิกถอน + ยังไม่หมดอายุ) */
  readonly active: boolean;
};

type SessionRow = {
  readonly token_hash: string;
  readonly user_id: string;
  readonly created_at: Date;
  readonly last_seen_at: Date;
  readonly expires_at: Date;
  readonly revoked_at: Date | null;
  readonly revoked_by: string | null;
  readonly user_agent: string | null;
};

/** รหัสเซสชันแบบสุ่ม (ค่าดิบ) — อยู่ในคุกกี้ที่เซ็นแล้วเท่านั้น */
export function newSessionId(): string {
  return randomBytes(32).toString("base64url");
}

/** สิ่งที่เก็บในฐานข้อมูล = hash ของรหัสเซสชัน */
export function hashSessionId(sid: string): string {
  return createHash("sha256").update(sid, "utf8").digest("hex");
}

/** แถวนี้ใช้งานได้หรือยัง — ตรรกะล้วน (ทดสอบได้โดยไม่ต้องมี DB) */
export function isSessionActive(row: { readonly revokedAt: string | null; readonly expiresAt: string }, now: number): boolean {
  if (row.revokedAt !== null) return false;
  const expires = new Date(row.expiresAt).getTime();
  return Number.isFinite(expires) && expires > now;
}

function toSummary(row: SessionRow, now: number): AdminSessionSummary {
  const summary = {
    id: row.token_hash,
    userId: row.user_id,
    createdAt: new Date(row.created_at).toISOString(),
    lastSeenAt: new Date(row.last_seen_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at).toISOString(),
    revokedBy: row.revoked_by,
    userAgent: row.user_agent,
  };
  return { ...summary, active: isSessionActive(summary, now) };
}

const SELECT_COLUMNS =
  "token_hash, user_id, created_at, last_seen_at, expires_at, revoked_at, revoked_by, user_agent";

/** ตัดข้อมูลอุปกรณ์ให้สั้น (และว่าง = null) */
function normalizeUserAgent(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (trimmed === "") return null;
  return trimmed.slice(0, USER_AGENT_MAX);
}

/**
 * บันทึกเซสชันใหม่ — คืน `false` เมื่อบันทึกไม่ได้ **ทั้งที่ตั้งฐานข้อมูลไว้แล้ว**
 * ⚠️ ผู้เรียก (ตอนล็อกอิน) ต้องถือว่า "ล้มเหลว" เพราะเซสชันที่เพิกถอนไม่ได้คือสิ่งที่เรากำลังปิดช่อง
 */
export async function createAdminSession(input: {
  readonly userId: string;
  readonly sid: string;
  readonly expiresAt: Date;
  readonly userAgent?: string | null;
}): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;

  try {
    /* เพดานต่อบัญชี: ตัดเซสชันที่เก่าที่สุดออกก่อน (เก็บของใหม่เสมอ — ผู้ใช้กำลังใช้งานอยู่) */
    await getPool().query(
      `delete from admin_session
        where user_id = $1
          and token_hash in (
            select token_hash from admin_session
             where user_id = $1
             order by created_at desc
             offset $2
          )`,
      [input.userId, MAX_ACTIVE_SESSIONS_PER_USER - 1],
    );

    await getPool().query(
      `insert into admin_session (token_hash, user_id, expires_at, user_agent)
       values ($1, $2, $3, $4)
       on conflict (token_hash) do nothing`,
      [hashSessionId(input.sid), input.userId, input.expiresAt.toISOString(), normalizeUserAgent(input.userAgent)],
    );
    return true;
  } catch {
    return false;
  }
}

/** หาแถวเซสชันจากรหัสในคุกกี้ (คืน `null` = ไม่มี/อ่านไม่ได้) */
export async function findAdminSession(sid: string): Promise<AdminSessionSummary | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const { rows } = await getPool().query<SessionRow>(
      `select ${SELECT_COLUMNS} from admin_session where token_hash = $1`,
      [hashSessionId(sid)],
    );
    const row = rows[0];
    return row === undefined ? null : toSummary(row, Date.now());
  } catch {
    return null;
  }
}

/**
 * อัปเดต "เห็นล่าสุด" — เขียนเฉพาะเมื่อข้อมูลเก่ากว่า `SESSION_TOUCH_MINUTES` (ลด write ต่อคำขอ)
 * ⚠️ ล้มเหลว = เงียบ (การใช้งานต้องไม่พังเพราะสถิติ)
 */
export async function touchAdminSession(sid: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await getPool().query(
      `update admin_session
          set last_seen_at = now()
        where token_hash = $1
          and revoked_at is null
          and last_seen_at < now() - ($2 || ' minutes')::interval`,
      [hashSessionId(sid), String(SESSION_TOUCH_MINUTES)],
    );
  } catch {
    /* เงียบ */
  }
}

/** เซสชันที่ยังใช้งานได้ (ทั้งหมด หรือของบัญชีเดียว) — เรียงใหม่สุดก่อน */
export async function listActiveAdminSessions(userId?: string): Promise<readonly AdminSessionSummary[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const { rows } = await getPool().query<SessionRow>(
      `select ${SELECT_COLUMNS}
         from admin_session
        where revoked_at is null
          and expires_at > now()
          and ($1::text is null or user_id = $1)
        order by last_seen_at desc
        limit 200`,
      [userId ?? null],
    );
    const now = Date.now();
    return rows.map((row) => toSummary(row, now));
  } catch {
    return [];
  }
}

export type RevokeSessionResult = { readonly ok: true; readonly revoked: number } | { readonly ok: false; readonly reason: "no-database" };

/**
 * เพิกถอนเซสชัน **ตาม hash id** (ค่าที่หน้าจอเห็น) — ใช้จากหน้าจัดการบัญชี
 * `exceptHash` = ไม่แตะเซสชันนี้ (ใช้ตอน "ตัดเซสชันอื่นทั้งหมด" ของตัวเอง)
 */
export async function revokeAdminSessions(input: {
  readonly hash: string;
  readonly actor: string;
}): Promise<RevokeSessionResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "no-database" };

  const { rowCount } = await getPool().query(
    "update admin_session set revoked_at = now(), revoked_by = $2 where token_hash = $1 and revoked_at is null",
    [input.hash, input.actor],
  );
  const revoked = rowCount ?? 0;

  if (revoked > 0) {
    await recordAudit({ action: "admin-session-revoke", actorEmail: input.actor, target: input.hash.slice(0, 12), detail: "session" });
  }
  return { ok: true, revoked };
}

/**
 * เพิกถอน **ทุกเซสชันของบัญชีหนึ่ง** (ใช้ตอนปิดบัญชี/ตั้งรหัสผ่านใหม่/ลบบัญชี)
 * `exceptSid` = คงเซสชันปัจจุบันไว้ (ตอนผู้ใช้เปลี่ยนรหัสของตัวเอง)
 */
export async function revokeSessionsForUser(input: {
  readonly userId: string;
  readonly actor: string;
  readonly exceptSid?: string | null;
  readonly detail?: string;
}): Promise<number> {
  if (!isDatabaseConfigured()) return 0;

  try {
    const exceptHash = input.exceptSid === undefined || input.exceptSid === null ? null : hashSessionId(input.exceptSid);
    const { rowCount } = await getPool().query(
      `update admin_session
          set revoked_at = now(), revoked_by = $2
        where user_id = $1
          and revoked_at is null
          and ($3::text is null or token_hash <> $3)`,
      [input.userId, input.actor, exceptHash],
    );
    const revoked = rowCount ?? 0;

    if (revoked > 0) {
      await recordAudit({
        action: "admin-session-revoke",
        actorEmail: input.actor,
        target: input.userId,
        detail: input.detail ?? `all (${revoked})`,
      });
    }
    return revoked;
  } catch {
    /* ล้มเหลว = ไม่เพิกถอน (ผู้เรียกยังทำงานต่อได้) — แต่ต้องไม่กลืนเงียบในบันทึกของงานสำคัญ */
    return 0;
  }
}

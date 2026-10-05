import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ADMIN_LOGIN_PATH } from "@/lib/auth/credentials";
import { can, type AdminPermission } from "@/lib/auth/roles";
import {
  createAdminSession,
  findAdminSession,
  hashSessionId,
  newSessionId,
  revokeAdminSessions,
  touchAdminSession,
} from "@/lib/auth/sessions-repository";
import { createDbUserStore, ensureEnvAdminUser } from "@/lib/auth/users-repository";
import { isDatabaseConfigured } from "@/lib/content/repository";
import {
  MAINTENANCE_BYPASS_COOKIE,
  createMaintenanceBypassToken,
  nextMaintenanceBypassExpiry,
  parseMaintenanceBypassToken,
  shouldRefreshMaintenanceBypass,
} from "@/lib/maintenance/bypass";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  isSecretUsable,
  parseSessionToken,
  sessionCookieOptions,
  sessionExpiry,
} from "@/lib/auth/session";
import { ENV_ADMIN_ID, createEnvUserStore, createFallbackUserStore, type AdminUserStore } from "@/lib/auth/user-store";
import type { AdminUser } from "@/lib/auth/types";

/**
 * Data Access Layer (DAL) ของหลังบ้าน — **ฝั่งเซิร์ฟเวอร์เท่านั้น**
 *
 * เอกสาร Next 16 (`02-guides/authentication.md`) แนะนำให้รวม "อ่านเซสชัน + ตรวจสิทธิ์" ไว้ที่เดียว
 * และให้ทุกหน้าที่แตะข้อมูลเรียกผ่านฟังก์ชันนี้ → ไม่มีทางที่หน้าใดจะลืมตรวจสิทธิ์
 *
 * กติกาโปรเจกต์ที่บังคับใช้ที่นี่
 * - *MUST check authorisation on the server for every request that reads or writes data*
 * - คุกกี้เซสชันตั้ง flag ที่เดียวใน `sessionCookieOptions()`
 * - ไม่มีค่าเริ่มต้นลับ ๆ: ถ้า `SESSION_SECRET` ไม่พอ/สั้นไป → ถือว่า "ยังตั้งค่าไม่ครบ" ไม่ใช่ปล่อยผ่าน
 */

/** user-agent ของคำขอนี้ (ใช้เป็น "คำใบ้อุปกรณ์" ในรายการเซสชัน) — อ่านจาก headers แบบไม่โยน error */
async function currentUserAgent(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    return (await headers()).get("user-agent");
  } catch {
    return null;
  }
}

/** อ่าน env แบบรวม — ที่เดียว เพื่อให้ตรวจได้ว่าอะไรขาด */
function readEnv(): {
  email: string | undefined;
  passwordHash: string | undefined;
  name: string | undefined;
  role: string | undefined;
  secret: string | undefined;
} {
  return {
    email: process.env.ADMIN_EMAIL,
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
    name: process.env.ADMIN_NAME,
    role: process.env.ADMIN_ROLE,
    secret: process.env.SESSION_SECRET,
  };
}

/** ที่อยู่ของหน้า "ไม่มีสิทธิ์" — ผู้ใช้จะถูกพามาที่นี่เมื่อบทบาทไม่พอ */
export const ADMIN_DENIED_PATH = "/admin/denied";

/**
 * store ของบัญชีผู้ดูแล — **ฐานข้อมูลก่อน แล้วบัญชีจาก env เป็นตัวสำรอง** (X1.10 · รอบที่ 84)
 *
 * - มี `DATABASE_URL` + ตาราง `admin_user` ⇒ บัญชีงานประจำอยู่ใน DB (เพิ่ม/ปิด/เปลี่ยนบทบาทได้)
 * - บัญชีจาก env ยังใช้ได้เสมอ = **ประตูหลังกันถูกล็อกออก** (ถ้า DB ว่าง/ตั้งค่าผิด ยังเข้าไปสร้างบัญชีแรกได้)
 * - ไม่มี DB เลย (เดโม) ⇒ ใช้ env อย่างเดียวเหมือนเดิม
 *
 * ⚠️ รหัสผ่านตรวจจาก hash เสมอ · ไม่มีทางเดิน绕过รหัสผ่านได้จากไฟล์นี้
 */
export function getAdminUserStore(): AdminUserStore | null {
  const env = readEnv();
  const envStore = createEnvUserStore({
    email: env.email,
    passwordHash: env.passwordHash,
    name: env.name,
    role: env.role,
  });
  const dbStore = createDbUserStore();

  if (dbStore === null) return envStore;
  if (envStore === null) return dbStore;
  return createFallbackUserStore(dbStore, envStore);
}

/** หลังบ้านพร้อมใช้งานหรือยัง — ถ้าไม่พร้อม หน้าล็อกอินต้องบอกวิธีตั้งค่า ไม่ใช่ฟอร์มที่กดแล้วเงียบ */
export function isAdminConfigured(): boolean {
  const env = readEnv();
  return isSecretUsable(env.secret) && getAdminUserStore() !== null;
}

function readSecret(): string | null {
  const env = readEnv();
  return isSecretUsable(env.secret) ? (env.secret as string) : null;
}

/**
 * คุกกี้ควรเป็น `secure` (ส่งเฉพาะ HTTPS) หรือไม่
 * - production → true
 * - ยกเว้นได้ด้วย `ADMIN_COOKIE_INSECURE=1` สำหรับ **เดโมในวงแลนด์ที่รันบน http** เท่านั้น
 *   (ถ้าเปิด secure บน http เบราว์เซอร์จะไม่เก็บคุกกี้ → ล็อกอินไม่เข้าและดูเหมือนบั๊ก)
 */
function shouldUseSecureCookies(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ADMIN_COOKIE_INSECURE !== "1";
}

/**
 * ผู้ใช้ของคำขอนี้ — `cache()` ทำให้อ่านคุกกี้/ค้นบัญชีครั้งเดียวต่อการ render หนึ่งรอบ
 * คืน null = ยังไม่ล็อกอิน (ไม่โยน error) · ผู้เรียกตัดสินว่าจะ redirect หรือไม่
 */
export const getSessionUser = cache(async (): Promise<AdminUser | null> => {
  /*
    ⚠️ บังคับให้เรนเดอร์ตอนมีคำขอจริง (`connection()` ตามเอกสาร Next 16)
    บทเรียนที่เจอจริง (2026-10-02): ถ้าไม่ใส่ หน้า /admin จะถูก prerender ตอน build
    (ตอน build ไม่มีคุกกี้ → ได้ "หน้า static ที่ redirect ไปหน้าล็อกอิน" ฝังตายไว้)
    ผลคือ **ล็อกอินถูกก็ยังถูกเด้งไปหน้าล็อกอิน** — เจอได้ด้วยการยิงเซิร์ฟเวอร์จริงเท่านั้น
    วางไว้ที่ DAL = ทุกหน้าของหลังบ้านได้ความถูกต้องนี้พร้อมกัน (ประตูเดียว)
  */
  await connection();

  const secret = readSecret();
  const store = getAdminUserStore();
  if (secret === null || store === null) return null;

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token === undefined || token === "") return null;

  const payload = parseSessionToken(token, secret, Date.now());
  if (payload === null) return null;

  const account = await store.findById(payload.userId);
  if (account === null || account.disabled) return null;

  /*
    ตรวจ "เซสชันที่เพิกถอนได้" (รอบที่ 95)
    - มีฐานข้อมูล ⇒ **ต้องมีแถวเซสชันที่ยังใช้งานได้** (คุกกี้เก่าที่ไม่มี `sid` = ใช้ไม่ได้ ⇒ ล็อกอินใหม่)
    - ไม่มีฐานข้อมูล (เดโม) ⇒ ใช้แบบเดิม (ไม่มีที่ให้เพิกถอน — ดูคอมเมนต์ใน `session.ts`)
  */
  if (isDatabaseConfigured()) {
    if (payload.sid === undefined) return null;
    const session = await findAdminSession(payload.sid);
    if (session === null || !session.active || session.userId !== account.id) return null;
    /* อัปเดต "เห็นล่าสุด" แบบไม่ถี่ — ทำให้รายการเซสชันบนหน้าจอมีข้อมูลจริง */
    await touchAdminSession(payload.sid);
  }

  /* สิทธิ์ที่ใช้จริงต้องมาจาก "บัญชี" ไม่ใช่จากค่าที่อยู่ในโทเคน (โทเคนแก่กว่าได้) */
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    disabled: account.disabled,
  };
});

/**
 * ต่ออายุ "บัตรผ่านดูเว็บระหว่างปิดปรับปรุง" (รอบที่ 96)
 *
 * ⚠️ เรียกได้เฉพาะใน Server Action / Route Handler (ตั้งคุกกี้จาก Server Component ไม่ได้)
 * ⚠️ **ต้องเรียกหลังตรวจเซสชันกับฐานข้อมูลแล้วเท่านั้น** — นี่คือหัวใจของกลไก:
 *    เซสชันที่ถูกเพิกถอน/บัญชีที่ถูกปิด จะไม่มีใครต่ออายุบัตรผ่านให้ ⇒ บัตรผ่านเก่าตายภายใน ≤ 15 นาที
 */
export async function refreshMaintenanceBypass(): Promise<void> {
  const secret = readSecret();
  if (secret === null) return;

  const jar = await cookies();
  const now = Date.now();
  const current = jar.get(MAINTENANCE_BYPASS_COOKIE)?.value;
  const expiresAt = current === undefined ? null : (parseMaintenanceBypassToken(current, secret, now)?.expiresAt ?? null);
  if (!shouldRefreshMaintenanceBypass(expiresAt, now)) return;

  const next = nextMaintenanceBypassExpiry(now);
  jar.set(MAINTENANCE_BYPASS_COOKIE, createMaintenanceBypassToken(next, secret), {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    expires: new Date(next),
  });
}

/** รหัสเซสชันของคำขอนี้ (`null` = ไม่มี/อ่านไม่ได้) — ใช้ตอน "ตัดเซสชันอื่นทั้งหมด" ของตัวเอง */
export async function currentSessionId(): Promise<string | null> {
  const secret = readSecret();
  if (secret === null) return null;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token === undefined || token === "") return null;
  const payload = parseSessionToken(token, secret, Date.now());
  return payload?.sid ?? null;
}

/**
 * ประตูของหลังบ้าน — **ไม่ล็อกอิน = ไปหน้าล็อกอิน · สิทธิ์ไม่พอ = ไปหน้า "ไม่มีสิทธิ์"**
 *
 * วิธีใช้ (X1.10 · รอบที่ 84)
 * ```ts
 * await requireAdminUser("media");   // ต้องมีสิทธิ์จัดการคลังภาพ
 * ```
 * ⚠️ **ต้องส่งรหัสสิทธิ์เสมอ** — เทสต์ `scripts/test-rbac.ts` สแกนทุกไฟล์ใน `app/admin/**`
 *    ว่ามีการเรียกพร้อมสิทธิ์ (ยกเว้นหน้า/action ที่ไม่ต้องล็อกอิน เช่นหน้าล็อกอิน)
 *
 * การบังคับสิทธิ์อยู่ใน "ประตูเดียว" แบบนี้ เพื่อไม่ให้มีหน้าที่ลืมตรวจ
 * และ **สิทธิ์มาจากบัญชีที่อ่านสด ๆ** (ดู `getSessionUser`) ⇒ เปลี่ยนบทบาทแล้วมีผลทันที
 */
export async function requireAdminUser(permission: AdminPermission): Promise<AdminUser> {
  const user = await getSessionUser();
  if (user === null) redirect(ADMIN_LOGIN_PATH);
  if (!can(user.role, permission)) redirect(ADMIN_DENIED_PATH);
  return user;
}

/** ตั้งคุกกี้เซสชัน — เรียกได้เฉพาะใน Server Action / Route Handler เท่านั้น */
export async function startSession(user: AdminUser): Promise<void> {
  /*
    ⚠️ บัญชีโหมด env ไม่มีแถวในตาราง admin_user ⇒ แถวเซสชันจะผิด FK แล้วล็อกอินล้ม
    (เคสจริงบนคลาวด์ 2026-10-05: หน้า login ขึ้น "เกิดข้อผิดพลาดในระบบ" ทั้งที่รหัสถูก)
  */
  if (user.id === ENV_ADMIN_ID) {
    await ensureEnvAdminUser({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });
  }

  const secret = readSecret();
  if (secret === null) {
    throw new Error("SESSION_SECRET is missing or too short");
  }

  const expiresAt = sessionExpiry(Date.now());

  /*
    บันทึกเซสชันลงฐานข้อมูล (รอบที่ 95) เพื่อให้ "เพิกถอนได้"
    - มีฐานข้อมูล: บันทึกไม่สำเร็จ = **ไม่ให้ล็อกอิน** (โยน error → action ตอบ "server")
      เพราะเซสชันที่เพิกถอนไม่ได้คือช่องที่เรากำลังปิดอยู่ (fail-closed)
    - ไม่มีฐานข้อมูล (เดโม): ล็อกอินได้ตามเดิม แต่คุกกี้จะไม่มี `sid` ⇒ เพิกถอนไม่ได้
  */
  let sid: string | undefined;
  if (isDatabaseConfigured()) {
    sid = newSessionId();
    const recorded = await createAdminSession({
      userId: user.id,
      sid,
      expiresAt: new Date(expiresAt),
      userAgent: await currentUserAgent(),
    });
    if (!recorded) throw new Error("cannot record admin session");
  }

  const token = createSessionToken(
    { userId: user.id, role: user.role, expiresAt, ...(sid === undefined ? {} : { sid }) },
    secret,
  );

  (await cookies()).set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt, shouldUseSecureCookies()));
}

/** ออกจากระบบ = **เพิกถอนเซสชันในฐานข้อมูลด้วย** (ไม่ใช่แค่ลบคุกกี้ที่เครื่องนี้) */
export async function endSession(): Promise<void> {
  const sid = await currentSessionId();
  if (sid !== null) {
    await revokeAdminSessions({ hash: hashSessionId(sid), actor: "self-logout" });
  }
  (await cookies()).delete(SESSION_COOKIE_NAME);
  /* ลบบัตรผ่านดูเว็บด้วย — ออกจากระบบแล้วต้องดูเว็บที่ปิดอยู่ไม่ได้ */
  (await cookies()).delete(MAINTENANCE_BYPASS_COOKIE);
}

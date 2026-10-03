import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ADMIN_LOGIN_PATH } from "@/lib/auth/credentials";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  isSecretUsable,
  parseSessionToken,
  sessionCookieOptions,
  sessionExpiry,
} from "@/lib/auth/session";
import { createEnvUserStore, type AdminUserStore } from "@/lib/auth/user-store";
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

/** store ของบัญชีผู้ดูแล (เฟสนี้ = โหมด env · B1b จะสลับเป็น DB ที่นี่) */
export function getAdminUserStore(): AdminUserStore | null {
  const env = readEnv();
  return createEnvUserStore({
    email: env.email,
    passwordHash: env.passwordHash,
    name: env.name,
    role: env.role,
  });
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
 * ใช้ในทุกหน้า/ทุก action ของหลังบ้าน — ไม่ล็อกอิน = เด้งไปหน้าล็อกอิน
 * (เป็น "ประตู" จุดเดียว ไม่กระจายการตรวจสิทธิ์ไปทั่วโค้ด)
 */
export async function requireAdminUser(): Promise<AdminUser> {
  const user = await getSessionUser();
  if (user === null) redirect(ADMIN_LOGIN_PATH);
  return user;
}

/** ตั้งคุกกี้เซสชัน — เรียกได้เฉพาะใน Server Action / Route Handler เท่านั้น */
export async function startSession(user: AdminUser): Promise<void> {
  const secret = readSecret();
  if (secret === null) {
    throw new Error("SESSION_SECRET is missing or too short");
  }

  const expiresAt = sessionExpiry(Date.now());
  const token = createSessionToken({ userId: user.id, role: user.role, expiresAt }, secret);

  (await cookies()).set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt, shouldUseSecureCookies()));
}

/** ลบคุกกี้เซสชัน (ออกจากระบบ) */
export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}

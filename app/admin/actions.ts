"use server";

import { redirect } from "next/navigation";

import { type LoginState } from "@/features/admin/login-state";
import { getAdminUserStore, endSession, isAdminConfigured, startSession } from "@/lib/auth/dal";
import { recordAudit } from "@/lib/audit/log";
import { getSessionUser } from "@/lib/auth/dal";
import { loginRateLimit, recordLoginAttempt } from "@/lib/auth/attempts";
import { attemptLogin, type LoginOutcome } from "@/lib/auth/login";
import { retryAfterMinutes } from "@/lib/auth/rate-limit";
import { verifyPassword } from "@/lib/auth/password";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/credentials";
import { equalizeTiming } from "@/lib/auth/user-store";
import { isValidEmail } from "@/lib/validate";

/**
 * Server Actions ของหลังบ้าน (ไฟล์นี้ส่งออกได้เฉพาะ async function)
 *
 * ⚠️ ข้อจำกัดที่ตั้งใจและต้องรู้ (จะปิดในเฟส B3 เมื่อมี DB)
 * - **ยังไม่มี rate limit ที่แท้จริง** (ต้องมีที่เก็บถาวร — in-memory ใช้บน serverless ไม่ได้ผล)
 *   ⇒ ตอนนี้ทำได้แค่ "หน่วงเมื่อล้มเหลว" เพื่อให้เดารหัสช้าลง · **ห้ามเปิดหลังบ้านสู่อินเทอร์เน็ตก่อนมี B3**
 * - ไม่บันทึก audit log (ต้องมีตารางใน DB เหมือนกัน)
 */

/** หน่วงเมื่อล็อกอินไม่ผ่าน — ให้การเดารหัสช้าลง (scrypt กินเวลาอยู่แล้ว ~100ms) */
const FAILURE_DELAY_MS = 400;

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = readField(formData, "email");
  const password = readField(formData, "password");

  if (email === "" || password === "" || !isValidEmail(email)) {
    return { error: "required" };
  }

  if (!isAdminConfigured()) {
    return { error: "notConfigured" };
  }

  /*
    จำกัดการพยายามล็อกอิน (X2.1) — เช็คก่อนแตะที่เก็บรหัสผ่าน
    ⚠️ ล็อกตาม "อีเมลที่พยายาม" ทุกอีเมล (ไม่ว่ามีบัญชีจริงหรือไม่) ⇒ ข้อความไม่บอกใบ้ว่าอีเมลไหนมีอยู่
  */
  const limit = await loginRateLimit(email);
  if (limit.locked) {
    await recordAudit({ action: "login-failure", actorEmail: email, target: "login", detail: "locked" });
    return { error: "locked", locked: { minutes: retryAfterMinutes(limit.retryAfterMs) } };
  }

  let outcome: LoginOutcome;

  try {
    /* ตรรกะการตัดสินอยู่ใน lib/auth/login.ts (บริสุทธิ์ + มีเทสต์) — ที่นี่ทำแค่ต่อสาย */
    outcome = await attemptLogin(
      { email, password },
      { store: getAdminUserStore(), verify: verifyPassword, equalize: equalizeTiming },
    );
  } catch {
    /* ไม่เปิดเผยรายละเอียดภายในให้ผู้ใช้ (กติกา: ห้ามคืน stack trace) */
    return { error: "server" };
  }

  if (outcome.kind === "unconfigured") return { error: "notConfigured" };

  if (outcome.kind === "invalid") {
    await recordLoginAttempt(email, false);
    await recordAudit({ action: "login-failure", actorEmail: email, target: "login", detail: null });
    await delay(FAILURE_DELAY_MS);
    return { error: "invalid" };
  }

  try {
    await startSession(outcome.user);
  } catch {
    return { error: "server" };
  }

  await recordLoginAttempt(email, true);
  await recordAudit({ action: "login-success", actorEmail: email, target: "login", detail: null });

  /* redirect ต้องอยู่นอก try/catch — ตัวมันเองโยน error ภายในเพื่อหยุด render */
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  if (user !== null) await recordAudit({ action: "logout", actorEmail: user.email, target: "login", detail: null });
  await endSession();
  redirect(ADMIN_LOGIN_PATH);
}

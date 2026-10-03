"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { type LoginState } from "@/features/admin/login-state";
import { getAdminUserStore, currentSessionId, endSession, isAdminConfigured, requireAdminUser, startSession } from "@/lib/auth/dal";
import { touchAdminLastLogin } from "@/lib/auth/users-repository";
import { revokeSessionsForUser } from "@/lib/auth/sessions-repository";
import { recordAudit } from "@/lib/audit/log";
import { getSessionUser } from "@/lib/auth/dal";
import { loginRateLimit, recordLoginAttempt } from "@/lib/auth/attempts";
import { attemptLogin, type LoginOutcome } from "@/lib/auth/login";
import { retryAfterMinutes } from "@/lib/auth/rate-limit";
import { verifyPassword } from "@/lib/auth/password";
import { ADMIN_LOGIN_PATH } from "@/lib/auth/credentials";
import { equalizeTiming } from "@/lib/auth/user-store";
import { purgeNow, runScheduledPurge } from "@/lib/retention/purge";
import { publishDueScheduled, runScheduledPublish } from "@/lib/blocks/publish-scheduler";
import { refreshPublicSite } from "@/lib/cache/refresh";
import { isValidEmail } from "@/lib/validate";

/**
 * Server Actions ของหลังบ้าน (ไฟล์นี้ส่งออกได้เฉพาะ async function)
 *
 * สถานะปัจจุบัน (อัปเดต 2026-10-03)
 * - **มี rate limit จริงแล้ว** (X2a รอบที่ 65 — ตาราง `login_attempt` + `lib/auth/rate-limit.ts`)
 * - **เขียน audit log จริงแล้ว** (X2.2) ทั้งตอนล็อกอินสำเร็จ/ล้มเหลว และตอนเผยแพร่เนื้อหา
 * - ⚠️ แต่ยัง **ไม่ควรเปิด `/admin` สู่อินเทอร์เน็ต** ก่อนทบทวนความปลอดภัย/PDPA รอบสุดท้าย (มติ D4)
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

  /* บันทึกเวลาล็อกอินล่าสุด (X1.10) — ใช้ดูว่าบัญชีไหนยังใช้อยู่จริงก่อนปิด/ลบ
     ⚠️ บัญชีโหมด env ไม่มีแถวในตาราง ⇒ ฟังก์ชันนี้ข้ามให้เอง · ล้มเหลวก็ไม่ทำให้ล็อกอินล้ม */
  await touchAdminLastLogin(outcome.user.id);

  /*
    ลบข้อมูลส่วนบุคคลที่หมดอายุ (X2b · PDPA) — ทำตอนล็อกอินเพราะโปรเจกต์ไม่มี cron/worker
    · ตัวมันเองกันซ้ำ 24 ชม. (`shouldRunPurge`) ⇒ ไม่ได้ลบทุกครั้งที่เข้า
    · ล้มเหลว/ไม่มี DB = คืน null เงียบ ๆ — **ห้ามทำให้ล็อกอินล้มเพราะงานลบรอบนี้**
  */
  await runScheduledPurge({ actorEmail: email });

  /*
    เผยแพร่หน้าที่ "ตั้งกำหนดเวลาไว้และครบกำหนดแล้ว" (X2.7) — ใช้เหตุผลเดียวกับตัวลบตามระยะเก็บ:
    โปรเจกต์นี้ไม่มีตัวจับเวลา/worker ⇒ ล็อกอินหลังบ้านคือจังหวะที่งานตามรอบได้ทำ
    · ล้มเหลว/ไม่มี DB = คืน null เงียบ ๆ — **ห้ามทำให้ล็อกอินล้ม**
    · เผยแพร่จริง = ทำให้หน้าเว็บสดใหม่ทันที (ISR) · ถ้าสั่งไม่สำเร็จก็ไม่ทำให้ล็อกอินล้ม
  */
  const scheduled = await runScheduledPublish({ actorEmail: email });
  if (scheduled !== null && scheduled.published.length > 0) {
    try {
      await refreshPublicSite("page");
    } catch {
      /* ปล่อยผ่าน — ISR จะทำให้หน้าเว็บสดใหม่เองภายในรอบถัดไป */
    }
  }

  /* redirect ต้องอยู่นอก try/catch — ตัวมันเองโยน error ภายในเพื่อหยุด render */
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  if (user !== null) await recordAudit({ action: "logout", actorEmail: user.email, target: "login", detail: null });
  await endSession();
  redirect(ADMIN_LOGIN_PATH);
}

/**
 * **ตัดเซสชันอื่นทั้งหมดของตัวเอง** (รอบที่ 95) — ใช้จากหน้า "กิจกรรมของฉัน"
 *
 * - ใช้ `<form action={...}>` ธรรมดา ⇒ ทำงานได้แม้ปิด JavaScript
 * - คงเซสชันที่กำลังใช้อยู่ไว้ (ไม่ใช่ "ออกจากระบบ")
 * - ใช้สิทธิ์ `content` (มีทุกบทบาท) เพราะเป็นการจัดการเซสชันของตัวเอง ไม่ใช่ของคนอื่น
 */
export async function revokeOwnOtherSessionsAction(): Promise<void> {
  const user = await requireAdminUser("content");
  const sid = await currentSessionId();
  await revokeSessionsForUser({ userId: user.id, actor: user.email, exceptSid: sid, detail: "self-revoke-others" });
  revalidatePath("/admin/activity");
  redirect("/admin/activity");
}

/**
 * "ลบข้อมูลที่หมดอายุตอนนี้" — ผู้ดูแลกดเองจากหน้าภาพรวม (X2b)
 *
 * - ข้ามการกัน 24 ชม. (ผู้ใช้สั่งชัดเจน) แต่ยังบันทึก audit log เสมอ
 * - ลบถาวร: ใบสมัครที่หมดอายุ + ไฟล์เรซูเม่ของใบนั้น (cascade) — ปุ่มมีคำเตือนบนหน้าจอแล้ว
 */
export async function purgeRetentionNowAction(): Promise<void> {
  /* ลบข้อมูลส่วนบุคคลถาวร = สิทธิ์ระดับผู้ดูแลระบบเท่านั้น (X1.10) */
  const user = await requireAdminUser("retention");
  await purgeNow({ actorEmail: user.email });
  revalidatePath("/admin");
}

/**
 * "เผยแพร่หน้าที่ครบกำหนดเดี๋ยวนี้" — ผู้ดูแลกดเองจากหน้าภาพรวม (X2.7)
 *
 * ทำไมต้องมีปุ่มนี้ทั้งที่ตัวเผยแพร่ตามกำหนดทำงานตอนล็อกอินอยู่แล้ว
 * - กำหนดเวลาที่ครบระหว่างวันจะถูกเก็บไว้จนกว่าจะมีคนล็อกอินใหม่ ⇒ ปุ่มนี้ทำให้ "เห็นแล้วสั่งได้เลย"
 * - ใช้สิทธิ์ `content` (ทุกบทบาทมี) เพราะเป็นการเผยแพร่เนื้อหา ไม่ใช่การแตะข้อมูลส่วนบุคคล
 * - ล้มเหลวไม่ทำให้หน้าจอพัง (ปุ่มนี้ไม่คืนข้อความ — ร่องรอยใน audit log/การ์ดจะบอกผลเอง)
 */
export async function publishScheduledNowAction(): Promise<void> {
  const user = await requireAdminUser("content");

  let published = 0;
  try {
    const report = await publishDueScheduled({ actorEmail: user.email });
    published = report === null ? 0 : report.published.length;
  } catch {
    published = 0;
  }

  revalidatePath("/admin");
  if (published > 0) await refreshPublicSite("page");
}

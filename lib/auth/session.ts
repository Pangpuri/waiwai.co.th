import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { isAdminRole, type AdminRole, type SessionPayload } from "@/lib/auth/types";

/**
 * เซสชันของผู้ดูแล — **opaque token ที่เซ็นด้วย HMAC** (ไม่ใช่ JWT)
 *
 * ทำไมไม่ใช้ JWT (ทั้งที่เอกสาร Next แนะนำ `jose`)
 * - JWT ต้องเพิ่ม dependency · และที่สำคัญคือ **ยกเลิกไม่ได้** จนกว่าจะหมดอายุ
 *   (เซสชันหลังบ้านควรถูกเตะออกได้ทันทีเมื่อพนักงานออก/เครื่องหาย)
 * - เซ็นเองด้วย `node:crypto` เป็นโค้ดสั้น ๆ ที่ทดสอบได้ ไม่มีของใหม่ให้ตาม security patch
 * - เมื่อมี DB (เฟส B1b) โทเคนนี้จะถูกเก็บเป็น **hash ในตาราง `admin_session`** เพื่อให้เพิกถอนได้จริง
 *   — รูปแบบ token/คุกกี้ยังเหมือนเดิม ผู้ใช้ไม่ต้องล็อกอินใหม่
 *
 * รูปแบบ token: `base64url(JSON payload).base64url(HMAC-SHA256)`
 */

export const SESSION_COOKIE_NAME = "waiwai_admin_session";

/** อายุเซสชัน 8 ชั่วโมง (หนึ่งวันทำงาน) — สั้นพอสำหรับเซสชันหลังบ้าน ไม่ต้องต่ออายุอัตโนมัติ */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** ความยาวต่ำสุดของ `SESSION_SECRET` — สั้นกว่านี้ให้ปฏิเสธตั้งแต่ตอนสตาร์ต ไม่ใช่ปล่อยผ่าน */
export const MIN_SECRET_LENGTH = 32;

export type SessionCookieOptions = {
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: string;
  readonly expires: Date;
};

function base64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function sign(payloadPart: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(payloadPart).digest());
}

/** สร้างค่าลับสำหรับเซสชัน (ใช้ตอนตั้งค่า env ครั้งแรก) */
export function generateSecret(): string {
  return base64url(randomBytes(32));
}

/** `SESSION_SECRET` ใช้ได้หรือยัง — ไม่เดาค่า ไม่มีค่าตั้งต้นให้ (กติกาโปรเจกต์) */
export function isSecretUsable(secret: string | undefined): boolean {
  return typeof secret === "string" && secret.trim().length >= MIN_SECRET_LENGTH;
}

export function createSessionToken(payload: SessionPayload, secret: string): string {
  const payloadPart = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${payloadPart}.${sign(payloadPart, secret)}`;
}

function readPayloadPart(decoded: string): SessionPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const candidate = parsed as { userId?: unknown; role?: unknown; expiresAt?: unknown; sid?: unknown };
  if (typeof candidate.userId !== "string" || candidate.userId === "") return null;
  if (typeof candidate.role !== "string" || !isAdminRole(candidate.role)) return null;
  if (typeof candidate.expiresAt !== "number" || !Number.isFinite(candidate.expiresAt)) return null;

  /*  เป็นทางเลือก (โหมดไม่มีฐานข้อมูล) — ถ้ามีต้องเป็นสตริงที่ไม่ว่างและไม่ยาวผิดปกติ */
  if (candidate.sid !== undefined) {
    if (typeof candidate.sid !== "string" || candidate.sid === "" || candidate.sid.length > 200) return null;
    return { userId: candidate.userId, role: candidate.role, expiresAt: candidate.expiresAt, sid: candidate.sid };
  }

  return { userId: candidate.userId, role: candidate.role, expiresAt: candidate.expiresAt };
}

/**
 * ตรวจ token — คืน payload เมื่อถูกต้องและยังไม่หมดอายุ · คืน null ทุกกรณีอื่น
 * (ไม่แยกว่า "ลายเซ็นผิด" หรือ "หมดอายุ" เพื่อไม่ให้ผู้โจมตีเก็บข้อมูลไปใช้)
 */
export function parseSessionToken(token: string, secret: string, now: number): SessionPayload | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payloadPart = token.slice(0, separator);
  const signaturePart = token.slice(separator + 1);

  const expected = Buffer.from(sign(payloadPart, secret), "utf8");
  const received = Buffer.from(signaturePart, "utf8");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  const payload = readPayloadPart(Buffer.from(payloadPart, "base64url").toString("utf8"));
  if (payload === null) return null;
  if (payload.expiresAt <= now) return null;

  return payload;
}

/**
 * ตัวเลือกคุกกี้ — ตั้งจากที่เดียว (กติกา: cookie flags set in one place)
 * `secure` = ส่งเฉพาะ HTTPS: เปิดใน production · ปิดได้ด้วย `ADMIN_COOKIE_INSECURE=1`
 * (จำเป็นสำหรับเดโมในวงแลนด์ที่รัน `next start` บน http — **ห้ามใช้ค่านี้บนอินเทอร์เน็ต**)
 */
export function sessionCookieOptions(expiresAt: number, secure: boolean): SessionCookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  };
}

/** เวลาหมดอายุของเซสชันใหม่ */
export function sessionExpiry(now: number): number {
  return now + SESSION_TTL_MS;
}

export type { AdminRole, SessionPayload };

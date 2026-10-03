import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  MAX_ACTIVE_SESSIONS_PER_USER,
  SESSION_TOUCH_MINUTES,
  hashSessionId,
  isSessionActive,
  newSessionId,
} from "@/lib/auth/sessions-repository";
import { SESSION_TTL_MS, createSessionToken, parseSessionToken } from "@/lib/auth/session";
import { RETENTION_CLASSES, RETENTION_DAYS, LOG_RETENTION_CLASSES } from "@/lib/retention/plan";

/**
 * เทสต์เซสชันหลังบ้านที่ "เพิกถอนได้" (รอบที่ 95)
 *
 * ตรรกะที่ทดสอบได้โดยไม่ต้องมี DB อยู่ที่ `isSessionActive` / `hashSessionId` / `newSessionId`
 * ส่วนที่เหลือเป็นการสแกนซอร์ส: บังคับว่าจุดสำคัญยัง "ต่อสาย" อยู่จริง (ด่านกันลืม)
 */

const root = join(import.meta.dirname, "..");
const read = (...parts: readonly string[]): string => readFileSync(join(root, ...parts), "utf8");

test("session: รหัสเซสชันสุ่มไม่ซ้ำ และยาวพอ", () => {
  const ids = new Set<string>();
  for (let index = 0; index < 200; index += 1) {
    const sid = newSessionId();
    assert.ok(sid.length >= 40, `sid ต้องยาวพอ (ได้ ${sid.length})`);
    assert.match(sid, /^[A-Za-z0-9_-]+$/, "sid ต้องเป็น base64url เท่านั้น");
    ids.add(sid);
  }
  assert.equal(ids.size, 200, "ต้องไม่ซ้ำกันเลย");
});

test("session: เก็บเป็น hash เท่านั้น (ค่าเดิมได้ค่าเดิม · ค่าต่างกันได้ค่าต่างกัน)", () => {
  const sid = "ตัวอย่าง-sid-ทดสอบ";
  assert.equal(hashSessionId(sid), hashSessionId(sid), "ค่าเดิมต้องได้ hash เดิม (ใช้ค้นแถวเดิมได้)");
  assert.notEqual(hashSessionId(sid), hashSessionId(`${sid}2`));
  assert.equal(hashSessionId(sid).length, 64, "sha256 = 64 hex");
  assert.ok(!hashSessionId(sid).includes(sid), "hash ต้องไม่ใช่ค่าดิบ");
});

test("session: ใช้งานได้เฉพาะเมื่อยังไม่ถูกเพิกถอนและยังไม่หมดอายุ", () => {
  const now = Date.now();
  const future = new Date(now + 1000).toISOString();
  const past = new Date(now - 1000).toISOString();

  assert.equal(isSessionActive({ revokedAt: null, expiresAt: future }, now), true, "ยังไม่เพิกถอน + ยังไม่หมดอายุ = ใช้ได้");
  assert.equal(isSessionActive({ revokedAt: past, expiresAt: future }, now), false, "ถูกเพิกถอน = ใช้ไม่ได้");
  assert.equal(isSessionActive({ revokedAt: null, expiresAt: past }, now), false, "หมดอายุ = ใช้ไม่ได้");
  assert.equal(isSessionActive({ revokedAt: null, expiresAt: "ไม่ใช่วันที่" }, now), false, "ค่าเพี้ยน = ใช้ไม่ได้ (fail-closed)");
});

test("session: token พา sid ไปด้วย และปฏิเสธ sid ที่ผิดรูป", () => {
  const secret = "s".repeat(40);
  const payload = { userId: "usr_test", role: "admin" as const, expiresAt: Date.now() + 60_000, sid: "sid-abc" };

  const token = createSessionToken(payload, secret);
  const parsed = parseSessionToken(token, secret, Date.now());
  assert.equal(parsed?.sid, "sid-abc", "sid ต้องรอดผ่าน token");
  assert.equal(parsed?.userId, "usr_test");

  /* ไม่มี sid = โหมดไม่มีฐานข้อมูล (ยังต้องใช้ได้) */
  const noSid = createSessionToken({ userId: "usr_test", role: "admin", expiresAt: Date.now() + 60_000 }, secret);
  assert.equal(parseSessionToken(noSid, secret, Date.now())?.sid, undefined, "ไม่ส่ง sid = ไม่มี sid");

  /* sid ผิดรูป (ว่าง/ยาวเกิน/ไม่ใช่สตริง) = ปฏิเสธทั้ง token */
  assert.equal(parseSessionToken(createSessionToken({ ...payload, sid: "" }, secret), secret, Date.now()), null, "sid ว่าง = ปฏิเสธ");
  assert.equal(
    parseSessionToken(createSessionToken({ ...payload, sid: "x".repeat(500) }, secret), secret, Date.now()),
    null,
    "sid ยาวผิดปกติ = ปฏิเสธ",
  );
});

test("session: ระยะเก็บเป็นชั้นข้อมูลของเจ้าหน้าที่ และตัวเลขอยู่ที่ไฟล์นโยบายเท่านั้น", () => {
  assert.ok(RETENTION_CLASSES.includes("adminSession"), "ต้องมีชั้นข้อมูล adminSession");
  assert.ok(LOG_RETENTION_CLASSES.includes("adminSession"), "ต้องอยู่ในกลุ่มร่องรอยการใช้งาน");
  assert.equal(RETENTION_DAYS.adminSession, 30, "ระยะเก็บเซสชัน = 30 วัน (นับจากหมดอายุ/ถูกเพิกถอน)");

  const purge = read("lib", "retention", "purge.ts");
  assert.ok(purge.includes("coalesce(revoked_at, expires_at)"), "ตัวลบต้องวัดจากเวลาหมดอายุ/เพิกถอน ไม่ใช่เวลาสร้าง");

  /* ห้ามมีตัวเลข 30 ที่อื่นในโค้ดเซสชัน (กันหลุดจากนโยบาย) */
  const repository = read("lib", "auth", "sessions-repository.ts");
  assert.ok(repository.includes("MAX_ACTIVE_SESSIONS_PER_USER"), "ต้องมีเพดานเซสชันต่อบัญชี");
  assert.ok(MAX_ACTIVE_SESSIONS_PER_USER >= 1 && SESSION_TOUCH_MINUTES >= 1);
});

test("session: ทุกคำขอต้องตรวจแถวเซสชัน (มี DB) และออกจากระบบต้องเพิกถอนจริง", () => {
  const dal = read("lib", "auth", "dal.ts");

  assert.ok(dal.includes("findAdminSession(payload.sid)"), "getSessionUser ต้องอ่านแถวเซสชัน");
  assert.ok(dal.includes("session.active"), "ต้องเช็คว่ายังใช้งานได้");
  assert.ok(dal.includes("session.userId !== account.id"), "เซสชันต้องเป็นของบัญชีนั้นจริง");
  assert.ok(dal.includes("if (!recorded) throw new Error"), "บันทึกเซสชันไม่ได้ = ต้องไม่ให้ล็อกอิน (fail-closed)");
  assert.ok(dal.includes("if (sid !== null)"), "endSession ต้องเพิกถอนแถวก่อนลบคุกกี้");
  assert.ok(dal.includes("await connection()"), "ยังต้องบังคับเรนเดอร์ตอนมีคำขอ (บทเรียนเดิม)");

  /* ลับบัญชี/ตั้งรหัสใหม่ = ตัดเซสชัน */
  const users = read("lib", "auth", "users-repository.ts");
  assert.ok(users.includes("detail: \"disabled\""), "ปิดบัญชีต้องตัดเซสชัน");
  assert.ok(users.includes("detail: \"password-reset\""), "ตั้งรหัสผ่านใหม่ต้องตัดเซสชัน");

  /* ปุ่ม/หน้าจอ */
  const activity = read("app", "admin", "activity", "page.tsx");
  assert.ok(activity.includes("listActiveAdminSessions(user.id)"), "หน้า \"กิจกรรมของฉัน\" ต้องเห็นเซสชันของตัวเอง");
  assert.ok(activity.includes("revokeOwnOtherSessionsAction"), "ต้องมีปุ่มตัดเซสชันอื่นทั้งหมด");

  const usersPage = read("app", "admin", "users", "page.tsx");
  assert.ok(usersPage.includes("listActiveAdminSessions()"), "หน้าจัดการบัญชีต้องเห็นเซสชันที่ล็อกอินอยู่");
  const manager = read("features", "admin", "ui", "user-manager.tsx");
  assert.ok(manager.includes("revokeSessionsAction"), "ต้องมีปุ่มตัดเซสชันรายตัว/ทั้งบัญชี");

  /* หน้าจอทุกหน้าของหลังบ้านต้องยังผ่านประตูเดียว */
  const activity2 = read("app", "admin", "users", "actions.ts");
  assert.ok(activity2.includes("requireAdminUser("), "action ต้องผ่านประตูสิทธิ์");
});

test("session: migration มีจริงและ idempotent (สร้างใหม่ + เติมคอลัมน์ให้ DB เก่า)", () => {
  const files = readdirSync(join(root, "db", "migrations"));
  const create = files.find((name) => name.startsWith("0012-"));
  const columns = files.find((name) => name.startsWith("0013-"));
  assert.ok(create !== undefined, "ต้องมี migration สร้างตาราง (0012)");
  assert.ok(columns !== undefined, "ต้องมี migration เติมคอลัมน์ให้ DB ที่มีตารางเดิมอยู่แล้ว (0013)");

  const createSql = read("db", "migrations", create);
  assert.ok(createSql.includes("create table if not exists admin_session"), "0012 ต้องสร้างตาราง");
  assert.ok(createSql.includes("on delete cascade"), "ลบบัญชีต้องลบเซสชันตาม");

  const columnsSql = read("db", "migrations", columns);
  assert.ok(columnsSql.includes("add column if not exists last_seen_at"), "0013 ต้องเติม last_seen_at");
  assert.ok(columnsSql.includes("add column if not exists revoked_by"), "0013 ต้องเติม revoked_by");
  assert.ok(columnsSql.includes("add column if not exists user_agent"), "0013 ต้องเติม user_agent");
  assert.ok(!columnsSql.includes("drop table"), "ห้าม drop ตารางในไฟล์นี้");

  /* ตารางจริงต้องมีคอลัมน์ตามที่โค้ดใช้ (อ้างอิงเอกสารสคีมา) */
  const schema = read("db", "schema.sql");
  for (const column of ["token_hash", "user_id", "last_seen_at", "expires_at", "revoked_at", "revoked_by", "user_agent"]) {
    assert.ok(schema.includes(column), `schema.sql ต้องมีคอลัมน์ ${column}`);
  }
});

test("session: TTL ยังสั้นพอสำหรับเซสชันหลังบ้าน", () => {
  assert.equal(SESSION_TTL_MS, 8 * 60 * 60 * 1000, "8 ชั่วโมง (หนึ่งวันทำงาน) — เปลี่ยนแล้วต้องแก้เอกสารด้วย");
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";

import { hintOf, isHealthKeyValid, safeErrorMessage, verdictOf, type AdminHealth } from "@/lib/ops/health";
import { PROXY_BYPASS_PREFIXES, shouldBypassLocaleRouting } from "@/lib/i18n/config";
import { shouldBypassMaintenance } from "@/lib/maintenance/plan";

/**
 * เทสต์รอบที่ 289 — **ตัวตรวจสุขภาพระบบ `/healthz`** (ปิดด้วยคีย์ · ไม่มีรหัสผ่าน)
 *
 * ที่มา (เคสจริง 2 ครั้งในวันเดียว):
 *   1. เดโมเสิร์ฟข้อมูลตัวอย่างเพราะ `DATABASE_URL` ไม่ถึงแอป — กว่าจะรู้ก็เสียเวลาครึ่งวัน
 *   2. `/admin/login` ตอบ "เกิดข้อผิดพลาดในระบบ" เพราะ `DATABASE_URL` เป็น URL ของ role อ่าน
 *      (อ่าน `admin_user` ไม่ได้) — ต้องยิงฟอร์มล็อกอินทดลอง + จำลองด้วย role อ่านกว่าจะรู้
 * ⇒ ด่านนี้ล็อก "กติกาความปลอดภัย" ของ endpoint ไว้ไม่ให้หลุด และตรวจว่าตรรกะวินิจฉัยถูก
 */

const BASE: Omit<AdminHealth, "configured" | "reachable" | "canReadAdminUser" | "canWriteAdminSession"> = {
  role: "neondb_owner",
  database: "neondb",
  envAdminRow: true,
  migrations: 44,
  error: null,
};

test("isHealthKeyValid: ต้องตั้งคีย์ถึงจะใช้ได้ + ไม่ผ่านเมื่อค่าว่าง/ไม่ตรง/ความยาวต่าง", () => {
  assert.equal(isHealthKeyValid("abc", "abc"), true);
  assert.equal(isHealthKeyValid(" abc ", "abc"), true, "ตัดช่องว่างหัวท้าย");
  assert.equal(isHealthKeyValid("abc", undefined), false, "ไม่ตั้ง HEALTH_KEY = ใช้ไม่ได้");
  assert.equal(isHealthKeyValid("abc", ""), false);
  assert.equal(isHealthKeyValid("", "abc"), false);
  assert.equal(isHealthKeyValid(null, "abc"), false);
  assert.equal(isHealthKeyValid("abd", "abc"), false, "คีย์ผิด = ไม่ผ่าน");
  assert.equal(isHealthKeyValid("ab", "abc"), false, "ความยาวต่าง = ไม่ผ่าน (ไม่โยน error)");
});

test("verdictOf: ลำดับการวินิจฉัยถูก (ไม่ตั้ง env → ต่อไม่ได้ → อ่านไม่ได้ → เขียนไม่ได้ → ok)", () => {
  const base: AdminHealth = {
    ...BASE,
    configured: true,
    reachable: true,
    canReadAdminUser: true,
    canWriteAdminSession: true,
  };

  assert.equal(verdictOf(base), "ok");
  assert.equal(verdictOf({ ...base, configured: false, reachable: false }), "admin-not-configured");
  assert.equal(verdictOf({ ...base, reachable: false, error: "28P01" }), "admin-db-error");
  assert.equal(
    verdictOf({ ...base, canReadAdminUser: false, canWriteAdminSession: false }),
    "admin-cannot-read",
    "เคสจริง: DATABASE_URL เป็น role อ่าน ⇒ อ่าน admin_user ไม่ได้",
  );
  assert.equal(verdictOf({ ...base, canWriteAdminSession: false }), "admin-cannot-write");
  assert.equal(
    verdictOf({ ...base, configured: false, reachable: false, canReadAdminUser: false }),
    "admin-not-configured",
    "ไม่ได้ตั้ง env ต้องชนะการวินิจฉัยอื่น (สาเหตุต้นทางสุด)",
  );
});

test("safeErrorMessage: ส่งแค่รหัส+ข้อความสั้น · ไม่โยน error กับค่าประหลาด", () => {
  assert.equal(safeErrorMessage({ code: "42501", message: "permission denied for table admin_user" }), "42501 permission denied for table admin_user");
  assert.equal(safeErrorMessage(new Error("boom")), "boom");
  assert.equal(safeErrorMessage(null), "unknown error");
  assert.equal(safeErrorMessage(undefined), "unknown error");
  const long = safeErrorMessage({ message: "x".repeat(500) });
  assert.ok(long.length <= 160, "ตัดความยาวกัน log บวม");
});

test("hintOf: ทุกคำวินิจฉัยมีคำใบ้ + บอกวิธีแก้ที่ตรงสาเหตุ", () => {
  assert.ok(hintOf("ok").includes("healthy"));
  assert.ok(hintOf("admin-not-configured").includes("DATABASE_URL"));
  assert.ok(hintOf("admin-cannot-read").includes("owner URL"), "บอกให้ใช้ URL ของเจ้าของ");
  assert.ok(hintOf("admin-cannot-write").includes("write"));
  assert.ok(hintOf("admin-db-error").includes("Cannot reach"));
});

test("/healthz: proxy ต้องไม่เติมภาษาให้ และต้องทำงานได้ตอนปิดปรับปรุง", () => {
  assert.ok(PROXY_BYPASS_PREFIXES.includes("/healthz" as (typeof PROXY_BYPASS_PREFIXES)[number]));
  assert.equal(shouldBypassLocaleRouting("/healthz"), true);
  assert.equal(shouldBypassLocaleRouting("/healthz/anything"), true);
  assert.equal(shouldBypassMaintenance({ pathname: "/healthz", hasAdminSession: false }), true);
});

test("/healthz route: ปิดด้วยคีย์เสมอ + ตอบแบบไม่แคช + ห้ามมีรหัสผ่าน/connection string", () => {
  const route = codeOf("app/healthz/route.ts");

  assert.ok(route.includes("process.env.HEALTH_KEY"), "ต้องอ่านคีย์จาก env");
  assert.ok(route.includes("isHealthKeyValid("), "ต้องใช้ตัวตรวจคีย์กลาง");
  assert.ok(route.includes("status: 404"), "คีย์ผิด/ไม่ตั้ง = 404");
  assert.ok(route.includes('dynamic = "force-dynamic"'), "ห้ามถูกแคชเป็น static");
  assert.ok(route.includes("no-store"), "ห้ามแคชคำตอบ");
  assert.ok(route.includes("noindex"), "ห้ามเครื่องค้นหาเก็บ");

  for (const forbidden of ["password_hash", "connectionString", "postgresql://", "process.env.DATABASE_URL"]) {
    assert.ok(!route.includes(forbidden), `ห้ามเปิดเผย/อ้างถึงค่าเชื่อมต่อโดยตรง: ${forbidden}`);
  }
  /* ต้องไม่เขียนข้อมูลเลย — endpoint อ่านเท่านั้น */
  for (const write of ["insert into", "update ", "delete from"]) {
    assert.ok(!route.toLowerCase().includes(write), `ห้ามเขียนฐานข้อมูลจาก /healthz: ${write}`);
  }
});

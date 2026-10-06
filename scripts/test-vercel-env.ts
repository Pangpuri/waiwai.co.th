import assert from "node:assert/strict";
import { test } from "node:test";

import { VERCEL_EXCLUDED_KEYS, planVercelAdminEnv, planVercelEnv } from "@/lib/db/vercel-env";

/**
 * เทสต์ "env ที่จะตั้งบน Vercel" (รอบที่ 116)
 *
 * ที่มา: เจ้าของถามว่า *"หรือจะ import .env เข้าไปดี"*
 * `.env.local` ในเครื่องมี 9 คีย์ ซึ่ง **การ import ทั้งไฟล์จะพัง 2 เรื่อง**
 *   1. `DATABASE_URL` ในไฟล์เป็น **localhost:55432** (Docker) ⇒ เว็บจริงจะไม่มีข้อมูล
 *   2. มีความลับหลังบ้าน (SESSION_SECRET/ADMIN_*) ⇒ จะเปิดประตู `/admin` ออกอินเทอร์เน็ต (ขัดมติ D4)
 * ⇒ เทสต์นี้ล็อกว่า "แผน env สำหรับ Vercel" ต้องมี **แค่** `DATABASE_URL` ที่เป็น endpoint ตรงของคลาวด์
 */

const POOLED =
  "postgresql://neondb_owner:secret@ep-small-shadow-b3ooq1yz-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const DEV_URL = "postgresql://waiwai:waiwai@localhost:55432/waiwai";

test("vercel-env: ใช้ TARGET_DATABASE_URL แต่เปลี่ยนชื่อเป็น DATABASE_URL และตัด -pooler", () => {
  const plan = planVercelEnv({ TARGET_DATABASE_URL: POOLED, DATABASE_URL: DEV_URL });

  assert.ok(plan.line.startsWith("DATABASE_URL="), "บรรทัดที่ให้วางต้องเป็น DATABASE_URL=");
  assert.ok(!plan.line.includes("-pooler"), "ต้องไม่ใช้ pooled endpoint (search_path จะว่าง)");
  assert.ok(plan.line.includes("secret"), "ต้องคงรหัสผ่านจริงไว้ในบรรทัดที่ใช้จริง (ผู้ใช้เป็นคนวางเอง)");
  assert.equal(plan.normalizedToDirect, true);
  assert.equal(plan.host, "ep-small-shadow-b3ooq1yz.c-4.ap-southeast-1.aws.neon.tech");
});

test("vercel-env: ห้ามยกค่าฐานข้อมูลในเครื่อง (localhost) ขึ้น Vercel โดยเด็ดขาด", () => {
  /* แผนต้องไม่เอา DATABASE_URL เดิมมาใช้ — ใช้ TARGET_DATABASE_URL เท่านั้น */
  const plan = planVercelEnv({ TARGET_DATABASE_URL: POOLED, DATABASE_URL: DEV_URL });
  assert.ok(!plan.line.includes("localhost"), "ห้ามมี localhost ในบรรทัดสำหรับ Vercel");

  /* และถ้าปลายทางเป็น localhost จริง ๆ ต้องปฏิเสธ */
  assert.throws(() => planVercelEnv({ TARGET_DATABASE_URL: DEV_URL }), /เครื่องตัวเอง/);
});

test("vercel-env: คีย์ของหลังบ้าน/เครื่อง dev ต้องถูกกันออกพร้อมเหตุผล", () => {
  const excludedKeys = VERCEL_EXCLUDED_KEYS.map((entry) => entry.key);
  for (const key of [
    "SESSION_SECRET",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD_HASH",
    "ADMIN_NAME",
    "ADMIN_ROLE",
    "DB_TOOLS_PREFIX",
    "MAINTENANCE_MODE",
  ]) {
    assert.ok(excludedKeys.includes(key), `${key} ต้องอยู่ในรายการ "ไม่ใส่"`);
  }

  /* ทุกคีย์ต้องมีเหตุผลที่อ่านรู้เรื่อง (ไม่ปล่อยว่าง) */
  for (const entry of VERCEL_EXCLUDED_KEYS) {
    assert.ok(entry.reason.trim().length > 10, `${entry.key} ต้องมีเหตุผลอธิบาย`);
  }
});

test("vercel-env: ไม่มีค่าเป้าหมาย = แจ้งวิธีแก้ (ไม่เดาค่า)", () => {
  assert.throws(() => planVercelEnv({}), /TARGET_DATABASE_URL/);
  assert.throws(() => planVercelEnv({ TARGET_DATABASE_URL: "   " }), /TARGET_DATABASE_URL/);
  assert.throws(() => planVercelEnv({ TARGET_DATABASE_URL: "ไม่ใช่-url" }), /อ่านโฮสต์/);
});

/* ── หนี้ A3 (รอบที่ 142): แผน env ของ "หลังบ้าน" ──────────────────────────── */

const HASH = "scrypt:32768:8:1:abcdef0123456789:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd";
const SECRET = "J7not-a-real-secret-but-long-enough-0123456789";

test("vercel-env: แผนคีย์หลังบ้านต้องได้ 3 คีย์ครบและมีคำเตือนมติ D4", () => {
  const plan = planVercelAdminEnv({ ADMIN_EMAIL: "admin@waiwai.co.th", ADMIN_PASSWORD_HASH: HASH, SESSION_SECRET: SECRET });
  assert.deepEqual(
    plan.lines.map((line) => line.split("=")[0]),
    ["ADMIN_EMAIL", "ADMIN_PASSWORD_HASH", "SESSION_SECRET"],
    "ต้องได้คีย์ตามลำดับที่กำหนด",
  );
  assert.ok(plan.warnings.some((w) => w.includes("D4")), "ต้องเตือนเรื่องมติ D4 (เปิดหลังบ้านสู่อินเทอร์เน็ต)");
  assert.ok(plan.warnings.some((w) => w.includes("Redeploy")), "ต้องเตือนว่าต้อง Redeploy หลังแก้ env");
});

test("vercel-env: กันค่าที่มี $ (กับดัก dotenv-expand เคสจริงรอบที่ 27)", () => {
  assert.throws(
    () => planVercelAdminEnv({ ADMIN_EMAIL: "a@b.co", ADMIN_PASSWORD_HASH: "scrypt:1:2:3:sa$lt:hash", SESSION_SECRET: SECRET }),
    /\$/,
    "hash ที่มี $ ต้องถูกปฏิเสธ (Vercel จะตัดค่าทิ้ง ⇒ ล็อกอินไม่ได้)",
  );
  assert.throws(
    () => planVercelAdminEnv({ ADMIN_EMAIL: "a@b.co", ADMIN_PASSWORD_HASH: HASH, SESSION_SECRET: "x".repeat(40) + "$y" }),
    /\$/,
    "SESSION_SECRET ที่มี $ ก็ต้องถูกปฏิเสธ",
  );
});

test("vercel-env: ด่านรูปแบบรหัสผ่าน/ความยาว SESSION_SECRET", () => {
  assert.throws(() => planVercelAdminEnv({ ADMIN_PASSWORD_HASH: HASH, SESSION_SECRET: SECRET }), /ADMIN_EMAIL/);
  assert.throws(() => planVercelAdminEnv({ ADMIN_EMAIL: "a@b.co", SESSION_SECRET: SECRET }), /ADMIN_PASSWORD_HASH/);
  assert.throws(
    () => planVercelAdminEnv({ ADMIN_EMAIL: "a@b.co", ADMIN_PASSWORD_HASH: "$2b$10$abc", SESSION_SECRET: SECRET }),
    /scrypt/,
    "รูปแบบอื่นที่ไม่ใช่ scrypt:… ต้องถูกปฏิเสธ (แอปจะล็อกอินไม่ได้)",
  );
  assert.throws(
    () => planVercelAdminEnv({ ADMIN_EMAIL: "a@b.co", ADMIN_PASSWORD_HASH: HASH, SESSION_SECRET: "short" }),
    /32/,
    "SESSION_SECRET สั้นกว่า 32 ต้องถูกปฏิเสธ",
  );
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { VERCEL_EXCLUDED_KEYS, planVercelEnv } from "@/lib/db/vercel-env";

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

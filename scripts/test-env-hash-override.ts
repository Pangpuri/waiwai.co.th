import assert from "node:assert/strict";
import { test } from "node:test";

import { attemptLogin } from "@/lib/auth/login";
import { createEnvHashOverrideStore } from "@/lib/auth/user-store";
import type { AdminAccount, AdminUserStore } from "@/lib/auth/user-store";

/**
 * เทสต์บั๊กจริงรอบที่ 144: "รหัสถูกแต่ล็อกอินไม่ได้" (ทั้งเครื่องและคลาวด์)
 *
 * ลำดับเหตุ:
 *   1. รอบที่ 124 แก้บั๊ก FK ด้วย `ensureEnvAdminUser()` ⇒ เกิดแถวใน `admin_user`
 *      ที่มี `password_hash = 'env-only'` (ยืนยันไม่ได้)
 *   2. `createFallbackUserStore` เลือก DB ก่อน ⇒ **เจอแถวนั้น** จึงไม่ถอยไปใช้ hash จาก env
 *   3. ⇒ `attemptLogin` เทียบรหัสกับ `'env-only'` ⇒ `invalid` ตลอด (audit `login-failure`)
 *
 * ทางแก้: `createEnvHashOverrideStore` ให้ hash จาก env ชนะ **เฉพาะอีเมลของ env**
 */
const ENV_EMAIL = "admin@waiwai.co.th";
const REAL_HASH = "scrypt:32768:8:1:salt:hash";

const rowAccount: AdminAccount = {
  id: "env-admin",
  email: ENV_EMAIL,
  displayName: ENV_EMAIL,
  role: "admin",
  disabled: false,
  passwordHash: "env-only",
};

function storeOf(account: AdminAccount | null): AdminUserStore {
  return {
    async findByEmail() {
      return account;
    },
    async findById() {
      return account;
    },
  };
}

test("env hash override: แถว 'env-only' ในฐานข้อมูลต้องไม่กันรหัสจาก env (บั๊กจริงรอบ 144)", async () => {
  const deps = {
    verify: async (password: string, hash: string) => password === "004400" && hash === REAL_HASH,
    equalize: async () => {},
  };

  const before = await attemptLogin({ email: ENV_EMAIL, password: "004400" }, { ...deps, store: storeOf(rowAccount) });
  assert.equal(before.kind, "invalid", "ก่อนแก้: เทียบกับ 'env-only' ⇒ ไม่ผ่าน (ตรงกับที่ผู้ใช้เจอ)");

  const wrapped = createEnvHashOverrideStore(storeOf(rowAccount), { email: ENV_EMAIL, passwordHash: REAL_HASH });
  const after = await attemptLogin({ email: ENV_EMAIL, password: "004400" }, { ...deps, store: wrapped });
  assert.equal(after.kind, "ok", "หลังแก้: ใช้ hash จาก env ⇒ ล็อกอินได้");
});

test("env hash override: ต้องไม่ให้ hash ของ env ไปใช้กับบัญชีอื่น (ไม่มีช่อง bypass)", async () => {
  const other: AdminAccount = { ...rowAccount, id: "u2", email: "someone@example.com" };
  const wrapped = createEnvHashOverrideStore(storeOf(other), { email: ENV_EMAIL, passwordHash: REAL_HASH });
  const outcome = await attemptLogin(
    { email: "someone@example.com", password: "004400" },
    { verify: async (password, hash) => password === "004400" && hash === REAL_HASH, equalize: async () => {}, store: wrapped },
  );
  assert.equal(outcome.kind, "invalid", "บัญชีอื่นยังต้องใช้ hash ของตัวเอง (env-only ⇒ ไม่ผ่าน)");
});

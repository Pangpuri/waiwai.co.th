import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  ADMIN_ENV_KEYS,
  ADMIN_LOGIN_PATH,
  buildEnvSnippet,
  buildLoginUrl,
  generatePassword,
} from "@/lib/auth/credentials";
import { hashPassword, isPasswordHashUsable, needsRehash, parsePasswordHash, verifyPassword } from "@/lib/auth/password";
import {
  MIN_SECRET_LENGTH,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionToken,
  generateSecret,
  isSecretUsable,
  parseSessionToken,
  sessionCookieOptions,
  sessionExpiry,
} from "@/lib/auth/session";
import { ENV_ADMIN_ID, createEnvUserStore, equalizeTiming, type AdminAccount, type AdminUserStore } from "@/lib/auth/user-store";
import { attemptLogin } from "@/lib/auth/login";
import type { SessionPayload } from "@/lib/auth/types";

/**
 * เทสต์ของชั้นล็อกอินหลังบ้าน (lib/auth/*)
 *
 * ครอบเฉพาะ "ตรรกะล้วน" ที่ไม่ต้องมี Next runtime (ไม่ import lib/auth/dal.ts เพราะต้องใช้ next/headers)
 * ใช้พารามิเตอร์ scrypt แบบเบาในเทสต์ เพื่อไม่ให้ชุดทดสอบนาน (ค่า production อยู่ที่ lib/auth/password.ts)
 */

const FAST = { N: 1024, r: 8, p: 1 } as const;
const SECRET = "test-secret-that-is-long-enough-0123456789";

/* ── รหัสผ่าน ───────────────────────────────────────────────────────── */

test("password: hash แล้วตรวจคืนได้ (รอบเดียวกัน)", async () => {
  const stored = await hashPassword("correct horse battery staple", FAST);
  assert.equal(await verifyPassword("correct horse battery staple", stored), true);
});

test("password: รหัสผ่านผิดต้องไม่ผ่าน", async () => {
  const stored = await hashPassword("รหัสผ่านยาวพอสมควร", FAST);
  assert.equal(await verifyPassword("รหัสผ่านยาวพอสมคว", stored), false);
  assert.equal(await verifyPassword("", stored), false);
});

test("password: รหัสผ่านเดียวกันได้ hash ต่างกัน (มี salt สุ่ม)", async () => {
  const first = await hashPassword("same-password-here", FAST);
  const second = await hashPassword("same-password-here", FAST);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("same-password-here", first), true);
  assert.equal(await verifyPassword("same-password-here", second), true);
});

test("password: รูปแบบที่เก็บอ่านกลับได้ และไม่เก็บรหัสผ่านจริง", async () => {
  const plain = "another-strong-password";
  const stored = await hashPassword(plain, FAST);
  assert.ok(stored.startsWith("scrypt:"), "ต้องขึ้นต้นด้วยชื่ออัลกอริทึม");
  assert.equal(stored.split(":").length, 6);
  assert.ok(!stored.includes(plain), "ต้องไม่มีรหัสผ่านจริงในค่าที่เก็บ");

  const parsed = parsePasswordHash(stored);
  assert.ok(parsed);
  assert.deepEqual(parsed.params, { N: FAST.N, r: FAST.r, p: FAST.p });
});

test("password: ค่าที่เก็บต้องไม่มี `$` (กัน .env ตัดค่า — เคสจริง 2026-10-02)", async () => {
  const stored = await hashPassword("some-password-value", FAST);
  assert.ok(!stored.includes("$"), `ค่าเก็บต้องไม่มี $ แต่ได้: ${stored.slice(0, 16)}…`);
  assert.ok(isPasswordHashUsable(stored));
});

test("password: ยังอ่านรูปแบบเดิม (`$`) ได้ เพื่อไม่ทิ้งค่าที่ตั้งไว้ก่อนหน้า", async () => {
  const legacy = ["scrypt", "1024", "8", "1", "c2FsdA==", "aGFzaA=="].join("$");
  const parsed = parsePasswordHash(legacy);
  assert.ok(parsed, "ต้องอ่านรูปแบบเดิมได้");
  assert.deepEqual(parsed.params, { N: 1024, r: 8, p: 1 });
  assert.ok(isPasswordHashUsable(legacy));
});

test("password: ค่าที่ถูก dotenv ตัดทิ้ง (เคสจริง) ต้องถูกมองว่าใช้ไม่ได้", () => {
  for (const broken of ["scrypt+Bikum0011", "scrypt", "scrypt:1024:8:1:only5parts", undefined]) {
    assert.equal(isPasswordHashUsable(broken), false, `ต้องใช้ไม่ได้: ${String(broken)}`);
  }
});

test("password: ค่าที่เก็บพังต้องไม่ทำให้ระบบล้ม (คืน false)", async () => {
  for (const broken of ["", "scrypt$", "scrypt$1$2$3$4$5$6$7", "bcrypt$1$1$1$abc$def", "ไม่ใช่รูปแบบ"]) {
    assert.equal(parsePasswordHash(broken), null, `ควรอ่านไม่ได้: ${broken}`);
    assert.equal(await verifyPassword("whatever-password", broken), false);
  }
});

test("password: แก้ค่า hash แล้วต้องไม่ผ่าน", async () => {
  const stored = await hashPassword("tamper-me-please", FAST);
  const tampered = `${stored.slice(0, stored.length - 4)}AAAA`;
  assert.equal(await verifyPassword("tamper-me-please", tampered), false);
});

test("password: รหัสผ่านว่างต้องสร้างไม่ได้ (กันบั๊กที่ทำให้ทุกคนเข้าระบบได้)", async () => {
  await assert.rejects(() => hashPassword(""), /must not be empty/);
});

test("password: needsRehash บอกได้ว่าพารามิเตอร์เก่ากว่าปัจจุบัน", async () => {
  const fast = await hashPassword("upgrade-me-later", FAST);
  assert.equal(needsRehash(fast), true, "พารามิเตอร์เบากว่าค่าปัจจุบัน → ควรอัปเกรด");
  assert.equal(needsRehash("พัง", FAST), true, "อ่านไม่ได้ → ควรตั้งใหม่");

  const current = await hashPassword("already-current", { N: 32768, r: 8, p: 1 });
  assert.equal(needsRehash(current), false);
});

/* ── เซสชัน ─────────────────────────────────────────────────────────── */

function payload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return { userId: "u-1", role: "admin", expiresAt: Date.now() + 60_000, ...overrides };
}

test("session: สร้างแล้วอ่านคืนได้", () => {
  const now = Date.now();
  const parsed = parseSessionToken(createSessionToken(payload(), SECRET), SECRET, now);
  assert.ok(parsed);
  assert.equal(parsed.userId, "u-1");
  assert.equal(parsed.role, "admin");
});

test("session: ลายเซ็นผิด / คนละ secret ต้องไม่ผ่าน", () => {
  const token = createSessionToken(payload(), SECRET);
  assert.equal(parseSessionToken(token, `${SECRET}-other`, Date.now()), null);

  const [body, signature] = token.split(".");
  assert.ok(body && signature);
  const tampered = `${body}.${signature.slice(0, -2)}bb`;
  assert.equal(parseSessionToken(tampered, SECRET, Date.now()), null, "แก้ลายเซ็นต้องไม่ผ่าน");

  const forgedBody = Buffer.from(
    JSON.stringify({ userId: "u-1", role: "editor", expiresAt: Date.now() + 60_000 }),
    "utf8",
  ).toString("base64url");
  assert.equal(
    parseSessionToken(`${forgedBody}.${signature}`, SECRET, Date.now()),
    null,
    "เปลี่ยนเนื้อหา (ยกระดับ/ลดบทบาท) โดยไม่เซ็นใหม่ ต้องไม่ผ่าน",
  );
});

test("session: หมดอายุแล้วต้องไม่ผ่าน", () => {
  const expired = createSessionToken(payload({ expiresAt: 1_000 }), SECRET);
  assert.equal(parseSessionToken(expired, SECRET, 2_000), null);
  assert.ok(parseSessionToken(expired, SECRET, 500));
});

test("session: บทบาทที่ไม่รู้จักต้องถูกปฏิเสธ แม้ลายเซ็นถูก", () => {
  const body = Buffer.from(JSON.stringify({ userId: "u-1", role: "root", expiresAt: Date.now() + 1000 })).toString(
    "base64url",
  );
  const signature = createHmac("sha256", SECRET).update(body).digest("base64url");
  assert.equal(parseSessionToken(`${body}.${signature}`, SECRET, Date.now()), null);
});

test("session: token ที่รูปแบบพังต้องคืน null ไม่โยน error", () => {
  for (const broken of ["", ".", "abc", "a.b", "..", "eyJhIjoxfQ."]) {
    assert.equal(parseSessionToken(broken, SECRET, Date.now()), null, `ควรอ่านไม่ได้: ${broken}`);
  }
});

test("session: ตัวเลือกคุกกี้ตั้งครบตามกติกา (HttpOnly · SameSite · Path · อายุ)", () => {
  const expiresAt = Date.now() + 1000;
  const options = sessionCookieOptions(expiresAt, true);
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/");
  assert.equal(options.expires.getTime(), expiresAt);
  assert.equal(sessionCookieOptions(expiresAt, false).secure, false, "เดโมบน http ต้องปิด secure ได้");
});

test("session: secret ที่สั้นเกินไปต้องถูกปฏิเสธ (ไม่มีค่าเริ่มต้นลับ ๆ)", () => {
  assert.equal(isSecretUsable(undefined), false);
  assert.equal(isSecretUsable(""), false);
  assert.equal(isSecretUsable("short"), false);
  assert.equal(isSecretUsable("x".repeat(MIN_SECRET_LENGTH - 1)), false);
  assert.equal(isSecretUsable("x".repeat(MIN_SECRET_LENGTH)), true);
});

test("session: generateSecret ให้ค่าสุ่มยาวพอ และไม่ซ้ำกัน", () => {
  const first = generateSecret();
  const second = generateSecret();
  assert.ok(first.length >= MIN_SECRET_LENGTH);
  assert.notEqual(first, second);
});

test("session: อายุเซสชัน = 8 ชั่วโมง และชื่อคุกกี้เฉพาะโปรเจกต์", () => {
  assert.equal(SESSION_TTL_MS, 8 * 60 * 60 * 1000);
  assert.equal(sessionExpiry(1000), 1000 + SESSION_TTL_MS);
  assert.equal(SESSION_COOKIE_NAME, "waiwai_admin_session");
});

/* ── ตัวสร้างข้อมูลล็อกอิน ───────────────────────────────────────────── */

test("credentials: รหัสผ่านที่สุ่มได้อ่านออกเสียงได้ และไม่มีความกำกวม", () => {
  const password = generatePassword();
  assert.equal(password.replace(/-/g, "").length, 16);
  assert.equal(password.split("-").length, 4);
  for (const group of password.split("-")) {
    assert.equal(group.length, 4);
  }
  for (const ambiguous of ["O", "0", "I", "l", "1"]) {
    assert.ok(!password.includes(ambiguous), `ไม่ควรมีอักขระกำกวม ${ambiguous}: ${password}`);
  }
});

test("credentials: สุ่มหลายครั้งต้องไม่ซ้ำกัน", () => {
  const seen = new Set<string>();
  for (let index = 0; index < 50; index += 1) {
    seen.add(generatePassword());
  }
  assert.equal(seen.size, 50);
});

test("credentials: ความยาวที่สั้นเกินไปต้องไม่ยอมให้สร้าง", () => {
  assert.throws(() => generatePassword(7), /length/);
  assert.throws(() => generatePassword(10.5), /length/);
});

test("credentials: ลิงก์ล็อกอินต่อ base ได้ และไม่ใส่รหัสผ่านใน URL", () => {
  assert.equal(buildLoginUrl(), ADMIN_LOGIN_PATH);
  assert.equal(buildLoginUrl("", "a@b.co.th"), `${ADMIN_LOGIN_PATH}?email=a%40b.co.th`);
  assert.equal(buildLoginUrl("https://demo.example.com"), `https://demo.example.com${ADMIN_LOGIN_PATH}`);
  assert.equal(
    buildLoginUrl("https://demo.example.com/", "a@b.co.th"),
    `https://demo.example.com${ADMIN_LOGIN_PATH}?email=a%40b.co.th`,
  );
  assert.ok(!buildLoginUrl("https://x.y", "a@b.co.th").includes("password"));
});

test("credentials: บล็อก env มีตัวแปรที่จำเป็นครบ และไม่มีรหัสผ่าน", () => {
  const snippet = buildEnvSnippet({ email: "a@b.co.th", passwordHash: "scrypt$1$2$3$aa$bb", secret: "s".repeat(40) });

  for (const key of ["ADMIN_EMAIL", "ADMIN_PASSWORD_HASH", "SESSION_SECRET"]) {
    assert.ok(snippet.includes(`${key}=`), `ต้องมี ${key}`);
  }
  assert.equal(snippet.split("\n").length, 3, "ไม่ใส่ชื่อ = ไม่มีบรรทัด ADMIN_NAME");
  assert.ok(!snippet.includes("ADMIN_NAME="));
});

test("credentials: ใส่ชื่อมา → เพิ่มบรรทัด ADMIN_NAME ให้", () => {
  const snippet = buildEnvSnippet({
    email: "a@b.co.th",
    passwordHash: "scrypt$1$2$3$aa$bb",
    secret: "s".repeat(40),
    name: "ผู้ดูแลระบบ",
  });
  assert.equal(snippet.split("\n").length, 4);
  assert.ok(snippet.includes("ADMIN_NAME=ผู้ดูแลระบบ"));
  assert.ok(ADMIN_ENV_KEYS.includes("ADMIN_NAME"));
});

/* ── ที่เก็บบัญชี (โหมด env) ─────────────────────────────────────────── */

test("user-store: ตั้งค่าไม่ครบต้องคืน null (ไม่สร้างบัญชีจากค่าเริ่มต้น)", () => {
  assert.equal(createEnvUserStore({ email: undefined, passwordHash: undefined, name: undefined, role: undefined }), null);
  assert.equal(createEnvUserStore({ email: "", passwordHash: "x", name: undefined, role: undefined }), null);
  assert.equal(createEnvUserStore({ email: "a@b.co.th", passwordHash: "", name: undefined, role: undefined }), null);
});

test("user-store: หาบัญชีจากอีเมลแบบไม่สนตัวพิมพ์ และไม่พบคนอื่น", async () => {
  const store = createEnvUserStore({
    email: "Admin@WaiWai.co.th",
    passwordHash: "scrypt$32768$8$1$aa$bb",
    name: "ผู้ดูแล",
    role: undefined,
  });
  assert.ok(store);

  const found = await store.findByEmail("admin@waiwai.co.th");
  assert.ok(found);
  assert.equal(found.role, "admin", "ไม่ระบุบทบาท = admin");
  assert.equal(found.displayName, "ผู้ดูแล");
  assert.equal(found.disabled, false);
  assert.equal(await store.findByEmail("someone@else.co.th"), null);
  assert.equal(await store.findById(ENV_ADMIN_ID), found);
  assert.equal(await store.findById("other-id"), null);
});

test("user-store: บทบาทที่ผิดจะถูกแทนด้วย admin (ไม่ทำให้ระบบพัง)", async () => {
  const store = createEnvUserStore({
    email: "a@b.co.th",
    passwordHash: "scrypt$32768$8$1$aa$bb",
    name: undefined,
    role: "super-root",
  });
  assert.ok(store);
  const found = await store.findByEmail("a@b.co.th");
  assert.ok(found);
  assert.equal(found.role, "admin");
  assert.equal(found.displayName, "a@b.co.th", "ไม่ใส่ชื่อ = ใช้อีเมล");
});

test("user-store: equalizeTiming ทำงานได้และไม่ทำให้ล็อกอินพัง", async () => {
  await assert.doesNotReject(() => equalizeTiming("some-password"));
});

/* ── ตรรกะตัดสินการล็อกอิน (pure) ────────────────────────────────────── */

/** store ปลอมสำหรับเทสต์ — เลือกได้ว่าจะพบบัญชี/ปิดบัญชี/บทบาทอะไร */
function fakeStore(account: AdminAccount | null): AdminUserStore {
  return {
    async findByEmail(email: string) {
      if (account === null) return null;
      return email.trim().toLowerCase() === account.email.toLowerCase() ? account : null;
    },
    async findById(id: string) {
      return account !== null && account.id === id ? account : null;
    },
  };
}

const TEST_ACCOUNT: AdminAccount = {
  id: "u-9",
  email: "admin@waiwai.co.th",
  displayName: "ผู้ดูแล",
  role: "publisher",
  disabled: false,
  passwordHash: "scrypt$1024$8$1$aa$bb",
};

type Spy = { calls: number };

function deps(options: {
  readonly account?: AdminAccount | null;
  readonly passwordOk?: boolean;
  readonly store?: AdminUserStore | null;
}) {
  const account = options.account === undefined ? TEST_ACCOUNT : options.account;
  const equalizeSpy: Spy = { calls: 0 };
  const verifySpy: Spy = { calls: 0 };

  return {
    deps: {
      store: options.store === undefined ? fakeStore(account) : options.store,
      verify: async () => {
        verifySpy.calls += 1;
        return options.passwordOk ?? true;
      },
      equalize: async () => {
        equalizeSpy.calls += 1;
      },
    },
    equalizeSpy,
    verifySpy,
  };
}

test("login: อีเมล/รหัสผ่านถูก → ผ่าน และไม่คืน hash ออกมา", async () => {
  const { deps: d } = deps({});
  const outcome = await attemptLogin({ email: "Admin@WaiWai.co.th", password: "good-password" }, d);

  assert.equal(outcome.kind, "ok");
  assert.ok(outcome.kind === "ok");
  assert.equal(outcome.user.id, "u-9");
  assert.equal(outcome.user.role, "publisher");
  assert.ok(!("passwordHash" in outcome.user), "ห้ามคืนค่า hash ออกไปไหน");
});

test("login: รหัสผ่านผิด → invalid และยังยิงเทียบเวลา (กันการวัดเวลา)", async () => {
  const { deps: d, equalizeSpy } = deps({ passwordOk: false });
  const outcome = await attemptLogin({ email: "admin@waiwai.co.th", password: "bad" }, d);

  assert.equal(outcome.kind, "invalid");
  assert.equal(equalizeSpy.calls, 1, "ทางที่ล้มเหลวต้องเรียก equalize เสมอ");
});

test("login: ไม่พบบัญชี → invalid และใช้เวลาเท่ากับตอนพบบัญชี", async () => {
  const { deps: d, equalizeSpy, verifySpy } = deps({ account: null });
  const outcome = await attemptLogin({ email: "nobody@example.com", password: "whatever" }, d);

  assert.equal(outcome.kind, "invalid");
  assert.equal(equalizeSpy.calls, 1, "ต้องไม่ปล่อยให้เวลาบอกได้ว่าอีเมลมีอยู่หรือไม่");
  assert.equal(verifySpy.calls, 0);
});

test("login: บัญชีถูกปิด → invalid (ไม่บอกว่า 'บัญชีถูกระงับ')", async () => {
  const { deps: d } = deps({ account: { ...TEST_ACCOUNT, disabled: true } });
  const outcome = await attemptLogin({ email: "admin@waiwai.co.th", password: "good-password" }, d);

  assert.equal(outcome.kind, "invalid");
});

test("login: ช่องว่าง → invalid โดยไม่แตะ store เลย", async () => {
  const { deps: d, equalizeSpy, verifySpy } = deps({});
  for (const input of [
    { email: "", password: "x" },
    { email: "   ", password: "x" },
    { email: "a@b.co.th", password: "" },
  ]) {
    const outcome = await attemptLogin(input, d);
    assert.equal(outcome.kind, "invalid");
  }
  assert.equal(equalizeSpy.calls, 0);
  assert.equal(verifySpy.calls, 0);
});

test("login: ยังตั้งค่าไม่ครบ → unconfigured (ไม่ใช่ invalid)", async () => {
  const { deps: d } = deps({ store: null });
  const outcome = await attemptLogin({ email: "a@b.co.th", password: "x" }, d);
  assert.equal(outcome.kind, "unconfigured");
});

test("user-store: hash ที่ถูก .env ตัดค่า ต้องปิดการล็อกอิน (fail-closed) ไม่ใช่ปล่อยให้เดา", () => {
  /* เคสจริง 2026-10-02: `scrypt$32768$8$1$...` ถูก dotenv-expand ตัดเหลือ `scrypt+Bikum…` */
  assert.equal(
    createEnvUserStore({
      email: "a@b.co.th",
      passwordHash: "scrypt+Bikum0011xy",
      name: undefined,
      role: undefined,
    }),
    null,
  );
  assert.ok(
    createEnvUserStore({ email: "a@b.co.th", passwordHash: "scrypt$1$2$3$aa$bb", name: undefined, role: undefined }),
    "รูปแบบเดิมที่ยังครบ 6 ส่วน ต้องใช้ได้",
  );
});

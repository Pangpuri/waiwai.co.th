import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { ADMIN_ROLES, isAdminRole } from "@/lib/auth/types";
import {
  ADMIN_PERMISSIONS,
  ROLE_PERMISSIONS,
  can,
  permissionsOf,
  isStrongerOrEqual,
  isAdminRoleId,
  type AdminPermission,
} from "@/lib/auth/roles";

/**
 * เทสต์ RBAC (X1.10 · รอบที่ 84)
 *
 * จุดที่ต้องคุม (เรียงตามความเสียหายถ้าพลาด)
 * 1. **ไม่มีหน้าที่ลืมตรวจสิทธิ์** — สแกนทุกไฟล์ใน `app/admin/**` ว่ามี `requireAdminUser("...")`
 *    (ยกเว้นเฉพาะ action ล็อกอิน/ออกจากระบบ ที่ต้องใช้ได้โดยไม่ต้องมีสิทธิ์)
 * 2. สิทธิ์ที่อันตรายต้องไม่ตกกับบทบาทต่ำ (กล่องข้อความลูกค้า · ลบบัญชี · ตั้งค่าระบบ · สิทธิ์คนอื่น)
 * 3. ตารางบทบาท→สิทธิ์ต้อง "เพิ่มขึ้น" เสมอ (editor ⊂ publisher ⊂ admin) และทุกสิทธิ์มีเจ้าของ
 * 4. บัญชีใน DB: เก็บเฉพาะ hash · กันล็อกตัวเองออก · ลง audit ทุกการเปลี่ยน
 */

const ROOT = join(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function adminFiles(): readonly string[] {
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (name.endsWith(".ts") || name.endsWith(".tsx")) files.push(path.slice(ROOT.length + 1).replace(/\\/g, "/"));
    }
  };
  walk(join(ROOT, "app", "admin"));
  return files;
}

/* ── 1) บังคับใช้สิทธิ์ครบทุกไฟล์ ───────────────────────────────────────────── */

test("rbac: ทุกไฟล์ใน app/admin ต้องตรวจสิทธิ์ด้วยรหัสสิทธิ์ (ยกเว้น action ล็อกอิน/ออกจากระบบ)", () => {
  /*
    ไฟล์ที่ "ไม่ต้องมีสิทธิ์": เฉพาะเรื่องล็อกอิน (ต้องเข้าได้ก่อนมีเซสชัน)
    ⚠️ route handler ที่อ่านไฟล์ (เช่นภาพในถัง) ต้องตรวจสิทธิ์เอง — ไม่ใช่แค่ "ล็อกอินแล้ว"
  */
  const allowlist = new Set(["app/admin/actions.ts", "app/admin/login/page.tsx"]);
  const callPattern = /requireAdminUser\(([^)]*)\)/g;

  const missing: string[] = [];
  for (const file of adminFiles()) {
    if (allowlist.has(file)) continue;
    const source = sourceOf(file);

    /* ทางที่ 1 (หน้า/action): ประตูกลางของ DAL บังคับสิทธิ์ให้แล้ว */
    const calls = [...source.matchAll(callPattern)].map((match) => match[1] ?? "");
    if (calls.some((argument) => argument.trim() !== "")) continue;

    /*
      ทางที่ 2 (route handler): `redirect()` ของ DAL ใช้ไม่ได้ ⇒ ตรวจสิทธิ์เองด้วย `can(user.role, "...")`
      ต้องมีการตรวจจริง ไม่ใช่แค่ล็อกอิน
    */
    if (/can\(\s*user\.role\s*,\s*"[a-z]+"\s*\)/.test(source)) continue;

    missing.push(file);
  }

  assert.deepEqual(
    missing,
    [],
    "ไฟล์เหล่านี้ยังไม่ได้ระบุสิทธิ์ — ใช้ requireAdminUser(\"<permission>\") หรือ can(user.role, \"<permission>\")",
  );
});

test("rbac: action ล็อกอิน/ออกจากระบบต้องไม่ผูกกับสิทธิ์ และ action ลบข้อมูลส่วนบุคคลต้องเป็น admin", () => {
  const actions = sourceOf("app/admin/actions.ts");
  assert.ok(actions.includes("export async function loginAction"), "ยังมี action ล็อกอิน");
  assert.ok(actions.includes("export async function logoutAction"), "ยังมี action ออกจากระบบ");

  /* การลบข้อมูลส่วนบุคคลถาวร = สิทธิ์ระดับผู้ดูแลระบบเท่านั้น */
  assert.ok(actions.includes('requireAdminUser("retention")'), "action ลบข้อมูลตามระยะเก็บต้องใช้สิทธิ์ retention");
  assert.ok(!can("editor", "retention"), "บรรณาธิการต้องไม่มีสิทธิ์ลบข้อมูลส่วนบุคคล");
  assert.ok(!can("publisher", "retention"), "ผู้เผยแพร่ก็ต้องไม่มีสิทธิ์ลบข้อมูลส่วนบุคคล");
});

test("rbac: หน้าจอ/prévue/action สำคัญผูกกับสิทธิ์ที่ถูกต้อง", () => {
  const expectations: readonly { readonly file: string; readonly permission: AdminPermission }[] = [
    { file: "app/admin/users/page.tsx", permission: "users" },
    { file: "app/admin/users/actions.ts", permission: "users" },
    { file: "app/admin/inbox/page.tsx", permission: "inbox" },
    { file: "app/admin/inbox/actions.ts", permission: "inbox" },
    { file: "app/admin/media/page.tsx", permission: "media" },
    { file: "app/admin/settings/page.tsx", permission: "settings" },
    { file: "app/admin/trash/page.tsx", permission: "trash" },
    { file: "app/admin/preview-links/page.tsx", permission: "preview" },
    { file: "app/admin/builder/chrome/page.tsx", permission: "presets" },
    { file: "app/admin/builder/[page]/page.tsx", permission: "content" },
    { file: "app/[lang]/preview/[page]/page.tsx", permission: "content" },
  ];

  for (const { file, permission } of expectations) {
    const source = sourceOf(file);
    assert.ok(
      source.includes(`requireAdminUser("${permission}")`),
      `${file}: ต้องใช้สิทธิ์ "${permission}"`,
    );
  }
});

/* ── 2) ตารางสิทธิ์ ───────────────────────────────────────────────────────── */

test("rbac: บทบาทต้องเป็นชุดที่ฐานข้อมูลรู้จัก และตรวจค่าที่ส่งมาจากฟอร์มได้", () => {
  assert.deepEqual([...ADMIN_ROLES], ["editor", "publisher", "admin"]);
  assert.equal(isAdminRole("owner"), false, "บทบาทที่ไม่มีในระบบต้องถูกปฏิเสธ");
  assert.equal(isAdminRoleId("admin"), true);
  assert.equal(isAdminRoleId("root"), false);

  /* ตรงกับ check constraint ในสคีมา (ผู้ใช้รัน `npm run check:db` จะพิสูจน์กับฐานข้อมูลจริงอีกชั้น) */
  for (const file of ["db/schema.sql", "db/migrations/0001-init.sql"]) {
    const sql = sourceOf(file);
    assert.ok(
      sql.includes("check (role in ('editor', 'publisher', 'admin'))"),
      `${file}: ต้องมี check constraint ของบทบาทตรงกับ lib/auth/types.ts`,
    );
  }
});

test("rbac: สิทธิ์ให้แบบเพิ่มขึ้น (editor ⊂ publisher ⊂ admin) และทุกสิทธิ์มีเจ้าของ", () => {
  for (const permission of ADMIN_PERMISSIONS) {
    const owners = ADMIN_ROLES.filter((role) => can(role, permission));
    assert.ok(owners.length > 0, `สิทธิ์ "${permission}" ไม่มีบทบาทใดได้เลย — ลืมใส่ในตาราง?`);
  }

  for (const permission of permissionsOf("editor")) {
    assert.ok(can("publisher", permission), `publisher ต้องมีสิทธิ์ของ editor: ${permission}`);
    assert.ok(can("admin", permission), `admin ต้องมีสิทธิ์ของ publisher/editor: ${permission}`);
  }
  for (const permission of permissionsOf("publisher")) {
    assert.ok(can("admin", permission), `admin ต้องมีสิทธิ์ของ publisher: ${permission}`);
  }

  /* ลำดับความแรง (ใช้ตอนกัน "ถอดบทบาทตัวเอง") */
  assert.equal(isStrongerOrEqual("admin", "publisher"), true);
  assert.equal(isStrongerOrEqual("editor", "publisher"), false);

  /* สิทธิ์ที่อันตราย: ต้องเป็น admin เท่านั้น */
  for (const permission of ["users", "settings", "retention", "maintenance"] as const) {
    assert.deepEqual(
      ADMIN_ROLES.filter((role) => can(role, permission)),
      ["admin"],
      `สิทธิ์ "${permission}" ต้องเป็นของผู้ดูแลระบบเท่านั้น`,
    );
  }

  /* ข้อมูลส่วนบุคคล: ต้องไม่ใช่บรรณาธิการ */
  assert.equal(can("editor", "inbox"), false);
  assert.equal(can("editor", "trash"), false);
});

test("rbac: ไม่มีสิทธิ์ซ้ำ/ไม่รู้จักในตาราง และจำนวนสิทธิ์ต่อบทบาทสอดคล้องกัน", () => {
  assert.equal(new Set(ADMIN_PERMISSIONS).size, ADMIN_PERMISSIONS.length, "ห้ามมีสิทธิ์ซ้ำ");
  for (const role of ADMIN_ROLES) {
    const list = ROLE_PERMISSIONS[role];
    assert.equal(new Set(list).size, list.length, `${role}: ห้ามมีสิทธิ์ซ้ำ`);
    for (const permission of list) {
      assert.ok(ADMIN_PERMISSIONS.includes(permission), `${role}: สิทธิ์ "${permission}" ไม่อยู่ในรายการกลาง`);
    }
  }
});

/* ── 3) ที่เก็บบัญชีในฐานข้อมูล ─────────────────────────────────────────────── */

test("rbac: บัญชีใน DB เก็บเฉพาะ hash · ตรวจค่าก่อนเขียน · กันล็อกตัวเองออก", () => {
  const repo = sourceOf("lib/auth/users-repository.ts");

  assert.ok(repo.includes("hashPassword("), "ต้อง hash รหัสผ่านก่อนเก็บเสมอ");
  assert.ok(!repo.includes("password_hash: input.password"), "ห้ามเก็บรหัสผ่านตรง ๆ");
  assert.ok(repo.includes("isUsableAdminEmail(input.email)"), "ต้องตรวจอีเมลก่อนสร้าง");
  assert.ok(repo.includes("isUsableAdminPassword(input.password)"), "ต้องตรวจความยาวรหัสผ่านก่อนสร้าง");
  assert.ok(repo.includes("isAdminRole(input.role)"), "ต้องตรวจบทบาทก่อนเขียน");
  assert.ok(repo.includes("lower(email) = lower($1)"), "อีเมลเทียบแบบไม่สนตัวพิมพ์");
  assert.ok(repo.includes("on conflict (email) do nothing"), "กันสร้างอีเมลซ้ำที่ฐานข้อมูล");

  /* กันล็อกตัวเองออก: ต้องเช็ค "ผู้ดูแลที่ยังใช้งานได้คนสุดท้าย" ทั้งตอนถอดบทบาทและตอนปิดบัญชี */
  assert.equal(repo.split('return { ok: false, reason: "last-admin" }').length - 1, 2, "ต้องมีการกัน last-admin 2 จุด");
  assert.ok(repo.includes("countActiveAdmins("), "ต้องนับผู้ดูแลที่ยังใช้งานได้จริง");

  /* audit ทุกการเปลี่ยนบัญชี */
  for (const action of ["admin-user-create", "admin-user-role", "admin-user-disable", "admin-user-enable", "admin-user-password"]) {
    assert.ok(repo.includes(action), `ต้องลง audit "${action}"`);
  }

  /* อ่านบัญชีไม่คืนรหัสผ่านออกจากเลเยอร์ UI */
  const page = sourceOf("app/admin/users/page.tsx");
  assert.ok(!page.includes("passwordHash"), "หน้าจอต้องไม่แตะ hash");
  assert.ok(!page.includes("password_hash"), "หน้าจอต้องไม่แตะคอลัมน์รหัสผ่าน");
});

test("rbac: บัญชี env ยังเป็นประตูหลัง (กันถูกล็อกออก) และสิทธิ์มาจากบัญชีที่อ่านสด", () => {
  const dal = sourceOf("lib/auth/dal.ts");
  assert.ok(dal.includes("createFallbackUserStore"), "ต้องใช้ store ผสม (DB → env)");
  assert.ok(dal.includes("ADMIN_DENIED_PATH"), "มีหน้าแยกสำหรับผู้ที่สิทธิ์ไม่พอ");
  assert.ok(dal.includes("if (!can(user.role, permission)) redirect(ADMIN_DENIED_PATH)"), "ประตูต้องบังคับสิทธิ์");

  /* สิทธิ์ต้องมาจากบัญชี (อ่านสด) ไม่ใช่จาก role ที่ฝังในโทเคน */
  assert.ok(
    dal.includes("role: account.role"),
    "ผู้ใช้ของคำขอต้องใช้บทบาทจากบัญชี ⇒ เปลี่ยนบทบาท/ปิดบัญชีมีผลทันที",
  );

  const store = sourceOf("lib/auth/user-store.ts");
  assert.ok(store.includes("export function createFallbackUserStore"), "มี store สำรอง");
  assert.ok(store.includes("ENV_ADMIN_ID"), "บัญชี env ยังมี id คงที่");
});

test("rbac: เมนูหลังบ้านซ่อนลิงก์ตามสิทธิ์ (แต่ไม่ใช่มาตรการความปลอดภัย)", () => {
  const layout = sourceOf("app/admin/layout.tsx");
  assert.ok(layout.includes("permission: \"users\""), "เมนูผู้ใช้ต้องผูกกับสิทธิ์ users");
  assert.ok(layout.includes("can(user.role, link.permission)"), "ต้องกรองเมนูตามสิทธิ์ของบัญชี");
  assert.ok(layout.includes('href: "/admin/users"'), "มีลิงก์ไปหน้าจัดการบัญชี");
  assert.ok(layout.includes("roleLabelOf("), "แสดงบทบาทของผู้ใช้ปัจจุบัน");
});

test("rbac: พจนานุกรมสองภาษามีคีย์ของ RBAC ครบ และไม่พิมพ์รายชื่อบทบาทซ้ำในโค้ด UI", () => {
  for (const locale of ["th", "en"]) {
    const area = sourceOf(`lib/i18n/messages/areas/${locale}/adminRbac.ts`);
    for (const key of [
      "rbacUsersTitle",
      "rbacRoleEditorName",
      "rbacRolePublisherName",
      "rbacRoleAdminName",
      "deniedTitle",
      "rbacLastAdminBlocked",
      "rbacSelfBlocked",
      "auditAdminUserCreate",
    ]) {
      assert.ok(area.includes(`${key}:`), `${locale}: ขาดคีย์ ${key}`);
    }
    assert.ok(!area.includes('"editor"'), `${locale}: ห้ามพิมพ์รหัสบทบาทซ้ำ (ให้อยู่ใน lib/auth/types.ts)`);
  }

  /* ป้ายชื่อบทบาทต้องมีที่เดียว (exhaustive) */
  const labels = sourceOf("features/admin/rbac-labels.ts");
  for (const role of ADMIN_ROLES) {
    assert.ok(labels.includes(`case "${role}"`), `ต้องมีป้ายของบทบาท ${role}`);
  }
  assert.ok(!labels.includes("default:"), "ต้องเป็น switch แบบ exhaustive (เพิ่มบทบาทแล้วลืม = compile error)");
});

test("rbac: สถานะของฟอร์มจัดการบัญชีครบทุกกรณีที่ action คืนได้", () => {
  const state = sourceOf("features/admin/rbac-state.ts");
  const actions = sourceOf("app/admin/users/actions.ts");

  const codes = [...actions.matchAll(/code: "([a-z-]+)"/g)].map((match) => match[1] ?? "");
  assert.ok(codes.length >= 8, "action ต้องคืนรหัสผลลัพธ์หลายกรณี");
  for (const code of new Set(codes)) {
    assert.ok(state.includes(`"${code}"`), `รหัส "${code}" ไม่มีในชนิด RbacActionState`);
  }

  /* รหัสผ่านใหม่ต้องไม่ถูกส่งกลับในกรณีล้มเหลว */
  assert.ok(actions.includes("password: null"), "กรณีล้มเหลวต้องไม่คืนรหัสผ่าน");
  assert.ok(actions.includes("generatePassword()"), "รหัสผ่านสร้างฝั่งเซิร์ฟเวอร์เท่านั้น");
});

test("rbac: ชนิดบทบาท/สิทธิ์ต้องมาจากทะเบียนกลาง ไม่มีการCast กลบ", () => {
  const dal = sourceOf("lib/auth/dal.ts");
  assert.ok(!dal.includes("as AdminRole"), "ห้าม cast กลบชนิดบทบาท");
  assert.ok(dal.includes("type AdminPermission"), "ประตูต้องอ้างชนิดสิทธิ์จากทะเบียนกลาง");

  const menu = sourceOf("app/admin/layout.tsx");
  assert.ok(menu.includes("AdminPermission"), "เมนูต้องอ้างชนิดสิทธิ์จากทะเบียนกลาง");

  /* route handler ของภาพในถังต้องตรวจสิทธิ์ trash ไม่ใช่แค่ล็อกอิน */
  const route = sourceOf("app/admin/trash/thumbnail/[id]/route.ts");
  assert.ok(route.includes('can(user.role, "trash")'), "route ภาพในถังต้องตรวจสิทธิ์ trash");
});

test("rbac: ประตูต้อง 'บังคับ' ส่งสิทธิ์ และห้ามเหลือรูปแบบเก่าในโค้ด/คอมเมนต์ทั้งโปรเจกต์", () => {
  /*
    ทำไมต้องกันถึงคอมเมนต์ (บทเรียนที่เจอจริง 2 ครั้งในรอบนี้)
    - ตอนเปลี่ยนลายเซ็นเป็น `requireAdminUser("<permission>")` มีคอมเมนต์เก่าที่เขียนว่า `requireAdminUser()`
      หลงเหลืออยู่ ⇒ คน/เครื่องมือที่คัดลอกจากคอมเมนต์ (หรือไฟล์ที่ยังไม่รีเฟรชในเอดิเตอร์)
      จะได้โค้ดที่ **ไม่ผ่าน typecheck** ทันที ("Expected 1 arguments, but got 0")
    ⇒ ลบรูปแบบเก่าออกจากทุกไฟล์ (รวมคอมเมนต์) และกันไม่ให้กลับมา
  */
  const roots = ["app", "features", "lib"];
  const offenders: string[] = [];

  const walk = (directory: string): void => {
    for (const name of readdirSync(join(ROOT, directory))) {
      const relative = `${directory}/${name}`;
      if (statSync(join(ROOT, relative)).isDirectory()) {
        walk(relative);
        continue;
      }
      if (!relative.endsWith(".ts") && !relative.endsWith(".tsx")) continue;
      /* dal.ts = ที่ประกาศฟังก์ชัน (รูปแบบที่ถูกคือมีพารามิเตอร์ ไม่ใช่ `()`) */
      if (relative === "lib/auth/dal.ts") continue;
      if (sourceOf(relative).includes("requireAdminUser()")) offenders.push(relative);
    }
  };
  for (const root of roots) walk(root);

  assert.deepEqual(offenders, [], "ไฟล์เหล่านี้ยังมีรูปแบบเก่า `requireAdminUser()` — แก้เป็น `requireAdminUser(\"<permission>\")`");

  const dal = sourceOf("lib/auth/dal.ts");
  assert.ok(
    dal.includes("export async function requireAdminUser(permission: AdminPermission)"),
    "พารามิเตอร์สิทธิ์ต้องเป็นแบบบังคับ (ห้ามใส่ ? — จะทำให้ลืมส่งสิทธิ์ได้เงียบ ๆ)",
  );
  assert.ok(!dal.includes("permission?:"), "ห้ามทำสิทธิ์เป็น optional");
});

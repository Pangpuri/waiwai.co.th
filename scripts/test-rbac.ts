import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { codeOf } from "./source-scan.ts";

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
  /*
    รอบที่ 243 (ปิดหนี้ "คอมเมนต์ทำให้ผ่านด่าน"): ค่าเริ่มต้นของเทสต์นี้คือ **โค้ดจริง** (ตัดคอมเมนต์)
    ⚠️ เคสจริงรอบที่ 242: `app/admin/layout.tsx` ผ่านด่านสิทธิ์เพราะ *คอมเมนต์* มีข้อความ
    `requireAdminUser("<permission>")` ⇒ ถ้าสแกนแบบดิบ ด่านจะโกหกได้
  */
  return codeOf(relativePath);
}

/** อ่านแบบ **ดิบ** (รวมคอมเมนต์) — ใช้เฉพาะเทสต์ที่ *ตั้งใจ* ตรวจทั้งไฟล์รวมคอมเมนต์ */
function rawSourceOf(relativePath: string): string {
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

    /*
      ทางที่ 3 (layout ของหลังบ้าน): ไฟล์นี้ไม่ใช่ "หน้าจอ" แต่เป็น **เมนู**
      ⇒ การประกาศสิทธิ์ของมันคือตาราง `sidebarPermission` แล้วกรองเมนูด้วยค่านั้น
      ⚠️ บทเรียนรอบที่ 242: ก่อนหน้านี้ไฟล์นี้ "ผ่าน" การสแกนเพราะ **คอมเมนต์** มีข้อความ
         `requireAdminUser("<permission>")` ⇒ ผลบวกปลอม (คอมเมนต์ไม่ใช่การตรวจสิทธิ์)
         ⇒ ตอนนี้ต้องมีของจริง: ชนิด `AdminPermission` + ตาราง + การเรียก `can(...)` ด้วยค่านั้น
    */
    if (
      file === "app/admin/layout.tsx" &&
      source.includes("sidebarPermission: Readonly<Record<string, AdminPermission>>") &&
      source.includes('can(user.role, sidebarPermission[item.href] ?? "content")')
    ) {
      continue;
    }

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

test("rbac: ลิงก์ข้ามสิทธิ์ต้องถูกซ่อนด้วย can(user.role, ...) (ไม่ให้กดแล้วเด้ง /admin/denied)", () => {
  /*
    บทเรียน รอบที่ 85: หลังทำ RBAC ยังเหลือจุดที่ UI โชว์ของซึ่งกดแล้วเด้งไป /admin/denied
    (การ์ดถังขยะบน /admin · ลิงก์ถังขยะบนคลังภาพ) เพราะหน้าแม่ใช้สิทธิ์ต่ำกว่าเป้าหมาย
    เทสต์นี้สแกนอัตโนมัติ: ถ้า "บทบาทต่ำสุดที่เข้าหน้านี้ได้" ยังเข้าเป้าหมายไม่ได้
    ไฟล์นั้นต้องมี `can(user.role, "<permission ของเป้าหมาย>")` กำกับ
  */
  const privilegedRoutes: readonly { readonly prefix: string; readonly permission: AdminPermission }[] = [
    { prefix: "/admin/trash", permission: "trash" },
    { prefix: "/admin/users", permission: "users" },
    { prefix: "/admin/settings", permission: "settings" },
    { prefix: "/admin/preview-links", permission: "preview" },
    { prefix: "/admin/inbox", permission: "inbox" },
    { prefix: "/admin/media", permission: "media" },
    { prefix: "/admin/builder/chrome", permission: "presets" },
    { prefix: "/admin/builder/mourning", permission: "presets" },
    { prefix: "/admin/builder/footer", permission: "presets" },
    { prefix: "/admin/builder/navbar", permission: "presets" },
  ];

  const offenders: string[] = [];
  for (const file of adminFiles()) {
    const source = sourceOf(file);
    const own = /requireAdminUser\("([a-z]+)"\)/.exec(source)?.[1];
    if (own === undefined) continue;

    /* บทบาท "ต่ำสุด" ที่เข้าได้ = บทบาทแรกในลำดับที่มีสิทธิ์นี้ (ตารางสิทธิ์เป็นแบบเพิ่มขึ้นเสมอ) */
    const weakest = ADMIN_ROLES.find((role) => can(role, own as AdminPermission));
    if (weakest === undefined) continue;

    for (const { prefix, permission } of privilegedRoutes) {
      if (!source.includes(`href="${prefix}`)) continue;
      if (can(weakest, permission)) continue; /* เข้าหน้านั้นได้อยู่แล้ว ⇒ ไม่ต้องซ่อน */
      if (source.includes(`can(user.role, "${permission}")`)) continue;
      offenders.push(`${file} → ${prefix} ต้องมี can(user.role, "${permission}")`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "ลิงก์ไปหน้าที่ต้องสิทธิ์สูงกว่าต้องซ่อนตามสิทธิ์ (ไม่ให้กดแล้วเด้ง /admin/denied)",
  );
});

test("rbac: การ์ดเฉพาะทางบน /admin และการ์ด SEO รายหน้า ต้องผูกสิทธิ์ตรงกับ action", () => {
  /* การ์ด "เฉพาะทาง" ไม่ใช่แค่ลิงก์ ⇒ เทสต์สแกนลิงก์ด้านบนจับไม่ได้ ต้องตรวจชื่อสิทธิ์ตรง ๆ */
  const overview = sourceOf("app/admin/page.tsx");
  assert.ok(overview.includes('can(user.role, "retention")'), "การ์ดระยะเก็บข้อมูล/ปุ่มลบ ต้องผูกกับสิทธิ์ retention");
  assert.ok(overview.includes('can(user.role, "maintenance")'), "การ์ดโหมดปิดปรับปรุง ต้องผูกกับสิทธิ์ maintenance");
  assert.ok(overview.includes('can(user.role, "trash")'), "การ์ดถังขยะ ต้องผูกกับสิทธิ์ trash");

  /*
    การ์ด SEO รายหน้า (ตัวสร้างหน้า) = ผู้เผยแพร่ขึ้นไป และการบันทึกก็ใช้สิทธิ์เดียวกัน
    ⚠️ ต้องเก็บผลของประตูสิทธิ์ไว้ใช้ตัดสิน UI ด้วย (ไม่ทิ้งค่า) — เคสจริงรอบที่ 85: ทิ้งแล้วอ้าง `user.role` → compile พัง
  */
  const builder = sourceOf("app/admin/builder/[page]/page.tsx");
  assert.ok(builder.includes('can(user.role, "seo")'), "การ์ด SEO รายหน้า ต้องผูกกับสิทธิ์ seo");
  assert.ok(
    builder.includes('const user = await requireAdminUser("content")'),
    "ตัวสร้างหน้าต้องเก็บผู้ใช้จากประตูสิทธิ์ไว้ใช้ตัดสินการแสดงผล",
  );
  assert.ok(
    sourceOf("app/admin/builder/page-actions.ts").includes('requireAdminUser("seo")'),
    "บันทึก SEO รายหน้า ต้องใช้สิทธิ์ seo ให้ตรงกับการ์ด",
  );

  /* คลังภาพเข้าถึงด้วยสิทธิ์ media แต่ถังขยะต้องใช้ trash ⇒ ต้องซ่อนลิงก์สำหรับบทบาทที่ไม่มี */
  assert.ok(
    sourceOf("app/admin/media/page.tsx").includes('const user = await requireAdminUser("media")'),
    "คลังภาพต้องเก็บผู้ใช้จากประตูสิทธิ์ไว้ใช้ตัดสินการแสดงผล",
  );
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

  /*
    กันล็อกตัวเองออก: ต้องเช็ค "ผู้ดูแลที่ยังใช้งานได้คนสุดท้าย" ทั้งตอนถอดบทบาท ตอนปิดบัญชี **และตอนลบบัญชีถาวร** (B3 รอบที่ 90)
    3 จุด = ครบทุกเส้นทางที่ทำให้ผู้ดูแลระบบคนสุดท้ายหายไป
  */
  assert.equal(repo.split('return { ok: false, reason: "last-admin" }').length - 1, 3, "ต้องมีการกัน last-admin 3 จุด");
  assert.ok(repo.includes("countActiveAdmins("), "ต้องนับผู้ดูแลที่ยังใช้งานได้จริง");

  /* audit ทุกการเปลี่ยนบัญชี */
  for (const action of [
    "admin-user-create",
    "admin-user-role",
    "admin-user-disable",
    "admin-user-enable",
    "admin-user-password",
    "admin-user-delete",
  ]) {
    assert.ok(repo.includes(action), `ต้องลง audit "${action}"`);
  }

  /*
    ลบบัญชีถาวร (B3 · รอบที่ 90) — ด่านที่ต้องมี (เรียงตามความเสียหาย)
    1. ห้ามลบตัวเอง (เทียบ id กับผู้กระทำ)
    2. ต้องมี "พิมพ์อีเมลยืนยัน" ให้ตรงกับบัญชีจริง (เทียบแบบ normalize)
    3. ต้องใช้ `delete` เท่านั้น (ไม่ใช่ update ธงลบ) ⇒ บัญชีหายจริงตามที่ผู้ใช้ยืนยัน
  */
  assert.ok(repo.includes("if (input.id === input.actorId) return { ok: false, reason: \"self\" }"), "ห้ามลบตัวเอง");
  assert.ok(repo.includes("normalizeAdminEmail(input.confirmEmail) !== normalizeAdminEmail(target.email)"), "ต้องเทียบอีเมลยืนยันกับบัญชีจริง");
  assert.ok(repo.includes("delete from admin_user where id = $1"), "ต้องลบแถวจริง (ไม่ใช่ปิดบัญชี)");

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
  assert.ok(layout.includes('"/admin/users": "users"'), "ไซด์บาร์ต้องผูกสิทธิ์ users กับหน้าจัดการบัญชี");
  assert.ok(layout.includes('sidebarPermission[item.href] ?? "content"'), "ต้องกรองเมนูตามสิทธิ์ของบัญชี");
  assert.ok(layout.includes('href: "/admin/users"'), "มีลิงก์ไปหน้าจัดการบัญชี");
  assert.ok(layout.includes("roleLabelOf("), "แสดงบทบาทของผู้ใช้ปัจจุบัน (ย้ายไปท้ายไซด์บาร์)");
  /*
    รอบที่ 242 (คำสั่งเจ้าของ): "ส่วนไหนซ้ำซ้อนกับไซด์บาร์เอาออก" ⇒ ถอดแถบลิงก์ด้านบนออก
    ⚠️ กันไม่ให้มีเมนูชุดที่สองกลับมาโดยไม่ตั้งใจ (ผู้ใช้จะกดมั่ว/สับสนอีก)
  */
  assert.equal(layout.includes("link.permission"), false, "ห้ามมีแถบลิงก์เมนูด้านบนชุดที่สอง");
  assert.equal(layout.includes("messages.admin.chromeTitle"), false, "ห้ามเหลือป้ายเมนูของแถบด้านบน");
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
      /* ⚠️ ตั้งใจใช้ raw: เทสต์นี้ต้องการให้ **คอมเมนต์** ก็ไม่มีรูปแบบเก่าหลงเหลือ (ดูเหตุผลด้านบน) */
      if (rawSourceOf(relative).includes("requireAdminUser()")) offenders.push(relative);
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

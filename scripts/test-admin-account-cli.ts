import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  MIN_ADMIN_PASSWORD_LENGTH,
  isUsableAdminPassword,
} from "@/lib/auth/types";
import { MIN_ADMIN_PASSWORD_LENGTH as MIN_FROM_REPOSITORY } from "@/lib/auth/users-repository";
import { accountPasswordHint, parseAccountCliArgs, planAccountAction } from "@/lib/auth/account-cli";
import { codeOf, REPO_ROOT } from "@/scripts/source-scan";

/**
 * เทสต์ของ `npm run admin:passwd` (รอบที่ 295) — CLI ออกรหัสให้ "ตัวบุคคล"
 *
 * ที่มา (มติเจ้าของ 2026-10-16): ตอนขึ้นเซิร์ฟเวอร์จริงจะออกรหัสตามตัวผู้รับมอบหมาย (เช่นตามรหัสพนักงาน)
 * ⇒ ต้องมีคำสั่งที่ผูกกับบัญชีรายคนในตาราง `admin_user` (ไม่ใช่บัญชี env ใบเดียวของ `admin:create`)
 */

test("บัญชี CLI: อ่านตัวเลือกถูกต้อง — บทบาทเริ่มต้น = editor (ให้สิทธิ์เท่าที่ต้องใช้)", () => {
  const base = parseAccountCliArgs(["--email=someone@waiwai.co.th"]);
  assert.equal(base.email, "someone@waiwai.co.th");
  assert.equal(base.role, "editor");
  assert.equal(base.password, null);
  assert.equal(base.list, false);
  assert.equal(base.json, false);

  const custom = parseAccountCliArgs([
    "--email=someone@waiwai.co.th",
    "--password=004400-waiwai",
    "--name=สมชาย",
    "--role=publisher",
    "--base=https://www.waiwai.com",
    "--json",
  ]);
  assert.equal(custom.role, "publisher");
  assert.equal(custom.name, "สมชาย");
  assert.equal(custom.base, "https://www.waiwai.com");
  assert.equal(custom.json, true);

  assert.equal(parseAccountCliArgs(["--list"]).list, true, "--list ใช้ได้โดยไม่ต้องมีอีเมล");
});

test("บัญชี CLI: ปฏิเสธข้อมูลผิดก่อนแตะฐานข้อมูล (อีเมล/บทบาท/ธงที่ไม่รู้จัก)", () => {
  assert.throws(() => parseAccountCliArgs([]), /ต้องระบุ --email/);
  assert.throws(() => parseAccountCliArgs(["--email=ไม่ใช่อีเมล"]), /อีเมลไม่ถูกต้อง/);
  assert.throws(() => parseAccountCliArgs(["--email=a@b.co", "--role=root"]), /บทบาทไม่ถูกต้อง/);
  assert.throws(() => parseAccountCliArgs(["--email=a@b.co", "--wat=1"]), /ไม่รู้จักตัวเลือก/);
});

test("บัญชี CLI: **รหัสพนักงานล้วนใช้ไม่ได้กับบัญชีรายคน** (เกณฑ์ 12 ตัวอักษร) — ต้องบอกทางแก้", () => {
  /* นี่คือข้อจำกัดจริงที่เจ้าของต้องรู้ก่อนตั้งรหัสตามรหัสพนักงาน */
  assert.equal(MIN_ADMIN_PASSWORD_LENGTH, 12);
  assert.equal(isUsableAdminPassword("004400"), false);
  assert.equal(isUsableAdminPassword("004400-waiwai"), true);

  assert.throws(
    () => parseAccountCliArgs(["--email=a@b.co", "--password=004400"]),
    /สั้นเกินไป \(6 ตัวอักษร\)[\s\S]*≥ 12[\s\S]*004400-waiwai/,
  );

  assert.equal(parseAccountCliArgs(["--email=a@b.co", "--password=004400-waiwai"]).password, "004400-waiwai");
  assert.equal(MIN_FROM_REPOSITORY, MIN_ADMIN_PASSWORD_LENGTH, "ค่าคงที่ต้องเป็นแหล่งเดียว (types ↔ repository)");
});

test("บัญชี CLI: ตัดสิน 'สร้าง' กับ 'ตั้งรหัสใหม่' จากสถานะจริง (ไม่เดา)", () => {
  const options = parseAccountCliArgs(["--email=someone@waiwai.co.th"]);

  const created = planAccountAction(options, null);
  assert.equal(created.kind, "create");

  const reset = planAccountAction(options, { id: "u-1", role: "publisher" });
  assert.equal(reset.kind, "reset");
  assert.ok(reset.kind === "reset" && reset.existingId === "u-1", "ต้องตั้งรหัสให้บัญชีเดิม ไม่สร้างซ้ำ");
  assert.ok(reset.kind === "reset" && reset.existingRole === "publisher");

  assert.equal(planAccountAction(parseAccountCliArgs(["--list"]), null).kind, "list");
});

test("บัญชี CLI: เตือนรหัสอ่อนแบบมีเหตุผล (สั้น/ตัวเลขล้วน/ตัวอักษรล้วน/ซ้ำตัวเดียว)", () => {
  assert.match(accountPasswordHint("004400") ?? "", /สั้นกว่า 12/);
  assert.match(accountPasswordHint("004400004400") ?? "", /ตัวเลขล้วน/);
  assert.match(accountPasswordHint("aaaaaaaaaaaa") ?? "", /ซ้ำ/);
  assert.match(accountPasswordHint("waiwaiwaiwai") ?? "", /ตัวอักษรล้วน/);
  assert.equal(accountPasswordHint("004400-waiwai"), null, "ผ่านเกณฑ์ = ไม่ต้องเตือน");
});

test("บัญชี CLI: ตัวสคริปต์ต้องใช้ repository (ไม่เขียน SQL เอง/ไม่พิมพ์ hash) และถูกลงทะเบียนเป็น npm script", () => {
  const script = codeOf("scripts/admin-passwd.ts");
  const raw = readFileSync(path.join(REPO_ROOT, "scripts/admin-passwd.ts"), "utf8");
  const pkg = readFileSync(path.join(REPO_ROOT, "package.json"), "utf8");

  assert.ok(script.includes("createAdminUser("), "ทางสร้างต้องใช้ repository (hash + audit ให้แล้ว)");
  assert.ok(script.includes("resetAdminUserPassword("), "ทางตั้งรหัสใหม่ต้องใช้ repository (ตัดเซสชันเดิมให้ด้วย)");
  assert.ok(script.includes("listAdminUsers()"), "ต้องอ่านบัญชีจาก repository");
  assert.ok(!/getPool\(\)|\.query\(/.test(script), "ห้ามเขียน SQL เองในสคริปต์ CLI");
  assert.ok(!/password_hash|hashPassword\(/.test(script), "ห้ามแตะ hash ตรง ๆ");
  assert.ok(!/writeFileSync|\.env\.local/.test(raw), "CLI นี้ไม่เขียนไฟล์ env (หน้าที่นั้นเป็นของ admin:create)");
  assert.ok(pkg.includes('"admin:passwd"'), "ต้องมี `npm run admin:passwd`");
});

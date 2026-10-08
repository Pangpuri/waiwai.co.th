import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { ACCOUNT_AUDIT_PREFIX, auditActionLabel, auditStamp } from "@/features/admin/audit-labels";
import { th } from "@/lib/i18n/messages/th";

/**
 * เทสต์ "ร่องรอยการใช้งาน" (B3 · รอบที่ 90)
 *
 * เหตุผลที่ต้องมี
 * - รอบที่ 90 เพิ่มหน้า "กิจกรรมของฉัน" + "ประวัติบัญชี" ⇒ แผนที่รหัสเหตุการณ์ → ข้อความ ถูกใช้ 3 ที่
 *   ถ้ามีเหตุการณ์ใหม่ที่ยังไม่มีป้าย ผู้ใช้จะเห็น `admin-user-delete` ดิบ ๆ บนหน้าจอ (อ่านไม่ออก)
 *   ⇒ เทสต์นี้ **สแกนซอร์สหาทุกเหตุการณ์ที่ระบบเขียนจริง** แล้วบังคับว่าต้องมีป้าย
 * - ชุดทดสอบนี้รันได้โดยไม่ต้องมีฐานข้อมูล (อ่านไฟล์ + ตรรกะล้วน)
 */

const ROOT = join(import.meta.dirname, "..");

function sourceFiles(directory: string, found: string[] = []): readonly string[] {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      sourceFiles(path, found);
      continue;
    }
    if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) found.push(path);
  }
  return found;
}

/**
 * รายการเหตุการณ์ทั้งหมด — อ่านจาก **type กลาง** (`AuditAction` ใน `lib/audit/log.ts`)
 * นี่คือแหล่งความจริง: เพิ่มเหตุการณ์ใหม่ใน type แต่ลืมใส่ป้าย ⇒ เทสต์นี้แดงทันที
 */
function declaredActions(): readonly string[] {
  const source = readFileSync(join(ROOT, "lib", "audit", "log.ts"), "utf8");
  const start = source.indexOf("export type AuditAction =");
  assert.ok(start >= 0, "ไม่พบ type AuditAction");
  const body = source.slice(start, source.indexOf(";", start));

  return [...body.matchAll(/\|\s*"([a-z][a-z0-9-]+)"/g)].flatMap((match) => {
    const value = match[1];
    return value === undefined ? [] : [value];
  });
}

/** เหตุการณ์ที่ระบบเขียนจริง (สแกนซอร์ส) — ตาข่ายจับ "เขียนรหัสที่ไม่มีใน type" ด้วย */
function writtenActions(): readonly string[] {
  const found = new Set<string>();
  const pattern = /action:\s*"([a-z][a-z0-9-]+)"/g;

  for (const file of [...sourceFiles(join(ROOT, "lib")), ...sourceFiles(join(ROOT, "app"))]) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(pattern)) {
      const value = match[1];
      if (value !== undefined) found.add(value);
    }
  }

  return [...found].sort();
}

test("audit: ทุกเหตุการณ์ใน type กลางต้องมีป้ายในพจนานุกรม (ไม่โชว์รหัสดิบ)", () => {
  const actions = declaredActions();

  assert.ok(actions.length >= 25, `ต้องเจอเหตุการณ์อย่างน้อย 25 แบบใน type (เจอ ${actions.length})`);

  for (const action of actions) {
    const label = auditActionLabel(th.admin, action);
    assert.notEqual(label, action, `เหตุการณ์ "${action}" ยังไม่มีป้ายในพจนานุกรม`);
    assert.ok(label.trim().length > 0, `เหตุการณ์ "${action}" มีป้ายว่าง`);
  }
});

test("audit: รหัสที่เขียนจริงในซอร์สต้องไม่หลุดจาก type (และมีป้ายครบ)", () => {
  const declared = new Set(declaredActions());
  const written = writtenActions();

  assert.ok(written.length >= 10, `ต้องเจอเหตุการณ์ที่เขียนจริงอย่างน้อย 10 แบบ (เจอ ${written.length})`);

  for (const action of written) {
    assert.ok(declared.has(action), `ซอร์สเขียนเหตุการณ์ "${action}" ที่ไม่มีใน type AuditAction`);
    assert.notEqual(auditActionLabel(th.admin, action), action, `เหตุการณ์ "${action}" ยังไม่มีป้าย`);
  }
});

test("audit: รหัสที่ไม่รู้จักคืนรหัสดิบ (ไม่ทำให้หน้าจอว่าง)", () => {
  assert.equal(auditActionLabel(th.admin, "brand-new-event"), "brand-new-event");
});

test("audit: รหัสเหตุการณ์ของบัญชีขึ้นต้นด้วยคำนำหน้าที่ใช้กรอง", () => {
  for (const action of ["admin-user-create", "admin-user-role", "admin-user-delete"]) {
    assert.ok(action.startsWith(ACCOUNT_AUDIT_PREFIX), `${action} ต้องอยู่ใต้ "${ACCOUNT_AUDIT_PREFIX}"`);
  }
});

test("audit: auditStamp ตัดถึงนาทีและอ่านได้ (สตริงเหมือนเดิม · รับ Date ได้ · ห้ามพัง) — รอบที่ 197", () => {
  assert.equal(auditStamp("2026-10-03T07:45:12.345Z"), "2026-10-03 07:45");
  assert.equal(auditStamp("2026-10-03T07:45:12Z"), "2026-10-03 07:45", "ไม่มีมิลลิวินาทีก็ได้");

  /* ★ บั๊กจริงรอบที่ 197: Postgres คืน `timestamptz` เป็น **Date** ⇒ เดิมหน้าจอ 500 ทั้งหน้า (`iso.slice is not a function`) */
  assert.equal(auditStamp(new Date("2026-10-03T07:45:12.345Z")), "2026-10-03 07:45", "Date ต้องแปลงได้");
  assert.equal(auditStamp(new Date(Number.NaN)), "", "Date เพี้ยน = ค่าว่าง (ไม่โยน error)");
  assert.equal(auditStamp(null), "");
  assert.equal(auditStamp(undefined), "");
  assert.equal(auditStamp(""), "");
});

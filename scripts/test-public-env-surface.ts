import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * เทสต์ "เดโมหน้าบ้านต้องไม่ต้องใช้ env อะไรนอกจาก DATABASE_URL" (รอบที่ 122)
 *
 * ที่มา (คำถามเจ้าของ): *"SESSION_SECRET อันนี้จำเป็นไหมครับ ถ้าไม่จะได้เอาออก"*
 * คำตอบที่ต้องพิสูจน์ได้ด้วยโค้ด:
 * - หน้าบ้าน (หน้าเว็บสาธารณะ) อ่านแค่ `DATABASE_URL`
 * - `SESSION_SECRET` ใช้เฉพาะ **หลังบ้าน** (ลายเซ็นคุกกี้เซสชัน) และ **บัตรผ่านโหมดปิดปรับปรุงใน proxy**
 *   ซึ่ง `proxy` จัดการกรณีไม่มีค่าแบบ fail-closed (`return false`) ไม่ crash
 * - ถ้าไม่ตั้ง `ADMIN_*`/`SESSION_SECRET` ⇒ `/admin/login` ขึ้น "ยังตั้งค่าไม่ครบ" (ปลอดภัยตามมติ D4)
 *
 * ⇒ เทสต์นี้ล็อกว่า **ห้ามมีโค้ดหน้าบ้านไปอ่าน SESSION_SECRET** (กันอนาคตมีคนผูกหน้าบ้านกับความลับหลังบ้าน)
 */

const ROOT = process.cwd();

/** ไฟล์ที่ "อนุญาต" ให้แตะ SESSION_SECRET (หลังบ้าน/ตัวเขียน env/เทสต์/ข้อความ) */
const ALLOWED_PREFIXES = ["lib/auth/", "lib/db/", "proxy.ts", "scripts/", "lib/i18n/"];

function walk(dir: string, out: string[] = []): readonly string[] {
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const files = ["app", "features", "lib", "db", "proxy.ts", "scripts"].flatMap((entry) => {
  const full = path.join(ROOT, entry);
  if (statSync(full).isDirectory()) return walk(entry);
  return [entry];
});

test("env: โค้ดหน้าบ้านต้องไม่อ่าน SESSION_SECRET (เดโมใช้แค่ DATABASE_URL)", () => {
  const offenders: string[] = [];

  for (const file of files) {
    if (ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
    const code = readFileSync(path.join(ROOT, file), "utf8");
    if (/SESSION_SECRET/.test(code)) offenders.push(file);
  }

  assert.deepEqual(
    offenders,
    [],
    `ไฟล์เหล่านี้เป็นโค้ดหน้าบ้านแต่ไปอ่าน SESSION_SECRET (ทำให้เว็บพังเมื่อไม่ตั้งค่าหลังบ้าน):\n${offenders.join("\n")}`,
  );
});

test("env: proxy ต้องจัดการ 'ไม่มี SESSION_SECRET' แบบ fail-closed (ไม่ throw)", () => {
  const proxy = readFileSync(path.join(ROOT, "proxy.ts"), "utf8");
  const block = proxy.slice(proxy.indexOf("function hasValidMaintenanceBypass"));
  const body = block.slice(0, block.indexOf("\n}"));

  assert.ok(body.includes("SESSION_SECRET"), "proxy ยังอ่าน SESSION_SECRET เพื่อตรวจบัตรผ่าน");
  assert.ok(body.includes("return false"), "ต้องคืน false เมื่อตรวจไม่ผ่าน (fail-closed)");
  assert.ok(!body.includes("throw"), "ห้าม throw ในเส้นทางนี้ ⇒ ไม่งั้นเว็บล่มทั้งเว็บเมื่อไม่ตั้งค่าหลังบ้าน");
  assert.ok(
    /secret\s*===\s*undefined/.test(body) && body.includes("isSecretUsable"),
    "ต้องเช็คทั้ง 'ไม่มีค่า' และ 'ค่าใช้ไม่ได้' ก่อนใช้",
  );
});

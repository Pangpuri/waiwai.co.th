import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  ORPHAN_SCAN_ROOTS,
  ORPHAN_SOURCE_FILE,
  findOrphanKeys,
  isReferenced,
  topLevelKeysOfArea,
} from "@/scripts/i18n-orphans";
import { REPO_ROOT, stripComments } from "@/scripts/source-scan";

/**
 * เทสต์ของด่าน "คีย์พจนานุกรมที่ไม่มีใครอ้าง" (หนี้ D-252-1 · check:i18n ข้อ 5)
 *
 * ⚠️ ไฟล์นี้ทดสอบ **ตัวช่วย** (ตรรกะล้วน) + สแกนพจนานุกรมจริงหนึ่งครั้ง
 *    ⇒ ถ้ามีคนเพิ่มคีย์แล้วลืมใช้ (หรือลบโมดูลแล้วลืมลบคีย์) `npm test` จะฟ้องทันที
 */

test("topLevelKeysOfArea: เอาเฉพาะคีย์ระดับราก (เยื้อง 2 ช่อง) และทน CRLF", () => {
  const source = [
    "export const sample = {",
    '  alpha: "ก",',
    "  beta: {",
    '    nested: "ข",',
    "  },",
    '  gamma: "ค",',
    "};",
  ].join("\r\n");

  assert.deepEqual(topLevelKeysOfArea(source), ["alpha", "beta", "gamma"]);
  assert.deepEqual(topLevelKeysOfArea(""), []);
});

test("topLevelKeysOfArea: ไม่นับคีย์ที่อยู่ในคอมเมนต์หรือเยื้องลึกกว่า", () => {
  const source = [
    "/** ตัวอย่าง:",
    ' *   fakeTopLevel: "ไม่นับ",',
    " */",
    "export const sample = {",
    '    deep: "ไม่นับ (เยื้อง 4)",',
    '  real: "นับ",',
    "};",
  ].join("\n");

  assert.deepEqual(topLevelKeysOfArea(source), ["real"]);
});

test("isReferenced: จับชื่อคีย์แบบมีขอบเขต (ไม่ใช่ substring)", () => {
  assert.equal(isReferenced("fieldEn", ["const label = strings.fieldEn;"]), true);
  assert.equal(isReferenced("fieldEn", ["const label = strings.fieldEnOptional;"]), false);
  assert.equal(isReferenced("save", ["const label = strings.save;"]), true);
  assert.equal(isReferenced("save", ["const label = strings.savedOk;"]), false);
  assert.equal(isReferenced("title", ["const titles = [];"]), false);

  /* คีย์ที่ถูกเก็บเป็น "ข้อมูล" (เช่น labelKey ในรายการ) ก็นับว่าถูกอ้าง */
  assert.equal(isReferenced("heroCardStateLive", ['const key = "heroCardStateLive";']), true);

  /* ชื่อคีย์ในเครื่องหมายคำพูดเดี่ยว/วงเล็บเหลี่ยมก็เจอ */
  assert.equal(isReferenced("navMourning", ["strings['navMourning']"]), true);
  assert.equal(isReferenced("navMourning", ["empty"]), false);
});

test("findOrphanKeys: คืนเฉพาะคีย์ที่ไม่ถูกอ้าง และคงลำดับเดิม", () => {
  const sources = [stripComments("const a = strings.kept;\n/* strings.commentedOnly */")];

  assert.deepEqual(findOrphanKeys(["kept", "commentedOnly", "missing"], sources), [
    "commentedOnly",
    "missing",
  ]);
  assert.deepEqual(findOrphanKeys(["kept"], sources), []);
  assert.deepEqual(findOrphanKeys([], sources), []);
});

test("findOrphanKeys: คอมเมนต์ไม่ทำให้คีย์รอด (บทเรียน source-scan)", () => {
  const raw = [
    "const keep = strings.usedSomewhere;",
    "/* เก็บไว้ใช้ทีหลัง: obsoleteKey */",
  ].join("\n");

  /* ไม่ตัดคอมเมนต์ = ชื่อคีย์ในคอมเมนต์ยังทำให้ผ่าน (นี่คือเหตุผลที่ด่านต้องตัดคอมเมนต์ก่อน) */
  assert.deepEqual(findOrphanKeys(["usedSomewhere", "obsoleteKey"], [raw]), []);
  assert.deepEqual(findOrphanKeys(["usedSomewhere", "obsoleteKey"], [stripComments(raw)]), [
    "obsoleteKey",
  ]);
});

test("พจนานุกรมจริง: ไม่มีคีย์ที่ไม่มีใครอ้างเลย (หนี้ D-252-1)", () => {
  const keys = new Set<string>();
  const thAreaDir = path.join(REPO_ROOT, "lib", "i18n", "messages", "areas", "th");
  for (const file of readdirSync(thAreaDir).filter((name) => name.endsWith(".ts"))) {
    for (const key of topLevelKeysOfArea(readFileSync(path.join(thAreaDir, file), "utf8"))) {
      keys.add(key);
    }
  }

  const sources: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(target);
        continue;
      }
      if (!ORPHAN_SOURCE_FILE.test(entry.name)) continue;
      const relative = path.relative(REPO_ROOT, target).split(path.sep).join("/");
      if (relative.startsWith("lib/i18n/messages/")) continue; /* ตัวพจนานุกรมเอง */
      sources.push(stripComments(readFileSync(target, "utf8")));
    }
  };

  for (const root of ORPHAN_SCAN_ROOTS) {
    const target = path.join(REPO_ROOT, root);
    if (existsSync(target)) walk(target);
  }
  for (const entry of readdirSync(REPO_ROOT)) {
    const target = path.join(REPO_ROOT, entry);
    if (!statSync(target).isFile() || !ORPHAN_SOURCE_FILE.test(entry)) continue;
    sources.push(stripComments(readFileSync(target, "utf8")));
  }

  assert.ok(keys.size > 1000, "ต้องอ่านคีย์ได้จริง (กันเทสต์หลอกที่อ่านไม่เจอไฟล์)");
  assert.deepEqual(findOrphanKeys([...keys], sources), []);
});

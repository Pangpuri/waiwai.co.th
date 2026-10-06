import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { prunePlan } from "@/lib/import/prune";

/**
 * เทสต์ "สุขอนามัยของสคริปต์นำเข้า" (รอบที่ 142 · หนี้ A1 + A2)
 *
 * ที่มา: หนี้ที่เจ้าของสั่งเคลียร์
 * - **A1** `recipes:import` / `news:import` ยังเขียนทับงานที่แก้จากหลังบ้าน (รอบ 140 ทำเฉพาะสินค้า)
 * - **A2** ของที่ถอดจากเว็บเดิมยังค้างใน DB (ไม่มี `--prune`)
 */

test("import-prune: prunePlan คืนของที่หายจากต้นทาง (เรียงแล้ว · ไม่ซ้ำ)", () => {
  const db = ["n3", "n1", "n2", "n2"];
  const imported = ["n1", "n3"];
  assert.deepEqual(prunePlan(db, imported), ["n2"], "ต้องได้เฉพาะที่ไม่มีในต้นทาง + ไม่ซ้ำ");
});

test("import-prune: ไม่มีอะไรหาย = คืนลิสต์ว่าง (ไม่ลบมั่ว)", () => {
  assert.deepEqual(prunePlan(["a", "b"], ["a", "b", "c"]), [], "ของใน DB ครบ = ไม่มีอะไรต้องทำ");
  assert.deepEqual(prunePlan([], ["a"]), [], "DB ว่าง = ไม่มีอะไรต้องทำ");
});

test("import-prune: id ว่าง/ช่องว่างถูกข้าม (กันลบผิดแถว)", () => {
  assert.deepEqual(prunePlan(["", "  ", "n9"], ["n1"]), ["n9"], "ค่าเปล่าต้องไม่กลายเป็นเป้าหมายการลบ");
});

test("import-prune: สคริปต์ทั้ง 3 ตัวมี --prune/--prune-apply และย้ายเข้าถังขยะ (ไม่ลบถาวร)", () => {
  const scripts = ["scripts/import-products.ts", "scripts/import-recipes.ts", "scripts/import-news.ts"];
  for (const file of scripts) {
    const text = readFileSync(file, "utf8");
    assert.ok(text.includes('arg === "--prune"'), `${file} ต้องมี --prune`);
    assert.ok(text.includes('arg === "--prune-apply"'), `${file} ต้องมี --prune-apply`);
    assert.ok(text.includes("prunePlan("), `${file} ต้องใช้ตัววางแผนกลาง`);
    assert.ok(/set(Product|Recipe|News)Trashed\(id, true/.test(text), `${file} ต้องย้ายเข้าถังขยะ (ไม่ลบถาวร)`);
    assert.ok(!/delete(Product|Recipe|News)(Forever)?\(id\)/.test(text), `${file} ห้ามลบถาวรในเส้นทาง prune`);
  }
});

test("import-prune: เมนู/ข่าว ใช้โหมด protect-edited เป็นค่าเริ่มต้น + มี --force (หนี้ A1)", () => {
  for (const file of ["scripts/import-recipes.ts", "scripts/import-news.ts"]) {
    const text = readFileSync(file, "utf8");
    assert.ok(text.includes('arg === "--force"'), `${file} ต้องมี --force`);
    assert.ok(
      text.includes('const writeMode = options.force ? "replace" : "protect-edited";'),
      `${file} ค่าเริ่มต้นต้องเป็น protect-edited`,
    );
    assert.ok(text.includes("stats.protectedEdits"), `${file} ต้องรายงานจำนวนที่คงค่าเดิมไว้`);
    assert.ok(text.includes("if (result.protectedEdit)"), `${file} ต้องใช้ผลจากชั้นข้อมูล (ไม่เดาเอง)`);
  }
});

test("import-prune: ชั้นข้อมูลของเมนู/ข่าวมีประตูกันทับ + คง updated_at/by (แบบเดียวกับสินค้า)", () => {
  const recipes = readFileSync("lib/recipes/repository.ts", "utf8");
  const news = readFileSync("lib/news/repository.ts", "utf8");
  const tables: readonly { readonly name: string; readonly text: string }[] = [
    { name: "recipe", text: recipes },
    { name: "news", text: news },
  ];
  for (const { name, text } of tables) {
    const table = name;
    assert.ok(text.includes(`${table}.updated_by is distinct from excluded.updated_by`), `${name}: ต้องเทียบ updated_by`);
    /* ⚠️ ต้องคง updated_at เดิม — ไม่งั้นนำเข้าครั้งที่ 2 จะทับงานคน (บทเรียนรอบที่ 140) */
    assert.ok(text.includes(`Column(mode, "updated_at", "now()")`), `${name}: ⚠️ ต้องคง updated_at เดิม`);
    assert.ok(text.includes("then " + table + ".${column} else ${fallback} end"), `${name}: ตัวช่วยต้องคงค่าเดิมของคอลัมน์นั้น`);
    assert.ok(text.includes("protectedEdit"), `${name}: ต้องคืนผลว่าป้องกันไว้ไหม`);
    assert.ok(text.includes("list") && text.includes("Ids(): Promise<readonly string[]>"), `${name}: ต้องมีตัวอ่าน id สำหรับ prune`);
  }
  /* เนื้อหาข่าวคือ body — ต้องถูกป้องกันด้วย ไม่ใช่แค่หัวข้อ */
  assert.ok(news.includes('newsColumn(mode, "body"'), "ข่าว: ต้องป้องกัน body (เนื้อหาที่คนแก้)");
});

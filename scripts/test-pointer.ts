import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * ด่านกันถอยหลัง — "สิ่งที่กดได้ต้องมี pointer"
 *
 * ที่มา (2026-10-22): เจ้าของทักว่า *"ยังไม่ได้เขียน pointer ครอบคลุมทุกปุ่มที่กดได้ ในส่วนหลังบ้าน"*
 * ตรวจแล้วจริง: Tailwind preflight ไม่ได้ตั้ง `cursor: pointer` ให้ `<button>` (เบราว์เซอร์ใช้ลูกศรปกติ)
 * และ repo นี้เคยใส่ `cursor-pointer` เฉพาะบาง `<summary>`/`<label>` ⇒ ปุ่มส่วนใหญ่ยังเป็นลูกศร
 *
 * วิธีแก้ที่เลือก: ตั้ง **ที่ base ที่เดียว** (`app/globals.css`) ให้ครอบทุกปุ่ม/ทุกหน้า
 * (รวมปุ่มที่จะเพิ่มในอนาคต) — ไม่ต้องไล่ใส่คลาสทีละปุ่มแล้วลืม
 * ด่านนี้จึงตรวจ 3 อย่าง:
 *   1. กฎกลางยังอยู่ครบ (ปุ่ม/role=button/summary/select/checkbox/radio/file + disabled)
 *   2. องค์ประกอบที่คลิกได้แต่ไม่ใช่ปุ่ม (แถวบล็อกในตัวสร้าง) ยังมี cursor-pointer
 *   3. ไม่มีใครสั่ง `cursor-default` ทับกฎกลาง (จะทำให้ปุ่มกลับเป็นลูกศรเงียบ ๆ)
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");
}

test("pointer: กฎกลางใน globals.css ครอบปุ่ม/สิ่งที่กดได้ทั้งหมด", () => {
  const css = sourceOf("app/globals.css");
  assert.ok(css.includes("@layer base"), "ต้องมี base layer สำหรับกฎกลาง");

  const required = [
    "button:not(:disabled)",
    '[role="button"]:not([aria-disabled="true"])',
    "summary",
    "select:not(:disabled)",
    'input[type="checkbox"]:not(:disabled)',
    'input[type="radio"]:not(:disabled)',
    'input[type="file"]:not(:disabled)',
    'label:has(input[type="checkbox"]:not(:disabled))',
    'label:has(input[type="radio"]:not(:disabled))',
    'label:has(input[type="file"]:not(:disabled))',
  ];
  for (const selector of required) {
    assert.ok(css.includes(selector), `กฎกลางขาด selector: ${selector}`);
  }
  assert.match(css, /cursor:\s*pointer/, "ต้องตั้ง cursor: pointer");
  assert.match(css, /button:disabled[\s\S]*?cursor:\s*not-allowed/, "ปุ่มที่ปิดใช้ต้องเป็น not-allowed");
  /* พรีวิวหลังบ้าน: ส่วนที่คลิกเลือกบล็อกได้ต้องเป็น pointer ด้วย (เฉพาะโหมดแก้ไข) */
  assert.match(
    css,
    /\[data-editable\]\s+\[data-block-id\]\s*\{\s*cursor:\s*pointer;/,
    "พรีวิวที่คลิกเลือกบล็อกได้ต้องมี cursor: pointer เฉพาะโหมดแก้ไข",
  );
});

test("pointer: แถวบล็อกในตัวสร้างที่คลิกเลือกได้ต้องมี cursor-pointer", () => {
  const source = sourceOf("features/admin/ui/block-layer-list.tsx");
  const marker = "onClick={() => handlers.onSelect(block.id)}";
  const at = source.indexOf(marker);
  assert.ok(at >= 0, "ต้องพบแถวบล็อกที่คลิกเลือกได้");
  const openingTag = source.slice(at, at + 400);
  assert.ok(openingTag.includes("cursor-pointer"), "แถวที่คลิกได้ต้องมี cursor-pointer (ไม่ใช่ปุ่มจริง)");
});

test("pointer: ห้ามมี cursor-default/cursor-auto ทับกฎกลาง", () => {
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const info = statSync(full);
      if (info.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".tsx") && !entry.endsWith(".css")) continue;
      const relative = path.relative(ROOT, full).replace(/\\/g, "/");
      const source = readFileSync(full, "utf8").replace(/\r\n/g, "\n");
      source.split("\n").forEach((line, index) => {
        if (/cursor-(default|auto)\b/.test(line)) hits.push(`${relative}:${index + 1}`);
      });
    }
  };
  walk(path.join(ROOT, "app"));
  walk(path.join(ROOT, "features"));
  assert.deepEqual(hits, [], `พบคลาสที่ทำให้ปุ่มกลับเป็นลูกศร:\n${hits.join("\n")}`);
});

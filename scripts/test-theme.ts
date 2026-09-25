import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DARK_CLASS,
  DEFAULT_THEME,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  THEMES,
  isTheme,
  resolveTheme,
} from "@/lib/theme/theme";

test("isTheme: รับเฉพาะค่าที่รู้จัก", () => {
  for (const theme of THEMES) {
    assert.equal(isTheme(theme), true);
  }

  assert.equal(isTheme("auto"), false);
  assert.equal(isTheme(null), false);
  assert.equal(isTheme(undefined), false);
  assert.equal(isTheme(0), false);
  assert.equal(isTheme("DARK"), false, "ตัวพิมพ์ใหญ่ต้องไม่ผ่าน");
});

test("resolveTheme: โหมดตามระบบต้องตามเครื่อง", () => {
  assert.equal(DEFAULT_THEME, "system");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});

test("resolveTheme: โหมดที่ผู้ใช้เลือกต้องชนะค่าของเครื่อง", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("สคริปต์กันจอวาบ: ต้องอ้างคีย์และคลาสเดียวกับที่โค้ดใช้", () => {
  assert.ok(THEME_INIT_SCRIPT.includes(THEME_STORAGE_KEY));
  assert.ok(THEME_INIT_SCRIPT.includes(DARK_CLASS));
  assert.ok(THEME_INIT_SCRIPT.includes("prefers-color-scheme"));
});

test("สคริปต์กันจอวาบ: ต้องไม่พังเมื่อ localStorage ถูกบล็อก", () => {
  // โหมดส่วนตัวของเบราว์เซอร์บางตัวโยน error ตอนอ่าน localStorage
  assert.ok(THEME_INIT_SCRIPT.includes("try"));
  assert.ok(THEME_INIT_SCRIPT.includes("catch"));
});

test("สคริปต์กันจอวาบ: ต้องทำงานก่อน paint และไม่ใช้ import", () => {
  // ต้องเป็น IIFE ที่รันทันที — ถ้าเป็น ES module จะถูกเลื่อนไปหลัง paint
  assert.ok(THEME_INIT_SCRIPT.startsWith("(function(){"));
  assert.ok(!THEME_INIT_SCRIPT.includes("import "));
});

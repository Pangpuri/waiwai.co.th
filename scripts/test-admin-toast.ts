import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * เทสต์ระบบแจ้งผลหลังบ้าน (รอบ 337) — ข้อความบันทึก/ลบต้องเป็น toast ลอยมุมจอ
 * ไม่ใช่แบนเนอร์หัวหน้าที่ทำให้ผู้ใช้ต้องเลื่อนขึ้นไปอ่านแล้วเลื่อนกลับลงมา
 *
 * ตรวจระดับซอร์ส เพราะ `AdminToastHost` เป็น client component ที่ต้อง hydrate
 * (node --test ไม่มี DOM) — ตัวพฤติกรรมจริงถูกตรวจด้วย build + การใช้งานจริง
 */

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

test("admin toast: host ถูก mount ใน layout หลังบ้าน + มีปุ่มปิดและ aria-live", () => {
  const layout = sourceOf("app/admin/layout.tsx");
  assert.ok(layout.includes("AdminToastHost"), "layout ต้อง mount toast host ครั้งเดียว");
  assert.ok(layout.includes("toastDismiss"), "ต้องส่งป้ายปุ่มปิดจากพจนานุกรม");

  const toast = sourceOf("features/admin/ui/admin-toast.tsx");
  assert.ok(toast.includes('role={failed ? "alert" : "status"}'), "ต้องมี role ที่ถูกต้องตามโทน");
  assert.ok(toast.includes('aria-live={failed ? "assertive" : "polite"}'), "ต้องประกาศให้ screen reader");
  assert.ok(toast.includes("aria-label={dismissLabel}"), "ต้องมีปุ่มปิดที่เข้าถึงได้");
  assert.ok(toast.includes("setToast(null)"), "กดปิดแล้วต้องซ่อนได้จริง");
  assert.ok(toast.includes("position") === false, "ห้ามใช้ inline position (ใช้คลาส Tailwind)");
  assert.ok(toast.includes("fixed"), "ต้องลอยอยู่กับจอ ไม่ดันเนื้อหา");
});

test("admin toast: หน้า hero ใช้ toast + anchor กลับไปส่วนที่แก้ ไม่ใช่หัวหน้า", () => {
  const page = sourceOf("app/admin/hero/page.tsx");
  assert.ok(page.includes("AdminToast"), "hero ต้องแจ้งผลผ่าน toast");
  assert.ok(!page.includes('role="status"'), "ต้องไม่มีแบนเนอร์ผลลัพธ์ที่หัวหน้าอีก");
  for (const anchor of ["hero-slides", "hero-texts", "hero-effect", "hero-card", "hero-trash"]) {
    assert.ok(page.includes(`id="${anchor}"`), `ต้องมีจุดยึด #${anchor} ให้ redirect กลับมาถูกส่วน`);
  }

  const actions = sourceOf("app/admin/hero/actions.ts");
  assert.ok(actions.includes("#hero-slides"), "เพิ่ม/ลบ/บันทึกสไลด์ต้องกลับมาที่ส่วนสไลด์");
  assert.ok(actions.includes("#hero-effect"), "บันทึกเอฟเฟกต์ต้องกลับมาที่ฟอร์มเอฟเฟกต์");
  assert.ok(actions.includes("#hero-trash"), "กู้คืน/ลบถาวรต้องกลับมาที่ถังขยะ");
});

test("admin toast: ฟอร์มหลังบ้านหลักใช้ toast แทนข้อความผลลัพธ์แบบเก่า", () => {
  const files = [
    "features/admin/ui/settings-form.tsx",
    "features/admin/ui/news-editor-form.tsx",
    "features/admin/ui/product-editor-form.tsx",
    "features/admin/ui/recipe-editor-form.tsx",
    "features/admin/ui/job-form.tsx",
    "features/admin/ui/product-category-form.tsx",
    "features/admin/ui/category-create-form.tsx",
    "features/admin/ui/category-editor-form.tsx",
    "features/admin/ui/category-preset-panel.tsx",
    "features/admin/ui/chrome-preset-panel.tsx",
    "features/admin/ui/mourning-editor.tsx",
    "features/admin/ui/user-manager.tsx",
    "features/admin/ui/trash-list.tsx",
    "features/admin/ui/preview-link-manager.tsx",
    "features/admin/ui/navbar-editor.tsx",
    "features/admin/ui/footer-editor.tsx",
  ];

  for (const file of files) {
    const source = sourceOf(file);
    assert.ok(source.includes("AdminToast"), `${file}: ต้องแจ้งผลผ่าน AdminToast`);
  }
});

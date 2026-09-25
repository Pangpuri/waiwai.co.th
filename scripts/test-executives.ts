import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { MANAGEMENT_TEAM_IMAGE } from "@/features/about/executives";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

test("MANAGEMENT_TEAM_IMAGE: ไฟล์ภาพต้องมีอยู่จริงใน public/", () => {
  assert.ok(
    MANAGEMENT_TEAM_IMAGE.src.startsWith("/executives/"),
    "path ต้องอยู่ใต้ /executives/",
  );

  const filePath = path.join(
    PROJECT_ROOT,
    "public",
    MANAGEMENT_TEAM_IMAGE.src.replace(/^\//, ""),
  );
  assert.ok(existsSync(filePath), `ไม่พบไฟล์ ${filePath}`);
});

test("MANAGEMENT_TEAM_IMAGE: ขนาดต้องเป็นจำนวนเต็มบวก (ใช้คำนวณสัดส่วนกันภาพกระตุก)", () => {
  assert.ok(Number.isInteger(MANAGEMENT_TEAM_IMAGE.width) && MANAGEMENT_TEAM_IMAGE.width > 0);
  assert.ok(Number.isInteger(MANAGEMENT_TEAM_IMAGE.height) && MANAGEMENT_TEAM_IMAGE.height > 0);
});

test("พจนานุกรม executives: ข้อความที่แสดงบนหน้าต้องไม่ว่างทั้งสองภาษา", () => {
  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    const m = messages.about.executives;

    for (const [name, value] of [
      ["meta.title", m.meta.title],
      ["meta.description", m.meta.description],
      ["eyebrow", m.eyebrow],
      ["title", m.title],
      ["intro", m.intro],
      ["breadcrumb", m.breadcrumb],
      ["figure.alt", m.figure.alt],
      ["figure.caption", m.figure.caption],
      ["note", m.note],
    ] as const) {
      assert.ok(value.trim().length > 0, `${locale}: ${name} ว่าง`);
    }
  }
});

test("figure.alt: เป็นภาพจริง ต้องบรรยายภาพ ไม่ใช่คำว่า 'ภาพตัวอย่าง'", () => {
  for (const [locale, messages] of [
    ["th", th],
    ["en", en],
  ] as const) {
    const alt = messages.about.executives.figure.alt;

    assert.ok(!alt.includes("ภาพตัวอย่าง"), `${locale}: alt ยังเป็นคำ placeholder`);
    assert.ok(!alt.toLowerCase().includes("placeholder"), `${locale}: alt ยังเป็นคำ placeholder`);
    assert.ok(alt.trim().length >= 30, `${locale}: alt สั้นเกินไปสำหรับภาพที่มีรายละเอียด`);
  }
});

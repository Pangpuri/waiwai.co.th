import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { chromeTabOf, DEFAULT_CHROME_MODE, DEFAULT_CHROME_PART } from "@/lib/chrome/workspace-url";
import { normalizeSearchText, searchParamText } from "@/lib/search/params";
import { REPO_ROOT, stripComments } from "@/scripts/source-scan";

/**
 * เทสต์ของ "อ่าน searchParams อย่างปลอดภัย" (รอบที่ 291 · ปิดบั๊กที่เจอจากการยิงจริง)
 *
 * บั๊กจริงที่เทสต์ชุดนี้กันไม่ให้กลับมา (เดิม **HTTP 500** ทุกเส้น):
 * · `?q=a&q=b` (ค่าซ้ำ ⇒ Next คืน array ⇒ `array.trim is not a function`)
 *   — `/admin/products` · `/admin/news` · `/admin/recipes` · `/admin/careers`
 *   — `/admin/products?category=…` · `/admin/inbox?erase=…` · `/admin/hero?saved|error|fields`
 *   — `/admin/builder/chrome?part&mode` · `/th/preview/home?parts`
 * · `?q=%00` (NUL) ⇒ Postgres ไม่รับ `\u0000` ในข้อความ ⇒ `ilike` โยน error — `/admin/media`
 */

test("normalizeSearchText: ตัดอักขระควบคุม/NUL · ยุบช่องว่าง · trim · จำกัดความยาว", () => {
  assert.equal(normalizeSearchText("  บะหมี่  "), "บะหมี่");
  assert.equal(normalizeSearchText("ก   ข\tค\nง"), "ก ข ค ง");
  assert.equal(normalizeSearchText("a\u0000b"), "a b", "NUL ต้องไม่หลุดไปถึง SQL");
  assert.equal(normalizeSearchText("\u0000"), "", "มีแต่ NUL ⇒ ว่าง");
  assert.equal(normalizeSearchText("a\u0001\u001Fb\u007Fc"), "a b c", "อักขระควบคุม/DEL ถูกแทนด้วยช่องว่าง");

  assert.equal(normalizeSearchText("ก".repeat(200), 80).length, 80, "เพดานความยาวต้องใช้จริง");
  assert.equal(normalizeSearchText("abc", 0), "abc", "maxLength เพี้ยน (0) ⇒ ถอยไปค่าเริ่มต้น");
  assert.equal(normalizeSearchText("abc", Number.NaN), "abc", "maxLength = NaN ⇒ ถอยไปค่าเริ่มต้น");

  /* ต้องรักษาภาษาไทย/อิโมจิไว้ (ห้าม strip ด้วย charCode ดิบ) */
  assert.equal(normalizeSearchText("บะหมี่ 🍜"), "บะหมี่ 🍜");

  /* เรียกซ้ำแล้วได้ค่าเดิม (idempotent) — ปลอดภัยแม้ผ่านหลายชั้น (หน้า → repository) */
  const once = normalizeSearchText("  ก\u0000  ข  ");
  assert.equal(normalizeSearchText(once), once);
});

test("searchParamText: ค่าซ้ำ (array) ใช้ค่าแรก · ค่าที่ไม่ใช่สตริง = ว่าง · ไม่ throw", () => {
  assert.equal(searchParamText(undefined), "");
  assert.equal(searchParamText("  ไวไว "), "ไวไว");
  assert.equal(searchParamText(["serda", "rod-ded"]), "serda", "พารามิเตอร์ซ้ำ = ใช้ค่าแรก");
  assert.equal(searchParamText([]), "", "array ว่าง = ว่าง");
  assert.equal(searchParamText(["\u0000nope"]), "nope");
  assert.equal(searchParamText(123 as unknown as string), "", "ค่าที่ไม่ใช่สตริง (จากที่อื่น) = ว่าง");
  assert.equal(searchParamText({} as unknown as string), "", "object = ว่าง");
  assert.equal(searchParamText("x".repeat(500), 80).length, 80);
});

test("chromeTabOf: ค่าซ้ำ/NUL/ค่าไม่รู้จัก ถอยไปค่าเริ่มต้น (ไม่ทำหน้า /admin/builder/chrome พัง)", () => {
  assert.deepEqual(chromeTabOf({ part: "notice", mode: "overview" }), { part: "notice", mode: "overview" });
  assert.deepEqual(chromeTabOf({ part: ["footer", "notice"] }), { part: "footer", mode: DEFAULT_CHROME_MODE });
  assert.deepEqual(chromeTabOf({ part: ["nope"], mode: ["nope"] }), {
    part: DEFAULT_CHROME_PART,
    mode: DEFAULT_CHROME_MODE,
  });
  assert.deepEqual(chromeTabOf({ part: "\u0000notice" }), { part: "notice", mode: DEFAULT_CHROME_MODE });
  assert.deepEqual(chromeTabOf({}), { part: DEFAULT_CHROME_PART, mode: DEFAULT_CHROME_MODE });
});

/**
 * ด่านกันถอยหลัง: หน้าที่อ่าน `searchParams` **ห้ามเรียกเมธอดของสตริงบนค่าดิบ**
 * (ค่าจาก URL ซ้ำได้ = array) ⇒ ต้องผ่าน `searchParamText()` เท่านั้น
 */
test("ด่านสแกนซอร์ส: ไม่มีหน้าไหนเรียก .trim()/.slice() บนค่าจาก searchParams โดยตรง", () => {
  const pages: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(target);
        continue;
      }
      if (entry.name === "page.tsx") pages.push(target);
    }
  };
  walk(path.join(REPO_ROOT, "app"));

  /* รูปแบบที่เคยทำให้ 500: `(query.x ?? "").trim()` · `query.x.trim()` · `params.x.slice(…)` */
  const methodPattern =
    /(\(?\s*(?:query|params|searchParams)\s*[.?]\s*[A-Za-z0-9_]+[^)]*?(?:\?\?|\.)\s*""\s*\)|(?:query|params|searchParams)[.][A-Za-z0-9_]+)\.(trim|slice|split|toLowerCase|startsWith|padStart|includes)\(/;

  const offenders: string[] = [];
  for (const file of pages) {
    const source = stripComments(readFileSync(file, "utf8"));
    if (!source.includes("searchParams")) continue;
    if (methodPattern.test(source)) offenders.push(path.relative(REPO_ROOT, file).split(path.sep).join("/"));
  }

  assert.deepEqual(offenders, [], "หน้าต่อไปนี้ยังอ่านค่าจาก URL แบบดิบ (ต้องใช้ searchParamText): ");
  assert.ok(pages.length > 20, "ต้องสแกนเจอหน้าจริง (กันเทสต์หลอกที่เดินไม่เจอไฟล์)");
});

test("ด่านสแกนซอร์ส: ตัวช่วยกลางถูกใช้จริงในเส้นที่เคยพัง + ชั้นข้อมูลกรองซ้ำ", () => {
  const read = (relative: string): string => stripComments(readFileSync(path.join(REPO_ROOT, relative), "utf8"));

  for (const file of [
    "app/admin/products/page.tsx",
    "app/admin/news/page.tsx",
    "app/admin/recipes/page.tsx",
    "app/admin/careers/page.tsx",
    "app/admin/media/page.tsx",
    "app/admin/inbox/page.tsx",
    "app/admin/hero/page.tsx",
    "app/[lang]/preview/[page]/page.tsx",
    "lib/chrome/workspace-url.ts",
  ]) {
    assert.ok(read(file).includes("searchParamText("), `${file}: ต้องใช้ searchParamText()`);
  }

  /* หน้าส่วนกลางอ่านค่าผ่าน `chromeTabOf()` (ตรรกะกลางที่ใช้ตัวช่วยเดียวกัน) — ห้ามอ่านเอง */
  const chromePage = read("app/admin/builder/chrome/page.tsx");
  assert.ok(
    chromePage.includes("chromeTabOf(query)") && chromePage.includes("searchParamText") === false,
    "หน้าส่วนกลางต้องอ่านค่าผ่าน chromeTabOf() ไม่ใช่แยกอ่านเอง",
  );

  for (const file of [
    "lib/media/repository.ts",
    "lib/products/repository.ts",
    "lib/news/repository.ts",
    "lib/recipes/repository.ts",
  ]) {
    assert.ok(
      read(file).includes("normalizeSearchText("),
      `${file}: ชั้นข้อมูลต้องกรองคำค้นด้วย normalizeSearchText() (ประตูที่สอง)`,
    );
  }
});

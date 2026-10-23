import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { refreshPlan } from "@/lib/cache/plan";
import { FOOTER_PAGE_KEY } from "@/lib/chrome/footer";
import { NAVBAR_PAGE_KEY } from "@/lib/chrome/navbar";
import { MOURNING_PAGE_KEY } from "@/lib/mourning/config";

/**
 * เทสต์ "กดเผยแพร่ส่วนกลางแล้วหน้าเว็บต้องสดใหม่" (รอบที่ 315)
 *
 * 🐞 เคสจริงจากเจ้าของ (บน Vercel): *"การปรับขนาด logo navbar เหมือนจะส่งไปไม่ถึงหน้าบ้าน
 *    เปลี่ยนโลโก้ได้แต่ปรับขนาดไม่เป็นผล"*
 *
 * ต้นเหตุ: `publishNavbarAction` บันทึก + เผยแพร่ลงฐานข้อมูลครบ **แต่ไม่ได้สั่ง `refreshPublicSite`**
 * ต่างจากท้ายเว็บ/ป้ายประกาศ ⇒ หน้าเว็บสาธารณะยังเสิร์ฟ layout เดิมจาก ISR cache (`revalidate = 300`)
 * ⇒ ผู้ใช้เห็น "ค่าไม่ถึงหน้าบ้าน" ทั้งที่ค่าใน DB ถูกต้องแล้ว (ตรวจยืนยันจาก revision ในฐานข้อมูลจริง)
 *
 * เทสต์ชุดนี้ล็อกไว้ 3 อย่าง:
 *  1. ทุก action ที่ **เผยแพร่** ของส่วนกลาง ต้องเรียก `refreshPublicSite(...)` (กันลืมในอนาคต)
 *  2. ปุ่ม "ใช้กับเว็บจริงเลย" ต้องครอบทั้ง 3 ส่วน (แถบเมนู · ป้ายประกาศ · ท้ายเว็บ)
 *  3. `refreshPlan("chrome")` ต้อง revalidate ทั้ง layout (หัวเว็บ/ท้ายเว็บอยู่ทุกหน้า)
 */

const ROOT = process.cwd();

/** อ่านไฟล์ซอร์ส + normalize CRLF→LF (repo มีทั้งสองแบบ) */
function sourceOf(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8").replace(/\r\n/g, "\n");
}

/**
 * ตัดเฉพาะเนื้อฟังก์ชันระดับบนสุด
 * ⚠️ ห้ามตัดที่ "\n}" แรก — พารามิเตอร์แบบ object type มี `}` ที่คอลัมน์ 0 (บทเรียนรอบที่ 169)
 * ⇒ ตัดที่ `export ` ตัวถัดไปแทน
 */
function topLevelFunction(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `ไม่พบฟังก์ชัน ${name} ในไฟล์`);
  const rest = source.slice(start);
  const next = rest.indexOf("\nexport ", 1);
  return next === -1 ? rest : rest.slice(0, next);
}

/* ── 1) ทุก publish action ของส่วนกลางต้องสั่งให้หน้าเว็บสดใหม่ ────────────── */

const PUBLISH_ACTIONS: readonly { readonly file: string; readonly fn: string }[] = [
  { file: "app/admin/builder/navbar/actions.ts", fn: "publishNavbarAction" },
  { file: "app/admin/builder/footer/actions.ts", fn: "publishFooterAction" },
  { file: "app/admin/builder/chrome/actions.ts", fn: "publishChromeAction" },
  { file: "app/admin/builder/mourning/actions.ts", fn: "publishMourningAction" },
  { file: "app/admin/builder/mourning/actions.ts", fn: "publishNoticeAction" },
];

for (const entry of PUBLISH_ACTIONS) {
  test(`${entry.fn}: เผยแพร่แล้วต้องสั่ง refreshPublicSite (ไม่งั้นหน้าเว็บค้างที่ ISR cache)`, () => {
    const body = topLevelFunction(sourceOf(entry.file), entry.fn);
    assert.ok(
      body.includes("refreshPublicSite("),
      `${entry.fn} ต้องเรียก refreshPublicSite() หลังเผยแพร่ — ไม่งั้นหน้าเว็บจะแสดงค่าเดิมนานถึง 5 นาที`,
    );
  });
}

/* ── 2) ตัวแก้แถบเมนูอยู่ในแท็บ "ส่วนกลางของเว็บ" ⇒ ต้อง revalidate หน้าจอนั้น ── */

test("navbar: บันทึกฉบับร่าง/เผยแพร่ ต้อง revalidate หน้าจอ /admin/builder/chrome", () => {
  const source = sourceOf("app/admin/builder/navbar/actions.ts");

  assert.ok(
    source.includes('const CHROME_PATH = "/admin/builder/chrome"'),
    "ต้องประกาศพาธหน้าจอที่ตัวแก้ถูกเรนเดอร์จริง",
  );

  for (const fn of ["saveNavbarDraftAction", "publishNavbarAction"]) {
    const body = topLevelFunction(source, fn);
    assert.ok(body.includes("revalidatePath(CHROME_PATH)"), `${fn} ต้อง revalidate หน้าจอส่วนกลาง`);
  }
});

/* ── 3) ปุ่ม "ใช้กับเว็บจริงเลย" ต้องครอบทุกส่วนของส่วนกลาง ──────────────────── */

test("publishChromeAction: ต้องเผยแพร่ครบทั้งแถบเมนู · ป้ายประกาศ · ท้ายเว็บ", () => {
  const source = sourceOf("app/admin/builder/chrome/actions.ts");
  const body = topLevelFunction(source, "publishChromeAction");

  /* ค่าจริงของคีย์มาจากแหล่งความจริงเดียว (ไม่พิมพ์สตริงซ้ำในเทสต์) */
  assert.equal(NAVBAR_PAGE_KEY, "chrome-navbar");
  assert.equal(MOURNING_PAGE_KEY, "mourning");
  assert.equal(FOOTER_PAGE_KEY, "chrome-footer");

  /*
    อ่านเฉพาะ "บรรทัดที่ประกาศ" — ห้ามหา `]` ตัวแรกจากทั้งไฟล์
    (type annotation `readonly string[]` มี `]` อยู่ก่อนรายการจริง)
  */
  const keysLine = source.split("\n").find((line) => line.includes("const CHROME_KEYS"));
  assert.ok(keysLine !== undefined, "ไม่พบการประกาศ CHROME_KEYS");

  for (const constant of ["NAVBAR_PAGE_KEY", "MOURNING_PAGE_KEY", "FOOTER_PAGE_KEY"]) {
    assert.ok(keysLine.includes(constant), `CHROME_KEYS ต้องมี ${constant} (ไม่งั้นส่วนนั้นไม่ขึ้นเว็บ)`);
  }

  assert.ok(body.includes("refreshPublicSite("), "ปุ่มใช้กับเว็บจริงเลยต้องทำให้หน้าเว็บสดใหม่");
});

/* ── 4) เหตุผลที่ต้อง refresh: แผนของ "chrome" = สร้างใหม่ทั้ง layout ──────── */

test('refreshPlan("chrome") ต้อง revalidate ทั้ง layout (หัวเว็บ/ท้ายเว็บอยู่ทุกหน้า)', () => {
  const plan = refreshPlan("chrome");
  assert.equal(plan.revalidateAll, true);
  assert.ok(plan.paths.includes("/th") && plan.paths.includes("/en"));
});

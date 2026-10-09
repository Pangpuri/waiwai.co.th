import assert from "node:assert/strict";
import { test } from "node:test";

import { heroTextsDraftOf, heroTextsFieldsOf, heroTextFieldCodesOf, parseHeroTextsInput } from "@/lib/content/home-hero";
import { ownerOfSection } from "@/lib/content/home-section-owners";
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { th } from "@/lib/i18n/messages/th";

import { codeOf, rawOf } from "./source-scan.ts";

/**
 * เทสต์รอบที่ 251 — รวม "ส่วน hero" ไว้ที่หน้าจอเดียว (สไลด์ แคมเปญ ข้อความหัวเว็บไซต์)
 *
 * ## มติเจ้าของ 2026-10-09
 * *"รวมทุกอย่างของ hero ไว้ที่ 'สไลด์ & แคมเปญ' + เปลี่ยนชื่อเมนูเป็น 'สไลด์ แคมเปญ ข้อความหัวเว็บไซต์'"*
 *
 * ## สัญญาที่ล็อก
 * 1. ฟอร์มข้อความอยู่หน้าจอสไลด์ · เก็บที่เดิม (EAV) · บันทึกผ่าน action ที่ตรวจสิทธิ์ + fail-closed
 * 2. หน้าจอ "เนื้อหาแบบฟิลด์" **ไม่แสดงฟอร์ม hero** แต่ค่ายังอยู่ใน draft (กดบันทึกแล้วค่าไม่หาย)
 * 3. กลุ่มรายการ `slides` (ข้อมูลตาย) ถอดออกจากสเปกแล้ว — ไม่มีใครอ่าน EAV slides
 * 4. ข้อความผู้ใช้ทั้งหมดมาจากพจนานุกรม (ห้ามพิมพ์ไทยใน .tsx)
 */

function form(values: Readonly<Record<string, string>>): { get(key: string): unknown } {
  return { get: (key) => values[key] };
}

const base = {
  eyebrowTh: "โรงงานผลิตภัณฑ์อาหารไทย",
  eyebrowEn: "",
  titleTh: "ความอร่อยที่คนไทยไว้วางใจ",
  titleEn: "",
  titleAccentTh: "ในทุกมื้อของวัน",
  titleAccentEn: "",
  bodyTh: "ไวไวตั้งใจทำบะหมี่กึ่งสำเร็จรูป",
  bodyEn: "",
  noteTh: "",
  noteEn: "",
  ctaLabelTh: "ดูผลิตภัณฑ์ทั้งหมด",
  ctaLabelEn: "",
  ctaHref: "/products",
};

test("hero texts: อ่านค่าฟอร์ม + ตัดความยาว + บังคับไทย · อังกฤษเว้นว่างได้", () => {
  const parsed = parseHeroTextsInput(form(base));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.eyebrowTh, "โรงงานผลิตภัณฑ์อาหารไทย");
  assert.equal(parsed.value.ctaHref, "/products");
  assert.equal(parsed.value.eyebrowEn, "", "อังกฤษว่างได้ (มติ D22)");

  /* ตัดช่องว่างหัวท้าย + จำกัดความยาวตามสเปก */
  const long = parseHeroTextsInput(form({ ...base, eyebrowTh: `  ${"ก".repeat(80)}  ` }));
  assert.equal(long.ok, true);
  if (long.ok) assert.equal(long.value.eyebrowTh.length, 40, "ความยาวต้องถูกตัดตามสเปก");
});

test("hero texts: ไทยบังคับในช่องแกน · ปลายทางต้องเป็นพาธหรือ http(s)", () => {
  for (const missing of ["eyebrowTh", "titleTh", "titleAccentTh", "bodyTh"] as const) {
    const parsed = parseHeroTextsInput(form({ ...base, [missing]: "" }));
    assert.equal(parsed.ok, false, `${missing} ว่างต้องไม่ผ่าน`);
    if (!parsed.ok) assert.deepEqual(parsed.problems, [missing]);
  }

  /* ปลายทาง: ว่างได้ (ถอยค่าเริ่มต้น) · /path ได้ · https ได้ · ค่าประหลาดไม่ผ่าน */
  assert.equal(parseHeroTextsInput(form({ ...base, ctaHref: "" })).ok, true, "ว่าง = ใช้ค่าเริ่มต้นในโค้ด");
  assert.equal(parseHeroTextsInput(form({ ...base, ctaHref: "https://waiwai.co.th" })).ok, true);
  assert.equal(parseHeroTextsInput(form({ ...base, ctaHref: "//evil.example" })).ok, false, "// นำหน้าไม่ใช่พาธในเว็บ");
  assert.equal(parseHeroTextsInput(form({ ...base, ctaHref: "javascript:alert(1)" })).ok, false);
  assert.equal(parseHeroTextsInput(form({ ...base, ctaHref: "/products all" })).ok, false, "พาธต้องไม่มีช่องว่าง");
});

test("hero texts: prefill มาจากค่าที่บันทึกจริง + แปลงเป็นฟิลด์ EAV ครบ", () => {
  const content = {
    page: "home",
    sections: { hero: { fields: { title: { th: "ไทย", en: "EN" }, ctaHref: { th: "/products", en: "" } }, items: {} } },
  };
  const draft = heroTextsDraftOf(content);
  assert.equal(draft.titleTh, "ไทย");
  assert.equal(draft.titleEn, "EN");
  assert.equal(draft.eyebrowTh, "", "ช่องที่ไม่ตั้ง = ว่าง (ให้ผู้ใช้เห็นว่ายังไม่ได้ตั้ง)");
  assert.equal(draft.ctaHref, "/products");

  const fields = heroTextsFieldsOf(draft);
  assert.deepEqual(Object.keys(fields).sort(), ["body", "ctaHref", "ctaLabel", "eyebrow", "note", "title", "titleAccent"]);
  assert.deepEqual(fields.ctaHref, { th: "/products", en: "" }, "ปลายทางไม่ผูกภาษา");

  /* ไม่มีข้อมูล = ว่างทั้งหมด (ไม่ทำให้หน้าจอพัง) */
  assert.equal(heroTextsDraftOf(null).titleTh, "");
});

test("hero texts: ตัวกรอง 'ช่องที่ต้องแก้' เชื่อค่าจาก URL ไม่ได้", () => {
  assert.deepEqual(heroTextFieldCodesOf("titleTh,bodyTh"), ["titleTh", "bodyTh"]);
  assert.deepEqual(heroTextFieldCodesOf("titleTh,<script>,bodyTh"), ["titleTh", "bodyTh"], "รหัสแปลกปลอมถูกทิ้ง");
  assert.deepEqual(heroTextFieldCodesOf(undefined), []);
  assert.deepEqual(heroTextFieldCodesOf(""), []);
});

test("hero texts: action อยู่หน้าจอสไลด์ · ตรวจสิทธิ์ · fail-closed · refresh + audit", () => {
  const action = codeOf("app/admin/hero/text-actions.ts");
  assert.ok(action.includes('requireAdminUser("content")'), "ต้องผ่านประตูสิทธิ์ content");
  assert.ok(action.includes("parseHeroTextsInput(formData)"), "ต้องตรวจด้วยตรรกะล้วน");
  assert.ok(action.includes("loaded.unknownKeys.length > 0"), "แถวที่โครงไม่รู้จัก = ไม่บันทึก (fail-closed)");
  assert.ok(action.includes('setSectionText(draft, "hero"'), "เขียนเฉพาะฟิลด์ของส่วน hero");
  assert.ok(action.includes("savePageContent(HOME_PAGE_SPEC"), "บันทึกผ่านทางเดิม (transaction เดียว)");
  assert.ok(action.includes('refreshPublicSite("page")'), "หน้าเว็บต้องอัปเดตทันที");
  assert.ok(action.includes('action: "hero-save"'), "มีร่องรอย audit");
  assert.ok(action.includes("hero-texts-save"), "detail บอกว่าเป็นงานข้อความ hero");
  /* ⚠️ ไฟล์ use server ห้าม export ตัวช่วยซิงก์ (Next ต้องให้ทุก export เป็น async) */
  const badExports = action.match(/^export (?!async function)[^\n]+/gm) ?? [];
  assert.deepEqual(badExports, [], "ไฟล์ use server ต้อง export เฉพาะ async function");
});

test("hero texts: หน้าจอสไลด์แสดงฟอร์ม · หน้าจอเนื้อหาไม่แสดง (แต่ค่าไม่หาย)", () => {
  const heroPage = codeOf("app/admin/hero/page.tsx");
  assert.ok(heroPage.includes("<HeroTextsForm"), "หน้าจอสไลด์ต้องมีฟอร์มข้อความ");
  assert.ok(heroPage.includes("heroTextsDraftOf(homeContent)"), "prefill จากค่าจริง");
  assert.ok(heroPage.includes("heroTextFieldCodesOf(problemFieldsRaw)"), "แสดงช่องที่ต้องแก้จาก ?fields=");

  const owner = ownerOfSection("hero");
  assert.notEqual(owner, null);
  assert.equal(owner?.screen, "/admin/hero", "เจ้าของส่วน hero = หน้าจอสไลด์");
  assert.equal(owner?.hideForm, true, "หน้าจอเนื้อหาต้องไม่แสดงฟอร์มของส่วนนี้");

  const editor = codeOf("features/admin/ui/home-editor.tsx");
  assert.ok(editor.includes("ownerOfSection(section.key)?.hideForm === true"), "กรองส่วนที่ซ่อนฟอร์มออก");
  assert.ok(editor.includes("data-moved-section={section.key}"), "ต้องบอกทางไปแก้");
  assert.ok(editor.includes("ownerOfSection(section.key)?.hideForm !== true"), "ส่วนที่เหลือยังแสดงตามเดิม");

  /* ฟอร์มต้องเป็น Server Action ล้วน + ป้ายจากพจนานุกรม + มีช่องครบ */
  const heroForm = codeOf("features/admin/ui/hero-texts-form.tsx");
  assert.ok(heroForm.includes("action={saveHeroTextsAction}"), "ใช้ Server Action");
  assert.equal(heroForm.includes('"use client"'), false, "ไม่ต้องมี JS ฝั่งจอ (ปิด JS ก็ใช้ได้)");
  for (const name of ["eyebrow", "title", "titleAccent", "body", "note", "ctaLabel"]) {
    assert.ok(heroForm.includes(`field="${name}"`), `ต้องมีแถว ${name}`);
  }
  assert.ok(heroForm.includes("data-texts-row={field}"), "แถวต้องมี marker");
  assert.ok(heroForm.includes("data-texts-field={pair.name}"), "ช่อง Th/En มาจากชื่อฐานเดียวกัน");
  assert.ok(heroForm.includes('data-texts-field="ctaHref"'), "ต้องมีช่องปลายทางปุ่ม");
  assert.ok(heroForm.includes("maxLength={40}") && heroForm.includes("maxLength={300}"), "มีเพดานความยาวตามสเปก");
});

test("hero texts: กลุ่ม slides (ข้อมูลตาย) ต้องไม่อยู่ในสเปก/seed และไม่มีใครอ่าน", () => {
  const hero = HOME_PAGE_SPEC.sections.find((section) => section.key === "hero");
  assert.ok(hero !== undefined);
  assert.deepEqual(hero?.items.map((group) => group.key), ["card"], "เหลือเฉพาะการ์ด PR (สไลด์มาจากตาราง hero_slide)");

  const seed = codeOf("lib/content/home-seed.ts");
  assert.equal(seed.includes("slides: heroSlides"), false, "seed ต้องไม่เขียนกลุ่ม slides อีก");
  assert.equal(/items\["slides"\]/.test(codeOf("app/[lang]/page.tsx")), false, "หน้าเว็บต้องไม่อ่าน slides จาก EAV");
});

test("hero texts: เปลี่ยนชื่อเมนูเป็น 'สไลด์ แคมเปญ ข้อความหัวเว็บไซต์' (ทั้งสองภาษา)", () => {
  assert.equal(th.admin.navHero, "สไลด์ แคมเปญ ข้อความหัวเว็บไซต์");
  const en = rawOf("lib/i18n/messages/areas/en/adminHero.ts");
  assert.ok(en.includes('navHero: "Slides, campaigns & header text"'), "อังกฤษต้องตรงกัน");
  /* ข้อความในฟอร์มต้องมาจากพจนานุกรม ไม่พิมพ์ไทยใน .tsx (ใช้ codeOf กลาง — ห้ามตัดคอมเมนต์เอง) */
  assert.equal(/[\u0E00-\u0E7F]/.test(codeOf("features/admin/ui/hero-texts-form.tsx")), false, "ห้ามมีข้อความไทยใน .tsx");
});

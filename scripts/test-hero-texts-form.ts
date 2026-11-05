import assert from "node:assert/strict";
import { test } from "node:test";

import {
  heroTextsDefaults,
  heroTextsDefaultsInput,
  heroTextsDraftOf,
  heroTextsFieldsOf,
  heroTextFieldCodesOf,
  parseHeroTextsInput,
} from "@/lib/content/home-hero";
import { ownerOfSection } from "@/lib/content/home-section-owners";
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { en } from "@/lib/i18n/messages/en";
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

test("hero texts: อ่านค่าฟอร์ม + ตัดความยาว · ทุกช่องเว้นว่างได้ (รอบ 331)", () => {
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

test("hero texts: 4 ช่องข้อความเว้นว่างได้ · ปลายทางต้องเป็นพาธหรือ http(s)", () => {
  /* รอบที่ 331 (คำสั่งเจ้าของ): ว่างได้ทุกช่อง — ว่าง = ซ่อนบนเว็บ (ไม่ใช่ error) */
  for (const blank of ["eyebrowTh", "titleTh", "titleAccentTh", "bodyTh", "ctaLabelTh"] as const) {
    const parsed = parseHeroTextsInput(form({ ...base, [blank]: "" }));
    assert.equal(parsed.ok, true, `${blank} ว่างต้องผ่าน`);
  }
  assert.equal(
    parseHeroTextsInput(form({ eyebrowTh: "", titleTh: "", titleAccentTh: "", bodyTh: "", ctaLabelTh: "" })).ok,
    true,
    "เว้นว่างครบทุกช่อง = ซ่อนทั้งบล็อก (ต้องบันทึกได้)",
  );

  /* ปลายทาง: ว่างได้ (ถอยค่าเริ่มต้น) · /path ได้ · https ได้ · ค่าประหลาดไม่ผ่าน */
  assert.equal(parseHeroTextsInput(form({ ...base, ctaHref: "" })).ok, true, "ว่าง = ใช้ค่าเริ่มต้นในโค้ด");
  assert.equal(parseHeroTextsInput(form({ ...base, ctaHref: "https://waiwai.co.th" })).ok, true);
  assert.equal(parseHeroTextsInput(form({ ...base, ctaHref: "//evil.example" })).ok, false, "// นำหน้าไม่ใช่พาธในเว็บ");
  assert.equal(parseHeroTextsInput(form({ ...base, ctaHref: "javascript:alert(1)" })).ok, false);
  assert.equal(parseHeroTextsInput(form({ ...base, ctaHref: "/products all" })).ok, false, "พาธต้องไม่มีช่องว่าง");
});

test("hero texts: prefill แสดงสิ่งที่เว็บใช้จริง · แถวที่ถูกล้างคงว่าง + แปลงเป็นฟิลด์ EAV ครบ", () => {
  const content = {
    page: "home",
    sections: { hero: { fields: { title: { th: "ไทย", en: "EN" }, ctaHref: { th: "/products", en: "" } }, items: {} } },
  };

  /* ค่าดิบ (ไม่ส่ง fallback) */
  const raw = heroTextsDraftOf(content);
  assert.equal(raw.titleTh, "ไทย");
  assert.equal(raw.titleEn, "EN");
  assert.equal(raw.eyebrowTh, "", "แถวที่ไม่มี = ว่างในค่าดิบ");
  assert.equal(raw.ctaHref, "/products");

  /* ค่าที่ฟอร์มใช้จริง: แถวที่ไม่มี = ค่าเริ่มต้น · แถวที่มีแต่ว่าง = ว่าง (ซ่อน) */
  const fallback = { eyebrow: "ค่าเริ่มต้น", title: "ค่าเริ่มต้น", titleAccent: "ค่าเริ่มต้น", body: "ค่าเริ่มต้น", note: "", ctaLabel: "ปุ่ม", ctaHref: "/products" };
  const formValues = heroTextsDraftOf(content, fallback);
  assert.equal(formValues.titleTh, "ไทย", "แถวที่มีค่าแล้วใช้ค่าจริง");
  assert.equal(formValues.eyebrowTh, "ค่าเริ่มต้น", "แถวที่ไม่มี = ค่าเริ่มต้น (ฟอร์มตรงกับเว็บ)");
  assert.equal(formValues.ctaLabelTh, "ปุ่ม");
  assert.equal(formValues.ctaHref, "/products");

  const cleared = heroTextsDraftOf(
    { page: "home", sections: { hero: { fields: { title: { th: "", en: "" } }, items: {} } } },
    fallback,
  );
  assert.equal(cleared.titleTh, "", "แถวที่มีอยู่แต่ถูกล้าง = ว่าง (ห้ามเติมค่าเริ่มต้นทับ)");

  const fields = heroTextsFieldsOf(raw);
  assert.deepEqual(Object.keys(fields).sort(), ["body", "ctaHref", "ctaLabel", "eyebrow", "note", "title", "titleAccent"]);
  assert.deepEqual(fields.ctaHref, { th: "/products", en: "" }, "ปลายทางไม่ผูกภาษา");

  /* ไม่มีข้อมูล = ค่าเริ่มต้น (ฟอร์มไม่พัง) */
  assert.equal(heroTextsDraftOf(null).titleTh, "");
  assert.equal(heroTextsDraftOf(null, fallback).titleTh, "ค่าเริ่มต้น");
});

test("hero texts: ปุ่มคืนค่าเริ่มต้นเติมค่า TH/EN จริง · ยังไม่บันทึกเอง", () => {
  const thDefaults = heroTextsDefaults(th);
  const enDefaults = heroTextsDefaults(en);
  const input = heroTextsDefaultsInput(th, en);

  assert.equal(input.eyebrowTh, thDefaults.eyebrow);
  assert.equal(input.eyebrowEn, enDefaults.eyebrow);
  assert.equal(input.titleTh, thDefaults.title);
  assert.equal(input.titleEn, enDefaults.title);
  assert.equal(input.titleAccentTh, thDefaults.titleAccent);
  assert.equal(input.titleAccentEn, enDefaults.titleAccent);
  assert.equal(input.bodyTh, thDefaults.body);
  assert.equal(input.bodyEn, enDefaults.body);
  assert.equal(input.noteTh, thDefaults.note);
  assert.equal(input.noteEn, enDefaults.note);
  assert.equal(input.ctaLabelTh, th.actions.viewProducts);
  assert.equal(input.ctaLabelEn, en.actions.viewProducts);
  assert.equal(input.ctaHref, "/products");

  /* ข้อความหลัก + ป้ายปุ่มต้องมีค่าให้เห็นจริง (note ไม่บังคับ — TH ว่างได้) */
  for (const key of [
    "eyebrowTh",
    "eyebrowEn",
    "titleTh",
    "titleEn",
    "titleAccentTh",
    "titleAccentEn",
    "bodyTh",
    "bodyEn",
    "ctaLabelTh",
    "ctaLabelEn",
    "ctaHref",
  ] as const) {
    assert.notEqual(input[key], "", `${key} ต้องมีค่าเริ่มต้นให้ผู้ใช้เห็น`);
  }

  const page = codeOf("app/admin/hero/page.tsx");
  assert.ok(page.includes('searchParamText(query.defaults) === "1"'), "อ่าน ?defaults=1 ผ่านตัวช่วยกลาง");
  assert.ok(
    page.includes('heroTextsDefaultsInput(messages, await getMessagesFor("en"))'),
    "ค่าเริ่มต้น TH/EN มาจากพจนานุกรมของแต่ละภาษา",
  );
  assert.ok(page.includes("showingDefaults={showDefaults}"), "ส่งโหมดค่าเริ่มต้นให้ฟอร์ม");

  const form = codeOf("features/admin/ui/hero-texts-form.tsx");
  assert.ok(form.includes('"/admin/hero?defaults=1#hero-texts"'), "มีลิงก์ไปโหมดค่าเริ่มต้น");
  assert.ok(form.includes('showingDefaults ? "/admin/hero#hero-texts"'), "มีลิงก์กลับไปค่าที่บันทึกไว้");
  assert.ok(form.includes("key={showingDefaults ?"), "remount ฟอร์มเมื่อสลับโหมด (defaultValue จะได้มีผล)");
  assert.ok(form.includes("strings.textsRestoreDefaults"), "ป้ายปุ่มจากพจนานุกรม");
  assert.ok(form.includes("strings.textsDefaultsNotice"), "ต้องบอกผู้ใช้ว่ายังไม่บันทึก");
  assert.ok(form.includes("action={saveHeroTextsAction}"), "การบันทึกยังเป็น action เดิม");
});

test("hero texts: ตัวกรอง 'ช่องที่ต้องแก้' เหลือเฉพาะปลายทาง + เชื่อค่าจาก URL ไม่ได้", () => {
  /* รอบ 331: ข้อความว่างผ่านได้แล้ว ⇒ มีเพียง ctaHref ที่เป็น error ได้ */
  assert.deepEqual(heroTextFieldCodesOf("ctaHref"), ["ctaHref"]);
  assert.deepEqual(heroTextFieldCodesOf("titleTh,<script>,ctaHref"), ["ctaHref"], "รหัสแปลกปลอม/รหัสเก่าถูกทิ้ง");
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
  assert.ok(heroPage.includes("heroTextsDraftOf(homeContent, heroTextsDefaults(messages))"), "prefill จากค่าจริง + ค่าเริ่มต้นเฉพาะแถวที่ยังไม่มี");
  assert.ok(heroPage.includes("heroTextFieldCodesOf(problemFieldsRaw)"), "แสดงช่องที่ต้องแก้จาก ?fields=");

  const owner = ownerOfSection("hero");
  assert.notEqual(owner, null);
  assert.equal(owner?.screen, "/admin/hero", "เจ้าของส่วน hero = หน้าจอสไลด์");
  assert.equal(owner?.hideForm, true, "หน้าจอเนื้อหาต้องไม่แสดงฟอร์มของส่วนนี้");

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
  /* รอบ 331: ต้องไม่มี `required` / ดาวบังคับกรอกเหลืออยู่ในฟอร์ม */
  assert.equal(heroForm.includes("required"), false, "ฟอร์มต้องไม่บังคับกรอกช่องใดอีก");
  assert.equal(heroForm.includes("*</span>"), false, "ต้องไม่เหลือดาวบังคับกรอก");
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

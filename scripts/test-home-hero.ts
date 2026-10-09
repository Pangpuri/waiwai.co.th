import assert from "node:assert/strict";
import { test } from "node:test";

import { heroTextsDefaults, heroTextsOf } from "@/lib/content/home-hero";
import type { PageContent } from "@/lib/content/types";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

import { codeOf } from "./source-scan.ts";

/**
 * เทสต์รอบที่ 250 — ข้อความ "แถบเปิดหน้าแรก (hero)" ต้องแก้จากหลังบ้านได้จริง
 *
 * ## เคสจริงจากเจ้าของ
 * *"ผมว่าเราขาดบล็อคนึงรึเปล่า บล็อคที่ต่อจากสไลด์ — โรงงานผลิตภัณฑ์อาหารไทย / ความอร่อยที่คนไทยไว้วางใจ
 * ในทุกมื้อของวัน / … / ดูผลิตภัณฑ์ทั้งหมด"*
 *
 * ## ต้นเหตุ
 * - hero **ไม่ใช่บล็อก** (มติรอบ 217 · เจ้าของเดียว = `/admin/hero`) ⇒ ในตัวสร้างไม่เห็นเป็นแถว (**ถูกต้องตามมติ**)
 * - แต่ข้อความชุดนี้ถูกอ่าน **จากพจนานุกรมเท่านั้น** ⇒ ช่องในหลังบ้าน (`/admin/content/home`) **ไม่มีผลกับหน้าเว็บ**
 *   (คลาสเดียวกับบั๊กการ์ดประกาศ รอบที่ 200) + ปุ่มหลักฮาร์ดโค้ด ⇒ "ช่องที่โกหก"
 *
 * ## สัญญาที่ล็อก
 * 1. ค่าที่ตั้งในหลังบ้าน **ทับ** พจนานุกรม · ไม่มีค่า/ว่าง = ถอยไปใช้ค่าเริ่มต้น (หน้าเว็บห้ามพัง ห้ามว่าง)
 * 2. EN ว่าง ⇒ ถอยไทย (ห้ามหน้าไทยแสดงข้อความอังกฤษ)
 * 3. หมายเหตุ (ป้าย "ภาพตัวอย่าง…") **ล้างแล้วต้องหายจริง** (ต่างจากช่องอื่นโดยเจตนา)
 * 4. ปุ่มหลัก (ป้าย + ปลายทาง) แก้ได้จากหลังบ้าน · ปลายทางเป็นพาธกลาง
 * 5. ตัวสร้างต้องแสดงแถว hero พร้อมลิงก์ไปแก้ทั้งสองทาง (กัน "หายไป 1 บล็อก" ในสายตาผู้ใช้)
 */

/* ใช้พจนานุกรมตรง ๆ (ไม่ผ่านตัวช่วยที่พึ่ง next/navigation — เทสต์รันด้วย `node --test`) */
const messages = th;
const messagesEn = en;

function contentWithHero(fields: Record<string, { th: string; en: string }>): PageContent {
  return { page: "home", sections: { hero: { fields, items: {} } } };
}

/* ── 1) ตรรกะเลือกค่า ─────────────────────────────────────────────────────── */

test("home-hero: ไม่มีค่าในหลังบ้าน = พจนานุกรมล้วน (พฤติกรรมเดิมเป๊ะ)", () => {
  const fallback = heroTextsDefaults(messages);
  assert.deepEqual(heroTextsOf(null, messages, "th"), fallback);
  assert.deepEqual(heroTextsOf({ page: "home", sections: {} }, messages, "th"), fallback);
  /* ค่าตั้งต้นต้องตรงกับพจนานุกรมจริง (กันตัวช่วยกับพจนานุกรมหลุดจากกัน) */
  assert.equal(fallback.eyebrow, messages.hero.eyebrow);
  assert.equal(fallback.title, messages.hero.title);
  assert.equal(fallback.titleAccent, messages.hero.titleAccent);
  assert.equal(fallback.body, messages.hero.body);
  assert.equal(fallback.note, messages.hero.note);
  assert.equal(fallback.ctaLabel, messages.actions.viewProducts);
  assert.equal(fallback.ctaHref, "/products");
});

test("home-hero: ค่าจากหลังบ้านทับพจนานุกรม (ค่าเคสจริงของเจ้าของ)", () => {
  const texts = heroTextsOf(
    contentWithHero({
      eyebrow: { th: "โรงงานผลิตภัณฑ์อาหารไทย", en: "A Thai food manufacturer" },
      title: { th: "ความอร่อยที่คนไทยไว้วางใจ", en: "The taste Thai kitchens trust" },
      titleAccent: { th: "ในทุกมื้อของวัน", en: "in every meal of the day" },
      body: { th: "ไวไวตั้งใจทำบะหมี่กึ่งสำเร็จรูปให้เป็นมื้อที่ง่าย", en: "Wai Wai makes instant noodles simple." },
      note: { th: "ภาพและข้อความในหน้านี้เป็นตัวอย่าง", en: "Sample content" },
      ctaLabel: { th: "ดูผลิตภัณฑ์ทั้งหมด", en: "Browse all products" },
      ctaHref: { th: "/products", en: "/products" },
    }),
    messages,
    "th",
  );
  assert.equal(texts.eyebrow, "โรงงานผลิตภัณฑ์อาหารไทย");
  assert.equal(texts.title, "ความอร่อยที่คนไทยไว้วางใจ");
  assert.equal(texts.titleAccent, "ในทุกมื้อของวัน");
  assert.equal(texts.body, "ไวไวตั้งใจทำบะหมี่กึ่งสำเร็จรูปให้เป็นมื้อที่ง่าย");
  assert.equal(texts.note, "ภาพและข้อความในหน้านี้เป็นตัวอย่าง");
  assert.equal(texts.ctaLabel, "ดูผลิตภัณฑ์ทั้งหมด");
  assert.equal(texts.ctaHref, "/products");
});

test("home-hero: ช่องว่าง = ถอยค่าเดิม · EN ว่าง = ถอยไทย (ห้ามหน้าอังกฤษว่าง/ไทยโชว์อังกฤษ)", () => {
  const fallback = heroTextsDefaults(messages);

  /* ช่องว่างล้วน ⇒ ค่าเดิม (หน้าเว็บห้ามว่าง) */
  const blank = heroTextsOf(contentWithHero({ eyebrow: { th: "  ", en: "" }, title: { th: "", en: "" } }), messages, "th");
  assert.equal(blank.eyebrow, fallback.eyebrow);
  assert.equal(blank.title, fallback.title);

  /* ขอ EN แต่ EN ว่าง ⇒ ใช้ไทย (ไม่ใช่ค่าว่าง) */
  const partial = heroTextsOf(contentWithHero({ body: { th: "ข้อความไทย", en: "" } }), messages, "en");
  assert.equal(partial.body, "ข้อความไทย");

  /* ขอ EN และมี EN ⇒ ใช้ EN */
  const both = heroTextsOf(contentWithHero({ body: { th: "ไทย", en: "English" } }), messages, "en");
  assert.equal(both.body, "English");
  /* ขอ TH ⇒ ไทยเสมอ แม้ EN มีค่า */
  assert.equal(heroTextsOf(contentWithHero({ body: { th: "ไทย", en: "English" } }), messages, "th").body, "ไทย");
  assert.equal(messagesEn.hero.title.trim() === "" ? true : both.body !== messagesEn.hero.title, true);
});

test("home-hero: หมายเหตุล้างแล้วต้องหายจริง (แต่ไม่เคยตั้ง = ค่าเริ่มต้น)", () => {
  /* ไม่มีแถว = ค่าเริ่มต้น */
  assert.equal(heroTextsOf(contentWithHero({}), messages, "th").note, messages.hero.note);

  /* มีแถวแต่ว่างทั้ง TH/EN = ผู้ใช้สั่งซ่อน */
  assert.equal(heroTextsOf(contentWithHero({ note: { th: "", en: "" } }), messages, "th").note, "");
  assert.equal(heroTextsOf(contentWithHero({ note: { th: "  ", en: "  " } }), messages, "en").note, "");

  /* ว่างเฉพาะภาษาที่ขอ ⇒ ถอยอีกภาษา (ไม่ใช่ซ่อน) */
  assert.equal(heroTextsOf(contentWithHero({ note: { th: "หมายเหตุไทย", en: "" } }), messages, "en").note, "หมายเหตุไทย");
});

/* ── 2) ต่อสายเข้าหน้าเว็บจริง ─────────────────────────────────────────────── */

test("home-hero: hero ต้องใช้ค่าที่ส่งมา และหน้าจอต้องส่งค่าจากหลังบ้าน", () => {
  const hero = codeOf("features/home/ui/hero.tsx");
  assert.ok(hero.includes("heroTexts ?? heroTextsDefaults(messages)"), "ไม่ส่งค่า = พจนานุกรม (พฤติกรรมเดิม)");
  for (const field of ["eyebrow", "title", "titleAccent", "body", "note", "ctaLabel", "ctaHref"]) {
    assert.ok(hero.includes(`texts.${field}`), `hero ต้องใช้ texts.${field}`);
  }
  /* ⚠️ ต้องไม่มีข้อความ hero ที่ยังอ่านจากพจนานุกรมตรง ๆ (นอกจากกลุ่มอื่น เช่น ปุ่มสไลด์/การ์ด) */
  assert.equal(hero.includes("{m.eyebrow}"), false, "ห้ามอ่าน eyebrow จากพจนานุกรมตรง ๆ อีก");
  assert.equal(hero.includes("{m.title}"), false, "ห้ามอ่าน title จากพจนานุกรมตรง ๆ อีก");
  assert.equal(hero.includes("{m.body}"), false, "ห้ามอ่าน body จากพจนานุกรมตรง ๆ อีก");
  /* ล้างหมายเหตุแล้วซ่อนป้าย */
  assert.ok(hero.includes('texts.note.trim() === "" ? null'), "หมายเหตุว่าง = ไม่แสดงป้าย");

  const page = codeOf("app/[lang]/page.tsx");
  assert.ok(page.includes("heroTextsOf(homeContent, messages, lang)"), "หน้าจอต้องรวมค่าจาก EAV");
  assert.equal((page.match(/texts=\{heroTexts\}/g) ?? []).length, 2, "ต้องส่งทั้งสองสาขา (โหมดบล็อก + เลย์เอาต์โค้ด)");
});

/* ── 3) หลังบ้านต้องมีช่องให้แก้ + ตัวสร้างต้องเห็นส่วนนี้ ─────────────────── */

test("home-hero: โมเดลเนื้อหามีช่องปุ่มหลัก + seed มีค่าให้ครบ TH/EN", () => {
  const model = codeOf("lib/content/model.ts");
  assert.ok(model.includes('sectionField("ctaLabel"'), "ต้องมีช่องป้ายปุ่มหลัก (แก้ได้)");
  assert.ok(model.includes('sectionUrl("ctaHref"'), "ต้องมีช่องปลายทางปุ่ม (ไม่ผูกภาษา)");
  const heroSpec = model.slice(model.indexOf("const HERO: SectionSpec"), model.indexOf("items: [", model.indexOf("const HERO: SectionSpec")));
  assert.ok(heroSpec.includes("required: false"), "ช่องใหม่ต้องไม่บังคับ (ข้อมูลเดิมต้องไม่กลายเป็นไม่ผ่าน)");

  const seed = codeOf("lib/content/home-seed.ts");
  assert.ok(seed.includes("ctaLabel: text(th.actions.viewProducts, en.actions.viewProducts)"), "seed ต้องมีป้ายปุ่ม");
  assert.ok(seed.includes("ctaHref: notLocalized(HERO_CTA_HREF)"), "seed ต้องมีปลายทางปุ่ม");
});

test("home-hero: ตัวสร้างต้องแสดงแถว hero พร้อมลิงก์ไปแก้ทั้งสองทาง", () => {
  const builder = codeOf("features/admin/ui/block-builder.tsx");
  assert.ok(builder.includes('data-hero-row=""'), "มีแถว hero ในตัวสร้าง");
  assert.ok(builder.includes('href="/admin/hero"'), "ลิงก์ไปหน้าจอสไลด์");
  assert.ok(builder.includes('href="/admin/content/home"'), "ลิงก์ไปหน้าจอข้อความ");
  assert.ok(builder.includes("strings.builderHeroRowTitle"), "ข้อความจากพจนานุกรม (ห้ามพิมพ์ไทยใน .tsx)");
  assert.ok(builder.includes("strings.builderHeroRowHint"), "ต้องอธิบายว่าทำไมไม่ใช่บล็อก");
  /* แถวนี้ต้องไม่ลาก/ไม่เลือกได้ (ไม่ใช่บล็อกจริง) */
  assert.equal(builder.slice(builder.indexOf('data-hero-row=""'), builder.indexOf('data-hero-row=""') + 900).includes("draggable"), false, "แถว hero ต้องไม่ถูกลาก");
});

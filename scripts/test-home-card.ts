import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { HERO_CARD_HREF, HERO_CARD_IMAGE } from "@/features/home/hero-card";
import { heroCardContentOf, heroCardDefaults, heroCardDraftOf, parseHeroCardInput } from "@/lib/content/home-card";
import type { PageContent } from "@/lib/content/types";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

/**
 * เทสต์ "การ์ดประกาศที่ขยับ" บนหน้าแรก (รอบที่ 200)
 *
 * ที่มา (คำเจ้าของ): *"เราเพียงแค่ต้องการแก้ไขเทมเพลตการ์ดที่มันแสดงอยู่ใน hardcode ตอนนี้ ที่เป็นการ์ดขยับ"*
 * ปัญหาเดิม: ข้อความการ์ดมาจาก **พจนานุกรมอย่างเดียว** ⇒ ช่องในหลังบ้าน (`/admin/content/home`)
 * มีอยู่จริงแต่ **ไม่มีผลกับหน้าเว็บ** (จอโกหกแบบเดียวกับบั๊กรอบ 199)
 *
 * เทสต์นี้รันได้โดยไม่ต้องมี DB (ตรรกะล้วน + สแกนซอร์ส)
 */
/**
 * ความลึกสูงสุดของฟอร์มที่ซ้อนกัน (1 = ไม่ซ้อน)
 * ⚠️ สแกนด้วย "สตริงล้วน" ไม่ใช้ regex — บทเรียนรอบ 203: regex ที่เขียนผ่านสคริปต์หลายชั้น
 * ทำให้ escaping เพี้ยน (``, `\/`) แล้วเทสต์ให้ผลผิดโดยไม่มีใครรู้
 */
function maxFormDepth(source: string): number {
  const open = "<form";
  const close = "</form>";
  let depth = 0;
  let max = 0;
  let cursor = 0;
  while (cursor < source.length) {
    const nextOpen = source.indexOf(open, cursor);
    const nextClose = source.indexOf(close, cursor);
    if (nextOpen < 0 && nextClose < 0) break;
    if (nextOpen >= 0 && (nextClose < 0 || nextOpen < nextClose)) {
      depth += 1;
      max = Math.max(max, depth);
      cursor = nextOpen + open.length;
    } else {
      depth = Math.max(0, depth - 1);
      cursor = nextClose + close.length;
    }
  }
  return max;
}

function contentWithCard(overrides: {
  readonly title?: { th: string; en: string };
  readonly media?: { path: string; altTh: string; altEn: string };
  readonly fields?: Record<string, { th: string; en: string }>;
}): PageContent {
  return {
    page: "home",
    sections: {
      hero: {
        fields: {},
        items: {
          card: [
            {
              order: 1,
              fields: {
                title: { th: "", en: "" },
                body: { th: "", en: "" },
                linkLabel: { th: "", en: "" },
                href: { th: "", en: "" },
                ...overrides.fields,
                ...(overrides.title === undefined ? {} : { title: overrides.title }),
              },
              media:
                overrides.media === undefined
                  ? {}
                  : { image: { ...overrides.media, hasWatermark: false } },
            },
          ],
        },
      },
    },
  };
}

test("★ home card: ค่าเริ่มต้น = พฤติกรรมเดิมเป๊ะ (พจนานุกรม + ค่าคงที่ในโค้ด)", () => {
  const defaults = heroCardDefaults(th);
  assert.equal(defaults.title, th.hero.card.title);
  assert.equal(defaults.body, th.hero.card.body);
  assert.equal(defaults.linkLabel, th.hero.card.link);
  assert.equal(defaults.href, HERO_CARD_HREF, "ปลายทางเริ่มต้นยังเป็นค่าคงที่เดิม");
  assert.equal(defaults.image.src, HERO_CARD_IMAGE.src, "ภาพเริ่มต้นยังเป็นไฟล์เดิม");
  assert.equal(defaults.image.alt, th.hero.card.alt);

  /* ไม่มี DB/ยังไม่มีแถว = ค่าเริ่มต้น (หน้าเว็บไม่พัง) */
  assert.deepEqual(heroCardContentOf(null, th, "th"), defaults);
  assert.deepEqual(heroCardContentOf({ page: "home", sections: {} }, th, "th"), defaults);
});

test("★ home card: ค่าที่ตั้งในหลังบ้านทับพจนานุกรม · ช่องว่างถอยค่าเดิม · แยกภาษา", () => {
  const content = contentWithCard({
    title: { th: "หัวข้อใหม่", en: "New title" },
    fields: {
      body: { th: "", en: "" },
      linkLabel: { th: "ไปดูเลย", en: "" },
      href: { th: "/products", en: "" },
    },
    media: { path: "/media/abc123", altTh: "คำอธิบายไทย", altEn: "English alt" },
  });

  const thai = heroCardContentOf(content, th, "th");
  assert.equal(thai.title, "หัวข้อใหม่");
  assert.equal(thai.body, th.hero.card.body, "ช่องที่เว้นว่าง = ใช้ค่าเดิม (ห้ามขึ้นช่องว่าง)");
  assert.equal(thai.linkLabel, "ไปดูเลย");
  assert.equal(thai.href, "/products", "ลิงก์ที่ตั้งในหลังบ้านต้องมีผล");
  assert.equal(thai.image.src, "/media/abc123", "ภาพที่ตั้งในหลังบ้านต้องมีผล");
  assert.equal(thai.image.alt, "คำอธิบายไทย");

  const eng = heroCardContentOf(content, en, "en");
  assert.equal(eng.title, "New title");
  assert.equal(eng.body, en.hero.card.body, "EN ว่าง = ถอยไปใช้ค่า EN ของพจนานุกรม");
  /* กติกาภาษาของโปรเจกต์: EN ว่าง ⇒ ถอยไปใช้ **ค่าไทยที่ตั้งไว้** (ไม่ใช่ค่า EN ของพจนานุกรม) */
  assert.equal(eng.linkLabel, "ไปดูเลย", "ป้ายลิงก์ EN ว่าง = ถอยไปใช้ค่าไทย");
  assert.equal(eng.image.alt, "English alt");
  /* ⚠️ บั๊กที่จับได้ระหว่างทำรอบ 200: เคยลืมเช็คภาษา ⇒ หน้าไทยโชว์ข้อความอังกฤษ */
  assert.equal(heroCardContentOf(contentWithCard({ title: { th: "ไทย", en: "English" } }), th, "th").title, "ไทย");
  /* ไม่ตั้งภาพในหลังบ้าน = ใช้ภาพ/คำอธิบายเดิมในโค้ด */
  assert.equal(heroCardContentOf(contentWithCard({}), th, "th").image.src, HERO_CARD_IMAGE.src);
});

test("★ home card: หน้าเว็บอ่านค่าจากหลังบ้าน + มีทางไปแก้ที่ช่องนั้น (ไม่ต้องเพิ่มแคมเปญ)", () => {
  const hero = readFileSync("features/home/ui/hero.tsx", "utf8");
  assert.ok(hero.includes("const card = heroCard ?? heroCardDefaults(messages)"), "ไม่มีค่าจากหลังบ้าน = ค่าเริ่มต้น");
  assert.ok(hero.includes("title: card.title") && hero.includes("body: card.body"), "การ์ดใช้ค่าที่ส่งเข้ามา");
  assert.ok(hero.includes("href={localePath(locale, card.href)}"), "ลิงก์การ์ดมาจากค่าที่ตั้งไว้");
  assert.ok(!hero.includes("title: m.card.title"), "ห้ามอ่านหัวข้อจากพจนานุกรมตรง ๆ อีก (นี่คือต้นเหตุ hardcode)");

  const page = readFileSync("app/[lang]/page.tsx", "utf8");
  assert.ok(
    page.includes("heroCard={heroCardContentOf(await loadHomeContentSafely(), messages, lang)}"),
    "หน้าแรกต้องส่งเนื้อหาการ์ดจากที่เก็บจริงเข้า Hero",
  );

  const cardUi = readFileSync("features/home/ui/hero-card.tsx", "utf8");
  assert.ok(cardUi.includes("image = { src: HERO_CARD_IMAGE.src"), "ค่าเริ่มต้นของภาพยังเป็นค่าคงที่เดิม");
  assert.ok(!cardUi.includes("src={HERO_CARD_IMAGE.src}"), "ภาพต้องมาจาก props (แก้จากหลังบ้านได้)");

  /*
    ทางไปแก้ (รอบ 200 → 203): เดิมเป็นแผงบอกทางไปหน้าจอ "เนื้อหาแบบมีโครง"
    รอบ 203 เจ้าของสั่งให้ **ย้ายมาเป็นส่วนของตัวเองในหน้าแคมเปญ** ⇒ ตรวจว่ามีตัวแก้จริงที่นั่น (ดูเทสต์รอบ 203)
  */
  const adminHero = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(adminHero.includes("HeroPrCardEditor"), "หน้าแคมเปญต้องมีตัวแก้การ์ด PR ของตัวเอง");
  assert.ok(adminHero.includes("s.wiggleCardHint"), "ต้องบอกว่าการ์ดนี้ไม่ใช่แคมเปญ");

  for (const locale of ["th", "en"]) {
    const area = readFileSync(`lib/i18n/messages/areas/${locale}/adminHero.ts`, "utf8");
    for (const key of ["wiggleCardTitle", "wiggleCardHint", "wiggleCardEdit"]) {
      assert.ok(area.includes(`${key}:`), `${locale} ต้องมีคีย์ ${key}`);
    }
  }
});

/**
 * ★ รอบที่ 203 — การ์ด PR แคมเปญต้องแก้ได้ **จากหน้าแคมเปญ** (ไม่ต้องเด้งไปหน้าเนื้อหารวม)
 * คำเจ้าของ: *"ย้ายมันไปไว้ส่วนแคมเปญ สามารถอัปโหลดรูปได้ เปลี่ยนข้อความสั้น ๆ ได้ เอามาเป็นส่วนของตัวเอง"*
 */
test("★ home card: ตรวจค่าฟอร์มการ์ด (ตรรกะล้วน) — หัวข้อ/ข้อความต้องมี · มีภาพต้องมีคำอธิบาย · ลิงก์ต้องถูก", () => {
  const form = (values: Record<string, string>) => ({ get: (key: string) => values[key] ?? null });
  const base = { titleTh: "แคมเปญจากไวไว", bodyTh: "รวมแคมเปญและข่าวสารล่าสุด", href: "", imagePath: "", imageAltTh: "" };

  /* happy path: เว้นลิงก์ว่าง = ไปหน้าข่าวสาร (ค่าเริ่มต้นเดิม) */
  const ok = parseHeroCardInput(form(base));
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.href, HERO_CARD_HREF);
    assert.equal(ok.value.titleEn, "", "อังกฤษว่างได้ (ถอยไปใช้ไทย)");
  }

  /* ต้องมีหัวข้อไทย + ข้อความไทย (การ์ดเปล่าไม่ควรขึ้นเว็บ) */
  const noTitle = parseHeroCardInput(form({ ...base, titleTh: "   " }));
  assert.equal(noTitle.ok, false);
  if (!noTitle.ok) assert.deepEqual([...noTitle.problems], ["titleTh"]);
  const noBody = parseHeroCardInput(form({ ...base, bodyTh: "" }));
  assert.equal(noBody.ok, false);
  if (!noBody.ok) assert.deepEqual([...noBody.problems], ["bodyTh"]);

  /* มีภาพ = ต้องมีคำอธิบายภาพ (a11y) · พาธเต็ม URL ใช้ไม่ได้ (มติ D9) */
  const imgNoAlt = parseHeroCardInput(form({ ...base, imagePath: "/media/abc" }));
  assert.equal(imgNoAlt.ok, false);
  if (!imgNoAlt.ok) assert.deepEqual([...imgNoAlt.problems], ["imageAltTh"]);
  const badPath = parseHeroCardInput(form({ ...base, imagePath: "https://cdn.example.com/x.jpg", imageAltTh: "ภาพ" }));
  assert.equal(badPath.ok, false);
  if (!badPath.ok) assert.deepEqual([...badPath.problems], ["imagePath"]);
  const badHref = parseHeroCardInput(form({ ...base, href: "javascript:alert(1)" }));
  assert.equal(badHref.ok, false);
  if (!badHref.ok) assert.deepEqual([...badHref.problems], ["href"]);
  const external = parseHeroCardInput(form({ ...base, href: "https://example.com/promo" }));
  assert.equal(external.ok, true, "ลิงก์ภายนอก http(s) ใช้ได้");
  const tooLong = parseHeroCardInput(form({ ...base, titleTh: "ก".repeat(120) }));
  assert.equal(tooLong.ok, true);
  if (tooLong.ok) assert.equal(tooLong.value.titleTh.length, 80, "ตัดที่เพดานความยาว");

  /* ค่าตั้งต้นของฟอร์ม = ค่าที่บันทึกจริง (ว่าง = ว่าง ไม่ยัดค่าพจนานุกรมทับ) */
  const draft = heroCardDraftOf(null);
  assert.equal(draft.titleTh, "");
  assert.equal(draft.href, HERO_CARD_HREF, "ยังไม่มีค่า = ชี้หน้าข่าวสาร (ค่าเริ่มต้นเดิม)");
  assert.equal(heroCardDraftOf(contentWithCard({ title: { th: "เก็บไว้", en: "Stored" } })).titleEn, "Stored");
});

test("★ home card: จอแคมเปญมีตัวแก้ของการ์ดนี้เอง (ฟอร์มเดียว + อัปโหลดภาพ) — รอบที่ 203", () => {
  const page = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(page.includes("<HeroPrCardEditor card={prCardDraft} strings={s} />"), "หน้าแคมเปญต้องมีตัวแก้การ์ด PR");
  assert.ok(page.includes("heroCardDraftOf(homeContent)"), "ค่าตั้งต้นต้องมาจากค่าที่บันทึกจริง");
  assert.ok(!page.includes('href="/admin/content/home#item-hero-card"'), "ไม่ต้องพาไปหน้าเนื้อหารวมอีก");
  assert.ok(page.includes('"card-saved": s.feedbackCardSaved'), "ต้องมีข้อความยืนยันผลการบันทึก");

  const editor = readFileSync("features/admin/ui/hero-pr-card-editor.tsx", "utf8");
  assert.ok(editor.includes("saveHeroCardAction"), "ฟอร์มต้องเรียก action ที่บันทึกการ์ด");
  assert.ok(editor.includes("<ImageDrop"), "ต้องอัปโหลด/เลือกภาพได้จากที่นี่");
  for (const name of ["titleTh", "bodyTh", "linkLabelTh", "href", "imagePath", "imageAltTh"]) {
    assert.ok(editor.includes(`name="${name}"`), `ฟอร์มต้องมีช่อง ${name}`);
  }
  /*
    ⚠️ ต้องนับ "ความลึก" ของฟอร์ม ไม่ใช่จำนวน (บทเรียนจริงรอบ 203):
    เทสต์รอบแรกนับ `<form` เจอ 2 เพราะ **คอมเมนต์** มีคำว่า `<form>` · พอแก้เป็นนับจริงกลับเจอ
    **ฟอร์มซ้อนฟอร์มจริง** (ImageDrop มี `<form>` ของตัวเองอยู่ข้างใน) ซึ่ง React ฟ้อง hydration error
    และเบราว์เซอร์ตัดฟอร์มชั้นในทิ้ง ⇒ ปุ่มอัปโหลดพัง
  */
  assert.equal(maxFormDepth(editor), 1, "ห้ามมีฟอร์มซ้อนฟอร์ม (ImageDrop ต้องอยู่นอกฟอร์มบันทึก)");
  assert.ok(
    editor.indexOf("<ImageDrop") > editor.indexOf("</form>"),
    "ImageDrop (มีฟอร์มอัปโหลดของตัวเอง) ต้องถูกวาง **หลัง** ปิดฟอร์มบันทึก",
  );

  const action = readFileSync("app/admin/hero/pr-card-actions.ts", "utf8");
  assert.ok(action.includes("parseHeroCardInput(formData)"), "ต้องตรวจค่าด้วยตรรกะล้วน");
  assert.ok(action.includes("savePageContent(HOME_PAGE_SPEC"), "บันทึกผ่านเส้นทางเดิมของหน้าเว็บ");
  assert.ok(action.includes("loaded.unknownKeys.length > 0"), "fail-closed เมื่อโครงเนื้อหาไม่ตรง (ไม่ทับข้อมูลส่วนอื่น)");
  for (const code of ["hero-card-save", 'refreshPublicSite("page")', 'saved=card-saved']) {
    assert.ok(action.includes(code), `action ต้องมี: ${code}`);
  }
});

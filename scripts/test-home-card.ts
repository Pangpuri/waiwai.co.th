import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { HERO_CARD_HREF, HERO_CARD_IMAGE } from "@/features/home/hero-card";
import { heroCardContentOf, heroCardDefaults } from "@/lib/content/home-card";
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

  /* ทางไปแก้: แผงใน /admin/hero → ตัวแก้เนื้อหาที่ช่องการ์ด */
  const adminHero = readFileSync("app/admin/hero/page.tsx", "utf8");
  assert.ok(adminHero.includes('href="/admin/content/home#item-hero-card"'), "ต้องมีปุ่มพาไปแก้การ์ดนี้");
  assert.ok(adminHero.includes("s.wiggleCardHint"), "ต้องบอกว่าการ์ดนี้ไม่ใช่แคมเปญ");
  const editor = readFileSync("features/admin/ui/home-editor.tsx", "utf8");
  assert.ok(editor.includes("id={`item-${sectionKey}-${group.key}`}"), "ตัวแก้เนื้อหาต้องมีปลายทางให้ลิงก์กระโดดถึง");

  for (const locale of ["th", "en"]) {
    const area = readFileSync(`lib/i18n/messages/areas/${locale}/adminHero.ts`, "utf8");
    for (const key of ["wiggleCardTitle", "wiggleCardHint", "wiggleCardEdit"]) {
      assert.ok(area.includes(`${key}:`), `${locale} ต้องมีคีย์ ${key}`);
    }
  }
});

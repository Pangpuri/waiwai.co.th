import { HERO_CARD_HREF, HERO_CARD_IMAGE } from "@/features/home/hero-card";
import type { PageContent } from "@/lib/content/types";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * เนื้อหาของ "การ์ดประกาศ" ที่ **ยิกเรียกความสนใจ** อยู่มุมขวาล่างของ hero หน้าแรก (รอบที่ 200)
 *
 * ที่มา (คำเจ้าของ 2026-10-08):
 *   *"เราเพียงแค่ต้องการแก้ไขเทมเพลตการ์ดที่มันแสดงอยู่ใน hardcode ตอนนี้ ที่เป็นการ์ดขยับ"*
 *
 * ปัญหาเดิม: ข้อความการ์ดถูกอ่านจาก **พจนานุกรมอย่างเดียว** (`messages.hero.card`)
 *   – แม้หลังบ้าน (`/admin/content/home`) มีช่องให้แก้การ์ดนี้ (seed ไว้ตั้งแต่รอบแรก) แต่ **ไม่มีผลกับหน้าเว็บเลย**
 *   – ⇒ ไฟล์นี้เป็น "กติกาการเลือกค่า" จุดเดียว: **ค่าที่ตั้งในหลังบ้านทับพจนานุกรม** และช่องที่ว่าง = ใช้ค่าเดิม
 *
 * เป็นตรรกะล้วน (ไม่แตะ DB/React) ⇒ ทดสอบได้ด้วย `node --test`
 * ⚠️ ห้ามให้ช่องไหนกลายเป็นสตริงว่างบนหน้าเว็บ — ว่าง = ถอยไปใช้ค่าเริ่มต้นเสมอ
 */
export type HeroCardContent = {
  readonly title: string;
  readonly body: string;
  readonly linkLabel: string;
  readonly href: string;
  readonly image: { readonly src: string; readonly alt: string };
};

/** ค่าเริ่มต้น = พฤติกรรมเดิมเป๊ะ (พจนานุกรม + ค่าคงที่ในโค้ด) — ใช้เมื่อหลังบ้านยังไม่ได้ตั้งค่า */
export function heroCardDefaults(messages: Messages): HeroCardContent {
  const card = messages.hero.card;
  return {
    title: card.title,
    body: card.body,
    linkLabel: card.link,
    href: HERO_CARD_HREF,
    image: { src: HERO_CARD_IMAGE.src, alt: card.alt },
  };
}

/**
 * เลือกค่าตามภาษา: **EN ใช้เฉพาะเมื่อขอ EN และมีจริง** — ไม่งั้นถอยไทย · ว่างเปล่า = ใช้ค่าเดิม
 * ⚠️ บั๊กที่จับได้ตอนพิสูจน์ (รอบ 200): เคยลืมเช็คภาษา ⇒ หน้าไทยแสดงข้อความอังกฤษ
 */
function pick(
  value: { readonly th: string; readonly en: string } | undefined,
  fallback: string,
  language: "th" | "en",
): string {
  if (value === undefined) return fallback;
  const chosen = language === "en" && value.en.trim() !== "" ? value.en : value.th;
  return chosen.trim() === "" ? fallback : chosen.trim();
}

/**
 * รวมเนื้อหาการ์ด: **หลังบ้าน (EAV) ทับพจนานุกรม**
 * `content` = `null`/ยังไม่มีแถว = ค่าเริ่มต้น (หน้าเว็บไม่มีทางพังเพราะฐานข้อมูล)
 */
export function heroCardContentOf(
  content: PageContent | null,
  messages: Messages,
  language: "th" | "en",
): HeroCardContent {
  const fallback = heroCardDefaults(messages);
  const item = content?.sections["hero"]?.items["card"]?.[0];
  if (item === undefined) return fallback;

  const image = item.media["image"];
  const imagePath = image?.path.trim() ?? "";

  return {
    title: pick(item.fields["title"], fallback.title, language),
    body: pick(item.fields["body"], fallback.body, language),
    linkLabel: pick(item.fields["linkLabel"], fallback.linkLabel, language),
    /* `href` ไม่ผูกภาษา (ปลายทางเดียวกันทั้งสองภาษา) — อ่านจากช่องไทยตามกติกาเดิม */
    href: pick(item.fields["href"], fallback.href, "th"),
    /* ไม่ตั้งภาพในหลังบ้าน = ใช้ภาพเดิมในโค้ด (มี alt ของตัวเอง) */
    image:
      imagePath === ""
        ? fallback.image
        : {
          src: imagePath,
          alt: pick({ th: image?.altTh ?? "", en: image?.altEn ?? "" }, fallback.image.alt, language),
        },
  };
}

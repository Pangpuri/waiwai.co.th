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

/* ── ฟอร์มแก้การ์ดในหน้าแคมเปญ (รอบที่ 203) ───────────────────────────────────── */

/** ช่องที่ทำให้บันทึกไม่ผ่าน (ใช้บอกผู้ใช้ทีละช่อง — เหมือนกติกาของแคมเปญ) */
export const HERO_CARD_FIELD_CODES = ["titleTh", "bodyTh", "href", "imagePath", "imageAltTh"] as const;
export type HeroCardFieldCode = (typeof HERO_CARD_FIELD_CODES)[number];

export type HeroCardInput = {
  readonly titleTh: string;
  readonly titleEn: string;
  readonly bodyTh: string;
  readonly bodyEn: string;
  readonly linkLabelTh: string;
  readonly linkLabelEn: string;
  readonly href: string;
  readonly imagePath: string;
  readonly imageAltTh: string;
  readonly imageAltEn: string;
};

export type HeroCardParseResult =
  | { readonly ok: true; readonly value: HeroCardInput }
  | { readonly ok: false; readonly problems: readonly HeroCardFieldCode[] };

/** พาธในเว็บ (`/…` ไม่ใช่ `//…`) หรือลิงก์ภายนอก http(s) — ห้าม URL เต็มของภาพ (มติ D9) */
function isInSitePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes(" ");
}

function text(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, max);
}

/**
 * ตรวจค่าที่ส่งมาจากฟอร์มการ์ด (ตรรกะล้วน · ทดสอบได้)
 * กติกา: หัวข้อไทย + ข้อความไทย **ต้องมี** (การ์ดเปล่าไม่ควรขึ้นเว็บ) · มีภาพแล้วต้องมีคำอธิบายภาพ (a11y)
 * · ลิงก์/พาธต้องอยู่ในเว็บหรือ http(s) · ภาษาอังกฤษไม่บังคับ (ว่าง = ถอยไปใช้ไทย)
 */
export function parseHeroCardInput(form: { get(key: string): unknown }): HeroCardParseResult {
  const value: HeroCardInput = {
    titleTh: text(form.get("titleTh"), 80),
    titleEn: text(form.get("titleEn"), 80),
    bodyTh: text(form.get("bodyTh"), 200),
    bodyEn: text(form.get("bodyEn"), 200),
    linkLabelTh: text(form.get("linkLabelTh"), 30),
    linkLabelEn: text(form.get("linkLabelEn"), 30),
    href: text(form.get("href"), 300),
    imagePath: text(form.get("imagePath"), 300),
    imageAltTh: text(form.get("imageAltTh"), 200),
    imageAltEn: text(form.get("imageAltEn"), 200),
  };

  const problems: HeroCardFieldCode[] = [];
  if (value.titleTh === "") problems.push("titleTh");
  if (value.bodyTh === "") problems.push("bodyTh");
  /* เว้นว่าง = ไปหน้าข่าวสาร (ค่าเริ่มต้นเดิม) · กรอกมา = ต้องเป็นพาธในเว็บหรือ http(s) */
  const href = value.href === "" ? HERO_CARD_HREF : value.href;
  if (value.href !== "" && !isInSitePath(value.href) && !/^https?:\/\//.test(value.href)) problems.push("href");
  if (value.imagePath !== "" && !isInSitePath(value.imagePath)) problems.push("imagePath");
  if (value.imagePath !== "" && value.imageAltTh === "") problems.push("imageAltTh");

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value: { ...value, href } };
}

/** ค่าตั้งต้นของฟอร์มแก้การ์ด = ค่าที่ **บันทึกไว้จริง** (ว่าง = ว่าง) ไม่ใช่ค่าที่ merge กับพจนานุกรมแล้ว */
export function heroCardDraftOf(content: PageContent | null): HeroCardInput {
  const item = content?.sections["hero"]?.items["card"]?.[0];
  const raw = (field: string, language: "th" | "en"): string => item?.fields[field]?.[language] ?? "";
  const image = item?.media["image"];
  return {
    titleTh: raw("title", "th"),
    titleEn: raw("title", "en"),
    bodyTh: raw("body", "th"),
    bodyEn: raw("body", "en"),
    linkLabelTh: raw("linkLabel", "th"),
    linkLabelEn: raw("linkLabel", "en"),
    href: raw("href", "th") === "" ? HERO_CARD_HREF : raw("href", "th"),
    imagePath: image?.path ?? "",
    imageAltTh: image?.altTh ?? "",
    imageAltEn: image?.altEn ?? "",
  };
}

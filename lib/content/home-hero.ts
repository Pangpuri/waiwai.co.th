import type { PageContent } from "@/lib/content/types";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ข้อความของ **แถบเปิดหน้าแรก (hero)** — รอบที่ 250 · **ตรรกะล้วน ทดสอบได้**
 *
 * ## ที่มา (เคสจริงจากเจ้าของ 2026-10-09)
 * *"ผมว่าเราขาดบล็อคนึงรึเปล่า บล็อคที่ต่อจากสไลด์ — โรงงานผลิตภัณฑ์อาหารไทย / ความอร่อยที่คนไทยไว้วางใจ
 * ในทุกมื้อของวัน / … / ดูผลิตภัณฑ์ทั้งหมด"*
 *
 * ส่วนนั้นคือ **hero** ซึ่ง **ไม่ใช่บล็อก** (มติรอบ 217: เจ้าของเดียวคือ `/admin/hero`) ⇒ ในตัวสร้างจะไม่เห็นเป็นแถว
 * แต่ที่ขาดจริงคือ: ข้อความชุดนี้ถูกอ่านจาก **พจนานุกรมเท่านั้น**
 *   – หลังบ้าน (`/admin/content/home` → section "แถบเปิดหน้าแรก (Hero)") มีช่องให้แก้ + seed ค่าไว้ครบ ทั้ง TH/EN
 *   – แต่ **ไม่มีผลกับหน้าเว็บเลย** ⇒ "ช่องที่โกหก" (คลาสเดียวกับบั๊กการ์ดประกาศ รอบที่ 200)
 *
 * ⇒ ไฟล์นี้เป็น **กติกาการเลือกค่าจุดเดียว**: *ค่าที่ตั้งในหลังบ้านทับพจนานุกรม* และช่องที่ว่าง = ใช้ค่าเดิม
 * ⚠️ ห้ามให้ช่องไหนกลายเป็นสตริงว่างบนหน้าเว็บ — ว่าง = ถอยไปใช้ค่าเริ่มต้นเสมอ (หน้าเว็บห้ามพังเพราะข้อมูล)
 */

export type HeroTexts = {
  readonly eyebrow: string;
  readonly title: string;
  /** ท่อนเน้นสีของหัวข้อ (`title` + `titleAccent`) */
  readonly titleAccent: string;
  readonly body: string;
  /** ป้ายหมายเหตุ (เช่น "ภาพและข้อความ…เป็นตัวอย่าง") — ว่างได้ (ไม่แสดง) */
  readonly note: string;
  /** ป้ายปุ่มหลักของ hero */
  readonly ctaLabel: string;
  /** ปลายทางปุ่มหลัก — **พาธกลาง** (`/products`) ไม่ผูกภาษา */
  readonly ctaHref: string;
};

/** ปลายทางเริ่มต้นของปุ่มหลัก (ของเดิมในโค้ด — รอบที่ 155) */
export const HERO_CTA_HREF = "/products";

/** ค่าเริ่มต้น = พฤติกรรมเดิมเป๊ะ (พจนานุกรมล้วน) — ใช้เมื่อหลังบ้านยังไม่ได้ตั้งค่า */
export function heroTextsDefaults(messages: Messages): HeroTexts {
  const hero = messages.hero;
  return {
    eyebrow: hero.eyebrow,
    title: hero.title,
    titleAccent: hero.titleAccent,
    body: hero.body,
    note: hero.note,
    ctaLabel: messages.actions.viewProducts,
    ctaHref: HERO_CTA_HREF,
  };
}

/**
 * เลือกค่าตามภาษา: **EN ใช้เฉพาะเมื่อขอ EN และมีจริง** — ไม่งั้นถอยไทย · ว่างเปล่า = ใช้ค่าเดิม
 * (บทเรียนรอบ 200: เคยลืมเช็คภาษา ⇒ หน้าไทยแสดงข้อความอังกฤษ)
 */
function pick(value: { readonly th: string; readonly en: string } | undefined, fallback: string, language: "th" | "en"): string {
  if (value === undefined) return fallback;
  const chosen = language === "en" && value.en.trim() !== "" ? value.en : value.th;
  return chosen.trim() === "" ? fallback : chosen.trim();
}

/**
 * หมายเหตุ (ป้าย "ภาพตัวอย่าง…"): **ผู้ใช้สั่งซ่อนได้**
 * ⚠️ ต่างจากช่องอื่นโดยเจตนา — ช่องอื่น "ว่าง = ใช้ค่าเริ่มต้น" แต่ช่องนี้พอถูกล้างแล้วต้องหายไปจริง
 *   (ไม่งั้นผู้ใช้จะซ่อนป้ายไม่ได้เลย) · ยังไม่เคยตั้ง (ไม่มีแถว) = ใช้ค่าเริ่มต้นของพจนานุกรม
 */
function noteText(value: { readonly th: string; readonly en: string } | undefined, fallback: string, language: "th" | "en"): string {
  if (value === undefined) return fallback;
  const preferred = language === "en" ? value.en : value.th;
  if (preferred.trim() !== "") return preferred.trim();
  /* ภาษาที่ขอว่าง → ถอยอีกภาษา (ไทยว่าง + EN มี = แสดง EN) · ว่างทั้งคู่ = ซ่อน */
  const other = language === "en" ? value.th : value.en;
  return other.trim();
}

/**
 * รวมข้อความ hero: **หลังบ้าน (EAV) ทับพจนานุกรม**
 * `content` = `null`/ยังไม่มีแถว = ค่าเริ่มต้น (หน้าเว็บไม่มีทางพังเพราะฐานข้อมูล)
 */
export function heroTextsOf(content: PageContent | null, messages: Messages, language: "th" | "en"): HeroTexts {
  const fallback = heroTextsDefaults(messages);
  const fields = content?.sections["hero"]?.fields;
  if (fields === undefined) return fallback;

  return {
    eyebrow: pick(fields["eyebrow"], fallback.eyebrow, language),
    title: pick(fields["title"], fallback.title, language),
    titleAccent: pick(fields["titleAccent"], fallback.titleAccent, language),
    body: pick(fields["body"], fallback.body, language),
    /* หมายเหตุ: ว่างได้ — แต่ถ้าไม่เคยตั้ง (ไม่มีแถว) ใช้ค่าเริ่มต้นของพจนานุกรม */
    note: noteText(fields["note"], fallback.note, language),
    ctaLabel: pick(fields["ctaLabel"], fallback.ctaLabel, language),
    /* ปลายทางไม่ผูกภาษา (พาธกลาง) — อ่านจากช่องไทยตามกติกาเดิม (เหมือนการ์ดประกาศ) */
    ctaHref: pick(fields["ctaHref"], fallback.ctaHref, "th"),
  };
}

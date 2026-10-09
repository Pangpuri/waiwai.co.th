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

/* ── ฟอร์ม "ข้อความหัวเว็บไซต์" บนหน้าจอสไลด์ & แคมเปญ (รอบที่ 251) ───────────────
   มติเจ้าของ: *"รวมทุกอย่างของ hero ไว้ที่สไลด์ & แคมเปญ + เปลี่ยนชื่อเมนูเป็น
   'สไลด์ แคมเปญ ข้อความหัวเว็บไซต์'"* ⇒ หน้าจอสไลด์เป็นเจ้าของส่วน hero ทั้งส่วน
   ⚠️ เก็บที่เดิม (EAV `content_field` section `hero`) — ไม่ย้ายที่เก็บ ⇒ หน้าเว็บอ่านค่าเดิม
*/

/** ช่องที่ทำให้บันทึกไม่ผ่าน (ใช้บอกผู้ใช้) */
export const HERO_TEXT_FIELD_CODES = [
  "eyebrowTh",
  "titleTh",
  "titleAccentTh",
  "bodyTh",
  "ctaHref",
] as const;
export type HeroTextFieldCode = (typeof HERO_TEXT_FIELD_CODES)[number];

export type HeroTextsInput = {
  readonly eyebrowTh: string;
  readonly eyebrowEn: string;
  readonly titleTh: string;
  readonly titleEn: string;
  readonly titleAccentTh: string;
  readonly titleAccentEn: string;
  readonly bodyTh: string;
  readonly bodyEn: string;
  readonly noteTh: string;
  readonly noteEn: string;
  readonly ctaLabelTh: string;
  readonly ctaLabelEn: string;
  readonly ctaHref: string;
};

export type HeroTextsParseResult =
  | { readonly ok: true; readonly value: HeroTextsInput }
  | { readonly ok: false; readonly problems: readonly HeroTextFieldCode[] };

/** พาธในเว็บ (`/…` ไม่ใช่ `//…`) หรือลิงก์ภายนอก http(s) — กติกาเดียวกับการ์ด PR */
function isInSitePath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes(" ");
}

function text(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, max);
}

/**
 * อ่านค่าจากฟอร์ม + ตรวจ (ตรรกะล้วน · ไม่แตะ DB)
 *
 * กติกา
 * - **ไทยบังคับ** ในช่องที่เป็นแกนของส่วน (ข้อความเล็ก/หัวข้อ/ท่อนเน้น/คำโปรย) — เหมือนสเปกเนื้อหา
 * - **อังกฤษไม่บังคับ** (มติ D22: EN = ความรับผิดชอบการตลาด) · ว่าง = หน้า EN ถอยไปใช้ไทย (`heroTextsOf`)
 * - หมายเหตุ/ป้ายปุ่ม/ปลายทาง **ว่างได้** — ว่าง = ถอยค่าเริ่มต้นของโค้ด (หมายเหตุ: ว่าง = ซ่อนป้าย)
 * - ปลายทางกรอกมา = ต้องเป็นพาธในเว็บหรือ http(s) เท่านั้น (ห้าม URL แปลกปลอม)
 */
export function parseHeroTextsInput(form: { get(key: string): unknown }): HeroTextsParseResult {
  const value: HeroTextsInput = {
    eyebrowTh: text(form.get("eyebrowTh"), 40),
    eyebrowEn: text(form.get("eyebrowEn"), 40),
    titleTh: text(form.get("titleTh"), 70),
    titleEn: text(form.get("titleEn"), 70),
    titleAccentTh: text(form.get("titleAccentTh"), 60),
    titleAccentEn: text(form.get("titleAccentEn"), 60),
    bodyTh: text(form.get("bodyTh"), 400),
    bodyEn: text(form.get("bodyEn"), 400),
    noteTh: text(form.get("noteTh"), 300),
    noteEn: text(form.get("noteEn"), 300),
    ctaLabelTh: text(form.get("ctaLabelTh"), 40),
    ctaLabelEn: text(form.get("ctaLabelEn"), 40),
    ctaHref: text(form.get("ctaHref"), 300),
  };

  const problems: HeroTextFieldCode[] = [];
  if (value.eyebrowTh === "") problems.push("eyebrowTh");
  if (value.titleTh === "") problems.push("titleTh");
  if (value.titleAccentTh === "") problems.push("titleAccentTh");
  if (value.bodyTh === "") problems.push("bodyTh");
  if (value.ctaHref !== "" && !isInSitePath(value.ctaHref) && !/^https?:\/\//.test(value.ctaHref)) {
    problems.push("ctaHref");
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value };
}

/**
 * ค่าตั้งต้นของฟอร์ม = ค่าที่ **บันทึกไว้จริง** (ว่าง = ว่าง) ไม่ใช่ค่าที่ merge กับพจนานุกรมแล้ว
 * เพื่อให้ผู้ใช้เห็นว่าช่องไหน "ยังไม่ได้ตั้ง" (แต่ตัวอย่างบนเว็บยังใช้ค่าเริ่มต้น)
 */
export function heroTextsDraftOf(content: PageContent | null): HeroTextsInput {
  const fields = content?.sections["hero"]?.fields;
  const raw = (field: string, language: "th" | "en"): string => fields?.[field]?.[language] ?? "";

  return {
    eyebrowTh: raw("eyebrow", "th"),
    eyebrowEn: raw("eyebrow", "en"),
    titleTh: raw("title", "th"),
    titleEn: raw("title", "en"),
    titleAccentTh: raw("titleAccent", "th"),
    titleAccentEn: raw("titleAccent", "en"),
    bodyTh: raw("body", "th"),
    bodyEn: raw("body", "en"),
    noteTh: raw("note", "th"),
    noteEn: raw("note", "en"),
    ctaLabelTh: raw("ctaLabel", "th"),
    ctaLabelEn: raw("ctaLabel", "en"),
    ctaHref: raw("ctaHref", "th"),
  };
}

/** แปลงค่าที่ตรวจแล้ว → ฟิลด์ของ section hero (รูปเดียวกับที่ EAV เก็บ) */
export function heroTextsFieldsOf(value: HeroTextsInput): Readonly<Record<string, { readonly th: string; readonly en: string }>> {
  return {
    eyebrow: { th: value.eyebrowTh, en: value.eyebrowEn },
    title: { th: value.titleTh, en: value.titleEn },
    titleAccent: { th: value.titleAccentTh, en: value.titleAccentEn },
    body: { th: value.bodyTh, en: value.bodyEn },
    note: { th: value.noteTh, en: value.noteEn },
    ctaLabel: { th: value.ctaLabelTh, en: value.ctaLabelEn },
    ctaHref: { th: value.ctaHref, en: "" },
  };
}

/** ช่องที่ต้องแก้ (จาก `?fields=` ของหน้าจอ) — กรองเฉพาะรหัสที่รู้จัก (ค่าจาก URL ไม่เชื่อถือได้) */
export function heroTextFieldCodesOf(value: string | undefined): readonly HeroTextFieldCode[] {
  if (value === undefined || value === "") return [];
  const known = new Set<string>(HERO_TEXT_FIELD_CODES);
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is HeroTextFieldCode => known.has(item));
}

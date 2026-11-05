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
 *   – จอเดิม (`/admin/content/home` → section "แถบเปิดหน้าแรก (Hero)") เคยมีช่องให้แก้แต่ **ไม่มีผลกับหน้าเว็บ**
 *   – รอบ 330 ถอดจอนั้นแล้ว · ค่าจริงแก้ที่ `/admin/hero` (ฟอร์มข้อความ hero) และ **มีผลกับหน้าเว็บ**
 *
 * ⇒ ไฟล์นี้เป็น **กติกาการเลือกค่าจุดเดียว**: *ค่าที่ตั้งในหลังบ้านทับพจนานุกรม*
 *
 * ## รอบที่ 331 (คำสั่งเจ้าของ 2026-11-05): เว้นว่างได้ = ซ่อน
 * เดิมช่องข้อความหลักบังคับกรอก และ "ว่าง" ถอยไปใช้ค่าเริ่มต้น ⇒ เจ้าของ **ซ่อนข้อความไม่ได้**
 * ใหม่: **แถวที่ยังไม่มีใน DB** = ค่าเริ่มต้นจากพจนานุกรม · **แถวที่มีอยู่แต่ช่องว่าง** = ซ่อน (`""`)
 *   – หน้าเว็บต้องไม่พังเพราะข้อมูล: ช่องที่ซ่อนต้องไม่ทิ้งแท็กเปล่า/ช่องว่างในผัง
 *   – หน้าไทยไม่แสดงข้อความอังกฤษ (บทเรียนรอบ 200) · หน้า EN ที่ยังไม่มี EN ยังถอยไทยได้
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
 * ค่าที่ **ห้ามว่างบนหน้าเว็บ** (เช่น ปลายทางปุ่ม) — ว่าง = ถอยค่าเริ่มต้นเสมอ
 * (บทเรียนรอบ 200: เคยลืมเช็คภาษา ⇒ หน้าไทยแสดงข้อความอังกฤษ · EN ใช้เมื่อมีจริงเท่านั้น)
 */
function pick(value: { readonly th: string; readonly en: string } | undefined, fallback: string, language: "th" | "en"): string {
  if (value === undefined) return fallback;
  const chosen = language === "en" && value.en.trim() !== "" ? value.en : value.th;
  return chosen.trim() === "" ? fallback : chosen.trim();
}

/**
 * ข้อความที่ **เว้นว่างได้ = ซ่อน** (รอบที่ 331)
 *
 * - **ไม่มีแถวใน DB** = ใช้ค่าเริ่มต้นจากพจนานุกรม (ผู้ใช้ยังไม่เคยแตะช่องนี้)
 * - **มีแถวแต่ช่องว่าง** = คืน `""` (ผู้ใช้สั่งซ่อน) — **ห้าม** ถอยไปค่าเริ่มต้น ไม่งั้นซ่อนไม่ได้
 * - ขอ EN และ EN ว่าง = ถอยไทย (มติ D22) · ขอ TH และไทยว่าง = ซ่อน (ห้ามหน้าไทยแสดงอังกฤษ)
 */
function optionalText(
  value: { readonly th: string; readonly en: string } | undefined,
  fallback: string,
  language: "th" | "en",
): string {
  if (value === undefined) return fallback;
  const preferred = language === "en" ? value.en : value.th;
  if (preferred.trim() !== "") return preferred.trim();
  if (language === "en") return value.th.trim();
  return "";
}

/**
 * หมายเหตุ (ป้าย "ภาพตัวอย่าง…"): **ผู้ใช้สั่งซ่อนได้**
 * (ปัจจุบันไม่เรนเดอร์บนหน้าเว็บ — รอบที่ 273 · เก็บกติกาไว้ให้ค่าที่ค้างใน DB ไม่ทำให้หน้าพัง)
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
 * รอบ 331: ช่องข้อความหลักที่ถูกล้าง = `""` (ซ่อน) · ปลายทางปุ่มยังถอยค่าเริ่มต้นเสมอ
 */
export function heroTextsOf(content: PageContent | null, messages: Messages, language: "th" | "en"): HeroTexts {
  const fallback = heroTextsDefaults(messages);
  const fields = content?.sections["hero"]?.fields;
  if (fields === undefined) return fallback;

  return {
    eyebrow: optionalText(fields["eyebrow"], fallback.eyebrow, language),
    title: optionalText(fields["title"], fallback.title, language),
    titleAccent: optionalText(fields["titleAccent"], fallback.titleAccent, language),
    body: optionalText(fields["body"], fallback.body, language),
    /* หมายเหตุ: ว่างได้ — แต่ถ้าไม่เคยตั้ง (ไม่มีแถว) ใช้ค่าเริ่มต้นของพจนานุกรม */
    note: noteText(fields["note"], fallback.note, language),
    ctaLabel: optionalText(fields["ctaLabel"], fallback.ctaLabel, language),
    /* ปลายทางไม่ผูกภาษา (พาธกลาง) — อ่านจากช่องไทยตามกติกาเดิม (เหมือนการ์ดประกาศ) */
    ctaHref: pick(fields["ctaHref"], fallback.ctaHref, "th"),
  };
}

/* ── ฟอร์ม "ข้อความหัวเว็บไซต์" บนหน้าจอสไลด์ & แคมเปญ (รอบที่ 251) ───────────────
   มติเจ้าของ: *"รวมทุกอย่างของ hero ไว้ที่สไลด์ & แคมเปญ + เปลี่ยนชื่อเมนูเป็น
   'สไลด์ แคมเปญ ข้อความหัวเว็บไซต์'"* ⇒ หน้าจอสไลด์เป็นเจ้าของส่วน hero ทั้งส่วน
   ⚠️ เก็บที่เดิม (EAV `content_field` section `hero`) — ไม่ย้ายที่เก็บ ⇒ หน้าเว็บอ่านค่าเดิม
*/

/**
 * ช่องที่ทำให้บันทึกไม่ผ่าน (ใช้บอกผู้ใช้)
 * รอบที่ 331: ช่องข้อความเว้นว่างได้ทั้งหมด ⇒ เหลือเฉพาะ **ปลายทางปุ่ม** ที่ต้องตรวจรูปแบบ
 */
export const HERO_TEXT_FIELD_CODES = ["ctaHref"] as const;
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
 * กติกา (รอบที่ 331)
 * - **ทุกช่องข้อความเว้นว่างได้** — ว่าง = ไม่แสดงส่วนนั้นบนเว็บ (คำสั่งเจ้าของ 2026-11-05)
 *   · ไม่มีแถวใน DB = ค่าเริ่มต้นจากพจนานุกรม (กติกาอยู่ที่ `heroTextsOf`)
 * - **อังกฤษไม่บังคับ** (มติ D22: EN = ความรับผิดชอบการตลาด) · ว่าง = หน้า EN ถอยไปใช้ไทย
 * - ปลายทางกรอกมา = ต้องเป็นพาธในเว็บหรือ http(s) เท่านั้น (ห้าม URL แปลกปลอม) · ว่าง = ค่าเริ่มต้น
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
  /* รอบที่ 331: ช่องข้อความว่างได้ (ว่าง = ซ่อน) — ตรวจเฉพาะรูปแบบปลายทาง */
  if (value.ctaHref !== "" && !isInSitePath(value.ctaHref) && !/^https?:\/\//.test(value.ctaHref)) {
    problems.push("ctaHref");
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value };
}

/**
 * ค่าตั้งต้นของฟอร์ม
 *
 * - ไม่ส่ง `fallback` = **ค่าดิบที่บันทึกไว้จริง** (ว่าง = ว่าง) — ใช้เมื่อต้องการเห็นแถวใน DB ตามจริง
 * - ส่ง `fallback` (ปกติคือ `heroTextsDefaults(messages)`) = **แถวที่ยังไม่มีใน DB ใช้ค่าเริ่มต้น**
 *   ⚠️ แถวที่มีอยู่แล้วแต่ถูกล้าง ต้องคงเป็นว่าง (ผู้ใช้สั่งซ่อน) — ห้ามเติมค่าเริ่มต้นทับ
 *   ⇒ ฟอร์มจะโชว์ "สิ่งที่เว็บกำลังแสดง" และการล้างช่อง = ซ่อนจริง (รอบที่ 331)
 *   · ช่อง EN ยังคงค่าดิบเสมอ (ว่าง = หน้า EN ถอยไทย) — ไม่เติมค่าเริ่มต้นอังกฤษให้เอง
 */
export function heroTextsDraftOf(content: PageContent | null, fallback?: HeroTexts): HeroTextsInput {
  const fields = content?.sections["hero"]?.fields;
  const raw = (field: string, language: "th" | "en", fallbackValue = ""): string => {
    const row = fields?.[field];
    return row === undefined ? fallbackValue : (row[language] ?? "");
  };

  return {
    eyebrowTh: raw("eyebrow", "th", fallback?.eyebrow ?? ""),
    eyebrowEn: raw("eyebrow", "en"),
    titleTh: raw("title", "th", fallback?.title ?? ""),
    titleEn: raw("title", "en"),
    titleAccentTh: raw("titleAccent", "th", fallback?.titleAccent ?? ""),
    titleAccentEn: raw("titleAccent", "en"),
    bodyTh: raw("body", "th", fallback?.body ?? ""),
    bodyEn: raw("body", "en"),
    noteTh: raw("note", "th", fallback?.note ?? ""),
    noteEn: raw("note", "en"),
    ctaLabelTh: raw("ctaLabel", "th", fallback?.ctaLabel ?? ""),
    ctaLabelEn: raw("ctaLabel", "en"),
    ctaHref: raw("ctaHref", "th", fallback?.ctaHref ?? ""),
  };
}

/**
 * ค่าเริ่มต้นสำหรับปุ่ม **“คืนค่าเริ่มต้น”** ในฟอร์ม (รอบที่ 331)
 *
 * เติมทั้ง TH และ EN จากพจนานุกรมของแต่ละภาษา ⇒ ผู้ใช้เห็น “รูปแบบเริ่มต้นจริง” ก่อนปรับ
 * ⚠️ ฟังก์ชันนี้ **ไม่แตะ DB** — เป็นเพียงค่าที่จะถูกใส่ในฟอร์ม · ยังไม่บันทึกจนกว่าจะกด “บันทึกข้อความ”
 * (ต่างจาก `heroTextsDraftOf` ที่ช่อง EN ปล่อยว่างเพื่อให้หน้า EN ถอยไทย)
 */
export function heroTextsDefaultsInput(messagesTh: Messages, messagesEn: Messages): HeroTextsInput {
  const th = heroTextsDefaults(messagesTh);
  const en = heroTextsDefaults(messagesEn);

  return {
    eyebrowTh: th.eyebrow,
    eyebrowEn: en.eyebrow,
    titleTh: th.title,
    titleEn: en.title,
    titleAccentTh: th.titleAccent,
    titleAccentEn: en.titleAccent,
    bodyTh: th.body,
    bodyEn: en.body,
    noteTh: th.note,
    noteEn: en.note,
    ctaLabelTh: th.ctaLabel,
    ctaLabelEn: en.ctaLabel,
    ctaHref: th.ctaHref,
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

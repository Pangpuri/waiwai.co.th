/**
 * แท็บของ "ส่วนกลางของเว็บ" + การเก็บสถานะไว้ใน URL (รอบที่ 178) — **ตรรกะล้วน ไม่มี Next/DB/env**
 *
 * ที่มา (ฟีดแบ็กเจ้าของ 2026-10-07):
 * *"ส่วนกลางของเว็บ ยังไม่มีการเซฟสเตท ทำแทรปไหน รีเฟรชควรยังเป็นแทรปนั้นต่อ
 *   เช่นเลือกป้ายประกาศไว้ แล้วเราต้องการดูตัวอย่างการประกาศ พอรีเฟรชมันเด้งกลับไปแถบเมนูก่อน"*
 *
 * วิธีที่เลือก: เก็บ **"ส่วนของเว็บ" (`part`) + "มุมมอง" (`mode`)** ไว้ใน **query string**
 * - รีเฟรช/F5 → ได้ค่าเดิม (เซิร์ฟเวอร์อ่าน `searchParams` แล้วส่งเป็นค่าเริ่มต้นให้ไคลเอนต์)
 * - คัดลอก URL ส่งต่อได้ว่า "ดูตรงนี้" และลิงก์ที่เปิดใหม่จะเข้าถูกแท็บ
 * - **ไม่เก็บลงฐานข้อมูล/คุกกี้** — เป็นสถานะหน้าจอ ไม่ใช่ข้อมูลของเว็บ
 *
 * ⚠️ ค่าที่ไม่รู้จัก/ไม่ส่งมา = ถอยไปค่าเริ่มต้น (`navbar`/`draft`) — **ห้าม throw** เพราะ URL มาจากผู้ใช้
 * ⚠️ ลำดับพารามิเตอร์คงที่ (`part` ก่อน `mode`) และไม่ใส่ค่าที่เป็นค่าเริ่มต้น ⇒ URL สั้นและเทียบกันได้
 */

export const CHROME_WORKSPACE_PATH = "/admin/builder/chrome";

export const CHROME_PARTS = ["navbar", "notice", "footer"] as const;
export type ChromePart = (typeof CHROME_PARTS)[number];
export const DEFAULT_CHROME_PART: ChromePart = "navbar";

export const CHROME_MODES = ["current", "draft", "overview"] as const;
export type ChromeMode = (typeof CHROME_MODES)[number];
export const DEFAULT_CHROME_MODE: ChromeMode = "draft";

export type ChromeTabState = {
  readonly part: ChromePart;
  readonly mode: ChromeMode;
};

export function isChromePart(value: string): value is ChromePart {
  return (CHROME_PARTS as readonly string[]).includes(value);
}

export function isChromeMode(value: string): value is ChromeMode {
  return (CHROME_MODES as readonly string[]).includes(value);
}

/**
 * ชื่อ "ส่วน" ที่ **หน้าพรีวิว** ใช้ใน query (`?parts=…`) — คนละคำกับแท็บของหน้าจอ
 * · แท็บหน้าจอ = `navbar` (ผู้ใช้เห็นเป็น "แถบเมนู") · พรีวิวใช้ `nav` (ของเดิมตั้งแต่รอบที่ 57)
 * ⚠️ ประกาศเป็น `Record<ChromePart, string>` ⇒ เพิ่มแท็บใหม่แล้ว TypeScript **บังคับ** ให้ระบุชื่อพรีวิว (ลืมไม่ได้)
 * ⚠️ หน้าพรีวิวรับเฉพาะค่าที่อยู่ในรายการนี้ (`app/[lang]/preview/[page]/page.tsx`) และ `app/globals.css`
 *    ต้องมีกฎซ่อนป้ายประกาศของทุกค่าที่ไม่ใช่ `notice` — มีเทสต์บังคับที่ `scripts/test-chrome-preset.ts`
 */
export const PREVIEW_PART_OF: Readonly<Record<ChromePart, string>> = {
  navbar: "nav",
  notice: "notice",
  footer: "footer",
};

/**
 * โหมดพรีวิวที่ไม่ใช่ป้ายประกาศ — ต้อง **ซ่อนป้ายประกาศ** (โอเวอร์เลย์เต็มจอ)
 *
 * ฟีดแบ็กเจ้าของ รอบที่ 179: *"ตั้งค่าท้ายเว็บแล้วมีหน้าประกาศเด้งมากวน · ให้เหมือนส่วนเมนู"*
 */
export const PREVIEW_PARTS_WITHOUT_NOTICE: readonly string[] = CHROME_PARTS.filter((part) => part !== "notice").map(
  (part) => PREVIEW_PART_OF[part],
);

/**
 * **"ส่วน" ที่หน้าพรีวิวรองรับ** (`?parts=…`) — รายการกลางที่เดียว (ใช้ทั้งหน้าพรีวิวและเทสต์ของ CSS)
 *
 * · `nav` · `footer` · `notice` = แท็บของ "ส่วนกลาง" (มาจาก `CHROME_PARTS`)
 * · **`content` = เฉพาะเนื้อหาหน้า ไม่เอาส่วนกลางเลย** (รอบที่ 182)
 *   ที่มา (ฟีดแบ็กเจ้าของ): *"จัดการหน้าแรกไม่ต้องโชว์ที่มาจากส่วนกลาง … แถบเมนู footer ไม่ต้องโชว์"*
 *   ⇒ ตอนจัดเลเยอร์ของหน้า ควรเห็นเฉพาะสิ่งที่ **หน้านั้นเป็นเจ้าของ** (ส่วนกลางไปแก้ที่แท็บของตัวเอง)
 */
export const CONTENT_PREVIEW_PART = "content";

export const PREVIEW_PARTS: readonly string[] = [
  ...PREVIEW_PARTS_WITHOUT_NOTICE,
  PREVIEW_PART_OF.notice,
  CONTENT_PREVIEW_PART,
];

/** เป็นชื่อ "ส่วน" ของพรีวิวที่รองรับไหม (ค่าอื่น = พรีวิวทั้งหน้า) */
export function isPreviewPart(value: string): boolean {
  return PREVIEW_PARTS.includes(value);
}

/** อ่านค่าจาก query → สถานะแท็บ (ค่าที่ไม่รู้จัก = ค่าเริ่มต้น ไม่โยน error) */
export function chromeTabOf(query: { readonly part?: string; readonly mode?: string }): ChromeTabState {
  const part = (query.part ?? "").trim();
  const mode = (query.mode ?? "").trim();
  return {
    part: isChromePart(part) ? part : DEFAULT_CHROME_PART,
    mode: isChromeMode(mode) ? mode : DEFAULT_CHROME_MODE,
  };
}

/**
 * สร้าง URL ของแท็บ — ใส่เฉพาะค่าที่ไม่ใช่ค่าเริ่มต้น
 * เช่น `{notice, draft}` → `/admin/builder/chrome?part=notice` · `{navbar, draft}` → `/admin/builder/chrome`
 */
export function chromeTabHref(state: ChromeTabState, base: string = CHROME_WORKSPACE_PATH): string {
  const params: string[] = [];
  if (state.part !== DEFAULT_CHROME_PART) params.push(`part=${state.part}`);
  if (state.mode !== DEFAULT_CHROME_MODE) params.push(`mode=${state.mode}`);
  return params.length === 0 ? base : `${base}?${params.join("&")}`;
}

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

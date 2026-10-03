/**
 * พรีเซ็ตของส่วนกลางของเว็บ (W3b) — **ตรรกะล้วน ไม่มี Next/DB/env**
 *
 * โจทย์จากผู้ใช้ (รอบที่ 58)
 * > "ชุดพรีเซ็ตเราต้องบันทึกลงฐานข้อมูล … มีของเก่าเก็บไว้ในฐานข้อมูลและโชว์ก่อน
 * >  มีของใหม่เตรียมฐานข้อมูลรับ มีพรีเซ็ตที่ต้องเตรียมฐานข้อมูลรับ"
 *
 * แปลเป็นของจริงในโปรเจกต์นี้
 * - **ของเก่า** = แถว `published` ของส่วนนั้น (`chrome-navbar` · `chrome-footer` · `mourning`) — ไม่ถูกแตะ
 * - **ของใหม่** = แถว `draft` ของส่วนนั้น — "ใช้ชุดนี้" จะเขียนทับเฉพาะแถวนี้
 * - **พรีเซ็ต** = ตาราง `chrome_preset` (ไฟล์นี้คือกติกา · ตัวเขียน/อ่านอยู่ที่ `preset-repository.ts`)
 *
 * ⚠️ งานนี้ **ไม่ใช่** พรีเซ็ตบล็อก (`lib/blocks/presets.ts`) — นั่นคือชุดของ "บล็อกในหน้าเว็บ"
 *    ส่วนนี่คือชุดของ "ส่วนกลาง" (แถบเมนู/ท้ายเว็บ/ป้ายประกาศ) ซึ่งเป็นรูปทรงคนละแบบ
 */

import { MAX_PRESET_NAME_LENGTH, newPresetId, normalizePresetName } from "@/lib/blocks/presets";
import {
  FOOTER_PAGE_KEY,
  defaultFooterConfig,
  footerErrorsOf,
  parseFooterConfig,
  validateFooterConfig,
} from "@/lib/chrome/footer";
import type { FooterConfig } from "@/lib/chrome/footer";
import {
  NAVBAR_PAGE_KEY,
  defaultNavbarConfig,
  navbarErrorsOf,
  parseNavbarConfig,
  validateNavbarConfig,
} from "@/lib/chrome/navbar";
import type { NavbarConfig } from "@/lib/chrome/navbar";
import type { Messages } from "@/lib/i18n/messages/th";
import {
  MOURNING_PAGE_KEY,
  defaultMourningConfig,
  mourningErrorsOf,
  parseMourningConfig,
  validateMourningConfig,
} from "@/lib/mourning/config";
import type { MourningConfig } from "@/lib/mourning/config";

/** ส่วนกลางสามส่วนที่ทำพรีเซ็ตได้ — ตรงกับคอลัมน์ `kind` ในตาราง `chrome_preset` */
export const CHROME_PRESET_KINDS = ["navbar", "footer", "mourning"] as const;

export type ChromePresetKind = (typeof CHROME_PRESET_KINDS)[number];

/** เพดานจำนวนพรีเซ็ตต่อส่วน (กันคลังบวมไม่จำกัด) */
export const MAX_CHROME_PRESETS_PER_KIND = 60;

/** ความยาวชื่อพรีเซ็ต = ใช้กติกาเดียวกับพรีเซ็ตบล็อก (ที่เดียวในระบบ) */
export const MAX_CHROME_PRESET_NAME_LENGTH = MAX_PRESET_NAME_LENGTH;

export function isChromePresetKind(value: string): value is ChromePresetKind {
  return (CHROME_PRESET_KINDS as readonly string[]).includes(value);
}

/** คีย์ของแถวใน `page_document` ที่ส่วนนี้ใช้เก็บของจริง (แหล่งเดียว — ห้ามพิมพ์ซ้ำ) */
export function chromePresetPageKey(kind: ChromePresetKind): string {
  switch (kind) {
    case "navbar":
      return NAVBAR_PAGE_KEY;
    case "footer":
      return FOOTER_PAGE_KEY;
    case "mourning":
      return MOURNING_PAGE_KEY;
  }
}

/** โครงสร้าง payload ที่ผ่านการตรวจแล้วของแต่ละส่วน */
export type ChromePresetPayload =
  | { readonly kind: "navbar"; readonly config: NavbarConfig }
  | { readonly kind: "footer"; readonly config: FooterConfig }
  | { readonly kind: "mourning"; readonly config: MourningConfig };

/** ชื่อพรีเซ็ต: ตัดช่องว่างซ้ำ · ว่าง = ใช้ไม่ได้ (กติกาเดียวกับพรีเซ็ตบล็อก) */
export function normalizeChromePresetName(raw: string): string | null {
  return normalizePresetName(raw);
}

export function newChromePresetId(): string {
  return newPresetId();
}

/**
 * ตรวจ payload ของพรีเซ็ตตามชนิดของมัน — **ต้องเรียกทุกครั้งที่อ่านจากฐานข้อมูล**
 * (ข้อมูลใน DB ถูกแก้จากภายนอกได้เสมอ + พรีเซ็ตเก่าอาจเป็นรูปทรงของโค้ดรุ่นก่อน)
 *
 * คืน `null` เมื่อใช้ไม่ได้ ⇒ ผู้เรียก "ข้าม" แถวนั้น ไม่ทำให้หน้าจอพัง
 * และในทางกลับกัน **ไม่รับชุดที่มี error** (warning ผ่านได้ — เช่นภาพ placeholder)
 */
export function parseChromePresetPayload(
  kind: ChromePresetKind,
  raw: unknown,
  messages: Messages,
): ChromePresetPayload | null {
  switch (kind) {
    case "navbar": {
      const parsed = parseNavbarConfig(raw, messages);
      if (!parsed.ok) return null;
      if (navbarErrorsOf(validateNavbarConfig(parsed.config)).length > 0) return null;
      return { kind: "navbar", config: parsed.config };
    }
    case "footer": {
      const parsed = parseFooterConfig(raw, messages);
      if (!parsed.ok) return null;
      if (footerErrorsOf(validateFooterConfig(parsed.config)).length > 0) return null;
      return { kind: "footer", config: parsed.config };
    }
    case "mourning": {
      const parsed = parseMourningConfig(raw, messages);
      if (!parsed.ok) return null;
      if (mourningErrorsOf(validateMourningConfig(parsed.config)).length > 0) return null;
      return { kind: "mourning", config: parsed.config };
    }
  }
}

/**
 * ค่าเริ่มต้นของส่วนนั้น (สิ่งที่เว็บใช้อยู่จริงเมื่อยังไม่มีแถวในฐานข้อมูล)
 * ใช้ตอน "เก็บชุด" ครั้งแรก ๆ ที่ยังไม่เคยบันทึกฉบับร่าง/เผยแพร่ของส่วนนี้
 * ⇒ ผู้ดูแลเก็บ "ชุดที่เว็บใช้อยู่ตอนนี้" ได้ทันที ไม่ต้องไปกดบันทึกเปล่า ๆ ก่อน
 */
export function defaultChromePresetPayload(kind: ChromePresetKind, messages: Messages): ChromePresetPayload {
  switch (kind) {
    case "navbar":
      return { kind: "navbar", config: defaultNavbarConfig(messages) };
    case "footer":
      return { kind: "footer", config: defaultFooterConfig(messages) };
    case "mourning":
      return { kind: "mourning", config: defaultMourningConfig(messages) };
  }
}

/** ตรวจชุดที่ "เพิ่งอ่านจากหน้าจอ/จะบันทึก" (ใช้ตอนบันทึกพรีเซ็ต) */
export function validateChromePresetConfig(payload: ChromePresetPayload): readonly string[] {
  switch (payload.kind) {
    case "navbar":
      return navbarErrorsOf(validateNavbarConfig(payload.config)).map((issue) => issue.code);
    case "footer":
      return footerErrorsOf(validateFooterConfig(payload.config)).map((issue) => issue.code);
    case "mourning":
      return mourningErrorsOf(validateMourningConfig(payload.config)).map((issue) => issue.code);
  }
}

/**
 * ตัวเลขสรุปของชุด — หน้าจอประกอบข้อความเองจากพจนานุกรม (ไฟล์นี้ห้ามมีข้อความไทย)
 * ตั้งชื่อให้เป็นกลาง ๆ เพื่อให้ใช้กับทุกส่วน: `primary` = หน่วยหลัก · `secondary` = หน่วยรอง
 */
export function chromePresetCounts(payload: ChromePresetPayload): {
  readonly primary: number;
  readonly secondary: number;
  readonly enabled: boolean | null;
} {
  switch (payload.kind) {
    case "navbar":
      return { primary: payload.config.items.length, secondary: payload.config.buttons.length, enabled: null };
    case "footer":
      return { primary: payload.config.groups.length, secondary: payload.config.socials.length, enabled: null };
    case "mourning":
      return { primary: payload.config.images.length, secondary: 0, enabled: payload.config.enabled };
  }
}

/** พรีเซ็ตที่อ่านจากฐานข้อมูลแล้วและผ่านการตรวจ (ใช้ได้จริง) */
export type ChromePreset = {
  readonly id: string;
  readonly kind: ChromePresetKind;
  readonly name: string;
  readonly payload: ChromePresetPayload;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string | null;
};

/** จำนวนของส่วนนั้น ๆ ที่มีอยู่ (ใช้ตัดสินว่าเต็มเพดานหรือยัง) */
export function chromePresetsAreFull(count: number): boolean {
  return count >= MAX_CHROME_PRESETS_PER_KIND;
}

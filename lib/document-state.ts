/**
 * สถานะชั่วคราวที่สคริปต์ก่อน paint ติดไว้บน `<html>`
 *
 * ⚠️ ทำไมต้องมี: `app/[lang]/layout.tsx` เป็น root layout ที่ผูกกับ dynamic param `[lang]`
 * ⇒ การสลับภาษา (เช่น `/th` → `/en`) ทำให้ Next เปลี่ยนโครง `<html>` ใหม่
 * และ attribute ที่สคริปต์ก่อน paint เพิ่มไว้ (คุกกี้ · ประกาศไว้อาลัย · การ์ด hero · reveal)
 * หายไปพร้อม document element เดิม
 *
 * ผลที่ผู้ใช้เห็นจริง (รอบ 335): กดยอมรับคุกกี้แล้วสลับภาษา → แถบคุกกี้กลับมาให้กดซ้ำ
 * ทั้งที่ localStorage ยังบอกว่าตอบแล้ว
 *
 * ไฟล์นี้เก็บ "รายการ attribute ที่ต้องกู้คืน" และฟังก์ชันอ่าน/เขียนแบบ pure
 * ส่วนตัวเฝ้าและกู้คืนจริงอยู่ที่ `features/shell/ui/document-state-sync.tsx`
 */

import { COOKIE_CONSENT_ATTRIBUTE } from "@/lib/cookie-consent";
import { HERO_CARD_ATTRIBUTE } from "@/lib/hero-card";
import { MOURNING_ATTRIBUTE } from "@/lib/mourning-notice";
import { REVEAL_ATTRIBUTE } from "@/lib/scroll-reveal";

/**
 * attribute ทั้งหมดที่ต้องคงอยู่ข้ามการนำทางฝั่ง client
 *
 * ⚠️ ห้ามใส่ `data-preview-chrome` / `data-preview-parts` ที่นี่
 * เพราะสองตัวนั้นเป็นของ "หน้าพรีวิว" และขึ้นกับ URL ปัจจุบัน ไม่ใช่สถานะผู้ใช้ระยะยาว
 */
export const DOCUMENT_STATE_ATTRIBUTES = [
  COOKIE_CONSENT_ATTRIBUTE,
  HERO_CARD_ATTRIBUTE,
  MOURNING_ATTRIBUTE,
  REVEAL_ATTRIBUTE,
] as const;

/** ค่าของ attribute — `null` = ไม่มี attribute นี้ (ต้องลบออก) */
export type DocumentState = Readonly<Record<string, string | null>>;

type AttributeReader = {
  readonly getAttribute: (name: string) => string | null;
};

type AttributeWriter = {
  readonly setAttribute: (name: string, value: string) => void;
  readonly removeAttribute: (name: string) => void;
};

/** อ่านค่าปัจจุบันของ attribute ทั้งชุด (ค่าที่ไม่มี = `null`) */
export function readDocumentState(root: AttributeReader): DocumentState {
  const state: Record<string, string | null> = {};
  for (const attribute of DOCUMENT_STATE_ATTRIBUTES) {
    state[attribute] = root.getAttribute(attribute);
  }
  return state;
}

/**
 * เขียนค่ากลับลง `<html>` ตาม snapshot
 *
 * - มีค่า → `setAttribute`
 * - เป็น `null` → `removeAttribute`
 * - คีย์ที่หายไปจาก snapshot → ถือว่าไม่มีค่า (ลบทิ้ง) เพื่อไม่ให้ค่าค้างจากรอบก่อน
 */
export function applyDocumentState(root: AttributeWriter, state: DocumentState): void {
  for (const attribute of DOCUMENT_STATE_ATTRIBUTES) {
    const value = state[attribute] ?? null;
    if (value === null) {
      root.removeAttribute(attribute);
    } else {
      root.setAttribute(attribute, value);
    }
  }
}

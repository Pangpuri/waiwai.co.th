import { buildAboutTemplate } from "@/lib/blocks/about-template";
import { buildCareersTemplate } from "@/lib/blocks/careers-template";
import { buildContactTemplate } from "@/lib/blocks/contact-template";
import { buildHomeTemplate } from "@/lib/blocks/home-template";
import type { BlockDocument } from "@/lib/blocks/types";

/**
 * ทะเบียนเทมเพลตบล็อกของแต่ละหน้า (S2) — **แหล่งความจริงเดียว**
 *
 * ทำไมต้องมีทะเบียน
 * - ก่อนหน้านี้มีเทมเพลตแค่ `buildHomeTemplate()` และปุ่ม "เริ่มจากเทมเพลต" ทำงานได้กับ `home` เท่านั้น
 *   (หน้าอื่นกดแล้วเด้งกลับ) ⇒ เพิ่มหน้าใหม่ทีต้องแก้ 3 ที่ (ปุ่ม · พรีวิว · ลิงก์พรีวิว)
 * - ตอนนี้ทุกอย่างอ่านจากที่นี่: ปุ่มในหลังบ้าน · รายการหน้าที่พรีวิวได้ · ตัวเลือกในหน้าลิงก์พรีวิว
 *
 * กติกา
 * - เทมเพลตทุกตัว **ต้องผ่าน parser + validator** (มีเทสต์บังคับ — `scripts/test-templates.ts`)
 * - `page` ในเอกสารต้องตรงกับ id ของหน้าที่ขอ (กันเทมเพลตสลับหน้า)
 * - หน้าที่ไม่มีเทมเพลต = ยังใช้เลย์เอาต์ที่ออกแบบไว้ + หน้าจอเนื้อหาแบบฟิลด์เดิม (ไม่ใช่ข้อผิดพลาด)
 */

export const BLOCK_TEMPLATE_PAGE_IDS = ["home", "about", "careers", "contact"] as const;

export type BlockTemplatePageId = (typeof BLOCK_TEMPLATE_PAGE_IDS)[number];

const TEMPLATE_BUILDERS: Readonly<Record<BlockTemplatePageId, () => BlockDocument>> = {
  home: buildHomeTemplate,
  about: buildAboutTemplate,
  careers: buildCareersTemplate,
  contact: buildContactTemplate,
};

/** หน้านี้มีเทมเพลตบล็อกให้เริ่มได้ไหม */
export function hasBlockTemplate(page: string): page is BlockTemplatePageId {
  return (BLOCK_TEMPLATE_PAGE_IDS as readonly string[]).includes(page);
}

/**
 * สร้างเทมเพลตของหน้านั้น (คืน `null` ถ้ายังไม่มีเทมเพลต)
 * ⚠️ เอกสารที่ได้ยัง **ไม่ผ่านการ parse** — ผู้เรียกต้องส่งเข้า `parseBlockDocument` ก่อนเขียนลงฐานข้อมูล
 */
export function buildBlockTemplate(page: string): BlockDocument | null {
  if (!hasBlockTemplate(page)) return null;
  return TEMPLATE_BUILDERS[page]();
}

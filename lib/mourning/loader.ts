import { cache } from "react";

import {
  MOURNING_PAGE_KEY,
  defaultMourningConfig,
  mourningErrorsOf,
  parseMourningConfig,
  validateMourningConfig,
  type MourningConfig,
} from "@/lib/mourning/config";
import { loadDocumentRow } from "@/lib/blocks/repository";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import { MOURNING_IMAGES, type MourningNoticeImage } from "@/features/shell/mourning";

/**
 * โหลดค่าป๊อปอัพไว้อาลัย "ฉบับที่เผยแพร่" มาใช้กับหน้าเว็บ
 *
 * หลักการที่สำคัญที่สุด: **ห้ามทำให้หน้าเว็บพังเพราะฐานข้อมูล**
 * - ยังไม่ตั้งค่า `DATABASE_URL` (เช่น เดโมบน Vercel) → ใช้ค่าเริ่มต้นในโค้ด/พจนานุกรมเหมือนเดิมเป๊ะ
 * - อ่านแล้วข้อมูลไม่ผ่านการตรวจ → ใช้ค่าเริ่มต้น
 * - อ่านไม่สำเร็จ (ฐานข้อมูลล่ม/ตารางหาย) → ใช้ค่าเริ่มต้น
 * ⇒ เว็บทำงานได้เสมอ และค่อยเปลี่ยนตามหลังบ้านเมื่อทุกอย่างพร้อม
 *
 * หมายเหตุการเรนเดอร์: หน้านี้ถูก prerender ตอน build (มติ D1) ⇒ การอ่านฐานข้อมูลเกิดตอน build
 *   บนเซิร์ฟเวอร์จริงที่รันคู่กับฐานข้อมูล ⇒ build อ่านค่าได้ · บนเดโมที่ไม่มีฐานข้อมูล ⇒ ได้ค่าเริ่มต้น
 */

export type MourningNoticeData = {
  readonly enabled: boolean;
  readonly images: readonly MourningNoticeImage[];
  readonly caption: string;
  readonly closeLabel: string;
  readonly muteTodayLabel: string;
  readonly seeNextLabel: string;
};

function toNoticeImages(config: MourningConfig, locale: Locale): readonly MourningNoticeImage[] {
  return config.images.map((image, index) => ({
    id: `mourning-${index + 1}`,
    src: image.path,
    alt: locale === "en" && image.altEn.trim() !== "" ? image.altEn : image.altTh,
    /* ไม่รู้ขนาดจริง (ภาพที่อัปโหลดใหม่) → ใช้ 3:1 เท่าภาพชุดเดิม เพื่อไม่ให้กรอบกระตุก */
    width: image.width ?? 3000,
    height: image.height ?? 1000,
  }));
}

export const loadMourningNotice = cache(async (locale: Locale): Promise<MourningNoticeData> => {
  const messages = await getMessagesFor(locale);
  const fallback = defaultMourningConfig(messages);

  const toData = (config: MourningConfig): MourningNoticeData => ({
    enabled: config.enabled,
    images: toNoticeImages(config, locale),
    /* ว่าง = ไม่มีคำบรรยาย (โหมด "ใช้รูปเป็นตัวประกาศ") — ห้ามดึงข้อความพจนานุกรมมาแทน */
    caption: locale === "en" && config.caption.en.trim() !== "" ? config.caption.en : config.caption.th,
    closeLabel: config.closeLabel.th,
    muteTodayLabel: config.muteTodayLabel.th,
    seeNextLabel: config.seeNextLabel.th,
  });

  if (!isDatabaseConfigured()) return toData(fallback);

  try {
    const row = await loadDocumentRow(MOURNING_PAGE_KEY, "published");
    if (row === null) return toData(fallback);

    const parsed = parseMourningConfig(row.raw, messages);
    if (!parsed.ok) return toData(fallback);
    if (mourningErrorsOf(validateMourningConfig(parsed.config)).length > 0) return toData(fallback);

    return toData(parsed.config);
  } catch {
    return toData(fallback);
  }
});

/** จำนวนภาพชุดเริ่มต้น (ใช้ในเทสต์/เอกสาร) */
export const DEFAULT_MOURNING_IMAGE_COUNT = MOURNING_IMAGES.length;

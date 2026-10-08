import { campaignCardImage, type Campaign, type CampaignCardImage } from "@/lib/campaigns/model";

/**
 * มุมมอง "การ์ดแคมเปญ" ที่พร้อมเรนเดอร์ (รอบที่ 198)
 *
 * ทำไมต้องมีไฟล์นี้
 * - ตั้งแต่รอบที่ 198 การ์ดใบเดียวแสดงได้ **หลายหน้า** (หน้าแรก + หน้าข่าวสาร)
 *   ⇒ ถ้าต่างหน้าต่างแปลงข้อความ/เลือกภาพเอง หน้าตาจะเพี้ยนจากกันแบบเงียบ ๆ
 * - เป็น **ตรรกะล้วน** (ไม่แตะ DB/React) ⇒ ทดสอบได้ด้วย `node --test` ว่ากติกาภาษา/ภาพตรงกันทุกหน้า
 *
 * กติกาเดียวกับทั้งโปรเจกต์: ไทยเป็นหลัก · EN ว่าง ⇒ **ถอยไปใช้ไทย** · ไม่มีภาพ ⇒ ไม่มีคีย์ `image`
 */
export type CampaignCardView = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly ctaHref: string;
  /** จุดยึด (เปอร์เซ็นต์ของพื้นที่ของหน้านั้น) */
  readonly anchorX: number;
  readonly anchorY: number;
  /** ไม่มีคีย์ = ไม่มีภาพ ⇒ ตัวเรนเดอร์ไม่สร้างองค์ประกอบภาพเลย (ห้ามปล่อย `src` ว่าง) */
  readonly image?: CampaignCardImage;
};

/** ข้อความตามภาษา: ใช้ EN ก็ต่อเมื่อมีจริง — ไม่งั้นถอยไทย (มติเดิมของโปรเจกต์) */
function textOf(value: { readonly th: string; readonly en: string }, language: "th" | "en"): string {
  return language === "en" && value.en.trim() !== "" ? value.en : value.th;
}

export function campaignCardView(
  campaign: Campaign,
  language: "th" | "en",
  anchor: { readonly x: number; readonly y: number },
): CampaignCardView {
  const title = textOf(campaign.title, language);
  /* ภาพ: ตัดสินที่ `campaignCardImage()` จุดเดียว — พาธว่าง = ไม่มีภาพ */
  const image = campaignCardImage(campaign, language, title);

  return {
    id: campaign.id,
    title,
    body: textOf(campaign.body, language),
    ctaLabel: textOf(campaign.ctaLabel, language),
    ctaHref: campaign.ctaHref,
    anchorX: anchor.x,
    anchorY: anchor.y,
    ...(image === null ? {} : { image }),
  };
}

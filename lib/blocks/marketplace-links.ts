import { blocks as blocksEn } from "@/lib/i18n/messages/areas/en/blocks";
import { blocks as blocksTh } from "@/lib/i18n/messages/areas/th/blocks";
import { whereToBuy as whereToBuyEn } from "@/lib/i18n/messages/areas/en/home";
import { whereToBuy as whereToBuyTh } from "@/lib/i18n/messages/areas/th/home";
import { SITE } from "@/lib/site";
import type { Language } from "@/lib/content/home-section";

/**
 * ชั้นข้อมูล + ตรรกะของ **บล็อก "ที่ซื้อสินค้า"** — รอบที่ 229 (เคลียร์หนี้ "แก้ได้สองที่" ให้จบ)
 *
 * เจ้าของเลือก "ก" = ให้ส่วนนี้มีเจ้าของเดียว · รอบ 228 ถอดบล็อกเดิมออกเพราะซ้ำกับหน้าจอเนื้อหา
 * รอบนี้ทำ **บล็อกไดนามิกของจริง** (ลิงก์ร้านมาจาก `SITE` = แหล่งความจริงเดียว + ป้ายจากพจนานุกรม)
 * ⇒ ย้ายเจ้าของมาเป็นตัวสร้างหน้าเว็บได้ โดย **ข้อมูลร้านไม่ต้องคีย์ซ้ำ**
 *
 * ⚠️ ไม่แตะฐานข้อมูล (ไม่ต้องมี loader) — ข้อมูลร้านเป็นค่าคงที่ของโปรเจกต์ (มติเดิม: ลิงก์จริงเท่านั้น)
 *
 * ## "สัญญากับดีไซน์เดิม" 2 ข้อ (รอบที่ 244 — 🐞 เคสจริงจากเจ้าของ)
 * ตอนที่หน้าแรกหันมาเรนเดอร์ **บล็อก** (รอบที่ 241) บล็อกนี้ทำ 2 อย่างของดีไซน์เดิมหลุดไป
 * 1. **anchor ปลายทางของปุ่มบนหัวเว็บ** — เดิมส่วนนี้มี `id="where-to-buy"` และ `HEADER_CTA.anchor` ชี้มาที่นี่
 *    ⇒ พอบล็อกไม่มี id นี้ ปุ่ม "สั่งซื้อสินค้าออนไลน์" บนหัวเว็บ **กดแล้วไม่ไปไหนเลย**
 * 2. **กรอบเหลืองของแบรนด์** — เดิมเป็นการ์ด `bg-brand-yellow` + `text-accent-on-yellow`
 *    ⇒ ของใหม่เหลือแค่ปุ่มลอยบนพื้นจาง ๆ ⇒ เจ้าของทักว่า "กรอบสีเหลืองหายไป"
 * ⇒ ค่าคงที่นี้เป็น **แหล่งความจริงเดียว** ของชื่อ anchor (ใช้ทั้ง nav · บล็อก · เลย์เอาต์โค้ด)
 */
export const WHERE_TO_BUY_ANCHOR = "where-to-buy";

export type MarketplaceLinkView = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
};

export type MarketplaceLinksView = {
  readonly items: readonly MarketplaceLinkView[];
  /** หมายเหตุร้านค้าปลีก (ท้ายส่วน) */
  readonly retailNote: string;
  /** ข้อความสำหรับ screen reader ของลิงก์ที่เปิดแท็บใหม่ */
  readonly newTabLabel: string;
  readonly isEmpty: boolean;
};

export function marketplaceLinksView(language: Language): MarketplaceLinksView {
  const labels = (language === "en" ? whereToBuyEn.marketplaces : whereToBuyTh.marketplaces) as Readonly<Record<string, string>>;
  const items: readonly MarketplaceLinkView[] = SITE.marketplaces.map((marketplace) => ({
    id: marketplace.id,
    label: labels[marketplace.id] ?? marketplace.id,
    href: marketplace.href,
  }));
  return {
    items,
    retailNote: language === "en" ? whereToBuyEn.retailNote : whereToBuyTh.retailNote,
    newTabLabel: language === "en" ? blocksEn.marketplaceOpenInNewTab : blocksTh.marketplaceOpenInNewTab,
    isEmpty: items.length === 0,
  };
}

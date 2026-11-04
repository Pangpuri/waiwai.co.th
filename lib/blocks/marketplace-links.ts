import { blocks as blocksEn } from "@/lib/i18n/messages/areas/en/blocks";
import { blocks as blocksTh } from "@/lib/i18n/messages/areas/th/blocks";
import { whereToBuy as whereToBuyEn } from "@/lib/i18n/messages/areas/en/home";
import { whereToBuy as whereToBuyTh } from "@/lib/i18n/messages/areas/th/home";
import { SITE } from "@/lib/site";
import type { MarketplaceLinkItem, MarketplaceLinksBlock } from "@/lib/blocks/types";
import type { Language } from "@/lib/content/home-section";
import type { LocalizedValue } from "@/lib/content/types";

/**
 * ชั้นข้อมูล + ตรรกะของ **บล็อก "ที่ซื้อสินค้า"** — รอบที่ 229 · รอบ 329
 *
 * รอบ 229: ย้ายเจ้าของมาเป็นตัวสร้างหน้าเว็บ โดยลิงก์ร้านมาจาก `SITE.marketplaces` (แหล่งความจริงเดียว)
 * รอบ 329 (คำเจ้าของ): *"ส่วนตั้งค่าบล็อคที่ 4 ที่ซื้อสินค้า ... มันควรอยู่ด้วยกัน เพราะเป็นปุ่มลิงค์ของส่วนนี้"*
 * ⇒ เพิ่ม `eyebrow` / `retailNote` / `items` ในบล็อก ⇒ แก้ข้อความ **และปุ่มลิงก์** ได้จากแผงบล็อกเดียว
 *
 * กติกาค่าเริ่มต้น (ไม่ทำให้ข้อมูลเก่า/หน้าเดิมเปลี่ยน):
 * - `items` ว่าง = ใช้รายการจาก `SITE.marketplaces` + ป้ายจากพจนานุกรม (พฤติกรรมเดิมเป๊ะ)
 * - `retailNote` ว่าง = ใช้ข้อความจากพจนานุกรม
 * - รายการที่ไม่มีชื่อหรือไม่มีลิงก์ = **ข้าม** (ไม่เรนเดอร์ปุ่มที่พาไปที่ว่าง)
 *
 * ## "สัญญากับดีไซน์เดิม" 2 ข้อ (รอบที่ 244 — 🐞 เคสจริงจากเจ้าของ)
 * 1. **anchor ปลายทางของปุ่มบนหัวเว็บ** — `id="where-to-buy"` + `HEADER_CTA.anchor` ชี้มาที่นี่
 * 2. **กรอบเหลืองของแบรนด์** — การ์ด `bg-brand-yellow` + `text-accent-on-yellow`
 * ⇒ ค่าคงที่นี้เป็น **แหล่งความจริงเดียว** ของชื่อ anchor (ใช้ทั้ง nav · บล็อก · เลย์เอาต์โค้ด)
 */
export const WHERE_TO_BUY_ANCHOR = "where-to-buy";

export type MarketplaceLinkView = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
};

export type MarketplaceLinksView = {
  /** ข้อความเล็กเหนือหัวข้อ (ว่าง = ไม่แสดง) */
  readonly eyebrow: string;
  readonly items: readonly MarketplaceLinkView[];
  /** หมายเหตุร้านค้าปลีก (ท้ายส่วน) */
  readonly retailNote: string;
  /** ข้อความสำหรับ screen reader ของลิงก์ที่เปิดแท็บใหม่ */
  readonly newTabLabel: string;
  readonly isEmpty: boolean;
};

function pick(value: LocalizedValue, language: Language): string {
  return language === "en" && value.en.trim() !== "" ? value.en : value.th;
}

/**
 * รายการเริ่มต้น (Shopee · Lazada · LINE Shop) ในรูป "รายการที่แก้ได้"
 * - ใช้เมื่อเจ้าของกด "ใช้รายการเริ่มต้น" ในแผงบล็อก ⇒ ได้ชื่อ/ลิงก์มาแก้ทีละปุ่ม
 * - เป็นชุดเดียวกับ fallback ของ `marketplaceLinksView` (ไม่ต้องคีย์ซ้ำ)
 */
export function defaultMarketplaceItems(): readonly MarketplaceLinkItem[] {
  const thLabels = whereToBuyTh.marketplaces as Readonly<Record<string, string>>;
  const enLabels = whereToBuyEn.marketplaces as Readonly<Record<string, string>>;
  return SITE.marketplaces.map((marketplace) => ({
    id: marketplace.id,
    label: {
      th: thLabels[marketplace.id] ?? marketplace.id,
      en: enLabels[marketplace.id] ?? marketplace.id,
    },
    href: marketplace.href,
  }));
}

export function marketplaceLinksView(block: MarketplaceLinksBlock, language: Language): MarketplaceLinksView {
  /* รายการที่แก้ในบล็อก — ใช้เมื่อมีอย่างน้อย 1 รายการที่ "มีชื่อ + มีลิงก์" จริง */
  const customItems: readonly MarketplaceLinkView[] = block.items
    .map((item) => ({
      id: item.id,
      label: pick(item.label, language).trim(),
      href: item.href.trim(),
    }))
    .filter((item) => item.label !== "" && item.href !== "");

  const items: readonly MarketplaceLinkView[] =
    customItems.length > 0
      ? customItems
      : defaultMarketplaceItems().map((item) => ({
          id: item.id,
          label: pick(item.label, language),
          href: item.href,
        }));

  const retailNote = pick(block.retailNote, language).trim();

  return {
    eyebrow: pick(block.eyebrow, language).trim(),
    items,
    retailNote: retailNote === "" ? (language === "en" ? whereToBuyEn.retailNote : whereToBuyTh.retailNote) : retailNote,
    newTabLabel: language === "en" ? blocksEn.marketplaceOpenInNewTab : blocksTh.marketplaceOpenInNewTab,
    isEmpty: items.length === 0,
  };
}

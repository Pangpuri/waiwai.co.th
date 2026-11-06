import { blocks as blocksEn } from "@/lib/i18n/messages/areas/en/blocks";
import { blocks as blocksTh } from "@/lib/i18n/messages/areas/th/blocks";
import { whereToBuy as whereToBuyEn } from "@/lib/i18n/messages/areas/en/home";
import { whereToBuy as whereToBuyTh } from "@/lib/i18n/messages/areas/th/home";
import { SITE } from "@/lib/site";
import type {
  BlockMedia,
  MarketplaceBrand,
  MarketplaceLinkItem,
  MarketplaceLinksBlock,
} from "@/lib/blocks/types";
import type { Language } from "@/lib/content/home-section";
import type { LocalizedValue } from "@/lib/content/types";

/**
 * ชั้นข้อมูล + ตรรกะของ **บล็อก "ที่ซื้อสินค้า"** — รอบที่ 229 · รอบ 329 · รอบ 333
 *
 * รอบ 229: ย้ายเจ้าของมาเป็นตัวสร้างหน้าเว็บ โดยลิงก์ร้านมาจาก `SITE.marketplaces` (แหล่งความจริงเดียว)
 * รอบ 329 (คำเจ้าของ): *"ส่วนตั้งค่าบล็อคที่ 4 ที่ซื้อสินค้า ... มันควรอยู่ด้วยกัน เพราะเป็นปุ่มลิงค์ของส่วนนี้"*
 * ⇒ เพิ่ม `eyebrow` / `retailNote` / `items` ในบล็อก ⇒ แก้ข้อความ **และปุ่มลิงก์** ได้จากแผงบล็อกเดียว
 * รอบ 333 (คำเจ้าของ): เปลี่ยนปุ่มเป็น **โลโก้ร้าน** · Shopee/Lazada แยก 2 ร้าน (Waiwai · Serda)
 * ⇒ มีข้อความใต้ปุ่มและจุดสีแบรนด์ · LINE Shop ถูกถอด · รวม 7 ปุ่มจาก 5 แพลตฟอร์ม
 *
 * กติกาค่าเริ่มต้น (ไม่ทำให้ข้อมูลเก่า/หน้าเดิมเปลี่ยน):
 * - `items` ว่าง = ใช้รายการจาก `SITE.marketplaces` + ป้ายจากพจนานุกรม (พฤติกรรมเดิมเป๊ะ)
 * - `retailNote` ว่าง = ใช้ข้อความจากพจนานุกรม
 * - รายการที่ไม่มีชื่อหรือไม่มีลิงก์ = **ข้าม** (ไม่เรนเดอร์ปุ่มที่พาไปที่ว่าง)
 * - รายการเก่าที่ไม่มี `logo`/`brand` = ยังแสดงได้ (ถอยไปเป็นปุ่มข้อความ)
 *
 * ## "สัญญากับดีไซน์เดิม" 2 ข้อ (รอบที่ 244 — 🐞 เคสจริงจากเจ้าของ)
 * 1. **anchor ปลายทางของปุ่มบนหัวเว็บ** — `id="where-to-buy"` + `HEADER_CTA.anchor` ชี้มาที่นี่
 * 2. **กรอบเหลืองของแบรนด์** — การ์ด `bg-brand-yellow` + `text-accent-on-yellow`
 * ⇒ ค่าคงที่นี้เป็น **แหล่งความจริงเดียว** ของชื่อ anchor (ใช้ทั้ง nav · บล็อก · เลย์เอาต์โค้ด)
 */
export const WHERE_TO_BUY_ANCHOR = "where-to-buy";

/** ภาพหนึ่งใบในปุ่มร้าน — `path` เป็นพาธในโปรเจกต์/`/media/<id>` (มติ D9) */
export type MarketplaceMediaView = {
  readonly path: string;
  readonly alt: string;
};

export type MarketplaceLinkView = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  /** โลโก้แพลตฟอร์ม (null = แสดงเป็นปุ่มข้อความ) */
  readonly logo: MarketplaceMediaView | null;
  /** แบรนด์ของรายการ (null = ไม่มีจุดสีแบรนด์) */
  readonly brand: MarketplaceBrand | null;
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

/** เลือกคำอธิบายภาพตามภาษา — ว่าง = ถอยไปใช้ข้อความของปุ่ม (ไม่ปล่อย alt ว่าง) */
function pickMedia(media: BlockMedia | null, language: Language, fallbackAlt: string): MarketplaceMediaView | null {
  if (media === null) return null;
  const path = media.path.trim();
  if (path === "") return null;

  const preferred = language === "en" && media.altEn.trim() !== "" ? media.altEn : media.altTh;
  return { path, alt: preferred.trim() === "" ? fallbackAlt : preferred.trim() };
}

/**
 * รายการเริ่มต้น (7 ปุ่มจาก 5 แพลตฟอร์ม) ในรูป "รายการที่แก้ได้"
 * - Shopee/Lazada มี 2 ร้าน (Waiwai · Serda) ⇒ ข้อความใต้ปุ่ม + จุดสีแบรนด์ช่วยแยกให้ชัด
 * - ใช้เมื่อเจ้าของกด "ใช้รายการเริ่มต้น" ในแผงบล็อก ⇒ ได้ชื่อ/ลิงก์/โลโก้มาแก้ทีละปุ่ม
 * - เป็นชุดเดียวกับ fallback ของ `marketplaceLinksView` (ไม่ต้องคีย์ซ้ำ)
 */
export function defaultMarketplaceItems(): readonly MarketplaceLinkItem[] {
  const thLabels = whereToBuyTh.marketplaces as Readonly<Record<string, string>>;
  const enLabels = whereToBuyEn.marketplaces as Readonly<Record<string, string>>;
  const thPlatforms = whereToBuyTh.platforms as Readonly<Record<string, string>>;
  const enPlatforms = whereToBuyEn.platforms as Readonly<Record<string, string>>;

  return SITE.marketplaces.map((marketplace) => {
    const labelTh = thLabels[marketplace.id] ?? marketplace.id;
    const labelEn = enLabels[marketplace.id] ?? marketplace.id;
    return {
      id: marketplace.id,
      label: { th: labelTh, en: labelEn },
      href: marketplace.href,
      logo: {
        path: marketplace.logo,
        altTh: thPlatforms[marketplace.platform] ?? marketplace.platform,
        altEn: enPlatforms[marketplace.platform] ?? marketplace.platform,
        hasWatermark: false,
      },
      brand: marketplace.brand,
    };
  });
}

export function marketplaceLinksView(block: MarketplaceLinksBlock, language: Language): MarketplaceLinksView {
  /* รายการที่แก้ในบล็อก — ใช้เมื่อมีอย่างน้อย 1 รายการที่ "มีชื่อ + มีลิงก์" จริง */
  const customItems: readonly MarketplaceLinkView[] = block.items
    .map((item) => {
      const label = pick(item.label, language).trim();
      return {
        id: item.id,
        label,
        href: item.href.trim(),
        logo: pickMedia(item.logo, language, label),
        brand: item.brand,
      };
    })
    .filter((item) => item.label !== "" && item.href !== "");

  const items: readonly MarketplaceLinkView[] =
    customItems.length > 0
      ? customItems
      : defaultMarketplaceItems().map((item) => {
          const label = pick(item.label, language);
          return {
            id: item.id,
            label,
            href: item.href,
            logo: pickMedia(item.logo, language, label),
            brand: item.brand,
          };
        });

  const retailNote = pick(block.retailNote, language).trim();

  return {
    eyebrow: pick(block.eyebrow, language).trim(),
    items,
    retailNote: retailNote === "" ? (language === "en" ? whereToBuyEn.retailNote : whereToBuyTh.retailNote) : retailNote,
    newTabLabel: language === "en" ? blocksEn.marketplaceOpenInNewTab : blocksTh.marketplaceOpenInNewTab,
    isEmpty: items.length === 0,
  };
}

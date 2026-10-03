import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { BLOCK_SCHEMA_VERSION, DEFAULT_BLOCK_STYLE, type Block, type BlockCard, type BlockDocument } from "@/lib/blocks/types";

/**
 * เทมเพลตตั้งต้นของหน้าแรก (ใช้ตอนกด "เริ่มจากเนื้อหาปัจจุบัน")
 *
 * ที่มา: ข้อความชุดเดียวกับหน้าเว็บที่ใช้งานอยู่ (พจนานุกรม TH/EN) ⇒ การตลาดเปิดมาแล้วเห็นของจริงทันที
 * ไม่ต้องเริ่มจากหน้าว่าง และไม่ต้องคัดลอกข้อความด้วยมือ
 *
 * ⚠️ ตั้งใจทำเป็น "จุดเริ่มต้น" เท่านั้น — ยังไม่ครบทุกส่วนของหน้าแรกเดิม (ส่วนที่เหลือเพิ่มด้วยปุ่ม "เพิ่มบล็อก")
 */

function style(overrides: Partial<typeof DEFAULT_BLOCK_STYLE> = {}): typeof DEFAULT_BLOCK_STYLE {
  return { ...DEFAULT_BLOCK_STYLE, ...overrides };
}

type DictCard = { readonly name: string; readonly description: string };

/** จับคู่การ์ด TH/EN ด้วย "คีย์เดียวกัน" (ไม่ใช่ลำดับ) — ถ้าคำแปลหาย การ์ดไทยยังอยู่ครบ */
function cardsFrom(
  thMap: Readonly<Record<string, DictCard>>,
  enMap: Readonly<Record<string, DictCard>>,
): readonly BlockCard[] {
  return Object.entries(thMap).map(([key, item]) => ({
    title: { th: item.name, en: enMap[key]?.name ?? "" },
    body: { th: item.description, en: enMap[key]?.description ?? "" },
    href: "",
    image: null,
  }));
}

export function buildHomeTemplate(): BlockDocument {
  const blocks: Block[] = [
    {
      id: "block-1",
      version: BLOCK_SCHEMA_VERSION,
      type: "hero",
      style: style({ size: "lg", width: "full", align: "left" }),
      title: { th: th.hero.title, en: en.hero.title },
      subtitle: { th: th.hero.body, en: en.hero.body },
      note: { th: th.hero.note, en: en.hero.note },
      image: null,
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    },
    {
      id: "block-2",
      version: BLOCK_SCHEMA_VERSION,
      type: "richText",
      style: style({ background: "cream" }),
      heading: { th: th.products.title, en: en.products.title },
      body: { th: th.products.body, en: en.products.body },
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    },
    {
      id: "block-3",
      version: BLOCK_SCHEMA_VERSION,
      type: "cards",
      style: style(),
      heading: { th: th.products.categoriesTitle, en: en.products.categoriesTitle },
      body: { th: "", en: "" },
      columns: 3,
      items: cardsFrom(th.products.categories, en.products.categories),
    },
    {
      id: "block-4",
      version: BLOCK_SCHEMA_VERSION,
      type: "cards",
      style: style({ background: "subtle" }),
      heading: { th: th.recipes.title, en: en.recipes.title },
      body: { th: th.recipes.body, en: en.recipes.body },
      columns: 3,
      items: cardsFrom(th.recipes.items, en.recipes.items),
    },
    {
      id: "block-5",
      version: BLOCK_SCHEMA_VERSION,
      type: "cta",
      style: style(),
      heading: { th: th.newsletter.title, en: en.newsletter.title },
      body: { th: th.newsletter.body, en: en.newsletter.body },
      label: { th: th.newsletter.eyebrow, en: en.newsletter.eyebrow },
      href: "/contact",
      tone: "brand",
    },
  ];

  return { page: "home", blocks };
}

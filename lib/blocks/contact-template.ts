import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateStyle, templateValueCards } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument } from "@/lib/blocks/types";

/**
 * เทมเพลตตั้งต้นของหน้า "ติดต่อเรา" (/contact) — S2
 *
 * ที่มา: ข้อความชุดเดียวกับหน้าที่ใช้งานอยู่ (พจนานุกรม TH/EN) — ที่อยู่จริงจากพจนานุกรม (ไม่แต่งขึ้นเอง)
 *
 * ⚠️ **แบบฟอร์มติดต่อไม่ใช่บล็อก** — ฟอร์มเป็นคอมโพเนนต์ที่ผูกกับ Server Action/ความยินยอม PDPA
 *    ⇒ เทมเพลตนี้ให้ "ทางติดต่อ + ที่ตั้งโรงงาน" ส่วนฟอร์มยังใช้หน้าจอเดิม (และเข้าถึงได้เสมอเมื่อปิดสวิตช์เวอร์ชันบล็อก)
 */
export function buildContactTemplate(): BlockDocument {
  const contact = th.contactPage;
  const contactEn = en.contactPage;

  const plants = [
    { label: contact.plant1, value: contact.plant1Address },
    { label: contact.plant2, value: contact.plant2Address },
  ];
  const plantsEn = [
    { label: contactEn.plant1, value: contactEn.plant1Address },
    { label: contactEn.plant2, value: contactEn.plant2Address },
  ];

  const blocks: Block[] = [
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      style: templateStyle({ size: "lg", align: "left" }),
      title: { th: contact.title, en: contactEn.title },
      subtitle: { th: contact.intro, en: contactEn.intro },
      note: { th: "", en: "" },
      image: null,
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    },
    {
      id: templateBlockId(1),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle({ background: "cream" }),
      heading: { th: contact.channelsTitle, en: contactEn.channelsTitle },
      body: { th: contact.note, en: contactEn.note },
      columns: 2,
      items: templateValueCards(plants, plantsEn),
    },
    {
      id: templateBlockId(2),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cta",
      style: templateStyle(),
      heading: { th: contact.formTitle, en: contactEn.formTitle },
      body: { th: contact.formIntro, en: contactEn.formIntro },
      label: { th: contact.submit, en: contactEn.submit },
      href: "/contact",
      tone: "brand",
    },
  ];

  return { page: "contact", blocks };
}

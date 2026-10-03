import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateMedia, templateStyle, templateValueCards } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument } from "@/lib/blocks/types";

import { MAP_IMAGE } from "@/features/contact/content";

/**
 * เทมเพลตตั้งต้นของหน้า "ติดต่อเรา" (/contact) — S2
 *
 * ที่มา: ข้อความชุดเดียวกับหน้าที่ใช้งานอยู่ (พจนานุกรม TH/EN) — ที่อยู่จริงจากพจนานุกรม (ไม่แต่งขึ้นเอง)
 *
 * รอบที่ 87: ใช้ **ชนิดบล็อกใหม่** ⇒ ปิดช่อง "ส่วนที่ไม่ครอบคลุม" ของหน้านี้ครบ
 * - `form` (kind = contact) = ฟอร์มติดต่อจริง (Server Action + ยินยอม PDPA เดิมทั้งชุด)
 * - `map` = ภาพแผนที่ที่บริษัททำเอง + คำบรรยาย (ไม่ฝัง iframe/พิกัด — ยังไม่มีลิงก์แผนที่ออนไลน์ที่ยืนยันแล้ว)
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
      type: "form",
      style: templateStyle({ background: "subtle" }),
      kind: "contact",
      heading: { th: contact.formTitle, en: contactEn.formTitle },
      body: { th: contact.formIntro, en: contactEn.formIntro },
    },
    {
      id: templateBlockId(3),
      version: TEMPLATE_BLOCK_VERSION,
      type: "map",
      style: templateStyle(),
      heading: { th: contact.mapTitle, en: contactEn.mapTitle },
      caption: { th: contact.mapCaption, en: contactEn.mapCaption },
      image: templateMedia(MAP_IMAGE.src, contact.mapAlt, contactEn.mapAlt),
      linkHref: "",
      linkLabel: { th: "", en: "" },
    },
  ];

  return { page: "contact", blocks };
}

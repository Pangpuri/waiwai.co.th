import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateStyle, templateTextCards } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument } from "@/lib/blocks/types";

/**
 * เทมเพลตตั้งต้นของหน้า "ร่วมงานกับไวไว" (/careers) — S2
 *
 * ที่มา: ข้อความชุดเดียวกับหน้าที่ใช้งานอยู่ (พจนานุกรม TH/EN)
 *
 * ⚠️ **ตารางตำแหน่งงานไม่ใช่บล็อก** — ข้อมูลตำแหน่ง (ฝ่าย/คุณสมบัติ/อัตรา) มาจาก `lib/careers/*`
 *    ⇒ เทมเพลตนี้เป็น "ส่วนหัว + ฝ่ายที่เปิดรับ + ช่องทางสมัคร" ส่วนตารางงานยังต้องใช้หน้าจอเดิม
 *    (ถ้าต้องการตารางในหน้าเวอร์ชันบล็อก ต้องย้ายข้อมูลตำแหน่งมาเป็นบล็อกก่อน — ยังไม่ทำในรอบนี้)
 */
export function buildCareersTemplate(): BlockDocument {
  const careers = th.careersPage;
  const careersEn = en.careersPage;

  const blocks: Block[] = [
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      style: templateStyle({ size: "lg", align: "left" }),
      title: { th: careers.title, en: careersEn.title },
      subtitle: { th: careers.intro, en: careersEn.intro },
      note: { th: "", en: "" },
      image: null,
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    },
    {
      id: templateBlockId(1),
      version: TEMPLATE_BLOCK_VERSION,
      type: "richText",
      style: templateStyle({ background: "cream" }),
      heading: { th: careers.boardTitle, en: careersEn.boardTitle },
      body: { th: careers.boardIntro, en: careersEn.boardIntro },
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    },
    {
      id: templateBlockId(2),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle(),
      heading: { th: careers.filterGroup, en: careersEn.filterGroup },
      body: { th: "", en: "" },
      columns: 3,
      items: templateTextCards(careers.departments, careersEn.departments, 6),
    },
    {
      id: templateBlockId(3),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cta",
      style: templateStyle(),
      heading: { th: th.contactPage.formTitle, en: en.contactPage.formTitle },
      body: { th: th.contactPage.formIntro, en: en.contactPage.formIntro },
      label: { th: th.nav.contact, en: en.nav.contact },
      href: "/contact",
      tone: "brand",
    },
  ];

  return { page: "careers", blocks };
}

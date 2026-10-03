import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateCards, templateStyle, templateValueCards } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument } from "@/lib/blocks/types";

/**
 * เทมเพลตตั้งต้นของหน้า "เกี่ยวกับไวไว" (/about) — S2
 *
 * ที่มา: ข้อความชุดเดียวกับหน้าที่ใช้งานอยู่ (พจนานุกรม TH/EN) ⇒ เปิดมาแล้วเห็นของจริงทันที
 *
 * ⚠️ เป็น **จุดเริ่มต้น** ไม่ใช่สำเนาทั้งหน้า — ส่วนที่เป็นภาพ/แผนที่/ตารางข้อมูล (เช่น ทำเนียบผู้บริหาร)
 *    ยังอยู่ในเลย์เอาต์เดิม และเพิ่มด้วยปุ่ม "เพิ่มบล็อก" เมื่อต้องการ
 */
export function buildAboutTemplate(): BlockDocument {
  const about = th.about;
  const aboutEn = en.about;

  /* การ์ดข้อเท็จจริง: ใช้คู่ label/value ที่มี "ตัวเลข" จริงในพจนานุกรม (ไม่แต่งขึ้นเอง) */
  const facts = [
    { label: about.facts.area.label, value: about.facts.area.value },
    { label: about.facts.sites.label, value: about.facts.sites.value },
  ];
  const factsEn = [
    { label: aboutEn.facts.area.label, value: aboutEn.facts.area.value },
    { label: aboutEn.facts.sites.label, value: aboutEn.facts.sites.value },
  ];

  const facilityStats = [
    { label: about.facilities.stats.factory.label, value: about.facilities.stats.factory.value },
    { label: about.facilities.stats.dormitory.label, value: about.facilities.stats.dormitory.value },
    { label: about.facilities.stats.treatment.label, value: about.facilities.stats.treatment.value },
  ];
  const facilityStatsEn = [
    { label: aboutEn.facilities.stats.factory.label, value: aboutEn.facilities.stats.factory.value },
    { label: aboutEn.facilities.stats.dormitory.label, value: aboutEn.facilities.stats.dormitory.value },
    { label: aboutEn.facilities.stats.treatment.label, value: aboutEn.facilities.stats.treatment.value },
  ];

  const blocks: Block[] = [
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      style: templateStyle({ size: "lg", align: "left" }),
      title: { th: about.title, en: aboutEn.title },
      subtitle: { th: about.intro, en: aboutEn.intro },
      note: { th: about.note, en: aboutEn.note },
      image: null,
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    },
    {
      id: templateBlockId(1),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle({ background: "cream" }),
      heading: { th: about.story.title, en: aboutEn.story.title },
      body: { th: about.story.body, en: aboutEn.story.body },
      columns: 2,
      items: templateValueCards(facts, factsEn),
    },
    {
      id: templateBlockId(2),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle(),
      heading: { th: about.story.timelineTitle, en: aboutEn.story.timelineTitle },
      body: { th: about.story.timelineNote, en: aboutEn.story.timelineNote },
      columns: 4,
      items: templateCards(about.story.timeline, aboutEn.story.timeline),
    },
    {
      id: templateBlockId(3),
      version: TEMPLATE_BLOCK_VERSION,
      type: "richText",
      style: templateStyle({ background: "subtle" }),
      heading: { th: about.facilities.title, en: aboutEn.facilities.title },
      body: { th: about.facilities.body, en: aboutEn.facilities.body },
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    },
    {
      id: templateBlockId(4),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle(),
      heading: { th: about.facilities.statsTitle, en: aboutEn.facilities.statsTitle },
      body: { th: about.facilities.statsNote, en: aboutEn.facilities.statsNote },
      columns: 3,
      items: templateValueCards(facilityStats, facilityStatsEn),
    },
    {
      id: templateBlockId(5),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cta",
      style: templateStyle(),
      heading: { th: th.contactPage.title, en: en.contactPage.title },
      body: { th: th.contactPage.intro, en: en.contactPage.intro },
      label: { th: th.nav.contact, en: en.nav.contact },
      href: "/contact",
      tone: "brand",
    },
  ];

  return { page: "about", blocks };
}

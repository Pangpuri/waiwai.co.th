import { CONTACT_PHONES, CONTACT_PLANTS, MAP_IMAGE } from "@/features/contact/content";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateMedia, templateStyle } from "@/lib/blocks/template-kit";
import type { Block, BlockCard, BlockDocument } from "@/lib/blocks/types";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

/**
 * ประกอบ **เอกสารบล็อกของหน้า "ติดต่อเรา" (/contact)** จากเนื้อหาที่ใช้งานจริง — รอบที่ 267 · มติเจ้าของ D27
 *
 * คำเจ้าของ: *"หน้าติดต่อเรา ที่เมนู แก้ไขเนื้อหาหน้าติดต่อเรา เก็บของเก่าเป็นค่าเริ่มต้นใส่ db
 * ส่วนสองใหม่ปรับแต่งโยกย้าย จัดวางบล็อคได้คล้ายๆกับหน้าแรก"*
 *
 * ⇒ ไฟล์นี้คือ **แหล่งเดียว** ของ "ค่าเริ่มต้น" ของหน้านี้
 *   - `lib/blocks/templates.ts` (ปุ่ม "เริ่มจากเทมเพลต" ในตัวสร้าง) เรียกผ่านทะเบียนเดิม
 *   - `scripts/import-contact.ts` (`npm run contact:import`) เขียนเป็น **ฉบับร่าง** ในตาราง `page_document`
 *   สองทางเรียกไฟล์นี้ ⇒ ได้เอกสารชุดเดียวกันเป๊ะ (ไม่มี "เทมเพลตคนละชุดกับของจริง" อีก)
 *
 * กติกา
 * - **ไม่แต่งข้อความเพิ่ม**: ทุกข้อความมาจากพจนานุกรม (`contactPage`) ที่หน้าเว็บใช้อยู่จริง
 * - เบอร์โทร **กดโทรได้** (การ์ดมี `href = tel:…` — `localizedBlockHref` ไม่เติม prefix ให้ `tel:`)
 * - แผนที่ใช้ **ภาพที่บริษัททำเอง** (ไม่ฝัง iframe/พิกัด — มติเดิม: ไม่ส่ง IP ผู้ใช้ไปบุคคลที่สาม)
 * - ฟอร์มติดต่อเป็น **บล็อกฟอร์มจริง** (`kind = "contact"`) ⇒ ส่งเข้า DB + มีหมายเหตุ PDPA ให้เอง
 * - ⚠️ **ไม่มีป้าย "ตัวอย่าง/ฟอร์มยังไม่เปิดใช้งาน"** แล้ว (รอบที่ 267 · มติเจ้าของ) — ฟอร์มทำงานจริงตั้งแต่รอบที่ 66
 */

/** ข้อความที่ "การ์ดช่องทางติดต่อ" ใช้ — แยกออกมาให้เทสต์ตรวจได้โดยไม่ต้องประกอบเอกสาร */
export function contactChannelCards(): readonly BlockCard[] {
  const c = th.contactPage;
  const cEn = en.contactPage;

  /* เบอร์โทร: 1 เบอร์ = 1 การ์ด ⇒ แตะโทรได้ทุกเบอร์ (เดิมมี 2 เบอร์ใน 1 การ์ด) */
  const phoneCards: readonly BlockCard[] = CONTACT_PHONES.map((phone) => ({
    title: { th: c.phoneLabel, en: cEn.phoneLabel },
    body: { th: phone.display, en: phone.display },
    href: `tel:${phone.tel}`,
    image: null,
  }));

  /* ที่ตั้งโรงงาน: ข้อความล้วน (ไม่มีลิงก์) — ชื่อโรงงานอยู่หัวการ์ด ที่อยู่เป็นเนื้อความ */
  const addressCards: readonly BlockCard[] = CONTACT_PLANTS.map((plant) => ({
    title: { th: c[plant.nameKey], en: cEn[plant.nameKey] },
    body: { th: c[plant.addressKey], en: cEn[plant.addressKey] },
    href: "",
    image: null,
  }));

  return [...phoneCards, ...addressCards];
}

/** เอกสารตั้งต้นของหน้า /contact — 4 บล็อก: แบนเนอร์ · ช่องทางติดต่อ · ฟอร์ม · แผนที่ */
export function buildContactDocument(): BlockDocument {
  const c = th.contactPage;
  const cEn = en.contactPage;

  const blocks: Block[] = [
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      style: templateStyle({ size: "lg", align: "left" }),
      title: { th: c.title, en: cEn.title },
      subtitle: { th: c.intro, en: cEn.intro },
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
      heading: { th: c.channelsTitle, en: cEn.channelsTitle },
      body: { th: "", en: "" },
      /* 2 คอลัมน์: 2 เบอร์ + 2 ที่อยู่ ⇒ เรียง 2×2 สวยกว่าล้นเป็น 3+1 */
      columns: 2,
      items: contactChannelCards(),
    },
    {
      id: templateBlockId(2),
      version: TEMPLATE_BLOCK_VERSION,
      type: "form",
      style: templateStyle({ background: "subtle" }),
      kind: "contact",
      heading: { th: c.formTitle, en: cEn.formTitle },
      body: { th: c.formIntro, en: cEn.formIntro },
    },
    {
      id: templateBlockId(3),
      version: TEMPLATE_BLOCK_VERSION,
      type: "map",
      style: templateStyle(),
      heading: { th: c.mapTitle, en: cEn.mapTitle },
      caption: { th: c.mapCaption, en: cEn.mapCaption },
      image: templateMedia(MAP_IMAGE.src, c.mapAlt, cEn.mapAlt),
      linkHref: "",
      linkLabel: { th: "", en: "" },
    },
  ];

  return { page: "contact", blocks };
}

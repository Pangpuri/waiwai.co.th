import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateMedia, templateStyle } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument } from "@/lib/blocks/types";

import { MANAGEMENT_TEAM_IMAGE } from "@/features/about/executives";

/**
 * เทมเพลตตั้งต้นของหน้า "คณะผู้บริหาร" (/about/executives) — S2 รอบที่ 83
 *
 * ที่มา: ผังคณะผู้บริหารจริง (`MANAGEMENT_TEAM_IMAGE` — ไฟล์ภาพใน public/executives) + ข้อความจากพจนานุกรม
 * ⚠️ **ชื่อ/ตำแหน่งอยู่ในตัวภาพ โดยการยืนยันของเจ้าของ (2026-10-03)** — ภาพนี้คือ "แหล่งข้อมูลที่ถูกต้อง"
 *    ⇒ เทมเพลตนี้เป็น "ภาพผัง + คำอธิบาย" ไม่มีรายชื่อรายบุคคล (เหมือนเลย์เอาต์เดิม) และ **ไม่ต้องถอดชื่อจากภาพ**
 *    · บล็อก `rosterText` ยังมีไว้เผื่ออนาคต (ตอนนั้นต้องได้รายชื่อที่ยืนยันแล้วจากเจ้าของก่อน)
 *    ⇒ เทมเพลตนี้จึงเป็น "ภาพผัง + คำอธิบาย" ไม่มีรายชื่อรายบุคคล (เหมือนเลย์เอาต์เดิม)
 */
export function buildExecutivesTemplate(): BlockDocument {
  const blocks: Block[] = [
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      style: templateStyle({ size: "lg", align: "left" }),
      title: { th: th.about.executives.title, en: en.about.executives.title },
      subtitle: { th: th.about.executives.intro, en: en.about.executives.intro },
      note: { th: "", en: "" },
      image: null,
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    },
    {
      id: templateBlockId(1),
      version: TEMPLATE_BLOCK_VERSION,
      type: "imageText",
      style: templateStyle({ background: "cream" }),
      heading: { th: th.about.executives.figure.caption, en: en.about.executives.figure.caption },
      body: { th: th.about.executives.note, en: en.about.executives.note },
      image: templateMedia(
        MANAGEMENT_TEAM_IMAGE.src,
        th.about.executives.figure.alt,
        en.about.executives.figure.alt,
      ),
      side: "right",
    },
  ];

  return { page: "executives", blocks };
}

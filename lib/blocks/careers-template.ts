import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateStyle, templateTextCards } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument, JobBoardItem } from "@/lib/blocks/types";

import { JOBS } from "@/features/careers/jobs";

/**
 * เทมเพลตตั้งต้นของหน้า "ร่วมงานกับไวไว" (/careers) — S2
 *
 * ที่มา: ข้อความชุดเดียวกับหน้าที่ใช้งานอยู่ (พจนานุกรม TH/EN) + ข้อมูลตำแหน่งจริง (`JOBS`)
 *
 * รอบที่ 87: เพิ่มบล็อก `form` (kind = careers) = ใบสมัครงานจริง ⇒ ปิดช่อง "form" ของหน้านี้
 * รอบที่ 88: เปลี่ยน "ข้อความหัวกระดาน" → บล็อก `jobBoard` ที่มี **ตำแหน่งจริงทั้ง 20 ตำแหน่ง**
 *   ⇒ ปิดช่อง "jobBoard" ⇒ หน้านี้ไม่มีส่วนที่เทมเพลตไม่ครอบคลุมเหลืออยู่
 *
 * ⚠️ **เจตนาไม่ใส่ "เพศ"/"อายุ" ลงในบล็อก** (แม้ประกาศต้นฉบับมี) — เป็นข้อมูลอ่อนไหวทางกฎหมาย
 *    และไม่จำเป็นต่อการสมัคร · ของเดิมในเลย์เอาต์ยังแสดงตามประกาศ (ดู PRODUCT_ROADMAP.md § 9)
 */
export function buildCareersTemplate(): BlockDocument {
  const careers = th.careersPage;
  const careersEn = en.careersPage;

  const jobItems: readonly JobBoardItem[] = JOBS.map((job) => {
    const item = careers.jobs[job.id];
    const itemEn = careersEn.jobs[job.id];
    return {
      id: `job-${job.id}`,
      title: { th: item.title, en: itemEn.title },
      department: { th: careers.departments[job.department], en: careersEn.departments[job.department] },
      openings: job.openings,
      qualifications: { th: item.qualifications, en: itemEn.qualifications },
      experience: { th: item.experience ?? "", en: itemEn.experience ?? "" },
    };
  });

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
      type: "jobBoard",
      style: templateStyle({ background: "cream" }),
      heading: { th: careers.boardTitle, en: careersEn.boardTitle },
      body: { th: careers.boardIntro, en: careersEn.boardIntro },
      groupByDepartment: true,
      items: jobItems,
    },
    {
      id: templateBlockId(2),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle(),
      /* เดิมหัวคือ "กรองตำแหน่งตามฝ่าย" — ตอนนี้ไม่มีการกรองแล้ว ⇒ ใช้ "ฝ่ายที่เปิดรับ" ให้ตรงความจริง */
      heading: { th: careers.stats.departments, en: careersEn.stats.departments },
      body: { th: "", en: "" },
      columns: 3,
      items: templateTextCards(careers.departments, careersEn.departments, 6),
    },
    {
      id: templateBlockId(3),
      version: TEMPLATE_BLOCK_VERSION,
      type: "form",
      style: templateStyle(),
      kind: "careers",
      heading: { th: careers.applyFormTitle, en: careersEn.applyFormTitle },
      body: { th: careers.applyFormIntro, en: careersEn.applyFormIntro },
    },
  ];

  return { page: "careers", blocks };
}

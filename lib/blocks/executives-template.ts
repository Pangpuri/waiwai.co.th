import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { aboutImagePath } from "@/lib/blocks/about-media";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateMedia, templateStyle } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument } from "@/lib/blocks/types";

/**
 * เทมเพลตตั้งต้นของหน้า **"คณะผู้บริหาร" (/about/executives)**
 * · S2 รอบที่ 83 (โครงเดิม) · **ปรับรอบที่ 259 ตามมติเจ้าของ 2026-10-10**
 *
 * ## มติเจ้าของ 2026-10-10 (คำพูดตรง ๆ)
 * *"อันนี้ไม่มีอะไร เก็บภาพลง db ตามโครงสร้างหน้าบ้านได้เลย เพราะหน้าเว็บดั้งเดิมเป็นแบบนั้น
 *   แค่โชว์ภาพ ภาพเดียว โครงหลังบ้านก็อิงตามหน้าบ้านครับ"*
 * ⇒ โครง = **หัวข้อ + คำโปรย (hero) แล้วต่อด้วย "ภาพใหญ่" ภาพเดียว** — ไม่มีคำบรรยาย/ไม่มีรายชื่อรายบุคคล
 *
 * ## ที่มา
 * - ข้อความ (หัวข้อ/คำโปรย) มาจากพจนานุกรมชุดเดียวกับหน้าที่ใช้งานอยู่ (ไม่แต่งขึ้นเอง)
 * - **ภาพผังคณะผู้บริหาร**: ทะเบียน `ABOUT_MEDIA` คีย์ `executives` → นำเข้าคลังภาพแล้ว (`npm run about:media`)
 *   ⇒ บล็อกเก็บพาธ `/media/<id>` (มติ D9) · ยังไม่นำเข้า = ถอยไปใช้ไฟล์ใน `public/` (หน้าเว็บไม่พัง)
 * - ⚠️ **ชื่อ/ตำแหน่งอยู่ในตัวภาพ โดยการยืนยันของเจ้าของ (2026-10-03)** — ภาพนี้คือ "แหล่งข้อมูลที่ถูกต้อง"
 *   ⇒ **ห้ามถอดชื่อจากภาพมาเป็นข้อความ** (บทเรียนรอบที่ 22: ตัวอักษรในภาพอ่านเพี้ยนได้) · บล็อก `rosterText`
 *   ยังมีไว้เผื่ออนาคต แต่ต้องได้รายชื่อที่ยืนยันแล้วจากเจ้าของก่อน
 *
 * ## ⚠️ ทำไมใช้บล็อก `image` (ไม่ใช่ `imageText`/`gallery`/`hero`)
 * บล็อกภาพชนิดอื่นบังคับ **สัดส่วน 4:3 + `object-cover`** ⇒ **ตัดขอบซ้าย/ขวาทิ้ง ~3% ต่อข้าง**
 * ซึ่งจะ **ตัดชื่อ-ตำแหน่งที่ชิดขอบในผังขาด** (ตรวจจากภาพจริง: ข้อความแถวล่างชิดขอบซ้าย ~1%)
 * ⇒ บล็อก `image` เรนเดอร์ที่สัดส่วนจริงของไฟล์ (`h-auto w-full`) ไม่ตัดอะไรทิ้ง
 */

export type ExecutivesTemplateOptions = {
  /** หาพาธภาพจากคลังภาพ (`aboutImagePath("executives", lookup)`) — ไม่ส่ง = ใช้ไฟล์ใน `public/` */
  readonly image?: (key: string) => string;
};

export function buildExecutivesTemplate(options: ExecutivesTemplateOptions = {}): BlockDocument {
  const m = th.about.executives;
  const mEn = en.about.executives;
  const imageOf = options.image ?? ((key: string) => aboutImagePath(key));

  const blocks: Block[] = [
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      style: templateStyle({ size: "lg", align: "left" }),
      title: { th: m.title, en: mEn.title },
      subtitle: { th: m.intro, en: mEn.intro },
      note: { th: "", en: "" },
      /* ภาพอยู่ในบล็อกถัดไป (ภาพใหญ่เต็มความกว้าง) — บล็อกนี้เป็นข้อความล้วน */
      image: null,
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    },
    {
      id: templateBlockId(1),
      version: TEMPLATE_BLOCK_VERSION,
      type: "image",
      /* กว้าง (ไม่ครอป) — ผังอ่านยากถ้าแคบ และข้อความในผังต้องไม่ถูกตัด */
      style: templateStyle({ width: "wide" }),
      image: templateMedia(imageOf("executives"), m.figure.alt, mEn.figure.alt),
    },
  ];

  return { page: "executives", blocks };
}

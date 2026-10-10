import type { AboutSource } from "@/lib/about/import-parse";
import { TEMPLATE_BLOCK_VERSION, templateBlockId, templateMedia, templateStyle } from "@/lib/blocks/template-kit";
import type { Block, BlockDocument, BlockGalleryItem } from "@/lib/blocks/types";

/**
 * ประกอบ **เอกสารบล็อกของหน้า "บริษัท" (/about)** จากโครงที่แกะมาจากหน้าต้นทาง — รอบที่ 255 · หนี้ D-253-1
 *
 * มติเจ้าของ 2026-10-09 (เย็น): *"ใช้ภาพ ข้อความ และแบ่งบล็อคตามความเหมาะสมจากแหล่งข้อมูลนี้"*
 * ⇒ ตรรกะการแบ่งบล็อกอยู่ที่ **ที่เดียว** (ไฟล์นี้) — ทั้งตัวนำเข้าและเทมเพลตตั้งต้นใช้ร่วมกัน
 *    ตัวนำเข้าแกะหน้าเว็บแล้วเรียกไฟล์นี้ · เทมเพลตเรียกไฟล์นี้กับโครงที่ฝังไว้ ⇒ สองทางให้ผลเหมือนกัน
 *
 * กติกา
 * - ภาพทุกใบต้องมาจาก **คลังภาพ** (`/media/<id>` — มติ D9) ผ่าน `resolveImage`
 *   ⇒ ยังไม่ได้นำเข้า = `null` ⇒ บล็อกนั้นถูกข้าม (ไม่ใส่ภาพที่ชี้ไปที่อื่น)
 * - **ไม่มี EN** (ต้นทางเป็นไทยล้วน) ⇒ `en: ""` ทั้งหมด (มติ D3/D22) — เจ้าของเติมเองได้ในตัวสร้าง
 * - **ไม่แต่งข้อความเพิ่ม** และ **ไม่ใส่บล็อกที่ไม่มีในต้นทาง** (เช่น ปุ่ม CTA ที่ต้นทางไม่มี)
 * - สไตล์เลือกจากพรีเซ็ตแบรนด์เท่านั้น (`templateStyle` — มติ D10)
 */

/** คืนพาธ `/media/<id>` ของภาพต้นทาง หรือ `null` ถ้ายังไม่ได้นำเข้า */
export type AboutImageResolver = (sourceUrl: string) => string | null;

/**
 * ⚠️ **ขนาดที่แสดงผลของภาพหน้าบริษัท — ตั้งใจ "ไม่ขยายภาพ"** (มติเจ้าของ 2026-10-10)
 *
 * คำเจ้าของ: *"ถ้าภาพไม่คมคงต้องลดขนาดภาพให้เหมาะสมนั่นแหล่ะครับ ทางออกที่ง่ายที่สุดเลย
 *   แล้วให้มันเป็นค่าดีฟอลต์ของเทมเพลตเลย"*
 *
 * ภาพของหน้าต้นทางมีขนาดเล็ก (แบนเนอร์ **800×367** · ภาพประกอบ 12 ใบ **244×150** — เป็น thumbnail
 * ที่ต้นทางวางไว้ 200px) ⇒ ถ้าให้แสดงเต็มความกว้าง ภาพจะถูก **ขยาย** แล้วดูไม่คม
 * ⇒ ล็อกความกว้างของบล็อกไว้ที่ค่าที่แสดงผล **ไม่เกินขนาดไฟล์จริง**
 *
 * เลขที่ใช้คำนวณ (คลาสจริงอยู่ที่ `lib/blocks/style.ts` · `containerClass` ใส่ `px-4` เสมอ = 32px)
 * - hero:  `normal` = `max-w-4xl` 896px → พื้นที่จริง 864px เทียบแบนเนอร์ 800px ⇒ **1.08×** (แทบไม่ต่างจากต้นทาง 888px)
 * - gallery: `narrow` = `max-w-2xl` 672px → 672−32−gap(2×16) = **203px/ใบ** เทียบ 244px ⇒ **0.83×** (ย่อ = คม)
 *   · 3 คอลัมน์ = ตรงกับที่ต้นทางวาง (แถวละ 3 ใบ)
 *
 * ⚠️ **ห้ามเปลี่ยนกลับเป็น `wide`/`full`** — มีเทสต์คำนวณส่วนต่างไว้กันถอยหลัง (`scripts/test-about-import.ts`)
 * ⚠️ ถ้าเจ้าของอัปโหลดภาพความละเอียดสูงทับภายหลัง จะขยายกล่องในตัวสร้างได้ตามใจ (ช่องมีอยู่แล้ว)
 */
export const ABOUT_IMAGE_FIT = {
  heroWidth: "normal",
  galleryWidth: "narrow",
  galleryColumns: 3,
  /** ความกว้างไฟล์จริงของภาพต้นทาง (px) — ใช้เป็นเพดานของขนาดที่แสดงผล */
  sourceBannerWidth: 800,
  sourcePhotoWidth: 244,
} as const;

/** URL ของภาพทุกใบในโครง (ไม่ซ้ำ · เรียงตามลำดับเอกสาร — แบนเนอร์ก่อน) */
export function aboutSourceImageUrls(source: AboutSource): readonly string[] {
  const urls: string[] = [];
  if (source.bannerUrl !== null) urls.push(source.bannerUrl);
  for (const node of source.nodes) {
    if (node.kind !== "images") continue;
    for (const url of node.urls) if (!urls.includes(url)) urls.push(url);
  }
  return urls;
}

/** คำบรรยายภาพ (alt) — ใช้ชื่อบริษัทจากต้นทาง (ข้อมูลจริง ไม่ใช่คำ placeholder) */
function altTextOf(pageTitle: string): string {
  return pageTitle.trim() === "" ? "ภาพประกอบของบริษัท" : `ภาพประกอบของบริษัท ${pageTitle.trim()}`;
}

/** ป้ายที่ใช้แยก "ชื่อบริษัท" ออกจากประโยคแรกของส่วนเปิดเรื่อง (ข้อความของต้นทางเอง) */
const INTRO_MARKER = "ก่อตั้งขึ้น";
/** ความยาวสูงสุดของหัวข้อที่อนุมานได้ (กันดูดทั้งย่อหน้ามาเป็นหัวข้อ) */
const MAX_DERIVED_HEADING = 80;

/**
 * หัวข้อของ **ส่วนที่ต้นทางไม่มีหัวข้อ** (ส่วนเปิดเรื่อง "บริษัท+ที่ตั้ง")
 *
 * 🔴 **บั๊กจริงที่เจ้าของเจอ (2026-10-10):** รอบ 255 ส่ง `heading: ""` ไป ⇒ validator ฟ้อง
 * `empty-th @ blocks[1].heading.th` (บล็อก `richText` **บังคับ** ให้มีหัวข้อไทย)
 * ⇒ กด "เผยแพร่" แล้ว `prepare()` ปฏิเสธ **ก่อน** เขียนฐานข้อมูล (จึงไม่มี audit/ไม่มีแถว published)
 * ⇒ หน้าบ้านไม่เปลี่ยน · **บทเรียน: ตัวนำเข้าต้องรัน `validateDocument` ด้วย ไม่ใช่แค่ `parseBlockDocument`**
 *
 * วิธีเติมหัวข้อ: ใช้ **คำของต้นทางเองเท่านั้น** (ห้ามแต่งขึ้นใหม่)
 * 1. ตัดประโยคแรกที่ป้าย "ก่อตั้งขึ้น" → "บริษัท โรงงานผลิตภัณฑ์อาหารไทย จำกัด" (ชื่อบริษัทตามต้นทาง)
 * 2. ถอยไปใช้ชื่อหน้าจาก `page-header` (เช่น "บริษัท")
 */
function headingForEmptySection(paragraphs: readonly string[], pageTitle: string): string {
  const first = paragraphs[0]?.trim() ?? "";
  const at = first.indexOf(INTRO_MARKER);
  if (at > 0) {
    const candidate = first.slice(0, at).trim();
    if (candidate !== "" && candidate.length <= MAX_DERIVED_HEADING) return candidate;
  }
  return pageTitle.trim();
}

export function buildAboutDocument(source: AboutSource, resolveImage: AboutImageResolver): BlockDocument {
  const blocks: Block[] = [];
  let index = 0;
  const nextId = (): string => templateBlockId(index++);
  const alt = altTextOf(source.pageTitle);

  /* ── 1) แบนเนอร์หัวหน้า — **มีเฉพาะเมื่อมีภาพ** (ต้นทางมีภาพเดียว) ────────────────
     ⚠️ บล็อกนี้ไม่มีหัวข้อ (มติเจ้าของ) ⇒ ถ้าไม่มีภาพด้วยจะกลายเป็น "แบนเนอร์ว่างเปล่า"
        ซึ่ง validator ไม่ให้ผ่าน (`hero-empty`) · และการขึ้นกล่องเปล่าไม่มีประโยชน์
        ⇒ ไม่มีภาพ = ไม่มีบล็อก (หลักเดียวกับแกลเลอรีด้านล่าง) ⇒ เอกสารยังถูกต้องเสมอ
  */
  const banner = source.bannerUrl === null ? null : resolveImage(source.bannerUrl);
  if (banner !== null) {
    blocks.push({
      id: nextId(),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      /* ⚠️ `width: "normal"` — ดูเหตุผลที่ `ABOUT_IMAGE_FIT` ด้านบน (ห้ามขยายภาพต้นทาง) */
      style: templateStyle({ size: "lg", align: "left", width: ABOUT_IMAGE_FIT.heroWidth }),
      /*
        ── ไม่ใส่หัวข้อที่แบนเนอร์ (มติเจ้าของ 2026-10-10) ──────────────────────────────────────
        บล็อกนี้เป็น **ภาพล้วน** เพราะชื่อเต็มของบริษัทอยู่บล็อกถัดไปแล้ว ⇒ ใส่ "บริษัท" ที่นี่ = ซ้ำสองที่
        (เจ้าของลบเองแล้วแต่เผยแพร่ไม่ผ่าน เพราะกฎ validator เดิมบังคับ `hero.title` — แก้ที่รากแล้วรอบ 258)
        ⚠️ `<h1>` ของหน้ามาจาก `heading` ของ `BlockDocumentView` ไม่ใช่บล็อกนี้ ⇒ ไม่กระทบ a11y
        ⚠️ ยังใช้ `pageTitle` เป็น **คำบรรยายภาพ (alt)** อยู่ (ยังมีข้อมูลจริงของหน้านั้น)
      */
      title: { th: "", en: "" },
      subtitle: { th: "", en: "" },
      note: { th: "", en: "" },
      image: templateMedia(banner, alt, ""),
      ctaLabel: { th: "", en: "" },
      ctaHref: "",
    });
  }

  /* ── 2) ส่วนต่าง ๆ + กลุ่มภาพ ตามลำดับที่ต้นทางวางไว้จริง ─────────────────────── */
  let galleryCount = 0;
  for (const node of source.nodes) {
    if (node.kind === "section") {
      blocks.push({
        id: nextId(),
        version: TEMPLATE_BLOCK_VERSION,
        type: "richText",
        style: templateStyle(),
        /* ⚠️ ต้นทางไม่มีหัวข้อให้ส่วนเปิดเรื่อง ⇒ ต้องเติม (validator บังคับ) — ดู `headingForEmptySection` */
        heading: {
          th: node.heading !== "" ? node.heading : headingForEmptySection(node.paragraphs, source.pageTitle),
          en: "",
        },
        body: { th: node.paragraphs.join("\n\n"), en: "" },
        ctaLabel: { th: "", en: "" },
        ctaHref: "",
      });
      continue;
    }

    const items: BlockGalleryItem[] = [];
    for (const [at, url] of node.urls.entries()) {
      const path = resolveImage(url);
      if (path === null) continue;
      items.push({
        id: `photo-${String(galleryCount + 1)}-${String(at + 1)}`,
        image: templateMedia(path, alt, ""),
        caption: { th: "", en: "" },
      });
    }
    /* ไม่มีภาพที่ใช้ได้สักใบ = ไม่ต้องขึ้นกล่องเปล่า (บทเรียนเดิมของโปรเจกต์) */
    if (items.length === 0) continue;

    galleryCount += 1;
    blocks.push({
      id: nextId(),
      version: TEMPLATE_BLOCK_VERSION,
      type: "gallery",
      /* ⚠️ `narrow` + 3 คอลัมน์ — ดูเหตุผลที่ `ABOUT_IMAGE_FIT` ด้านบน (203px/ใบ · ไม่ขยายภาพ 244px) */
      style: templateStyle({ width: ABOUT_IMAGE_FIT.galleryWidth, background: "subtle" }),
      heading: { th: "", en: "" },
      items,
      columns: ABOUT_IMAGE_FIT.galleryColumns,
    });
  }

  return { page: "about", blocks };
}

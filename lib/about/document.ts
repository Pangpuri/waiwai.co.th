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

export function buildAboutDocument(source: AboutSource, resolveImage: AboutImageResolver): BlockDocument {
  const blocks: Block[] = [];
  let index = 0;
  const nextId = (): string => templateBlockId(index++);
  const alt = altTextOf(source.pageTitle);

  /* ── 1) แบนเนอร์หัวหน้า (ต้นทางมีภาพเดียว + ชื่อหน้า) ─────────────────────────── */
  const banner = source.bannerUrl === null ? null : resolveImage(source.bannerUrl);
  blocks.push({
    id: nextId(),
    version: TEMPLATE_BLOCK_VERSION,
    type: "hero",
    style: templateStyle({ size: "lg", align: "left" }),
    title: { th: source.pageTitle, en: "" },
    subtitle: { th: "", en: "" },
    note: { th: "", en: "" },
    image: banner === null ? null : templateMedia(banner, alt, ""),
    ctaLabel: { th: "", en: "" },
    ctaHref: "",
  });

  /* ── 2) ส่วนต่าง ๆ + กลุ่มภาพ ตามลำดับที่ต้นทางวางไว้จริง ─────────────────────── */
  let galleryCount = 0;
  for (const node of source.nodes) {
    if (node.kind === "section") {
      blocks.push({
        id: nextId(),
        version: TEMPLATE_BLOCK_VERSION,
        type: "richText",
        style: templateStyle(),
        heading: { th: node.heading, en: "" },
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
      style: templateStyle({ width: "wide", background: "subtle" }),
      heading: { th: "", en: "" },
      items,
      columns: 3,
    });
  }

  return { page: "about", blocks };
}

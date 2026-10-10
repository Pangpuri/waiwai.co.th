import { attributeOf, textOf } from "@/lib/import/html";
import { applyAboutTextFixes } from "@/lib/about/corrections";

/**
 * ตัวแกะ **หน้า "บริษัท" (/about) จากเว็บเดิม** (waiwai.co.th/th/pages/11561) — รอบที่ 255 · หนี้ D-253-1
 *
 * ## ทำไมต้องมี
 * มติเจ้าของ 2026-10-09 (เย็น): *"ดูท่าทางฝั่งบล็อคบริษัทจะเยอะไป เสี่ยงข้อมูลเพี้ยน
 *   เดี๋ยวเราใช้ภาพ ข้อความ และแบ่งบล็อคตามความเหมาะสมจากแหล่งข้อมูลนี้"*
 * ⇒ รอบนี้ **ยึดของจริงจากหน้าต้นทาง** แทนการประกอบขึ้นเองจากพจนานุกรม (เทมเพลต 20 บล็อกของรอบ 253)
 *
 * ## รูปทรงของต้นทาง (ตรวจจาก HTML จริง 61 KB · 2026-10-10)
 * - หน้าใช้ **ตารางเลย์เอาต์** (`<table>`) ครอบทุกอย่าง — แต่ข้อความ/ภาพอยู่ใน `<p>` และ `<img>` ตามลำดับ
 *   ⇒ เราเดินตามลำดับเอกสาร ไม่ต้องแกะโครงตาราง
 * - ไม่มี `<h1>`–`<h6>` เลย ⇒ **หัวข้อของแต่ละส่วนอยู่ใน `<p><strong>…</strong></p>`** ที่ข้อความสั้น
 * - ภาพมี 13 ใบ: **ใบแรก (`.gif`) = แบนเนอร์หัวหน้า** · ที่เหลือ 12 ใบมาเป็น **กลุ่มละ 3 ใบ** คั่นระหว่างส่วน
 * - เนื้อหาเป็น **ภาษาไทยล้วน** (เว็บเดิมไม่มี EN) ⇒ `en: ""` ทั้งหมด (มติ D3/D22: ไม่ต้องมี EN ครบ)
 *
 * ⚠️ ตรรกะล้วน (ไม่แตะ DB/เครือข่าย/ไฟล์) ⇒ ทดสอบได้ด้วย `node --test` + fixture
 * ⚠️ คำที่แก้ = เฉพาะในตาราง `ABOUT_TEXT_FIXES` (มติเจ้าของ) — ห้าม "ปรับสำนวน" เอง
 */

/** ความยาวสูงสุดของย่อหน้าที่ถือว่าเป็น "หัวข้อ" (จริงของต้นทางสั้นกว่านี้มาก) */
const MAX_HEADING_LENGTH = 60;

/** ป้ายที่บอกว่าจบเนื้อหาหน้าแล้ว (กันดูด modal/PDPA ที่ต่อท้าย) */
const CONTENT_STOP_MARKERS = ["section-pdpa", "modal-content"] as const;

export type AboutSectionNode = {
  readonly kind: "section";
  /** ชื่อส่วนตามต้นทาง — `""` = ส่วนเปิดเรื่อง (ต้นทางไม่มีหัวข้อ) */
  readonly heading: string;
  /** ย่อหน้าทั้งหมด เรียงตามต้นทาง (แก้คำผิดแล้ว) */
  readonly paragraphs: readonly string[];
};

export type AboutImagesNode = {
  readonly kind: "images";
  /** URL ต้นทางของภาพในกลุ่มนี้ (ยังไม่แปลงเป็นพาธคลังภาพ) */
  readonly urls: readonly string[];
};

export type AboutNode = AboutSectionNode | AboutImagesNode;

export type AboutSource = {
  /** ชื่อหน้า (จาก `page-header` ของต้นทาง เช่น "บริษัท") */
  readonly pageTitle: string;
  /** แบนเนอร์หัวหน้า (ภาพ `.gif` ใบแรก) หรือ null */
  readonly bannerUrl: string | null;
  /** เนื้อหาตามลำดับเอกสารจริง (ส่วน ↔ กลุ่มภาพ) */
  readonly nodes: readonly AboutNode[];
};

/** ตัดเฉพาะบล็อกเนื้อหาของหน้า (กันเมนู/ท้ายเว็บ/modal ที่ติดมา) */
function contentBlockOf(html: string): string {
  const marker = html.indexOf("item-content");
  if (marker < 0) return "";
  const start = html.lastIndexOf("<div", marker);
  let end = html.length;
  for (const stop of CONTENT_STOP_MARKERS) {
    const at = html.indexOf(stop, start);
    if (at >= 0 && at < end) end = at;
  }
  return html.slice(start, end);
}

/**
 * ชื่อหน้าจาก `page-header` → `<div class="title">…</div>` (ของจริง 2026-10-10)
 * ถ้าไม่พบ/อ่านได้ไม่น่าเชื่อถือ ⇒ ถอยไปใช้ส่วนท้ายของ `<title>` (เช่น "ไวไว - บริษัท" → "บริษัท")
 * ⚠️ ต้องสั้น (≤ 60 ตัวอักษร) — กันดูดข้อความของส่วนถัดไปเมื่อโครงเว็บเปลี่ยน
 */
function pageTitleOf(html: string): string {
  const marker = html.indexOf("page-header");
  if (marker >= 0) {
    const slice = html.slice(marker, marker + 400);
    const inside = /class="title"[^>]*>([\s\S]*?)<\/div>/i.exec(slice);
    const value = textOf(inside?.[1] ?? "");
    if (value !== "" && value.length <= 60) return value;
  }

  const title = textOf(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const last = title.split("-").pop()?.trim() ?? "";
  return last !== "" && last.length <= 60 ? last : "";
}

type RawItem = {
  readonly text: string;
  readonly strong: boolean;
  readonly images: readonly string[];
};

/**
 * เดินตามลำดับเอกสาร: `<p>…</p>` หนึ่งรายการ · `<img>` ที่อยู่นอก `<p>` หนึ่งรายการ
 * (ภาพที่อยู่ใน `<p>` ถูกนับเป็นของย่อหน้านั้น — ไม่นับซ้ำ)
 */
function itemsOf(content: string): readonly RawItem[] {
  const items: RawItem[] = [];
  const matcher = /<p[^>]*>([\s\S]*?)<\/p>|<img[^>]*>/gi;

  for (const match of content.matchAll(matcher)) {
    const whole = match[0];
    if (whole.toLowerCase().startsWith("<img")) {
      const src = attributeOf(whole, "src");
      items.push({ text: "", strong: false, images: src === "" ? [] : [src] });
      continue;
    }
    const inner = match[1] ?? "";
    const images = [...inner.matchAll(/<img[^>]*>/gi)]
      .map((image) => attributeOf(image[0], "src"))
      .filter((src) => src !== "");
    items.push({ text: textOf(inner), strong: /<strong>/i.test(inner), images });
  }

  return items;
}

/** หัวข้อ = ย่อหน้าที่ทั้งย่อหน้าอยู่ใน `<strong>` และสั้น (ต้นทางไม่มี `<h*>`) */
function isHeading(item: RawItem): boolean {
  return item.strong && item.text !== "" && item.text.length <= MAX_HEADING_LENGTH;
}

/** แยกภาพใบแรก (แบนเนอร์) ออกจากลำดับที่เหลือ */
function splitBanner(items: readonly RawItem[]): { readonly bannerUrl: string | null; readonly rest: readonly RawItem[] } {
  for (const [index, item] of items.entries()) {
    if (item.images.length === 0) continue;
    const bannerUrl = item.images[0] ?? null;
    const rest = items.map((entry, at) => (at === index ? { ...entry, images: entry.images.slice(1) } : entry));
    return { bannerUrl, rest };
  }
  return { bannerUrl: null, rest: items };
}

/**
 * แกะหน้าต้นทาง → โครงสร้างที่เป็นกลาง (ยังไม่ผูกกับบล็อก/คลังภาพ)
 * - ย่อหน้าว่างถูกข้าม · ย่อหน้า `<strong>` สั้น = ขึ้นส่วนใหม่
 * - ภาพที่ติดกันเป็นชุดเดียว = หนึ่งกลุ่ม (ของจริงได้กลุ่มละ 3 ใบ)
 */
export function parseAboutPage(html: string): AboutSource {
  const content = contentBlockOf(html);
  const { bannerUrl, rest } = splitBanner(itemsOf(content));

  const nodes: AboutNode[] = [];
  let current: { heading: string; paragraphs: string[] } | null = null;
  let pendingImages: string[] = [];

  const pushImages = () => {
    if (pendingImages.length === 0) return;
    nodes.push({ kind: "images", urls: [...pendingImages] });
    pendingImages = [];
  };

  const closeSection = () => {
    if (current === null) return;
    if (current.heading !== "" || current.paragraphs.length > 0) {
      nodes.push({ kind: "section", heading: current.heading, paragraphs: [...current.paragraphs] });
    }
    current = null;
  };

  for (const item of rest) {
    if (item.images.length > 0) {
      pendingImages.push(...item.images);
      continue;
    }
    if (item.text === "") continue;

    const text = applyAboutTextFixes(item.text);
    if (isHeading(item)) {
      closeSection();
      pushImages();
      current = { heading: text, paragraphs: [] };
    } else {
      if (current === null) current = { heading: "", paragraphs: [] };
      current.paragraphs.push(text);
    }
  }
  closeSection();
  pushImages();

  return { pageTitle: pageTitleOf(html), bannerUrl, nodes };
}

import { attributeOf, decodeEntities, normalizeText, pathOfHref, textOf } from "@/lib/import/html";
import { parseThaiDateTime } from "@/lib/import/thai-date";

/**
 * ตัวแกะหน้าข่าวของเว็บเดิม (waiwai.co.th · CMS "iGetWeb") — **ตรรกะล้วน ทดสอบได้**
 *
 * โครงสร้างต้นทาง (ยืนยันจากเว็บจริง 2026-10-05 · 151 ข่าว ใน 11 หน้า)
 * - หน้าข่าว `th/news/?page=N` = กริด `<div class="item">` → `a.item-image` (href + ภาพย่อ 400×300)
 *   + `a.title` (หัวข้อ) + `ul.item-meta` (วันที่ + จำนวนวิว) + `div.item-description` (คำโปรย)
 * - หน้าข่าวเดี่ยว `/th/news/<id>-<slug>` → `div.item-post > div.title` + `Created:` + `div.item-content`
 *
 * ⚠️ **เนื้อหาใน `div.item-content` ถูกวางมาจาก Facebook** → HTML เละ (ตาราง/span/style)
 *    ⇒ `newsBlocksFromHtml()` แกะเป็น **บล็อกเรียงลำดับ (ย่อหน้า/หัวข้อ/รูป)** ไม่เก็บ HTML ดิบ
 *    ⚠️ รูปในต้นฉบับ **ไม่มี alt เลย** (ต้องสร้างจากหัวข้อข่าว — ดูสคริปต์นำเข้า)
 *
 * ⚠️ ตัวแกะผูกกับโครงสร้างนี้โดยเจตนา — ถ้าเว็บเดิมเปลี่ยน ต้องแก้ที่นี่ (มี fixture คุมในเทสต์)
 * หมายเหตุ: ไฟล์นี้ **ไม่แตะเครือข่าย/ฐานข้อมูล**
 */

/** ขนาดภาพที่ CDN ของเว็บเดิมมีให้ (ยืนยันด้วยการยิงจริง 2026-10-05) */
export const NEWS_IMAGE_SIZES = ["400x300", "600x450", "800x600", "1024x768", "1200x900"] as const;
export type NewsImageSize = (typeof NEWS_IMAGE_SIZES)[number];

/**
 * เปลี่ยน URL รูปให้เป็นขนาดที่ต้องการ (เช่น `…_full.JPG` → `…_1024x768.JPG`)
 * ⚠️ รุ่นย่อของ CDN เป็น **4:3 (ครอบภาพ)** ไม่ใช่ย่อสัดส่วน — มติเจ้าของ 2026-10-05 ยอมรับข้อนี้
 * ⚠️ ถ้า URL ไม่มีรูปแบบ `_full`/`_WxH` ⇒ คืนเดิม (ผู้เรียกต้องกันขนาดไฟล์เอง)
 */
export function newsImageVariantUrl(url: string, size: NewsImageSize): string {
  const trimmed = url.trim();
  if (trimmed === "") return "";
  return trimmed.replace(/(_full|_\d+x\d+)(\.(?:jpe?g|png|webp))(?=$|[?#])/i, `_${size}$2`);
}

/** id ข่าวจากพาธ `/th/news/148398-…` */
export function sourceIdOfNewsPath(path: string): string {
  return path.match(/\/news\/(\d+)/)?.[1] ?? "";
}

/**
 * แกะ `div.item-content` → บล็อกเรียงลำดับ
 * - ตัด `script`/`style`/คอมเมนต์ออกทั้งหมด
 * - `<img>` = บล็อกรูป (ตำแหน่งตามต้นฉบับ) · `<h1>`–`<h6>` = หัวข้อ
 * - ที่เหลือ = ย่อหน้า (แยกด้วย `<br>`, `</p>`, `</div>`, `</td>`, `</tr>`, `</table>`)
 * - บรรทัดที่ว่าง/มีแต่ `&nbsp;` ถูกตัดออก
 */
export function newsBlocksFromHtml(html: string): readonly ParsedNewsBlock[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const marked = cleaned
    .replace(/<h[1-6][^>]*>/gi, "\n@@HEAD@@")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|td|tr|table|tbody|li|ul|ol|section|article|blockquote)>/gi, "\n");

  const blocks: ParsedNewsBlock[] = [];
  for (const part of marked.split(/(<img\b[^>]*>)/i)) {
    if (/^<img\b[^>]*>$/i.test(part)) {
      const src = decodeEntities(attributeOf(part, "src")).trim();
      const url = src.startsWith("//") ? `https:${src}` : src;
      /* ข้ามภาพฝังข้อมูล (data:) — เก็บเฉพาะพาธจริง */
      if (url !== "" && !url.startsWith("data:")) {
        const previous = blocks[blocks.length - 1];
        /* ภาพเดียวกันติดกัน (ต้นฉบับวางซ้ำ) — เก็บครั้งเดียว */
        if (previous?.kind !== "image" || previous.sourceUrl !== url) blocks.push({ kind: "image", sourceUrl: url });
      }
      continue;
    }

    for (const rawLine of part.split("\n")) {
      const isHeading = rawLine.includes("@@HEAD@@");
      const text = textOf(rawLine.replace(/@@HEAD@@/g, " "));
      if (text === "") continue;
      blocks.push(isHeading ? { kind: "heading", text } : { kind: "paragraph", text });
    }
  }

  return blocks;
}

export type ParsedNewsBlock =
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "heading"; readonly text: string }
  | { readonly kind: "image"; readonly sourceUrl: string };

export type ParsedNewsCard = {
  readonly sourceId: string;
  /** พาธในเว็บเดิม เช่น `/th/news/148398-…` */
  readonly detailPath: string;
  readonly title: string;
  /** ข้อความวันที่จากต้นฉบับ เช่น `12 กันยายน 2026 11:28` */
  readonly publishedLabel: string;
  /** `YYYY-MM-DDTHH:MM` (เวลาไทย) — null = อ่านไม่ได้ */
  readonly publishedLocal: string | null;
  readonly excerpt: string;
  /** ภาพย่อ 400×300 จากหน้าข่าว (ใช้เป็นภาพปก) */
  readonly coverUrl: string;
};

function dateLabelOf(listingRow: string): string {
  const match = listingRow.match(/class="item-date"[^>]*>[\s\S]*?<\/i>\s*([^<]*)</i);
  return normalizeText(decodeEntities(match?.[1] ?? ""));
}

/** แกะหน้าข่าว (รายการ) → การ์ดข่าว เรียงตามที่ปรากฏ */
export function parseNewsListingPage(html: string): readonly ParsedNewsCard[] {
  const cards: ParsedNewsCard[] = [];

  for (const chunk of html.split(/<div class="item\s/).slice(1)) {
    const anchorTag = chunk.match(/<a[^>]+class="item-image"[^>]*>/i)?.[0] ?? "";
    const detailPath = pathOfHref(attributeOf(anchorTag, "href"));
    const sourceId = sourceIdOfNewsPath(detailPath);
    if (sourceId === "") continue;

    const coverUrl = decodeEntities(
      chunk.match(/<a[^>]+class="item-image"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1] ?? "",
    ).trim();
    const title = textOf(chunk.match(/<a[^>]+class="title"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
    if (title === "") continue;

    const publishedLabel = dateLabelOf(chunk);
    const excerpt = textOf(chunk.match(/class="item-description"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");

    cards.push({
      sourceId,
      detailPath,
      title,
      publishedLabel,
      publishedLocal: parseThaiDateTime(publishedLabel),
      excerpt,
      coverUrl,
    });
  }

  return cards;
}

export type ParsedNewsArticle = {
  readonly title: string;
  readonly publishedLabel: string;
  readonly publishedLocal: string | null;
  readonly body: readonly ParsedNewsBlock[];
};

/** แกะหน้าข่าวเดี่ยว (หัวข้อ · วันที่ · เนื้อหาเป็นบล็อก) */
export function parseNewsArticlePage(html: string): ParsedNewsArticle {
  /*
    ⚠️ อ่านหัวข้อจาก `div.item-post` เท่านั้น — บทเรียนจากตัวนำเข้าเมนูอาหาร (รอบที่ 104):
    หน้าเดียวกันมี `<div class="title">เข้าสู่ระบบ</div>` ของป๊อปอัปล็อกอินมาก่อน
  */
  const header = html.match(/<div class="item-post">([\s\S]*?)<ul class="item-meta">/i)?.[1] ?? "";
  const title =
    textOf(header.match(/<div class="title">([\s\S]*?)<\/div>/i)?.[1] ?? "") ||
    textOf(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "").replace(/^\s*ไวไว\s*-\s*/, "");

  const content = html.match(/<div class="item-content">([\s\S]*?)<\/div>\s*<div class="item-meta">/i)?.[1] ?? "";
  const createdLabel = normalizeText(html.match(/<strong>Created:<\/strong>\s*([^<]*)/i)?.[1] ?? "");

  return {
    title,
    publishedLabel: createdLabel,
    publishedLocal: parseThaiDateTime(createdLabel),
    body: newsBlocksFromHtml(content),
  };
}

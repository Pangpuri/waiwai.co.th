import { attributeOf, decodeEntities, normalizeText, pathOfHref, textOf } from "@/lib/import/html";

/**
 * ตัวแกะหน้าบทความเมนูอาหารของเว็บเดิม (waiwai.co.th · CMS "iGetWeb") — **ตรรกะล้วน ทดสอบได้**
 *
 * โครงสร้างต้นทาง (ยืนยันจากเว็บจริง 2026-10-05)
 * - หน้าหมวด `articles/category/12586` = กริด `<div class="item">` →
 *     `<a class="item-image" href="/th/articles/<id>-…"><img src="…400x300.jpg"></a>`
 *     + `<a class="title" …><strong>ชื่อเมนู</strong></a>`
 * - หน้าบทความ → `<div class="title"><strong>ชื่อ</strong></div>` · `og:image` = ภาพปก ·
 *     `<div class="item-content">` มี `<iframe src="//www.youtube.com/embed/<id>">` **(ไม่มีข้อความสูตร)**
 *     · `<li class="item-date"><strong>Created:</strong> 9 ตุลาคม 2018 at 09:21</li>`
 *
 * ⚠️ ตัวแกะผูกกับโครงสร้างนี้โดยเจตนา — ถ้าเว็บเดิมเปลี่ยน ต้องแก้ที่นี่ (มี fixture คุมในเทสต์)
 * หมายเหตุ: ไฟล์นี้ **ไม่แตะเครือข่าย/ฐานข้อมูล**
 */

const THAI_MONTHS: Readonly<Record<string, number>> = {
  มกราคม: 1,
  กุมภาพันธ์: 2,
  มีนาคม: 3,
  เมษายน: 4,
  พฤษภาคม: 5,
  มิถุนายน: 6,
  กรกฎาคม: 7,
  สิงหาคม: 8,
  กันยายน: 9,
  ตุลาคม: 10,
  พฤศจิกายน: 11,
  ธันวาคม: 12,
  "ม.ค.": 1,
  "ก.พ.": 2,
  "มี.ค.": 3,
  "เม.ย.": 4,
  "พ.ค.": 5,
  "มิ.ย.": 6,
  "ก.ค.": 7,
  "ส.ค.": 8,
  "ก.ย.": 9,
  "ต.ค.": 10,
  "พ.ย.": 11,
  "ธ.ค.": 12,
};

/**
 * แปลงวันที่ไทยจากเว็บเดิมเป็น ISO (`9 ตุลาคม 2018 at 09:21` → `2018-10-09`)
 * - รับปี พ.ศ. ได้ด้วย (มากกว่า 2400 ⇒ ลบ 543) เพื่อกันข้อมูลที่พิมพ์ปีไทย
 * - อ่านไม่ได้/ไม่สมเหตุสมผล = null (ไม่เดา)
 */
export function parseThaiDate(label: string): string | null {
  const match = label.match(/(\d{1,2})\s+([ก-๙.]+)\s+(\d{4})/);
  if (match === null) return null;

  const day = Number.parseInt(match[1] ?? "", 10);
  const month = THAI_MONTHS[(match[2] ?? "").trim()];
  let year = Number.parseInt(match[3] ?? "", 10);
  if (year > 2400) year -= 543;

  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  if (month === undefined) return null;
  if (year < 1900 || year > 2100) return null;

  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** ดึง id วิดีโอ YouTube จาก URL ที่เว็บเดิมฝังไว้ (embed / nocookie / youtu.be / watch?v=) */
export function youTubeIdOf(src: string): string {
  const match = src
    .trim()
    .match(/(?:youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=)([A-Za-z0-9_-]{6,20})/i);
  return match?.[1] ?? "";
}

export type ParsedRecipeCard = {
  readonly sourceId: string;
  /** พาธในเว็บเดิม เช่น `/th/articles/134712-…` */
  readonly detailPath: string;
  readonly title: string;
  /** ภาพปกย่อจากหน้าหมวด (400×300) */
  readonly coverUrl: string;
};

/** id บทความจากพาธ `/th/articles/134712-...` */
export function sourceIdOfArticlePath(path: string): string {
  return path.match(/\/articles\/(\d+)/)?.[1] ?? "";
}

/** แกะหน้าหมวดเมนูอาหาร → การ์ดเมนู (เรียงตามที่ปรากฏ) */
export function parseRecipeCategoryPage(html: string): readonly ParsedRecipeCard[] {
  const cards: ParsedRecipeCard[] = [];

  for (const chunk of html.split(/<div class="item\s/).slice(1)) {
    const anchorTag = chunk.match(/<a[^>]+class="item-image"[^>]*>/i)?.[0] ?? "";
    const detailPath = pathOfHref(attributeOf(anchorTag, "href"));
    const sourceId = sourceIdOfArticlePath(detailPath);
    if (sourceId === "") continue;

    const anchorInner = chunk.match(/<a[^>]+class="item-image"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "";
    const coverUrl = decodeEntities(anchorInner.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? "").trim();

    const title = textOf(chunk.match(/<a[^>]+class="title"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
    if (title === "") continue;

    cards.push({ sourceId, detailPath, title, coverUrl });
  }

  return cards;
}

export type ParsedRecipeArticle = {
  readonly title: string;
  readonly coverUrl: string;
  readonly videoId: string;
  /** ข้อความวันที่จากต้นฉบับ (เก็ปไว้ให้เห็นที่มา) */
  readonly publishedLabel: string;
  readonly publishedOn: string | null;
};

/** แกะหน้าบทความเมนูอาหาร (ชื่อ · ภาพปก · วิดีโอ · วันที่) */
export function parseRecipeArticlePage(html: string): ParsedRecipeArticle {
  /*
    ⚠️ ต้องอ่านชื่อจาก **หัวบทความ** (`div.item-post` → `div.title`) เท่านั้น
    บทเรียนจากของจริง: หน้าเดียวกันมี `<div class="title">เข้าสู่ระบบ</div>` ของป๊อปอัปล็อกอินมาก่อน
    ⇒ จับ `<div class="title">` ตัวแรกจะได้ "เข้าสู่ระบบ" แทนชื่อเมนู (เจอจริงตอนตรวจกับเว็บ)
  */
  const header = html.match(/<div class="item-post">([\s\S]*?)<ul class="item-meta">/i)?.[1] ?? "";
  const title =
    textOf(header.match(/<div class="title">([\s\S]*?)<\/div>/i)?.[1] ?? "") ||
    textOf(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "");

  const coverUrl = attributeOf(html.match(/<meta property="og:image"[^>]*>/i)?.[0] ?? "", "content");

  const content = html.match(/<div class="item-content">([\s\S]*?)<\/div>\s*<div class="item-meta">/i)?.[1] ?? "";
  const iframeSrc = content.match(/<iframe[^>]+src="([^"]+)"/i)?.[1] ?? "";
  const videoId = youTubeIdOf(decodeEntities(iframeSrc));

  const publishedLabel = normalizeText(
    html.match(/<strong>Created:<\/strong>\s*([^<]*)/i)?.[1] ?? "",
  );

  return { title, coverUrl, videoId, publishedLabel, publishedOn: parseThaiDate(publishedLabel) };
}

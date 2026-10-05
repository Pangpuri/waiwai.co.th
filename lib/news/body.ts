/**
 * เนื้อหาข่าวแบบ "บล็อกเรียงลำดับ" (หน้า /news · รอบที่ 105) — **ตรรกะล้วน ทดสอบได้**
 *
 * ทำไมไม่เก็บ HTML ของเว็บเดิมแล้วยิงออกหน้าเว็บ
 * - ต้นฉบับ **วางมาจาก Facebook** (`<table>` + `<span class="xdj266r…">` + style ติดมาเต็มไปหมด)
 *   ⇒ เก็บดิบ = ต้อง `dangerouslySetInnerHTML` (ช่อง XSS) + หน้าตาพังไม่รู้จบ
 * - โครงที่รองรับมีแค่ 3 ชนิด ⇒ หน้าตาคุมได้ทั้งหมด และ "ข้อมูลจาก DB" ต้องผ่าน `parseNewsBody()` ก่อนเสมอ
 *   (กฎโปรเจกต์: ห้ามเชื่อข้อมูลจาก DB/ไฟล์นำเข้าโดยตรง)
 *
 * ⚠️ ข้อความในบล็อกเป็น **ข้อความล้วน** — ตัวเรนเดอร์ห้ามตีความเป็น HTML
 */

export type NewsParagraphBlock = {
  readonly type: "paragraph";
  readonly text: string;
};

export type NewsHeadingBlock = {
  readonly type: "heading";
  readonly text: string;
};

export type NewsImageBlock = {
  readonly type: "image";
  /** id ของภาพในตาราง `media` */
  readonly mediaId: string;
  /** คำบรรยายภาพ — ต้นฉบับไม่มี alt ⇒ ตัวนำเข้าเป็นคนสร้างจากชื่อข่าว (ไม่แต่งเนื้อหา) */
  readonly alt: string;
};

export type NewsBlock = NewsParagraphBlock | NewsHeadingBlock | NewsImageBlock;

/** เพดานกันข้อมูลเพี้ยน/ไฟล์ใหญ่ผิดปกติ (ข่าวที่ยาวที่สุดที่พบ ~4,400 ตัวอักษร) */
export const MAX_NEWS_BLOCKS = 300;
export const MAX_NEWS_TEXT_LENGTH = 6000;
export const MAX_NEWS_IMAGES = 40;

export type NewsBodyIssue = {
  readonly code: string;
  readonly path: string;
  readonly message: string;
};

function textOf(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** อ่านค่าที่ไม่น่าเชื่อถือ → บล็อกที่ปลอดภัย (ข้ามบล็อกที่ไม่รู้จัก/ว่าง) */
export function parseNewsBody(value: unknown): readonly NewsBlock[] {
  if (!Array.isArray(value)) return [];

  const blocks: NewsBlock[] = [];
  let images = 0;

  for (const entry of value) {
    if (blocks.length >= MAX_NEWS_BLOCKS) break;
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const type = textOf(record.type);

    if (type === "paragraph" || type === "heading") {
      const text = textOf(record.text).slice(0, MAX_NEWS_TEXT_LENGTH);
      if (text === "") continue;
      blocks.push({ type, text });
      continue;
    }

    if (type === "image") {
      const mediaId = textOf(record.mediaId);
      if (mediaId === "" || images >= MAX_NEWS_IMAGES) continue;
      images += 1;
      blocks.push({ type: "image", mediaId, alt: textOf(record.alt).slice(0, 300) });
    }
  }

  return blocks;
}

/** ข้อความล้วนของทั้งข่าว (ใช้ตรวจว่าข่าวไม่ว่าง + ทำ meta description ถ้าจำเป็น) */
export function newsBodyPlainText(blocks: readonly NewsBlock[]): string {
  return blocks
    .filter((block): block is NewsParagraphBlock | NewsHeadingBlock => block.type !== "image")
    .map((block) => block.text)
    .join("\n\n")
    .trim();
}

export function newsBodyImageIds(blocks: readonly NewsBlock[]): readonly string[] {
  return blocks.filter((block): block is NewsImageBlock => block.type === "image").map((block) => block.mediaId);
}

export function newsBodyImageCount(blocks: readonly NewsBlock[]): number {
  return newsBodyImageIds(blocks).length;
}

export function validateNewsBody(blocks: readonly NewsBlock[], path: string): readonly NewsBodyIssue[] {
  const issues: NewsBodyIssue[] = [];

  if (blocks.length === 0) {
    issues.push({ code: "body-empty", path, message: "เนื้อหาข่าวว่าง" });
    return issues;
  }
  if (blocks.length > MAX_NEWS_BLOCKS) {
    issues.push({ code: "body-too-long", path, message: `บล็อกเกิน ${MAX_NEWS_BLOCKS}` });
  }
  if (newsBodyImageCount(blocks) > MAX_NEWS_IMAGES) {
    issues.push({ code: "too-many-images", path, message: `รูปเกิน ${MAX_NEWS_IMAGES}` });
  }

  blocks.forEach((block, index) => {
    const at = `${path}[${index}]`;
    if (block.type === "image") {
      if (block.mediaId.trim() === "") issues.push({ code: "image-no-media", path: at, message: "รูปต้องมี mediaId" });
      if (block.alt.trim() === "") issues.push({ code: "image-no-alt", path: at, message: "รูปต้องมี alt (สร้างจากชื่อข่าวได้)" });
      return;
    }
    if (block.text.trim() === "") issues.push({ code: "text-empty", path: at, message: "ข้อความว่าง" });
    if (block.text.length > MAX_NEWS_TEXT_LENGTH) issues.push({ code: "text-too-long", path: at, message: "ข้อความยาวเกิน" });
  });

  return issues;
}

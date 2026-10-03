import type { LocalizedValue } from "@/lib/content/types";

/**
 * โมเดล "บล็อกอิสระ" (page builder) — แกนใหม่ของหลังบ้าน ตามมติผู้ใช้ 2026-10-02
 *
 * หลักการที่ตกลงกัน
 * - หน้าเว็บ 1 หน้า = **รายการบล็อกเรียงกัน** เพิ่ม/ลบ/สลับ/ทำซ้ำได้อิสระ
 * - หน้าตา (สี/ฟอนต์/ระยะห่าง) **เลือกจากพรีเซ็ตของแบรนด์เท่านั้น** — ไม่มีช่องใส่ hex/ฟอนต์เอง
 *   ⇒ โหมดมืด · คอนทราสต์ · a11y · ความสม่ำเสมอแบรนด์ ยังตรวจได้ด้วยด่านเดิม
 * - ข้อความทุกชิ้นเป็น TH/EN (ค่า `en: ""` = ยังไม่มีคำแปล · มติ D3)
 * - เก็บเป็น **JSONB ต่อหน้า** แยก `draft` / `published` + ตารางประวัติ (ย้อนกลับได้)
 *
 * ทำไมเก็บ JSONB (ไม่ใช่ตาราง EAV เหมือน `content_field`)
 * - เนื้อหาแบบอิสระมีรูปทรงต่างกันทุกบล็อก (การ์ด 1-4 ใบ · ภาพซ้าย/ขวา · ข้อความล้วน)
 *   การยัดลง EAV จะได้คีย์ที่เดาไม่ได้และตรวจยาก ⇒ เอกสารเดียวต่อหน้า + ประวัติเป็นก้อน อ่าน/เขียนทั้งหน้าจบในรายการเดียว
 * - หน้าแรกเดิม (140 ฟิลด์มีโครง) ยังอยู่ใน `content_field` และไม่ถูกแตะ — ค่อยย้ายทีละส่วน
 */

export const BLOCK_TYPES = ["hero", "heading", "richText", "imageText", "cards", "cta", "quote", "divider", "row"] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export function isBlockType(value: string): value is BlockType {
  return (BLOCK_TYPES as readonly string[]).includes(value);
}

/* ── รุ่นของรูปทรงบล็อก (X1.1) ───────────────────────────────────────────────
 * ทุกบล็อกมีฟิลด์ `version` ⇒ วันที่รูปทรงเปลี่ยน (เพิ่มฟิลด์/ย้ายความหมาย) เราเพิ่มรุ่น
 * แล้วเขียนตัวย้ายเวอร์ชันไว้ที่ `lib/blocks/migrate.ts` — ข้อมูลเก่าเปิดได้เสมอ ไม่ต้องแก้มือ
 *
 * รุ่น 1 = บล็อกที่บันทึกก่อนรอบที่ 71 (ไม่มีฟิลด์ `version` ในข้อมูล)
 * รุ่น 2 = รุ่นปัจจุบัน: บล็อก `row` (แถว/คอลัมน์) ซ้อนได้ 1 ชั้น
 */
export const BLOCK_SCHEMA_VERSION = 2;
export const LEGACY_BLOCK_SCHEMA_VERSION = 1;

/* ── พรีเซ็ตของแบรนด์ (ค่าเดียวที่เลือกได้ — ไม่มี hex/ฟอนต์อิสระ) ───────────── */

export type BlockAlign = "left" | "center";
export type BlockWidth = "narrow" | "normal" | "wide" | "full";
export type BlockSpacing = "none" | "sm" | "md" | "lg";
export type BlockBackground = "none" | "cream" | "subtle" | "brand";
export type BlockSize = "sm" | "md" | "lg";

export const BLOCK_ALIGNS: readonly BlockAlign[] = ["left", "center"];
export const BLOCK_WIDTHS: readonly BlockWidth[] = ["narrow", "normal", "wide", "full"];
export const BLOCK_SPACINGS: readonly BlockSpacing[] = ["none", "sm", "md", "lg"];
export const BLOCK_BACKGROUNDS: readonly BlockBackground[] = ["none", "cream", "subtle", "brand"];
export const BLOCK_SIZES: readonly BlockSize[] = ["sm", "md", "lg"];

/**
 * ความกว้างของคอลัมน์ในบล็อก "แถว" (X1.1)
 * คิดบนกริด 12 ช่องของเดสก์ท็อป (ค่าเศษส่วนตรงเป๊ะ): ครึ่ง=6 · หนึ่งในสาม=4 · สองในสาม=8 · หนึ่งในสี่=3 · สามในสี่=9
 * ⇒ รวมกันไม่ควรเกิน 12 (validator เตือนถ้าเกิน) · มือถือทุกคอลัมน์เรียงลงมาเต็มความกว้าง
 */
export type BlockColumnWidth = "half" | "third" | "twoThirds" | "quarter" | "threeQuarters" | "full";

export const BLOCK_COLUMN_WIDTHS: readonly BlockColumnWidth[] = ["half", "third", "twoThirds", "quarter", "threeQuarters", "full"];

/** จำนวนช่องบนกริด 12 ที่ความกว้างแต่ละแบบกิน */
export const COLUMN_GRID_SPAN: Record<BlockColumnWidth, number> = {
  half: 6,
  third: 4,
  twoThirds: 8,
  quarter: 3,
  threeQuarters: 9,
  full: 12,
};

export type BlockStyle = {
  readonly align: BlockAlign;
  readonly width: BlockWidth;
  readonly spacing: BlockSpacing;
  readonly background: BlockBackground;
  readonly size: BlockSize;
};

export type BlockMedia = {
  /** พาธไฟล์ในโปรเจกต์ (มติ D9 — ห้ามเก็บ URL เต็ม) */
  readonly path: string;
  readonly altTh: string;
  readonly altEn: string;
  readonly hasWatermark: boolean;
};

export type BlockCard = {
  readonly title: LocalizedValue;
  readonly body: LocalizedValue;
  /** ลิงก์ภายในเว็บ (`/products`) หรือ mailto:/tel:/https:// — ตรวจด้วย `isSafeHref()` */
  readonly href: string;
  readonly image: BlockMedia | null;
};

/**
 * การแสดงผลตามขนาดจอ (X1.6)
 * - `true` = แสดง · `false` = ซ่อน
 * - ไม่มีวัตถุนี้เลย = แสดงทุกขนาด (พฤติกรรมเดิมเป๊ะ)
 */
export type BlockVisibility = {
  readonly desktop: boolean;
  readonly tablet: boolean;
  readonly mobile: boolean;
};

/** ค่าเริ่มต้น: แสดงทุกขนาด */
export const VISIBLE_EVERYWHERE: BlockVisibility = { desktop: true, tablet: true, mobile: true };

/**
 * ขนาดจอที่ "ถูกซ่อน" — คืนอาร์เรย์ว่างเมื่อแสดงทุกขนาด (ผู้เรียกจะได้ไม่ใส่ attribute เลย)
 * ใช้เป็น `data-hide-on="mobile tablet"` แล้วให้ CSS ใน `app/globals.css` ซ่อนให้
 * ⚠️ ทำไมไม่ใช้คลาส `hidden md:block` ของ Tailwind: บล็อกมี `display` หลายแบบ (flex/grid)
 *    การสั่ง `block` ทับจะทำให้เลย์เอาต์เพี้ยน — `display:none` ใน CSS จึงปลอดภัยกว่า
 */
export function hiddenSizesOf(visibility: BlockVisibility | undefined): readonly ("desktop" | "tablet" | "mobile")[] {
  if (visibility === undefined) return [];
  const hidden: ("desktop" | "tablet" | "mobile")[] = [];
  if (!visibility.desktop) hidden.push("desktop");
  if (!visibility.tablet) hidden.push("tablet");
  if (!visibility.mobile) hidden.push("mobile");
  /* ซ่อนทุกขนาด = ไม่มีอะไรให้แสดง ⇒ ถือว่าไม่ต้องใส่ attribute (กันบล็อกหายเงียบ ๆ ในหลังบ้าน) */
  return hidden.length === 3 ? [] : hidden;
}

/** อ่านค่าจากข้อมูลดิบ (ไม่เชื่อข้อมูลจากเบราว์เซอร์) — ไม่มี/ผิดรูป = แสดงทุกขนาด */
export function readVisibility(value: unknown): BlockVisibility | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const desktop = record["desktop"];
  const tablet = record["tablet"];
  const mobile = record["mobile"];
  if (typeof desktop !== "boolean" || typeof tablet !== "boolean" || typeof mobile !== "boolean") return undefined;
  if (desktop && tablet && mobile) return undefined;
  return { desktop, tablet, mobile };
}

type BlockBase = {
  /** รหัสเฉพาะของบล็อกในหน้านี้ (ใช้เป็น React key และใช้อ้างตอนสลับ/ลบ) — **ห้ามซ้ำกันทั้งหน้า รวมบล็อกที่ซ้อนอยู่** */
  readonly id: string;
  /** รุ่นรูปทรงของบล็อก (X1.1) — ดู `BLOCK_SCHEMA_VERSION` และตัวย้ายที่ `lib/blocks/migrate.ts` */
  readonly version: number;
  readonly style: BlockStyle;
  /** ซ่อน/แสดงตามขนาดจอ (ไม่ระบุ = แสดงทุกขนาด) */
  readonly visibility?: BlockVisibility;
};

export type HeroBlock = BlockBase & {
  readonly type: "hero";
  readonly title: LocalizedValue;
  readonly subtitle: LocalizedValue;
  readonly note: LocalizedValue;
  readonly image: BlockMedia | null;
  readonly ctaLabel: LocalizedValue;
  readonly ctaHref: string;
};

export type HeadingBlock = BlockBase & {
  readonly type: "heading";
  readonly text: LocalizedValue;
  /** ระดับหัวเรื่อง — 2 หรือ 3 เท่านั้น (1 สงวนให้ h1 ของหน้า) */
  readonly level: 2 | 3;
};

export type RichTextBlock = BlockBase & {
  readonly type: "richText";
  readonly heading: LocalizedValue;
  readonly body: LocalizedValue;
  readonly ctaLabel: LocalizedValue;
  readonly ctaHref: string;
};

export type ImageTextBlock = BlockBase & {
  readonly type: "imageText";
  readonly heading: LocalizedValue;
  readonly body: LocalizedValue;
  readonly image: BlockMedia | null;
  readonly side: "left" | "right";
};

export type CardsBlock = BlockBase & {
  readonly type: "cards";
  readonly heading: LocalizedValue;
  readonly body: LocalizedValue;
  readonly columns: 1 | 2 | 3 | 4;
  readonly items: readonly BlockCard[];
};

export type CtaBlock = BlockBase & {
  readonly type: "cta";
  readonly heading: LocalizedValue;
  readonly body: LocalizedValue;
  readonly label: LocalizedValue;
  readonly href: string;
  readonly tone: "brand" | "neutral";
};

export type QuoteBlock = BlockBase & {
  readonly type: "quote";
  readonly text: LocalizedValue;
  readonly attribution: LocalizedValue;
};

export type DividerBlock = BlockBase & {
  readonly type: "divider";
};

/**
 * คอลัมน์ในบล็อก "แถว" (X1.1)
 * - `blocks` = บล็อกลูกที่วางในคอลัมน์นี้ (**ซ้อนได้ 1 ชั้น** — แถวซ้อนแถวไม่ได้)
 * - id ของคอลัมน์ไม่ซ้ำกัน **ภายในแถวเดียวกัน** (คนละแถวใช้ id ซ้ำได้ ไม่กระทบการอ้างอิง)
 */
export type BlockColumn = {
  readonly id: string;
  readonly width: BlockColumnWidth;
  readonly blocks: readonly Block[];
};

/** บล็อก "แถว" — แบ่งหน้าเป็นคอลัมน์ แล้ววางบล็อกอื่นซ้อนในแต่ละคอลัมน์ */
export type RowBlock = BlockBase & {
  readonly type: "row";
  readonly columns: readonly BlockColumn[];
};

export type Block =
  | HeroBlock
  | HeadingBlock
  | RichTextBlock
  | ImageTextBlock
  | CardsBlock
  | CtaBlock
  | QuoteBlock
  | DividerBlock
  | RowBlock;

export function isRowBlock(block: Block): block is RowBlock {
  return block.type === "row";
}

export type BlockDocument = {
  readonly page: string;
  readonly blocks: readonly Block[];
};

/* ── แคตตาล็อกบล็อก (ใช้สร้างเมนู "เพิ่มบล็อก" และสร้างค่าเริ่มต้น) ───────────── */

export type BlockCatalogEntry = {
  readonly type: BlockType;
  /** ชื่อที่แสดงในเมนู (ภาษาไทย — อยู่ในไฟล์ .ts ไม่ผิดกฎ i18n) */
  readonly label: string;
  readonly hint: string;
};

export const BLOCK_CATALOG: readonly BlockCatalogEntry[] = [
  { type: "hero", label: "แบนเนอร์เปิดหน้า", hint: "ภาพใหญ่ + หัวข้อ + ปุ่ม" },
  { type: "heading", label: "หัวข้อ", hint: "หัวเรื่องสั้น ๆ คั่นกลางหน้า" },
  { type: "richText", label: "ข้อความ", hint: "หัวข้อ + ย่อหน้า (+ ปุ่มถ้าต้องการ)" },
  { type: "imageText", label: "ภาพ + ข้อความ", hint: "ภาพข้างหนึ่ง ข้อความอีกข้าง" },
  { type: "cards", label: "การ์ด", hint: "การ์ด 1-4 คอลัมน์ พร้อมภาพ" },
  { type: "cta", label: "ปุ่มเชิญชวน", hint: "กล่องเน้น + ปุ่ม" },
  { type: "quote", label: "คำกล่าว", hint: "ข้อความอ้างอิง + ผู้กล่าว" },
  { type: "divider", label: "เส้นคั่น", hint: "เว้นวรรคด้วยเส้นบาง" },
  { type: "row", label: "แถว (คอลัมน์)", hint: "แบ่งเป็น 1-4 คอลัมน์ แล้ววางบล็อกซ้อนในแต่ละคอลัมน์" },
];

export const DEFAULT_BLOCK_STYLE: BlockStyle = {
  align: "left",
  width: "normal",
  spacing: "md",
  background: "none",
  size: "md",
};

/** จำนวนบล็อกสูงสุดต่อหน้า (นับรวมบล็อกที่ซ้อนอยู่ในคอลัมน์) — กันเอกสารบวมและกันหน้าจอหลังบ้านหน่วง */
export const MAX_BLOCKS_PER_PAGE = 60;
/** เพดานรวมทั้งหน้า (นับทุกชั้น) — กันเอกสารบวมจริง ๆ */
export const MAX_BLOCKS_TOTAL = 120;
/** จำนวนคอลัมน์สูงสุดในแถวเดียว */
export const MAX_COLUMNS = 4;
/** จำนวนบล็อกตรงในคอลัมน์เดียว */
export const MAX_BLOCKS_PER_COLUMN = 12;
/**
 * ความลึกที่ซ้อนได้ (ชั้น)
 * 1 = วางบล็อกในคอลัมน์ของแถวได้ แต่ **แถวซ้อนแถวไม่ได้**
 * เหตุผล: กันเลย์เอาต์พังบนมือถือ · กันข้อมูลลึกไม่จำกัดที่แก้/ตรวจยาก · พอเพียงกับหน้าเว็บองค์กร
 */
export const MAX_BLOCK_DEPTH = 1;
/** จำนวนการ์ดสูงสุดในบล็อกเดียว */
export const MAX_CARDS = 12;

export function emptyText(): LocalizedValue {
  return { th: "", en: "" };
}

/** สร้างบล็อกใหม่ตามชนิด พร้อมค่าเริ่มต้นที่พร้อมแก้ */
export function createBlock(type: BlockType, id: string): Block {
  const style: BlockStyle = type === "hero" ? { ...DEFAULT_BLOCK_STYLE, size: "lg", width: "full" } : { ...DEFAULT_BLOCK_STYLE };
  const base = { id, version: BLOCK_SCHEMA_VERSION, style };

  switch (type) {
    case "hero":
      return {
        ...base,
        type: "hero",
        title: emptyText(),
        subtitle: emptyText(),
        note: emptyText(),
        image: null,
        ctaLabel: emptyText(),
        ctaHref: "",
      };
    case "heading":
      return { ...base, type: "heading", text: emptyText(), level: 2 };
    case "richText":
      return { ...base, type: "richText", heading: emptyText(), body: emptyText(), ctaLabel: emptyText(), ctaHref: "" };
    case "imageText":
      return { ...base, type: "imageText", heading: emptyText(), body: emptyText(), image: null, side: "right" };
    case "cards":
      return { ...base, type: "cards", heading: emptyText(), body: emptyText(), columns: 3, items: [] };
    case "cta":
      return { ...base, type: "cta", heading: emptyText(), body: emptyText(), label: emptyText(), href: "", tone: "brand" };
    case "quote":
      return { ...base, type: "quote", text: emptyText(), attribution: emptyText() };
    case "divider":
      return { ...base, type: "divider" };
    case "row":
      /* เริ่มด้วย 2 คอลัมน์แบ่งครึ่ง (ผู้ใช้เพิ่ม/ลด/ปรับความกว้างได้ในแผงตั้งค่า) */
      return { ...base, type: "row", columns: createColumns(2) };
  }
}

/* ── คอลัมน์ของบล็อก "แถว" (X1.1) ─────────────────────────────────────────── */

/** ความกว้างที่ทำให้คอลัมน์ N คอลัมน์แบ่งเท่ากันบนกริด 12 */
export function equalColumnWidth(count: number): BlockColumnWidth {
  if (count <= 1) return "full";
  if (count === 2) return "half";
  if (count === 3) return "third";
  return "quarter";
}

/** สร้างคอลัมน์เริ่มต้น `count` คอลัมน์ แบ่งเท่ากัน (id ในแถว: col-1, col-2, …) */
export function createColumns(count: number): readonly BlockColumn[] {
  const total = Math.max(1, Math.min(count, MAX_COLUMNS));
  const width = equalColumnWidth(total);
  return Array.from({ length: total }, (_unused, index) => ({
    id: `col-${index + 1}`,
    width,
    blocks: [] as readonly Block[],
  }));
}

/** id คอลัมน์ใหม่ที่ไม่ซ้ำกับคอลัมน์ที่มีอยู่ในแถวเดียวกัน */
export function nextColumnId(columns: readonly BlockColumn[]): string {
  let index = columns.length + 1;
  const used = new Set(columns.map((column) => column.id));
  let candidate = `col-${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `col-${index}`;
  }
  return candidate;
}

/** ลิงก์ที่ยอมรับได้ — กัน `javascript:` และค่าที่ไม่ใช่ลิงก์ (ความปลอดภัย) */
export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (value === "") return true;
  if (value.startsWith("/") || value.startsWith("#")) return true;
  if (value.startsWith("mailto:") || value.startsWith("tel:")) return true;
  return /^https:\/\/[^\s]+$/i.test(value);
}

/** สร้าง id ใหม่ที่ไม่ซ้ำกับชุด id ที่ใช้ไปแล้ว (ใช้กับการทำซ้ำ/วางพรีเซ็ตที่ต้องตั้ง id หลายก้อน) */
export function nextBlockIdFrom(used: ReadonlySet<string>): string {
  let index = used.size + 1;
  let candidate = `block-${index}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `block-${index}`;
  }
  return candidate;
}

/** สร้าง id ใหม่ที่ไม่ซ้ำกับที่มีอยู่ — **นับบล็อกที่ซ้อนอยู่ในคอลัมน์ด้วย** (ไม่ใช้สุ่ม เพื่อให้ผลซ้ำได้ในเทสต์) */
export function nextBlockId(existing: readonly Block[]): string {
  return nextBlockIdFrom(new Set(collectBlockIds(existing)));
}

/* ── เดินดูบล็อกทั้งหน้า (รวมบล็อกที่ซ้อน) ───────────────────────────────────
 * ใช้ร่วมกันหลายที่ เพื่อไม่ให้แต่ละที่มีตรรกะเดินต้นไม้คนละชุด (ต้นเหตุบั๊กคลาสสิก):
 * `lib/blocks/validate.ts` (ตรวจเนื้อหา) · `lib/blocks/migrate.ts` (นับรุ่นข้อมูล) · หน้าจอหลังบ้าน
 */

export type BlockNode = {
  readonly block: Block;
  /** เส้นทางในเอกสาร เช่น `blocks[2].columns[0].blocks[1]` (ใช้ชี้จุดที่ผิด) */
  readonly path: string;
  /** แถวที่บรรจุบล็อกนี้ (null = ระดับหน้า) */
  readonly rowId: string | null;
  /** คอลัมน์ที่บรรจุบล็อกนี้ (null = ระดับหน้า) */
  readonly columnId: string | null;
};

/**
 * เดินบล็อกจากบนลงล่าง (แถวก่อน แล้วจึงลูกในคอลัมน์) — ลำดับเดียวกับที่หน้าเว็บเรนเดอร์จริง
 * `pathPrefix` ใช้เปลี่ยนคำนำหน้าของเส้นทาง (ค่าเริ่มต้น `blocks` = รูตของเอกสาร)
 */
export function walkBlocks(blocks: readonly Block[], pathPrefix = "blocks"): readonly BlockNode[] {
  const nodes: BlockNode[] = [];

  blocks.forEach((block, index) => {
    const path = `${pathPrefix}[${index}]`;
    nodes.push({ block, path, rowId: null, columnId: null });

    if (!isRowBlock(block)) return;
    block.columns.forEach((column, columnIndex) => {
      const columnPrefix = `${path}.columns[${columnIndex}].blocks`;
      column.blocks.forEach((child, childIndex) => {
        nodes.push({
          block: child,
          path: `${columnPrefix}[${childIndex}]`,
          rowId: block.id,
          columnId: column.id,
        });
      });
    });
  });

  return nodes;
}

/** จำนวนบล็อกรวมทุกชั้น */
export function countBlocks(blocks: readonly Block[]): number {
  return walkBlocks(blocks).length;
}

/** id ของบล็อกทั้งหมด (รวมที่ซ้อนอยู่) — ใช้กัน id ซ้ำทั้งหน้า */
export function collectBlockIds(blocks: readonly Block[]): readonly string[] {
  return walkBlocks(blocks).map((node) => node.block.id);
}

/** ตำแหน่งของบล็อกในเอกสาร: `rowId`/`columnId` = null แปลว่าอยู่ระดับหน้า */
export type BlockLocation = {
  readonly rowId: string | null;
  readonly columnId: string | null;
  readonly index: number;
};

/** หาตำแหน่งของบล็อก (รวมที่ซ้อนในคอลัมน์) — ไม่พบ = null */
export function findBlockLocation(document: BlockDocument, id: string): BlockLocation | null {
  const index = document.blocks.findIndex((block) => block.id === id);
  if (index >= 0) return { rowId: null, columnId: null, index };

  for (const row of document.blocks) {
    if (!isRowBlock(row)) continue;
    for (const column of row.columns) {
      const childIndex = column.blocks.findIndex((child) => child.id === id);
      if (childIndex >= 0) return { rowId: row.id, columnId: column.id, index: childIndex };
    }
  }

  return null;
}

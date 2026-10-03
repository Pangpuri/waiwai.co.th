import {
  BLOCK_ALIGNS,
  BLOCK_BACKGROUNDS,
  BLOCK_COLUMN_WIDTHS,
  BLOCK_SCHEMA_VERSION,
  BLOCK_SIZES,
  BLOCK_SPACINGS,
  BLOCK_WIDTHS,
  DEFAULT_BLOCK_STYLE,
  FORM_BLOCK_KINDS,
  LEGACY_BLOCK_SCHEMA_VERSION,
  MAX_BLOCKS_PER_COLUMN,
  MAX_BLOCKS_PER_PAGE,
  MAX_BLOCKS_TOTAL,
  MAX_BLOCK_DEPTH,
  MAX_CARDS,
  MAX_COLUMNS,
  MAX_GALLERY_ITEMS,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  countBlocks,
  emptyText,
  equalColumnWidth,
  isBlockType,
  nextPrefixedId,
  readVisibility,
  type Block,
  type BlockCard,
  type BlockColumn,
  type BlockColumnWidth,
  type BlockDocument,
  type BlockGalleryItem,
  type BlockMedia,
  type BlockStyle,
  type BlockTableRow,
} from "@/lib/blocks/types";
import { migrateDocumentValue } from "@/lib/blocks/migrate";
import type { LocalizedValue } from "@/lib/content/types";

/**
 * แปลงสิ่งที่หน้าจอส่งมา (unknown) เป็นเอกสารบล็อกที่เชื่อถือได้
 *
 * เหมือน `lib/content/parse.ts`: **ไม่เชื่อข้อมูลจากเบราว์เซอร์** และ **ไม่โยน error**
 * บล็อกที่รูปทรงเสียหายจะถูกรายงานใน `problems` และถูกข้าม (ไม่ทำให้ทั้งหน้าพัง)
 *
 * ตั้งแต่รอบที่ 71 (X1.1)
 * - **ย้ายรุ่นก่อนอ่านเสมอ** (`migrateDocumentValue`) ⇒ ข้อมูลที่บันทึกด้วยรุ่นเก่าเปิดได้เหมือนเดิม
 * - อ่าน **บล็อกซ้อน** (`row` → คอลัมน์ → บล็อกลูก) ได้ 1 ชั้น · id ต้องไม่ซ้ำกัน **ทั้งหน้า** (รวมของที่ซ้อน)
 * - รุ่นที่ใหม่กว่ารุ่นที่ระบบรู้จัก = ข้ามบล็อกนั้นพร้อมรายงาน (กันเขียนทับข้อมูลของโค้ดรุ่นถัดไป)
 */

export type BlockParseOutcome =
  | { readonly ok: true; readonly document: BlockDocument }
  | { readonly ok: false; readonly problems: readonly string[] };

type ParseContext = {
  /** ความลึกปัจจุบัน (0 = ระดับหน้า) — ใช้กัน "แถวซ้อนแถว" */
  readonly depth: number;
  /** id ที่ใช้ไปแล้วทั้งหน้า (รวมบล็อกที่ซ้อน) */
  readonly seenIds: Set<string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(container: Record<string, unknown>, key: string, path: string, problems: string[]): string {
  const value = container[key];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    problems.push(`${path}: ต้องเป็นข้อความ`);
    return "";
  }
  return value;
}

function readText(container: Record<string, unknown>, key: string, path: string, problems: string[]): LocalizedValue {
  const value = container[key];
  if (value === undefined || value === null) return emptyText();
  if (!isRecord(value)) {
    problems.push(`${path}: ต้องเป็นออบเจ็กต์ {th, en}`);
    return emptyText();
  }
  return {
    th: readString(value, "th", `${path}.th`, problems),
    en: readString(value, "en", `${path}.en`, problems),
  };
}

function readBoolean(container: Record<string, unknown>, key: string, path: string, problems: string[]): boolean {
  const value = container[key];
  if (value === undefined || value === null) return false;
  if (typeof value !== "boolean") {
    problems.push(`${path}: ต้องเป็น true/false`);
    return false;
  }
  return value;
}

/** ภาพที่ไม่มีพาธ = ไม่มีภาพ (เหมือนกันทั้งระบบ) */
function readMedia(container: Record<string, unknown>, key: string, path: string, problems: string[]): BlockMedia | null {
  const value = container[key];
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    problems.push(`${path}: ต้องเป็นออบเจ็กต์ของภาพ`);
    return null;
  }

  const mediaPath = readString(value, "path", `${path}.path`, problems);
  if (mediaPath === "") return null;

  return {
    path: mediaPath,
    altTh: readString(value, "altTh", `${path}.altTh`, problems),
    altEn: readString(value, "altEn", `${path}.altEn`, problems),
    hasWatermark: readBoolean(value, "hasWatermark", `${path}.hasWatermark`, problems),
  };
}

function readChoice<T extends string>(
  container: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
  path: string,
  problems: string[],
): T {
  const value = container[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    problems.push(`${path}: ต้องเป็นหนึ่งใน ${allowed.join(" | ")}`);
    return fallback;
  }
  return value as T;
}

function readIntChoice(
  container: Record<string, unknown>,
  key: string,
  allowed: readonly number[],
  fallback: number,
  path: string,
  problems: string[],
): number {
  const value = container[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !allowed.includes(value)) {
    problems.push(`${path}: ต้องเป็นหนึ่งใน ${allowed.join(" | ")}`);
    return fallback;
  }
  return value;
}

function readStyle(block: Record<string, unknown>, path: string, problems: string[]): BlockStyle {
  const style = isRecord(block["style"]) ? block["style"] : {};
  if (block["style"] !== undefined && !isRecord(block["style"])) {
    problems.push(`${path}.style: ต้องเป็นออบเจ็กต์`);
  }

  return {
    align: readChoice(style, "align", BLOCK_ALIGNS, DEFAULT_BLOCK_STYLE.align, `${path}.style.align`, problems),
    width: readChoice(style, "width", BLOCK_WIDTHS, DEFAULT_BLOCK_STYLE.width, `${path}.style.width`, problems),
    spacing: readChoice(style, "spacing", BLOCK_SPACINGS, DEFAULT_BLOCK_STYLE.spacing, `${path}.style.spacing`, problems),
    background: readChoice(style, "background", BLOCK_BACKGROUNDS, DEFAULT_BLOCK_STYLE.background, `${path}.style.background`, problems),
    size: readChoice(style, "size", BLOCK_SIZES, DEFAULT_BLOCK_STYLE.size, `${path}.style.size`, problems),
  };
}

function readCards(container: Record<string, unknown>, path: string, problems: string[]): readonly BlockCard[] {
  const value = container["items"];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    problems.push(`${path}.items: ต้องเป็นรายการ (array)`);
    return [];
  }

  if (value.length > MAX_CARDS) {
    problems.push(`${path}.items: เกินที่อนุญาต (${value.length} > ${MAX_CARDS}) — ตัดส่วนเกินทิ้ง`);
  }

  return value.slice(0, MAX_CARDS).map((entry, index) => {
    const cardPath = `${path}.items[${index}]`;
    if (!isRecord(entry)) {
      problems.push(`${cardPath}: ต้องเป็นออบเจ็กต์`);
      return { title: emptyText(), body: emptyText(), href: "", image: null };
    }
    return {
      title: readText(entry, "title", `${cardPath}.title`, problems),
      body: readText(entry, "body", `${cardPath}.body`, problems),
      href: readString(entry, "href", `${cardPath}.href`, problems),
      image: readMedia(entry, "image", `${cardPath}.image`, problems),
    };
  });
}

/** อ่านข้อความ TH/EN จากค่าดิบตรง ๆ (ใช้กับรายการ เช่น หัวคอลัมน์/เซลล์/คำบรรยายภาพ) */
function toText(value: unknown, path: string, problems: string[]): LocalizedValue {
  if (value === undefined || value === null) return emptyText();
  if (!isRecord(value)) {
    problems.push(`${path}: ต้องเป็นออบเจ็กต์ {th, en}`);
    return emptyText();
  }
  return {
    th: readString(value, "th", `${path}.th`, problems),
    en: readString(value, "en", `${path}.en`, problems),
  };
}

/** อ่านภาพจากค่าดิบตรง ๆ — ไม่มีพาธ = null (เหมือนกันทั้งระบบ) */
function toMedia(value: unknown, path: string, problems: string[]): BlockMedia | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    problems.push(`${path}: ต้องเป็นออบเจ็กต์ของภาพ`);
    return null;
  }
  const mediaPath = readString(value, "path", `${path}.path`, problems);
  if (mediaPath === "") return null;
  return {
    path: mediaPath,
    altTh: readString(value, "altTh", `${path}.altTh`, problems),
    altEn: readString(value, "altEn", `${path}.altEn`, problems),
    hasWatermark: readBoolean(value, "hasWatermark", `${path}.hasWatermark`, problems),
  };
}

/** อ่านรายการข้อความ TH/EN (หัวคอลัมน์ของตาราง) พร้อมเพดานจำนวน */
function readTextList(
  container: Record<string, unknown>,
  key: string,
  path: string,
  problems: string[],
  limit: number,
): readonly LocalizedValue[] {
  const value = container[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    problems.push(`${path}.${key}: ต้องเป็นรายการ`);
    return [];
  }
  if (value.length > limit) {
    problems.push(`${path}.${key}: เกินที่อนุญาต (${value.length} > ${limit}) — ตัดส่วนเกินทิ้ง`);
  }
  return value.slice(0, limit).map((raw, index) => toText(raw, `${path}.${key}[${index}]`, problems));
}

/** อ่านแถวของตาราง — **จัดช่องให้เท่าหัวคอลัมน์เสมอ** (ขาด = ว่าง · เกิน = ตัดทิ้ง) */
function readTableRows(
  entry: Record<string, unknown>,
  path: string,
  problems: string[],
  columnCount: number,
): readonly BlockTableRow[] {
  const value = entry["rows"];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    problems.push(`${path}.rows: ต้องเป็นรายการ`);
    return [];
  }
  if (value.length > MAX_TABLE_ROWS) {
    problems.push(`${path}.rows: เกินที่อนุญาต (${value.length} > ${MAX_TABLE_ROWS}) — ตัดส่วนเกินทิ้ง`);
  }

  const seen = new Set<string>();
  return value.slice(0, MAX_TABLE_ROWS).map((raw, index) => {
    const rowPath = `${path}.rows[${index}]`;
    const record = isRecord(raw) ? raw : {};
    if (!isRecord(raw)) problems.push(`${rowPath}: ต้องเป็นออบเจ็กต์`);

    let id = readString(record, "id", `${rowPath}.id`, problems);
    if (id === "" || seen.has(id)) {
      if (id !== "") problems.push(`${rowPath}.id: ซ้ำกับแถวก่อนหน้า — สร้างรหัสใหม่ให้`);
      id = nextPrefixedId("row", seen);
    }
    seen.add(id);

    const cellsRaw = record["cells"];
    if (cellsRaw !== undefined && !Array.isArray(cellsRaw)) problems.push(`${rowPath}.cells: ต้องเป็นรายการ`);
    const cells = Array.isArray(cellsRaw) ? cellsRaw : [];
    const normalized = Array.from({ length: columnCount }, (_unused, cellIndex) =>
      toText(cells[cellIndex], `${rowPath}.cells[${cellIndex}]`, problems),
    );
    return { id, cells: normalized };
  });
}

/** อ่านภาพในแกลเลอรี — ใบที่ยังไม่เลือกภาพ (`image = null`) ยังเก็บไว้ได้ (validator เตือนเอง) */
function readGalleryItems(entry: Record<string, unknown>, path: string, problems: string[]): readonly BlockGalleryItem[] {
  const value = entry["items"];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    problems.push(`${path}.items: ต้องเป็นรายการ`);
    return [];
  }
  if (value.length > MAX_GALLERY_ITEMS) {
    problems.push(`${path}.items: เกินที่อนุญาต (${value.length} > ${MAX_GALLERY_ITEMS}) — ตัดส่วนเกินทิ้ง`);
  }

  const seen = new Set<string>();
  const items: BlockGalleryItem[] = [];
  value.slice(0, MAX_GALLERY_ITEMS).forEach((raw, index) => {
    const itemPath = `${path}.items[${index}]`;
    if (!isRecord(raw)) {
      problems.push(`${itemPath}: ต้องเป็นออบเจ็กต์`);
      return;
    }

    let id = readString(raw, "id", `${itemPath}.id`, problems);
    if (id === "" || seen.has(id)) {
      if (id !== "") problems.push(`${itemPath}.id: ซ้ำกับภาพก่อนหน้า — สร้างรหัสใหม่ให้`);
      id = nextPrefixedId("img", seen);
    }
    seen.add(id);

    items.push({
      id,
      image: toMedia(raw["image"], `${itemPath}.image`, problems),
      caption: toText(raw["caption"], `${itemPath}.caption`, problems),
    });
  });
  return items;
}

/** จำนวนคอลัมน์ของแกลเลอรี (2 | 3 | 4) */
function readGalleryColumns(container: Record<string, unknown>, path: string, problems: string[]): 2 | 3 | 4 {
  const value = readIntChoice(container, "columns", [2, 3, 4], 3, path, problems);
  return value === 2 ? 2 : value === 4 ? 4 : 3;
}

function readColumns(container: Record<string, unknown>, path: string, problems: string[]): 1 | 2 | 3 | 4 {
  const value = readIntChoice(container, "columns", [1, 2, 3, 4], 3, path, problems);
  if (value === 1) return 1;
  if (value === 2) return 2;
  if (value === 3) return 3;
  return 4;
}

/** สร้าง id ใหม่ที่ยังไม่ถูกใช้ทั้งหน้า (ผลซ้ำได้ — ไม่ใช้การสุ่ม) */
function freshBlockId(seen: Set<string>): string {
  let index = seen.size + 1;
  let candidate = `block-${index}`;
  while (seen.has(candidate)) {
    index += 1;
    candidate = `block-${index}`;
  }
  return candidate;
}

/** สร้าง id คอลัมน์ใหม่ที่ไม่ซ้ำภายในแถวเดียว */
function freshColumnId(seen: Set<string>): string {
  let index = seen.size + 1;
  let candidate = `col-${index}`;
  while (seen.has(candidate)) {
    index += 1;
    candidate = `col-${index}`;
  }
  return candidate;
}

/**
 * อ่านรุ่นของบล็อก
 * - ไม่มีฟิลด์ = รุ่น 1 (ข้อมูลก่อนรอบที่ 71) ⇒ ถือว่าใช้ได้ (ตัวย้ายรุ่นประทับรุ่นให้แล้ว/จะประทับตอนบันทึก)
 * - รุ่นใหม่กว่ารุ่นที่โค้ดนี้รู้จัก = **ข้ามบล็อกนี้พร้อมรายงาน** (ไม่เดา ไม่เขียนทับ)
 */
function readBlockVersion(entry: Record<string, unknown>, path: string, problems: string[]): number | null {
  const raw = entry["version"];
  if (raw === undefined || raw === null) return LEGACY_BLOCK_SCHEMA_VERSION;

  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) {
    problems.push(`${path}.version: ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป`);
    return null;
  }
  if (raw > BLOCK_SCHEMA_VERSION) {
    problems.push(`${path}.version: บล็อกถูกบันทึกด้วยรุ่นใหม่กว่า (${raw} > ${BLOCK_SCHEMA_VERSION}) — ข้ามบล็อกนี้`);
    return null;
  }
  return raw;
}

/** อ่านคอลัมน์ของบล็อก "แถว" (พร้อมบล็อกลูกด้านใน) */
function readRowColumns(
  entry: Record<string, unknown>,
  path: string,
  problems: string[],
  context: ParseContext,
): readonly BlockColumn[] {
  const value = entry["columns"];
  if (!Array.isArray(value)) {
    problems.push(`${path}.columns: ต้องเป็นรายการคอลัมน์`);
    return [];
  }
  if (value.length === 0) {
    problems.push(`${path}.columns: ต้องมีอย่างน้อย 1 คอลัมน์`);
    return [];
  }
  if (value.length > MAX_COLUMNS) {
    problems.push(`${path}.columns: จำนวนเกินที่อนุญาต (${value.length} > ${MAX_COLUMNS}) — ตัดส่วนเกินทิ้ง`);
  }

  const seenColumnIds = new Set<string>();
  const defaultWidth = equalColumnWidth(Math.min(value.length, MAX_COLUMNS));

  return value.slice(0, MAX_COLUMNS).map((raw, index): BlockColumn => {
    const columnPath = `${path}.columns[${index}]`;
    if (!isRecord(raw)) {
      problems.push(`${columnPath}: ต้องเป็นออบเจ็กต์`);
      const id = freshColumnId(seenColumnIds);
      seenColumnIds.add(id);
      return { id, width: defaultWidth, blocks: [] };
    }

    let id = readString(raw, "id", `${columnPath}.id`, problems);
    if (id === "" || seenColumnIds.has(id)) {
      if (id !== "") problems.push(`${columnPath}.id: ซ้ำกับคอลัมน์ก่อนหน้า — สร้างรหัสใหม่ให้`);
      id = freshColumnId(seenColumnIds);
    }
    seenColumnIds.add(id);

    const width = readChoice<BlockColumnWidth>(raw, "width", BLOCK_COLUMN_WIDTHS, defaultWidth, `${columnPath}.width`, problems);
    const blocks = readBlockList(raw["blocks"] ?? [], `${columnPath}.blocks`, problems, {
      depth: context.depth + 1,
      seenIds: context.seenIds,
    }, MAX_BLOCKS_PER_COLUMN);

    return { id, width, blocks };
  });
}

/** อ่านบล็อกหนึ่งก้อน (เรียกซ้ำได้สำหรับบล็อกลูกในคอลัมน์) */
function readBlock(entry: unknown, path: string, problems: string[], context: ParseContext): Block | null {
  if (!isRecord(entry)) {
    problems.push(`${path}: ต้องเป็นออบเจ็กต์`);
    return null;
  }

  const rawType = entry["type"];
  if (typeof rawType !== "string" || !isBlockType(rawType)) {
    problems.push(`${path}.type: ไม่รู้จักชนิดบล็อก "${String(rawType)}" — ข้ามบล็อกนี้`);
    return null;
  }

  /* ซ้อนได้ 1 ชั้น: "แถวในแถว" ถูกปฏิเสธ (กันเลย์เอาต์พัง + กันข้อมูลลึกไม่จำกัด) */
  if (rawType === "row" && context.depth >= MAX_BLOCK_DEPTH) {
    problems.push(`${path}.type: ซ้อนแถวในแถวไม่ได้ (ลึกเกิน ${MAX_BLOCK_DEPTH} ชั้น) — ข้ามบล็อกนี้`);
    return null;
  }

  const version = readBlockVersion(entry, path, problems);
  if (version === null) return null;

  const id = readString(entry, "id", `${path}.id`, problems);
  const style = readStyle(entry, path, problems);
  /* ซ่อน/แสดงตามขนาดจอ (X1.6) — ค่าผิดรูป/แสดงทุกขนาด = ไม่ใส่ฟิลด์ (พฤติกรรมเดิมเป๊ะ) */
  const visibility = readVisibility(entry["visibility"]);
  /* ผลลัพธ์ที่ได้เป็น "รุ่นปัจจุบัน" เสมอ (ผ่านตัวย้ายรุ่นมาแล้ว) */
  const base =
    visibility === undefined
      ? { id, version: BLOCK_SCHEMA_VERSION, style }
      : { id, version: BLOCK_SCHEMA_VERSION, style, visibility };

  switch (rawType) {
    case "hero":
      return {
        ...base,
        type: "hero",
        title: readText(entry, "title", `${path}.title`, problems),
        subtitle: readText(entry, "subtitle", `${path}.subtitle`, problems),
        note: readText(entry, "note", `${path}.note`, problems),
        image: readMedia(entry, "image", `${path}.image`, problems),
        ctaLabel: readText(entry, "ctaLabel", `${path}.ctaLabel`, problems),
        ctaHref: readString(entry, "ctaHref", `${path}.ctaHref`, problems),
      };
    case "heading":
      return {
        ...base,
        type: "heading",
        text: readText(entry, "text", `${path}.text`, problems),
        level: readIntChoice(entry, "level", [2, 3], 2, `${path}.level`, problems) === 3 ? 3 : 2,
      };
    case "richText":
      return {
        ...base,
        type: "richText",
        heading: readText(entry, "heading", `${path}.heading`, problems),
        body: readText(entry, "body", `${path}.body`, problems),
        ctaLabel: readText(entry, "ctaLabel", `${path}.ctaLabel`, problems),
        ctaHref: readString(entry, "ctaHref", `${path}.ctaHref`, problems),
      };
    case "imageText":
      return {
        ...base,
        type: "imageText",
        heading: readText(entry, "heading", `${path}.heading`, problems),
        body: readText(entry, "body", `${path}.body`, problems),
        image: readMedia(entry, "image", `${path}.image`, problems),
        side: readChoice(entry, "side", ["left", "right"] as const, "right", `${path}.side`, problems),
      };
    case "cards":
      return {
        ...base,
        type: "cards",
        heading: readText(entry, "heading", `${path}.heading`, problems),
        body: readText(entry, "body", `${path}.body`, problems),
        columns: readColumns(entry, `${path}.columns`, problems),
        items: readCards(entry, path, problems),
      };
    case "cta":
      return {
        ...base,
        type: "cta",
        heading: readText(entry, "heading", `${path}.heading`, problems),
        body: readText(entry, "body", `${path}.body`, problems),
        label: readText(entry, "label", `${path}.label`, problems),
        href: readString(entry, "href", `${path}.href`, problems),
        tone: readChoice(entry, "tone", ["brand", "neutral"] as const, "brand", `${path}.tone`, problems),
      };
    case "quote":
      return {
        ...base,
        type: "quote",
        text: readText(entry, "text", `${path}.text`, problems),
        attribution: readText(entry, "attribution", `${path}.attribution`, problems),
      };
    case "divider":
      return { ...base, type: "divider" };
    case "table": {
      const columns = readTextList(entry, "columns", path, problems, MAX_TABLE_COLUMNS);
      if (columns.length === 0) problems.push(`${path}.columns: ต้องมีอย่างน้อย 1 คอลัมน์`);
      return {
        ...base,
        type: "table",
        heading: readText(entry, "heading", `${path}.heading`, problems),
        caption: readText(entry, "caption", `${path}.caption`, problems),
        columns,
        rows: readTableRows(entry, path, problems, columns.length),
        firstColumnHeader: readBoolean(entry, "firstColumnHeader", `${path}.firstColumnHeader`, problems),
      };
    }
    case "map":
      return {
        ...base,
        type: "map",
        heading: readText(entry, "heading", `${path}.heading`, problems),
        caption: readText(entry, "caption", `${path}.caption`, problems),
        image: readMedia(entry, "image", `${path}.image`, problems),
        linkHref: readString(entry, "linkHref", `${path}.linkHref`, problems),
        linkLabel: readText(entry, "linkLabel", `${path}.linkLabel`, problems),
      };
    case "form":
      return {
        ...base,
        type: "form",
        kind: readChoice(entry, "kind", FORM_BLOCK_KINDS, "contact", `${path}.kind`, problems),
        heading: readText(entry, "heading", `${path}.heading`, problems),
        body: readText(entry, "body", `${path}.body`, problems),
      };
    case "gallery":
      return {
        ...base,
        type: "gallery",
        heading: readText(entry, "heading", `${path}.heading`, problems),
        items: readGalleryItems(entry, path, problems),
        columns: readGalleryColumns(entry, `${path}.columns`, problems),
      };
    case "row":
      return { ...base, type: "row", columns: readRowColumns(entry, path, problems, context) };
  }
}

/**
 * อ่านรายการบล็อก (ใช้ทั้งระดับหน้าและระดับคอลัมน์)
 * - `limit` = เพดานของภาชนะนั้น (หน้า 60 · คอลัมน์ 12)
 * - **id ซ้ำกันทั้งหน้า** ⇒ สร้างรหัสใหม่ให้พร้อมรายงาน (หน้าจอจะได้ไม่สับสนว่ากำลังเลือกก้อนไหน)
 */
function readBlockList(
  raw: unknown,
  path: string,
  problems: string[],
  context: ParseContext,
  limit: number,
): Block[] {
  if (!Array.isArray(raw)) {
    problems.push(`${path}: ต้องเป็นรายการ (array)`);
    return [];
  }

  if (raw.length > limit) {
    problems.push(`${path}: จำนวนเกินที่อนุญาต (${raw.length} > ${limit}) — ตัดส่วนเกินทิ้ง`);
  }

  const blocks: Block[] = [];
  raw.slice(0, limit).forEach((entry, index) => {
    const block = readBlock(entry, `${path}[${index}]`, problems, context);
    if (block === null) return;

    let id = block.id;
    if (id === "" || context.seenIds.has(id)) {
      if (id !== "") problems.push(`${path}[${index}].id: ซ้ำกับบล็อกก่อนหน้า — สร้างรหัสใหม่ให้`);
      id = freshBlockId(context.seenIds);
    }
    context.seenIds.add(id);
    blocks.push({ ...block, id });
  });

  return blocks;
}

export function parseBlockDocument(page: string, raw: unknown): BlockParseOutcome {
  const problems: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, problems: ["ข้อมูลที่ส่งมาไม่ใช่ออบเจ็กต์"] };
  }

  /* ย้ายรุ่นก่อนอ่าน (X1.1) — ข้อมูลเก่าเปิดได้เสมอ · ผลซ้ำได้ถ้าเป็นรุ่นปัจจุบันอยู่แล้ว */
  const migrated = migrateDocumentValue(raw);
  const source = isRecord(migrated) ? migrated : raw;

  const rawBlocks = source["blocks"];
  if (!Array.isArray(rawBlocks)) {
    return { ok: false, problems: ["ไม่พบ blocks ในข้อมูลที่ส่งมา"] };
  }

  const context: ParseContext = { depth: 0, seenIds: new Set<string>() };
  const blocks = readBlockList(rawBlocks, "blocks", problems, context, MAX_BLOCKS_PER_PAGE);

  const total = countBlocks(blocks);
  if (total > MAX_BLOCKS_TOTAL) {
    problems.push(`จำนวนบล็อกรวมทุกชั้นเกินที่อนุญาต (${total} > ${MAX_BLOCKS_TOTAL}) — ตัดส่วนเกินทิ้ง`);
  }

  if (problems.length > 0) {
    return { ok: false, problems };
  }

  return { ok: true, document: { page, blocks } };
}

/** แปลงเอกสารกลับเป็นค่าที่ส่งเป็น JSON ได้ (ใช้กับฟอร์ม/PG jsonb) */
export function documentToJson(document: BlockDocument): unknown {
  return JSON.parse(JSON.stringify(document)) as unknown;
}

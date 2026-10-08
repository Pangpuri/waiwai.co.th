import {
  HERO_ZOOM_MAX,
  HERO_ZOOM_MIN,
  MAX_BLOCKS_PER_COLUMN,
  MAX_BLOCKS_PER_PAGE,
  MAX_BLOCKS_TOTAL,
  MAX_CARDS,
  MAX_COLUMNS,
  MAX_GALLERY_ITEMS,
  MAX_HERO_SLIDES,
  MAX_JOB_ITEMS,
  MAX_RECIPE_ITEMS,
  MAX_ROSTER_MEMBERS,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  VISIBLE_EVERYWHERE,
  collectBlockIds,
  countBlocks,
  createBlock,
  DEFAULT_PAGE_LAYOUT,
  emptyText,
  equalColumnWidth,
  findBlockLocation,
  isRowBlock,
  layoutOf,
  nextBlockIdFrom,
  nextColumnId,
  nextPrefixedId,
  type Block,
  type BlockCard,
  type BlockColumnWidth,
  type BlockDocument,
  type BlockDocumentLanguage,
  type BlockLocation,
  type BlockStyle,
  type BlockType,
  type BlockVisibility,
  type HeroSlideItem,
  type PageLayout,
} from "@/lib/blocks/types";
import { clampShowcaseOptions, type ProductShowcaseOptions } from "@/lib/blocks/product-showcase";

/**
 * การแก้เอกสารบล็อก (เพิ่ม/ลบ/สลับ/ทำซ้ำ/แก้ข้อความ/วางในคอลัมน์) — ตรรกะล้วน ทดสอบได้โดยไม่ต้องมี React
 *
 * ชนิดข้อมูลจริงเป็น readonly โดยตั้งใจ (กันโค้ดหน้าเว็บแก้พลาด) · หน้าจอจึงแก้ผ่านฟังก์ชันในไฟล์นี้
 * ซึ่งโคลนเอกสารทั้งก้อนแล้วแก้เฉพาะจุด — เอกสารมีขนาดเล็ก (ไม่กี่สิบบล็อก) จึงแลกความง่ายกับประสิทธิภาพได้
 *
 * ตั้งแต่รอบที่ 71 (X1.1) ทุกฟังก์ชันที่รับ `id` **ทำงานกับบล็อกที่ซ้อนอยู่ในคอลัมน์ได้ด้วย**
 * (เดิมหาแค่ระดับหน้า ⇒ บล็อกลูกแก้ไม่ได้) · ตำแหน่งของบล็อกอธิบายด้วย `BlockLocation`
 */

type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;

type MutableBlock = DeepMutable<Block>;
type MutableDocument = { page: string; blocks: MutableBlock[]; layout?: PageLayout; layoutEn?: PageLayout };

export type BlockLanguage = "th" | "en";

/** ตำแหน่งปลายทางของการเพิ่ม/ย้ายบล็อก (`rowId`/`columnId` = null ⇒ ระดับหน้า) */
export type BlockTarget = {
  readonly rowId: string | null;
  readonly columnId: string | null;
  readonly index: number;
};

/** ผลของการเพิ่มบล็อก — คืน id ที่สร้างให้ด้วย เพื่อให้หน้าจอเลือกบล็อกใหม่ได้ทันที */
export type InsertResult = {
  readonly document: BlockDocument;
  readonly blockId: string | null;
};

function clone(document: BlockDocument): MutableDocument {
  return structuredClone(document) as unknown as MutableDocument;
}

function isLocalized(value: unknown): value is { th: string; en: string } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { th?: unknown; en?: unknown };
  return typeof candidate.th === "string" && typeof candidate.en === "string";
}

/* ── ภาชนะที่บรรจุบล็อก (ระดับหน้า หรือคอลัมน์ของแถว) ─────────────────────── */

/** อ่านภาชนะแบบอ่านอย่างเดียว (ไม่พบ = null) */
function readContainer(document: BlockDocument, rowId: string | null, columnId: string | null): readonly Block[] | null {
  if (rowId === null && columnId === null) return document.blocks;
  if (rowId === null || columnId === null) return null;
  const row = document.blocks.find((block) => block.id === rowId);
  if (row === undefined || row.type !== "row") return null;
  const column = row.columns.find((entry) => entry.id === columnId);
  return column === undefined ? null : column.blocks;
}

/** อ่านภาชนะของ "เอกสารที่โคลนมาแล้ว" เพื่อแก้ค่า */
function containerIn(document: MutableDocument, rowId: string | null, columnId: string | null): MutableBlock[] | null {
  if (rowId === null && columnId === null) return document.blocks;
  if (rowId === null || columnId === null) return null;
  const row = document.blocks.find((block) => block.id === rowId);
  if (row === undefined || row.type !== "row") return null;
  const column = row.columns.find((entry) => entry.id === columnId);
  return column === undefined ? null : column.blocks;
}

/** บล็อกที่ตำแหน่งนั้น (ไม่พบ = null) */
function blockAt(document: BlockDocument, location: BlockLocation): Block | null {
  const container = readContainer(document, location.rowId, location.columnId);
  return container?.[location.index] ?? null;
}

/** เพดานของภาชนะปลายทาง */
function limitOf(rowId: string | null): number {
  return rowId === null ? MAX_BLOCKS_PER_PAGE : MAX_BLOCKS_PER_COLUMN;
}

/** ให้ id ใหม่กับบล็อกก้อนหนึ่ง **และบล็อกลูกทั้งหมด** (ใช้ตอนทำซ้ำ/วางพรีเซ็ต) */
function withFreshIds(block: MutableBlock, used: Set<string>): MutableBlock {
  const id = nextBlockIdFrom(used);
  used.add(id);
  block.id = id;

  if (block.type === "row") {
    for (const column of block.columns) {
      for (const child of column.blocks) withFreshIds(child, used);
    }
  }

  return block;
}

/** โคลนเอกสาร แก้บล็อกที่ระบุ (ที่ไหนก็ได้ในหน้า) แล้วคืนเอกสารใหม่ (คืนของเดิมถ้าไม่พบบล็อก) */
function withBlock(document: BlockDocument, id: string, mutate: (block: MutableBlock) => void): BlockDocument {
  const location = findBlockLocation(document, id);
  if (location === null) return document;

  const next = clone(document);
  const container = containerIn(next, location.rowId, location.columnId);
  const block = container?.[location.index];
  if (block === undefined) return document;

  mutate(block);
  return next as unknown as BlockDocument;
}

/* ── แก้ค่าภายในบล็อก ──────────────────────────────────────────────────── */

export function setBlockStyle(document: BlockDocument, id: string, patch: Partial<BlockStyle>): BlockDocument {
  return withBlock(document, id, (block) => {
    Object.assign(block.style, patch);
  });
}

/**
 * ตั้งค่า "ซ่อน/แสดงตามขนาดจอ" ของบล็อก (X1.6)
 * - ตั้งให้แสดงทุกขนาด ⇒ **ลบฟิลด์ทิ้ง** (ข้อมูลสะอาด + DOM เหมือนเดิมเป๊ะ)
 */
export function setBlockVisibility(document: BlockDocument, id: string, patch: Partial<BlockVisibility>): BlockDocument {
  return withBlock(document, id, (block) => {
    const current: BlockVisibility = block.visibility ?? VISIBLE_EVERYWHERE;
    const next: BlockVisibility = { ...current, ...patch };

    if (next.desktop && next.tablet && next.mobile) {
      delete block.visibility;
      return;
    }
    block.visibility = next;
  });
}

/** แก้ข้อความ TH/EN — ถ้าบล็อกชนิดนั้นไม่มีฟิลด์นี้ ฟิลด์จะไม่ถูกแตะ (กันบั๊กจากหน้าจอ) */
export function setBlockText(
  document: BlockDocument,
  id: string,
  field: string,
  language: BlockLanguage,
  value: string,
): BlockDocument {
  return withBlock(document, id, (block) => {
    const target = (block as unknown as Record<string, unknown>)[field];
    if (isLocalized(target)) target[language] = value;
  });
}

/** แก้ค่าที่เป็นข้อความธรรมดา เช่น `href` · `ctaHref` */
export function setBlockString(document: BlockDocument, id: string, field: string, value: string): BlockDocument {
  return withBlock(document, id, (block) => {
    const container = block as unknown as Record<string, unknown>;
    if (typeof container[field] === "string") container[field] = value;
  });
}

/** แก้ค่าที่เลือกได้ (level/columns/side/tone) */
export function setBlockChoice(document: BlockDocument, id: string, field: string, value: string | number): BlockDocument {
  return withBlock(document, id, (block) => {
    const container = block as unknown as Record<string, unknown>;
    const current = container[field];
    if (typeof current === "number" && typeof value === "number") container[field] = value;
    if (typeof current === "string" && typeof value === "string") container[field] = value;
  });
}

/** ตั้งค่าภาพของบล็อก (path/alt/ลายน้ำ) — พาธว่าง = ลบภาพ */
export function setBlockImage(
  document: BlockDocument,
  id: string,
  patch: { path?: string; altTh?: string; altEn?: string; hasWatermark?: boolean },
): BlockDocument {
  return withBlock(document, id, (block) => {
    const container = block as unknown as Record<string, unknown>;
    if (!("image" in container)) return;

    const current = container["image"];
    const base = isLocalized(current)
      ? { path: "", altTh: "", altEn: "", hasWatermark: false }
      : (current as { path: string; altTh: string; altEn: string; hasWatermark: boolean } | null) ?? {
          path: "",
          altTh: "",
          altEn: "",
          hasWatermark: false,
        };

    const merged = { ...base, ...patch };
    container["image"] = merged.path.trim() === "" ? null : merged;
  });
}

/* ── การ์ดในบล็อก ──────────────────────────────────────────────────────── */

function withCards(document: BlockDocument, id: string, mutate: (cards: DeepMutable<BlockCard>[]) => void): BlockDocument {
  return withBlock(document, id, (block) => {
    const container = block as unknown as Record<string, unknown>;
    const items = container["items"];
    if (!Array.isArray(items)) return;
    mutate(items as DeepMutable<BlockCard>[]);
  });
}

export function canAddCard(document: BlockDocument, id: string): boolean {
  const location = findBlockLocation(document, id);
  if (location === null) return false;
  const block = blockAt(document, location);
  if (block === null || block.type !== "cards") return false;
  return block.items.length < MAX_CARDS;
}

export function addCard(document: BlockDocument, id: string): BlockDocument {
  if (!canAddCard(document, id)) return document;
  return withCards(document, id, (cards) => {
    cards.push({ title: { th: "", en: "" }, body: { th: "", en: "" }, href: "", image: null });
  });
}

export function removeCard(document: BlockDocument, id: string, index: number): BlockDocument {
  return withCards(document, id, (cards) => {
    if (index >= 0 && index < cards.length) cards.splice(index, 1);
  });
}

export function setCardText(
  document: BlockDocument,
  id: string,
  index: number,
  field: "title" | "body",
  language: BlockLanguage,
  value: string,
): BlockDocument {
  return withCards(document, id, (cards) => {
    const card = cards[index];
    if (card === undefined) return;
    card[field][language] = value;
  });
}

export function setCardString(document: BlockDocument, id: string, index: number, field: "href", value: string): BlockDocument {
  return withCards(document, id, (cards) => {
    const card = cards[index];
    if (card === undefined) return;
    card[field] = value;
  });
}

export function setCardImagePath(document: BlockDocument, id: string, index: number, path: string): BlockDocument {
  return withCards(document, id, (cards) => {
    const card = cards[index];
    if (card === undefined) return;
    card.image = path.trim() === "" ? null : { path, altTh: card.image?.altTh ?? "", altEn: card.image?.altEn ?? "", hasWatermark: card.image?.hasWatermark ?? false };
  });
}

/** ตั้งค่าภาพของการ์ดใบที่ระบุ (path/alt/ลายน้ำ) — พาธว่าง = ลบภาพ */
export function setCardImage(
  document: BlockDocument,
  id: string,
  index: number,
  patch: { path?: string; altTh?: string; altEn?: string; hasWatermark?: boolean },
): BlockDocument {
  return withCards(document, id, (cards) => {
    const card = cards[index];
    if (card === undefined) return;

    const base = card.image ?? { path: "", altTh: "", altEn: "", hasWatermark: false };
    const merged = { ...base, ...patch };
    card.image = merged.path.trim() === "" ? null : merged;
  });
}

/* ── สไลด์ของบล็อก "แบนเนอร์เปิดหน้า" (รอบที่ 183 · เฟส 2 ส่วน (ก)) ─────────────
   ตรรกะล้วน: เพิ่ม/ลบ/สลับลำดับ · ตั้งภาพ/จุดโฟกัส/ซูม · เพดานมาจากทะเบียนกลาง
   ⚠️ ทั้งชุดใช้สไตล์เดียวกับที่อื่นในไฟล์นี้: `withBlock(document, id, mutate)` = "แก้ของที่ถูก clone แล้ว"
      (ไม่ใช่คืนออบเจ็กต์ใหม่) — เขียนผิดแล้วจะเงียบ ⇒ มีเทสต์คุมทุกตัวที่ scripts/test-hero-slides.ts
   ⚠️ ไม่มีสไลด์ = หน้าเว็บใช้ `image` เดี่ยวเหมือนเดิม (เอกสารเก่าไม่เปลี่ยนพฤติกรรม)
*/

/** อ่านสไลด์ของบล็อก (คืน `null` ถ้าไม่ใช่ hero · คืน `[]` ถ้าเป็น hero แต่ยังไม่มีสไลด์) */
export function heroSlidesOf(document: BlockDocument, blockId: string): readonly HeroSlideItem[] | null {
  /* บล็อกซ้อนได้ 1 ชั้น (row → column) — เดินแบบเดียวกับ findBlockLocation */
  const flat: Block[] = [...document.blocks];
  for (const row of document.blocks) {
    if (isRowBlock(row)) for (const column of row.columns) flat.push(...column.blocks);
  }
  const block = flat.find((entry) => entry.id === blockId) ?? null;
  if (block === null || block.type !== "hero") return null;
  return block.slides ?? [];
}

/** รหัสสไลด์ใหม่ — ไล่เลขจากของเดิม กันซ้ำหลังลบแล้วเพิ่ม */
export function newHeroSlideId(existing: readonly HeroSlideItem[]): string {
  let index = existing.length + 1;
  const used = new Set(existing.map((slide) => slide.id));
  while (used.has(`slide-${index}`)) index += 1;
  return `slide-${index}`;
}

/** แก้รายการสไลด์ของบล็อก hero ผ่านฟังก์ชันบริสุทธิ์ (ไม่แตะบล็อกอื่น/ชนิดอื่น) */
function withHeroSlides(
  document: BlockDocument,
  blockId: string,
  update: (slides: readonly HeroSlideItem[]) => readonly HeroSlideItem[],
): BlockDocument {
  const current = heroSlidesOf(document, blockId);
  if (current === null) return document;
  const next = update(current);
  if (next === current) return document;

  return withBlock(document, blockId, (block) => {
    if (block.type !== "hero") return;
    (block as { slides?: readonly HeroSlideItem[] }).slides = next;
  });
}

/** เพิ่มสไลด์ว่าง (ภาพยังไม่เลือก · โฟกัสกลางภาพ · ไม่ซูม) — เกินเพดาน = ไม่ทำอะไร */
export function addHeroSlide(document: BlockDocument, blockId: string): BlockDocument {
  return withHeroSlides(document, blockId, (slides) =>
    slides.length >= MAX_HERO_SLIDES
      ? slides
      : [...slides, { id: newHeroSlideId(slides), image: null, focusX: 50, focusY: 50, zoom: HERO_ZOOM_MIN }],
  );
}

export function removeHeroSlide(document: BlockDocument, blockId: string, slideId: string): BlockDocument {
  return withHeroSlides(document, blockId, (slides) => {
    if (!slides.some((slide) => slide.id === slideId)) return slides;
    return slides.filter((slide) => slide.id !== slideId);
  });
}

/** ย้ายสไลด์ขึ้น/ลงตาม `delta` (±1) — หลุดขอบ = ไม่ทำอะไร */
export function moveHeroSlide(document: BlockDocument, blockId: string, slideId: string, delta: number): BlockDocument {
  return withHeroSlides(document, blockId, (slides) => {
    const from = slides.findIndex((slide) => slide.id === slideId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= slides.length) return slides;
    const next = [...slides];
    const moved = next[from];
    const target = next[to];
    if (moved === undefined || target === undefined) return slides;
    next[from] = target;
    next[to] = moved;
    return next;
  });
}

/** ตั้งภาพของสไลด์ — `path` ว่าง = ล้างภาพออก (คง alt/watermark เดิมไว้ถ้าไม่ได้ส่งมา) */
export function setHeroSlideImage(
  document: BlockDocument,
  blockId: string,
  slideId: string,
  patch: { path?: string; altTh?: string; altEn?: string; hasWatermark?: boolean },
): BlockDocument {
  return withHeroSlides(document, blockId, (slides) =>
    slides.map((slide) => {
      if (slide.id !== slideId) return slide;
      const path = (patch.path ?? "").trim();
      if (path === "") return { ...slide, image: null };
      return {
        ...slide,
        image: {
          path,
          altTh: patch.altTh ?? slide.image?.altTh ?? "",
          altEn: patch.altEn ?? slide.image?.altEn ?? "",
          hasWatermark: patch.hasWatermark ?? slide.image?.hasWatermark ?? false,
        },
      };
    }),
  );
}

/** ตั้งจุดโฟกัส (ค่าถูกบีบให้อยู่ใน 0–100 เหมือนตอนอ่านจากฐานข้อมูล) */
export function setHeroSlideFocus(
  document: BlockDocument,
  blockId: string,
  slideId: string,
  focusX: number,
  focusY: number,
): BlockDocument {
  const x = Math.min(100, Math.max(0, Math.round(focusX)));
  const y = Math.min(100, Math.max(0, Math.round(focusY)));
  return withHeroSlides(document, blockId, (slides) =>
    slides.map((slide) => (slide.id === slideId ? { ...slide, focusX: x, focusY: y } : slide)),
  );
}

/** ตั้งระดับซูม (บีบให้อยู่ใน 1–2 เหมือนตอนอ่านจากฐานข้อมูล) */
export function setHeroSlideZoom(document: BlockDocument, blockId: string, slideId: string, zoom: number): BlockDocument {
  const value = Number.isFinite(zoom) ? Math.min(HERO_ZOOM_MAX, Math.max(HERO_ZOOM_MIN, Math.round(zoom * 100) / 100)) : HERO_ZOOM_MIN;
  return withHeroSlides(document, blockId, (slides) =>
    slides.map((slide) => (slide.id === slideId ? { ...slide, zoom: value } : slide)),
  );
}

/* ── คอลัมน์ของบล็อก "แถว" (X1.1) ───────────────────────────────────────── */

/** เพิ่มคอลัมน์ (สูงสุด 4) แล้ว **แบ่งความกว้างใหม่ให้เท่ากันทุกคอลัมน์** — ผู้ใช้ปรับต่อได้ในแผงตั้งค่า */
export function addColumn(document: BlockDocument, rowId: string): BlockDocument {
  const row = document.blocks.find((block) => block.id === rowId);
  /* ตรวจก่อนโคลน — ไม่ให้เกิด state update เปล่า ๆ เมื่อทำไม่ได้ */
  if (row === undefined || row.type !== "row") return document;
  if (row.columns.length >= MAX_COLUMNS) return document;

  return withBlock(document, rowId, (block) => {
    if (block.type !== "row") return;
    if (block.columns.length >= MAX_COLUMNS) return;

    const width = equalColumnWidth(block.columns.length + 1);
    for (const column of block.columns) column.width = width;
    block.columns.push({ id: nextColumnId(block.columns), width, blocks: [] });
  });
}

/**
 * ลบคอลัมน์ — **ลบได้เฉพาะคอลัมน์ที่ว่างแล้ว** (กันข้อมูลหายโดยไม่ตั้งใจ)
 * และเหลืออย่างน้อย 1 คอลัมน์เสมอ · จากนั้นแบ่งความกว้างใหม่ให้เท่ากัน
 */
export function removeColumn(document: BlockDocument, rowId: string, columnId: string): BlockDocument {
  /* ตรวจก่อนโคลน — ผู้เรียกเทียบเอกสารเดิมได้ (คืนตัวเดิมเมื่อทำไม่ได้) */
  if (!canRemoveColumn(document, rowId, columnId)) return document;

  return withBlock(document, rowId, (block) => {
    if (block.type !== "row") return;
    if (block.columns.length <= 1) return;

    const index = block.columns.findIndex((column) => column.id === columnId);
    if (index < 0) return;
    if ((block.columns[index]?.blocks.length ?? 0) > 0) return;

    block.columns.splice(index, 1);
    const width = equalColumnWidth(block.columns.length);
    for (const column of block.columns) column.width = width;
  });
}

/** บอกได้ว่าลบคอลัมน์นี้ได้หรือไม่ (หน้าจอใช้ปิดปุ่ม + อธิบายเหตุผล) */
export function canRemoveColumn(document: BlockDocument, rowId: string, columnId: string): boolean {
  const row = document.blocks.find((block) => block.id === rowId);
  if (row === undefined || row.type !== "row") return false;
  if (row.columns.length <= 1) return false;
  const column = row.columns.find((entry) => entry.id === columnId);
  return column !== undefined && column.blocks.length === 0;
}

/** ตั้งความกว้างคอลัมน์จากพรีเซ็ตของแบรนด์ */
export function setColumnWidth(
  document: BlockDocument,
  rowId: string,
  columnId: string,
  width: BlockColumnWidth,
): BlockDocument {
  return withBlock(document, rowId, (block) => {
    if (block.type !== "row") return;
    const column = block.columns.find((entry) => entry.id === columnId);
    if (column === undefined) return;
    column.width = width;
  });
}

/* ── จัดการบล็อกทั้งก้อน ───────────────────────────────────────────────── */

/**
 * เพิ่มบล็อกใหม่ที่ตำแหน่งที่กำหนด (`target = null` ⇒ ต่อท้ายระดับหน้า)
 * ปฏิเสธเมื่อ: แถวซ้อนแถว · ภาชนะเต็ม · เกินเพดานรวมทั้งหน้า
 */
export function insertBlockAt(document: BlockDocument, type: BlockType, target: BlockTarget | null): InsertResult {
  /* แถวซ้อนแถวไม่ได้ (MAX_BLOCK_DEPTH = 1) */
  if (target !== null && target.rowId !== null && type === "row") {
    return { document, blockId: null };
  }

  const next = clone(document);
  const container = target === null ? next.blocks : containerIn(next, target.rowId, target.columnId);
  if (container === null) return { document, blockId: null };

  if (container.length >= limitOf(target === null ? null : target.rowId)) {
    return { document, blockId: null };
  }
  if (countBlocks(next.blocks) >= MAX_BLOCKS_TOTAL) {
    return { document, blockId: null };
  }

  const blockId = nextBlockIdFrom(new Set(collectBlockIds(next.blocks)));
  const block = createBlock(type, blockId) as unknown as MutableBlock;
  const index = target === null ? container.length : Math.max(0, Math.min(target.index, container.length));
  container.splice(index, 0, block);

  return { document: next as unknown as BlockDocument, blockId };
}

/** เพิ่มบล็อกใหม่ต่อท้ายหน้า (พฤติกรรมเดิมก่อน X1.1) */
export function insertBlock(document: BlockDocument, type: BlockType): BlockDocument {
  return insertBlockAt(document, type, null).document;
}

/** ลบบล็อก (ลบได้ทั้งระดับหน้าและบล็อกที่ซ้อนในคอลัมน์ — รวมบล็อกลูกถ้าเป็นแถว) */
export function removeBlock(document: BlockDocument, id: string): BlockDocument {
  const location = findBlockLocation(document, id);
  if (location === null) return document;

  const next = clone(document);
  const container = containerIn(next, location.rowId, location.columnId);
  if (container === null) return document;

  container.splice(location.index, 1);
  return next as unknown as BlockDocument;
}

/** เลื่อนบล็อกขึ้น/ลง (`delta` = -1 หรือ 1) **ภายในภาชนะของตัวเอง** */
export function moveBlock(document: BlockDocument, id: string, delta: -1 | 1): BlockDocument {
  const location = findBlockLocation(document, id);
  if (location === null) return document;
  return moveBlockToLocation(document, id, {
    rowId: location.rowId,
    columnId: location.columnId,
    index: location.index + delta,
  });
}

/**
 * ย้ายบล็อกไป **ตำแหน่งที่กำหนดในระดับหน้า** (ใช้กับการลากวาง — L1)
 * `toIndex` = ตำแหน่งปลายทางในลิสต์ (0 = บนสุด) · ค่าที่หลุดช่วงถูกบีบให้อยู่ในช่วง
 * คืนเอกสารเดิมถ้าไม่มีอะไรเปลี่ยน (เพื่อไม่ให้เกิด state update เปล่า ๆ)
 */
export function moveBlockTo(document: BlockDocument, id: string, toIndex: number): BlockDocument {
  return moveBlockToLocation(document, id, { rowId: null, columnId: null, index: toIndex });
}

/**
 * ย้ายบล็อกไปตำแหน่งที่กำหนด **ข้ามภาชนะได้** (ระดับหน้า ↔ คอลัมน์ของแถว) — X1.1
 * ปฏิเสธเมื่อ: ไม่พบบล็อก · ย้ายแถวเข้าไปในคอลัมน์ · ภาชนะปลายทางเต็ม
 */
export function moveBlockToLocation(document: BlockDocument, id: string, target: BlockTarget): BlockDocument {
  const from = findBlockLocation(document, id);
  if (from === null) return document;

  const moving = blockAt(document, from);
  if (moving === null) return document;
  /* แถวซ้อนแถวไม่ได้ — ย้ายแถวเข้าไปในคอลัมน์ต้องไม่เกิดขึ้น */
  if (moving.type === "row" && target.rowId !== null) return document;

  const sameContainer = from.rowId === target.rowId && from.columnId === target.columnId;
  if (!sameContainer) {
    const destination = readContainer(document, target.rowId, target.columnId);
    if (destination === null) return document;
    if (destination.length >= limitOf(target.rowId)) return document;
  }

  const next = clone(document);
  const source = containerIn(next, from.rowId, from.columnId);
  const destination = containerIn(next, target.rowId, target.columnId);
  if (source === null || destination === null) return document;

  const [moved] = source.splice(from.index, 1);
  if (moved === undefined) return document;

  const clamped = Math.max(0, Math.min(target.index, destination.length));
  if (sameContainer && clamped === from.index) {
    /* ไม่มีอะไรเปลี่ยน — ใส่กลับที่เดิมแล้วคืนเอกสารเดิม */
    source.splice(from.index, 0, moved);
    return document;
  }

  destination.splice(clamped, 0, moved);
  return next as unknown as BlockDocument;
}

/** ย้ายการ์ดภายในบล็อกไปตำแหน่งที่กำหนด (ใช้กับการลากวาง — L1) */
export function moveCardTo(document: BlockDocument, id: string, fromIndex: number, toIndex: number): BlockDocument {
  const location = findBlockLocation(document, id);
  if (location === null) return document;
  const block = blockAt(document, location);
  if (block === null || block.type !== "cards") return document;

  const total = block.items.length;
  if (fromIndex < 0 || fromIndex >= total) return document;

  const clamped = Math.max(0, Math.min(toIndex, total - 1));
  if (clamped === fromIndex) return document;

  const next = clone(document);
  const container = containerIn(next, location.rowId, location.columnId);
  const target = container?.[location.index];
  if (target === undefined || target.type !== "cards") return document;

  const [moved] = target.items.splice(fromIndex, 1);
  if (moved === undefined) return document;
  target.items.splice(clamped, 0, moved);
  return next as unknown as BlockDocument;
}

/**
 * วางพรีเซ็ตเป็นบล็อกใหม่ **ต่อท้ายหน้า** (ผู้ใช้สั่ง รอบที่ 52)
 * ⚠️ ต้องได้ **id ใหม่เสมอ (รวมบล็อกลูกของแถว)** — ไม่งั้นจะมีสองบล็อก id เดียวกัน (กดเลือก/ลบจะสับสน)
 */
export function insertPresetBlock(document: BlockDocument, preset: Block): BlockDocument {
  if (document.blocks.length >= MAX_BLOCKS_PER_PAGE) return document;
  if (countBlocks(document.blocks) >= MAX_BLOCKS_TOTAL) return document;

  const next = clone(document);
  const used = new Set(collectBlockIds(document.blocks));
  next.blocks.push(withFreshIds(structuredClone(preset) as unknown as MutableBlock, used));
  return next as unknown as BlockDocument;
}

/**
 * เอาพรีเซ็ต **ทับบล็อกที่เลือก** (ผู้ใช้สั่ง รอบที่ 52: "เอาขึ้นไปทับของเดิม")
 * คงตำแหน่งเดิมไว้ · ได้ id ใหม่ทั้งก้อน (กัน id ซ้ำกับบล็อกอื่นที่เผลอค้าง)
 */
export function replaceBlockWithPreset(document: BlockDocument, targetId: string, preset: Block): BlockDocument {
  const location = findBlockLocation(document, targetId);
  if (location === null) return document;
  /* วางแถวทับบล็อกที่อยู่ในคอลัมน์ = แถวซ้อนแถว ⇒ ไม่ทำ */
  if (preset.type === "row" && location.rowId !== null) return document;

  const next = clone(document);
  const container = containerIn(next, location.rowId, location.columnId);
  if (container === null) return document;

  const used = new Set(collectBlockIds(document.blocks).filter((id) => id !== targetId));
  container[location.index] = withFreshIds(structuredClone(preset) as unknown as MutableBlock, used);
  return next as unknown as BlockDocument;
}

/** ทำซ้ำบล็อก (ได้ id ใหม่ทั้งก้อน) — วางต่อท้ายบล็อกเดิมในภาชนะเดียวกัน */
export function duplicateBlock(document: BlockDocument, id: string): BlockDocument {
  const location = findBlockLocation(document, id);
  if (location === null) return document;

  const source = blockAt(document, location);
  if (source === null) return document;

  const container = readContainer(document, location.rowId, location.columnId);
  if (container === null || container.length >= limitOf(location.rowId)) return document;
  if (countBlocks(document.blocks) >= MAX_BLOCKS_TOTAL) return document;

  const next = clone(document);
  const target = containerIn(next, location.rowId, location.columnId);
  if (target === null) return document;

  const used = new Set(collectBlockIds(document.blocks));
  target.splice(location.index + 1, 0, withFreshIds(structuredClone(source) as unknown as MutableBlock, used));
  return next as unknown as BlockDocument;
}

/* ── ตาราง (รอบที่ 86) ───────────────────────────────────────────────────── */

/** เพิ่มคอลัมน์ — เพิ่มช่องว่างให้ทุกแถวพร้อมกัน (จำนวนช่องเท่าหัวคอลัมน์เสมอ) */
export function canAddTableColumn(document: BlockDocument, id: string): boolean {
  const location = findBlockLocation(document, id);
  if (location === null) return false;
  const block = blockAt(document, location);
  return block !== null && block.type === "table" && block.columns.length < MAX_TABLE_COLUMNS;
}

export function addTableColumn(document: BlockDocument, id: string): BlockDocument {
  if (!canAddTableColumn(document, id)) return document;
  return withBlock(document, id, (block) => {
    if (block.type !== "table") return;
    block.columns.push(emptyText());
    for (const row of block.rows) row.cells.push(emptyText());
  });
}

/** ลบคอลัมน์ได้เมื่อเหลือมากกว่า 1 คอลัมน์ (ตารางต้องมีหัวอย่างน้อยหนึ่งช่อง) */
export function canRemoveTableColumn(document: BlockDocument, id: string): boolean {
  const location = findBlockLocation(document, id);
  if (location === null) return false;
  const block = blockAt(document, location);
  return block !== null && block.type === "table" && block.columns.length > 1;
}

export function removeTableColumn(document: BlockDocument, id: string, columnIndex: number): BlockDocument {
  if (!canRemoveTableColumn(document, id)) return document;
  return withBlock(document, id, (block) => {
    if (block.type !== "table") return;
    if (columnIndex < 0 || columnIndex >= block.columns.length) return;
    block.columns.splice(columnIndex, 1);
    for (const row of block.rows) row.cells.splice(columnIndex, 1);
  });
}

export function setTableColumnText(
  document: BlockDocument,
  id: string,
  columnIndex: number,
  language: BlockLanguage,
  value: string,
): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "table") return;
    const column = block.columns[columnIndex];
    if (column === undefined) return;
    column[language] = value;
  });
}

/** คอลัมน์แรกเป็น "หัวแถว" หรือไม่ (a11y: `<th scope="row">`) */
export function setTableFirstColumnHeader(document: BlockDocument, id: string, value: boolean): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type === "table") block.firstColumnHeader = value;
  });
}

export function canAddTableRow(document: BlockDocument, id: string): boolean {
  const location = findBlockLocation(document, id);
  if (location === null) return false;
  const block = blockAt(document, location);
  return block !== null && block.type === "table" && block.rows.length < MAX_TABLE_ROWS;
}

export function addTableRow(document: BlockDocument, id: string): BlockDocument {
  if (!canAddTableRow(document, id)) return document;
  return withBlock(document, id, (block) => {
    if (block.type !== "table") return;
    const used = new Set(block.rows.map((row) => row.id));
    block.rows.push({ id: nextPrefixedId("row", used), cells: block.columns.map(() => emptyText()) });
  });
}

export function removeTableRow(document: BlockDocument, id: string, rowIndex: number): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "table") return;
    if (rowIndex < 0 || rowIndex >= block.rows.length) return;
    block.rows.splice(rowIndex, 1);
  });
}

/** สลับตำแหน่งแถว (ใช้กับการลากวางในแผงแก้) */
export function moveTableRow(document: BlockDocument, id: string, fromIndex: number, toIndex: number): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "table") return;
    const total = block.rows.length;
    if (fromIndex < 0 || fromIndex >= total) return;
    const clamped = Math.max(0, Math.min(toIndex, total - 1));
    if (clamped === fromIndex) return;
    const [moved] = block.rows.splice(fromIndex, 1);
    if (moved === undefined) return;
    block.rows.splice(clamped, 0, moved);
  });
}

export function setTableCellText(
  document: BlockDocument,
  id: string,
  rowIndex: number,
  columnIndex: number,
  language: BlockLanguage,
  value: string,
): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "table") return;
    const cell = block.rows[rowIndex]?.cells[columnIndex];
    if (cell === undefined) return;
    cell[language] = value;
  });
}

/* ── แกลเลอรี (รอบที่ 86) ─────────────────────────────────────────────────── */

export function canAddGalleryItem(document: BlockDocument, id: string): boolean {
  const location = findBlockLocation(document, id);
  if (location === null) return false;
  const block = blockAt(document, location);
  return block !== null && block.type === "gallery" && block.items.length < MAX_GALLERY_ITEMS;
}

/** เพิ่มภาพใหม่ (ยังไม่เลือกไฟล์ — ผู้ใช้ลาก/เลือกภาพในแผงแก้ แล้ว validator จะเตือนถ้ายังว่าง) */
export function addGalleryItem(document: BlockDocument, id: string): BlockDocument {
  if (!canAddGalleryItem(document, id)) return document;
  return withBlock(document, id, (block) => {
    if (block.type !== "gallery") return;
    const used = new Set(block.items.map((item) => item.id));
    block.items.push({ id: nextPrefixedId("img", used), image: null, caption: emptyText() });
  });
}

export function removeGalleryItem(document: BlockDocument, id: string, index: number): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "gallery") return;
    if (index < 0 || index >= block.items.length) return;
    block.items.splice(index, 1);
  });
}

/** สลับตำแหน่งภาพในแกลเลอรี (ใช้กับการลากวางในแผงแก้) */
export function moveGalleryItem(document: BlockDocument, id: string, fromIndex: number, toIndex: number): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "gallery") return;
    const total = block.items.length;
    if (fromIndex < 0 || fromIndex >= total) return;
    const clamped = Math.max(0, Math.min(toIndex, total - 1));
    if (clamped === fromIndex) return;
    const [moved] = block.items.splice(fromIndex, 1);
    if (moved === undefined) return;
    block.items.splice(clamped, 0, moved);
  });
}

export function setGalleryItemCaption(
  document: BlockDocument,
  id: string,
  index: number,
  language: BlockLanguage,
  value: string,
): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "gallery") return;
    const item = block.items[index];
    if (item === undefined) return;
    item.caption[language] = value;
  });
}

/** ตั้งค่าภาพของภาพใบที่ระบุ (path/alt/ลายน้ำ) — พาธว่าง = ลบภาพออกจากใบนั้น */
export function setGalleryItemImage(
  document: BlockDocument,
  id: string,
  index: number,
  patch: { path?: string; altTh?: string; altEn?: string; hasWatermark?: boolean },
): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "gallery") return;
    const item = block.items[index];
    if (item === undefined) return;

    const base = item.image ?? { path: "", altTh: "", altEn: "", hasWatermark: false };
    const merged = { ...base, ...patch };
    item.image = merged.path.trim() === "" ? null : merged;
  });
}

/* ── กระดานรับสมัครงาน (รอบที่ 88) ─────────────────────────────────────────── */

export function canAddJobItem(document: BlockDocument, id: string): boolean {
  const location = findBlockLocation(document, id);
  if (location === null) return false;
  const block = blockAt(document, location);
  return block !== null && block.type === "jobBoard" && block.items.length < MAX_JOB_ITEMS;
}

/** เพิ่มตำแหน่งว่าง (ผู้ใช้กรอกชื่อตำแหน่ง/ฝ่าย/คุณสมบัติเอง หรือเริ่มจากเทมเพลต) */
export function addJobItem(document: BlockDocument, id: string): BlockDocument {
  if (!canAddJobItem(document, id)) return document;
  return withBlock(document, id, (block) => {
    if (block.type !== "jobBoard") return;
    const used = new Set(block.items.map((item) => item.id));
    block.items.push({
      id: nextPrefixedId("job", used),
      title: emptyText(),
      department: emptyText(),
      openings: 0,
      qualifications: emptyText(),
      experience: emptyText(),
    });
  });
}

export function removeJobItem(document: BlockDocument, id: string, index: number): BlockDocument {
  const location = findBlockLocation(document, id);
  const block = location === null ? null : blockAt(document, location);
  /* ไม่มีอะไรต้องทำ = คืนของเดิม (ไม่สร้างเอกสารใหม่ ⇒ ไม่ทำให้หน้าจอ re-render เปล่า) */
  if (block === null || block.type !== "jobBoard" || index < 0 || index >= block.items.length) return document;

  return withBlock(document, id, (target) => {
    if (target.type !== "jobBoard") return;
    target.items.splice(index, 1);
  });
}

/** สลับลำดับตำแหน่ง (ใช้กับการลากวางในแผงแก้) */
export function moveJobItem(document: BlockDocument, id: string, fromIndex: number, toIndex: number): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "jobBoard") return;
    const total = block.items.length;
    if (fromIndex < 0 || fromIndex >= total) return;
    const clamped = Math.max(0, Math.min(toIndex, total - 1));
    if (clamped === fromIndex) return;
    const [moved] = block.items.splice(fromIndex, 1);
    if (moved === undefined) return;
    block.items.splice(clamped, 0, moved);
  });
}

export type JobItemTextField = "title" | "department" | "qualifications" | "experience";

export function setJobItemText(
  document: BlockDocument,
  id: string,
  index: number,
  field: JobItemTextField,
  language: BlockLanguage,
  value: string,
): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "jobBoard") return;
    const item = block.items[index];
    if (item === undefined) return;
    item[field][language] = value;
  });
}

/** จำนวนอัตราที่เปิดรับ — 0 = ไม่ระบุ (ค่าที่ส่งมาถูกปัดให้อยู่ในช่วง 0-999) */
export function setJobItemOpenings(document: BlockDocument, id: string, index: number, openings: number): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "jobBoard") return;
    const item = block.items[index];
    if (item === undefined) return;
    const safe = Number.isFinite(openings) ? Math.max(0, Math.min(Math.trunc(openings), 999)) : 0;
    item.openings = safe;
  });
}

/** จัดกลุ่มตามฝ่าย หรือเรียงเป็นรายการเดียว */
export function setJobBoardGrouping(document: BlockDocument, id: string, value: boolean): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type === "jobBoard") block.groupByDepartment = value;
  });
}

/* ── บล็อกไดนามิก "หมวดสินค้า + สินค้าแนะนำ" (รอบที่ 215) ─────────────────── */

/**
 * แก้ตัวเลือกของบล็อกไดนามิก — **บีบค่าทุกครั้ง** ด้วย `clampShowcaseOptions()`
 * (ค่าที่ผู้ใช้กรอก/ลากต้องไม่หลุดช่วง: 1–3 คอลัมน์ · 1–3 สินค้าแนะนำต่อหมวด)
 */
export function setProductShowcaseOptions(
  document: BlockDocument,
  id: string,
  patch: Partial<ProductShowcaseOptions>,
): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "productShowcase") return;
    const next = clampShowcaseOptions({ ...block, ...patch });
    block.columns = next.columns;
    block.showFeatured = next.showFeatured;
    block.featuredPerCategory = next.featuredPerCategory;
    block.categoryIds = [...next.categoryIds];
    block.showCount = next.showCount;
  });
}

/* ── รายชื่อคณะผู้บริหาร (รอบที่ 88) ───────────────────────────────────────── */

export function canAddRosterMember(document: BlockDocument, id: string): boolean {
  const location = findBlockLocation(document, id);
  if (location === null) return false;
  const block = blockAt(document, location);
  return block !== null && block.type === "rosterText" && block.members.length < MAX_ROSTER_MEMBERS;
}

/** เพิ่มคนว่าง (ยังไม่มีชื่อ — validator จะบังคับชื่อไทยก่อนเผยแพร่) */
export function addRosterMember(document: BlockDocument, id: string): BlockDocument {
  if (!canAddRosterMember(document, id)) return document;
  return withBlock(document, id, (block) => {
    if (block.type !== "rosterText") return;
    const used = new Set(block.members.map((member) => member.id));
    block.members.push({ id: nextPrefixedId("person", used), name: emptyText(), role: emptyText(), image: null });
  });
}

export function removeRosterMember(document: BlockDocument, id: string, index: number): BlockDocument {
  const location = findBlockLocation(document, id);
  const block = location === null ? null : blockAt(document, location);
  /* ไม่มีอะไรต้องทำ = คืนของเดิม (ไม่สร้างเอกสารใหม่) */
  if (block === null || block.type !== "rosterText" || index < 0 || index >= block.members.length) return document;

  return withBlock(document, id, (target) => {
    if (target.type !== "rosterText") return;
    target.members.splice(index, 1);
  });
}

/** สลับลำดับคน (ใช้กับการลากวางในแผงแก้) — ลำดับมักตรงกับอาวุโส */
export function moveRosterMember(document: BlockDocument, id: string, fromIndex: number, toIndex: number): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "rosterText") return;
    const total = block.members.length;
    if (fromIndex < 0 || fromIndex >= total) return;
    const clamped = Math.max(0, Math.min(toIndex, total - 1));
    if (clamped === fromIndex) return;
    const [moved] = block.members.splice(fromIndex, 1);
    if (moved === undefined) return;
    block.members.splice(clamped, 0, moved);
  });
}

export type RosterTextField = "name" | "role";

export function setRosterMemberText(
  document: BlockDocument,
  id: string,
  index: number,
  field: RosterTextField,
  language: BlockLanguage,
  value: string,
): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "rosterText") return;
    const member = block.members[index];
    if (member === undefined) return;
    member[field][language] = value;
  });
}

/** ตั้งค่าภาพรายบุคคล — พาธว่าง = เอารูปออก (ภาพไม่บังคับสำหรับรายชื่อ) */
export function setRosterMemberImage(
  document: BlockDocument,
  id: string,
  index: number,
  patch: { path?: string; altTh?: string; altEn?: string; hasWatermark?: boolean },
): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "rosterText") return;
    const member = block.members[index];
    if (member === undefined) return;

    const base = member.image ?? { path: "", altTh: "", altEn: "", hasWatermark: false };
    const merged = { ...base, ...patch };
    member.image = merged.path.trim() === "" ? null : merged;
  });
}

/* ── เมนูอาหาร (รอบที่ 101) ───────────────────────────────────────────────── */

export function canAddRecipeItem(document: BlockDocument, id: string): boolean {
  const location = findBlockLocation(document, id);
  if (location === null) return false;
  const block = blockAt(document, location);
  return block !== null && block.type === "recipeCards" && block.items.length < MAX_RECIPE_ITEMS;
}

/** เพิ่มเมนูว่าง (ยังไม่มีชื่อ/ภาพ — validator จะบังคับชื่อไทยก่อนเผยแพร่) */
export function addRecipeItem(document: BlockDocument, id: string): BlockDocument {
  if (!canAddRecipeItem(document, id)) return document;
  return withBlock(document, id, (block) => {
    if (block.type !== "recipeCards") return;
    const used = new Set(block.items.map((item) => item.id));
    block.items.push({
      id: nextPrefixedId("recipe", used),
      title: emptyText(),
      body: emptyText(),
      ingredients: emptyText(),
      steps: emptyText(),
      image: null,
    });
  });
}

export function removeRecipeItem(document: BlockDocument, id: string, index: number): BlockDocument {
  const location = findBlockLocation(document, id);
  const block = location === null ? null : blockAt(document, location);
  /* ไม่มีอะไรต้องทำ = คืนของเดิม (ไม่สร้างเอกสารใหม่ ⇒ ไม่ทำให้หน้าจอ re-render เปล่า) */
  if (block === null || block.type !== "recipeCards" || index < 0 || index >= block.items.length) return document;

  return withBlock(document, id, (target) => {
    if (target.type !== "recipeCards") return;
    target.items.splice(index, 1);
  });
}

/** สลับลำดับเมนู (ใช้กับปุ่มเลื่อน/การลากวางในแผงแก้) */
export function moveRecipeItem(document: BlockDocument, id: string, fromIndex: number, toIndex: number): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "recipeCards") return;
    const total = block.items.length;
    if (fromIndex < 0 || fromIndex >= total) return;
    const clamped = Math.max(0, Math.min(toIndex, total - 1));
    if (clamped === fromIndex) return;
    const [moved] = block.items.splice(fromIndex, 1);
    if (moved === undefined) return;
    block.items.splice(clamped, 0, moved);
  });
}

export type RecipeItemTextField = "title" | "body" | "ingredients" | "steps";

export function setRecipeItemText(
  document: BlockDocument,
  id: string,
  index: number,
  field: RecipeItemTextField,
  language: BlockLanguage,
  value: string,
): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "recipeCards") return;
    const item = block.items[index];
    if (item === undefined) return;
    item[field][language] = value;
  });
}

/** ตั้งค่าภาพของเมนู — พาธว่าง = เอารูปออก */
export function setRecipeItemImage(
  document: BlockDocument,
  id: string,
  index: number,
  patch: { path?: string; altTh?: string; altEn?: string; hasWatermark?: boolean },
): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "recipeCards") return;
    const item = block.items[index];
    if (item === undefined) return;

    const base = item.image ?? { path: "", altTh: "", altEn: "", hasWatermark: false };
    const merged = { ...base, ...patch };
    item.image = merged.path.trim() === "" ? null : merged;
  });
}

/** จำนวนคอลัมน์ของเมนู (1 | 2 | 3) — ค่าที่ไม่รองรับถูกปรับเป็น 2 */
export function setRecipeColumns(document: BlockDocument, id: string, columns: number): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "recipeCards") return;
    block.columns = columns === 1 ? 1 : columns === 3 ? 3 : 2;
  });
}

/* ── จำนวนคอลัมน์ของรายชื่อ (2 | 3 | 4) ───────────────────────────────────── */

export function setRosterColumns(document: BlockDocument, id: string, columns: number): BlockDocument {
  return withBlock(document, id, (block) => {
    if (block.type !== "rosterText") return;
    block.columns = columns === 2 ? 2 : columns === 4 ? 4 : 3;
  });
}

/* ── เลย์เอาต์ของทั้งหน้า (X1.8) ───────────────────────────────────────────── */

/**
 * เลือกเลย์เอาต์ของหน้า (X1.8) — ระดับหน้า ไม่ใช่ระดับบล็อก
 *
 * - ตั้ง `full` = **ลบฟิลด์ออก** (ค่าเริ่มต้น) ⇒ เอกสารกลับไปรูปทรงเดิมเป๊ะ ๆ
 *   และทำให้ `documentDiff` ไม่เห็น "ความต่างหลอก" กับเอกสารเดิมที่ไม่มีฟิลด์นี้
 * - ค่าอื่นเก็บใน `document.layout` (อยู่ใน JSONB เดิม — ไม่มี migration)
 * - `language = "th" | "en"` (X1.8 ต่อ · รอบที่ 92): เลย์เอาต์หน้าอังกฤษแยกได้
 *   ⚠️ canonical: ค่าอังกฤษที่เท่ากับค่าไทย = **ลบฟิลด์** (ไม่เก็บค่าซ้ำ)
 */
export function setPageLayout(
  document: BlockDocument,
  layout: PageLayout,
  language: BlockDocumentLanguage = "th",
): BlockDocument {
  if (layoutOf(document, language) === layout) return document;

  const next = clone(document);

  if (language === "en") {
    if (layout === layoutOf(document, "th")) delete next.layoutEn;
    else next.layoutEn = layout;
    return next as unknown as BlockDocument;
  }

  if (layout === DEFAULT_PAGE_LAYOUT) delete next.layout;
  else next.layout = layout;

  /* ค่าอังกฤษที่เท่ากับค่าไทยใหม่ = ไม่ต้องเก็บแยกอีก */
  if (next.layoutEn !== undefined && next.layoutEn === layoutOf(next as unknown as BlockDocument, "th")) {
    delete next.layoutEn;
  }

  return next as unknown as BlockDocument;
}

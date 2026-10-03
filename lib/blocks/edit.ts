import {
  MAX_BLOCKS_PER_COLUMN,
  MAX_BLOCKS_PER_PAGE,
  MAX_BLOCKS_TOTAL,
  MAX_CARDS,
  MAX_COLUMNS,
  VISIBLE_EVERYWHERE,
  collectBlockIds,
  countBlocks,
  createBlock,
  equalColumnWidth,
  findBlockLocation,
  nextBlockIdFrom,
  nextColumnId,
  type Block,
  type BlockCard,
  type BlockColumnWidth,
  type BlockDocument,
  type BlockLocation,
  type BlockStyle,
  type BlockType,
  type BlockVisibility,
} from "@/lib/blocks/types";

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
type MutableDocument = { page: string; blocks: MutableBlock[] };

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

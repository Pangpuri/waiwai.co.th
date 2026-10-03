import { isRowBlock, layoutOf, type Block, type BlockDocument } from "@/lib/blocks/types";

/**
 * "ความต่างของสองรุ่นเอกสารบล็อก" — ตรรกะล้วน ไม่พึ่ง React/DB (X1.5)
 *
 * ใช้ซ้ำ 3 งานในหน้าจอเดียว เพื่อไม่ให้มีตรรกะเทียบกันคนละชุด (ต้นเหตุบั๊กคลาสสิก)
 * 1. **นับจุดที่ยังไม่บันทึก** — `documentDiff(ฉบับที่บันทึกไว้, ฉบับบนหน้าจอ)`
 * 2. **ตัดสินใจบันทึกอัตโนมัติ** — ไม่บันทึกถ้าไม่มีความต่าง (ดู `lib/blocks/autosave.ts`)
 * 3. **เทียบเวอร์ชันก่อนกู้คืน** — `documentDiff(ฉบับร่างปัจจุบัน, รุ่นในประวัติ)`
 *
 * หลักการ
 * - **จับคู่บล็อกด้วย `id`** (ไม่ใช่ลำดับ) ⇒ ย้ายบล็อกไม่ทำให้ทั้งหน้าเหมือนถูกแก้ใหม่
 *   · id ที่มีแต่ในรุ่นใหม่ = เพิ่ม · มีแต่ในรุ่นเก่า = ลบ · มีทั้งคู่ = เทียบทีละฟิลด์ แล้วจึงดู "ตำแหน่ง"
 * - **ไม่สนใจรุ่นรูปทรง (`version`)** เพราะเป็นเรื่องภายในของรุ่นข้อมูล ไม่ใช่สิ่งที่ผู้ใช้แก้
 * - ค่าทุกอย่างถูกทำให้เป็นข้อความ (เทียบแบบเท่ากัน/ไม่เท่ากัน) ⇒ ผลซ้ำได้ เสถียร และทดสอบง่าย
 * - จำกัดจำนวนฟิลด์ที่รายงานต่อบล็อก (`MAX_DIFF_FIELDS_PER_BLOCK`) + จำนวนบรรทัดรวม — หน้าจอต้องไม่ยาวจนใช้ไม่ได้
 */

/** จำนวนความต่างสูงสุดที่รายงาน "ต่อบล็อก" (ที่เหลือบอกว่ามีมากกว่านี้) */
export const MAX_DIFF_FIELDS_PER_BLOCK = 12;
/** จำนวนบรรทัดความต่างสูงสุดที่รายงานทั้งใบ */
export const MAX_DIFF_ENTRIES = 40;

/**
 * "ชนิด" ที่ใช้รายงานความต่างระดับหน้า (X1.8) — เลย์เอาต์ไม่ผูกกับบล็อกใด ๆ
 * ⚠️ ต้องรายงานไม่งั้น `identical` จะเป็น true ⇒ **บันทึกอัตโนมัติจะข้ามการเปลี่ยนเลย์เอาต์**
 */
export const LAYOUT_DIFF_BLOCK_TYPE = "layout";

export type DiffFieldChange = {
  /** เส้นทางในบล็อก เช่น `heading.th` · `items[0].title.en` · `style.background` */
  readonly path: string;
  readonly before: string;
  readonly after: string;
};

export type DiffEntryKind = "added" | "removed" | "changed" | "moved";

export type DiffEntry = {
  readonly kind: DiffEntryKind;
  readonly blockId: string;
  /** ชนิดบล็อก เช่น `heading` · `row` (หน้าจอแปลงเป็นชื่อไทยด้วย BLOCK_CATALOG) */
  readonly blockType: string;
  /** ตำแหน่งในรุ่นใหม่ (บล็อกที่ถูกลบใช้ตำแหน่งจากรุ่นเก่า) */
  readonly index: number;
  /** ลำดับคอลัมน์ (0 = คอลัมน์แรก) — null = อยู่ระดับหน้า */
  readonly columnIndex: number | null;
  readonly fields: readonly DiffFieldChange[];
  /** true = มีความต่างในบล็อกนี้มากกว่าที่รายงาน */
  readonly truncated: boolean;
};

export type DocumentDiff = {
  readonly summary: {
    readonly added: number;
    readonly removed: number;
    readonly changed: number;
    readonly moved: number;
    readonly unchanged: number;
    /** จำนวน "จุดที่ต่าง" รวม (ใช้โชว์ "มีการแก้ไข N จุด" และใช้ตัดสิน dirty) */
    readonly total: number;
  };
  /** ลำดับบล็อกทั้งหน้าเปลี่ยนหรือไม่ (เทียบลำดับ id ทั้งหมด) */
  readonly orderChanged: boolean;
  /** เขียนทับ/แก้ข้อความในบล็อกเดิมหรือไม่ (ความต่างชนิดนี้ผู้ใช้ควรเห็นก่อนกู้คืน) */
  readonly entries: readonly DiffEntry[];
  /** true = มีความต่างมากกว่าที่รายงานใน `entries` */
  readonly truncated: boolean;
  /** true = ไม่มีความต่างเลย */
  readonly identical: boolean;
};

type Located = {
  readonly block: Block;
  /** ตำแหน่งในภาชนะของตัวเอง */
  readonly index: number;
  /** ลำดับคอลัมน์ในแถว (null = ระดับหน้า) */
  readonly columnIndex: number | null;
  readonly containerKey: string;
};

/** เดินทุกบล็อกพร้อมตำแหน่งในภาชนะ (ระดับหน้า หรือคอลัมน์ที่เท่าไร) */
function locate(document: BlockDocument): readonly Located[] {
  const nodes: Located[] = [];

  document.blocks.forEach((block, index) => {
    nodes.push({ block, index, columnIndex: null, containerKey: "root" });
    if (!isRowBlock(block)) return;

    block.columns.forEach((column, columnIndex) => {
      column.blocks.forEach((child, childIndex) => {
        nodes.push({ block: child, index: childIndex, columnIndex, containerKey: `${block.id}#${column.id}` });
      });
    });
  });

  return nodes;
}

/** ค่าที่ไม่ต้องรายงานว่าต่าง (ภายในของระบบ) */
const IGNORED_KEYS = new Set(["id", "version"]);

/**
 * ยุบ "ค่าของบล็อก" เป็นแผนที่ path → ข้อความ
 * ⚠️ บล็อกลูกในคอลัมน์ (ของ `row`) ถูกตัดออก เพราะถูกเทียบเป็นบล็อกของตัวเองอยู่แล้ว
 *    แต่ "โครงคอลัมน์" (จำนวน/ความกว้าง) ยังเทียบ ⇒ เพิ่ม-ลบ-ย่อคอลัมน์มองเห็นได้
 */
function flattenBlock(block: Block): Map<string, string> {
  const out = new Map<string, string>();

  const visit = (value: unknown, path: string, depth: number): void => {
    if (depth > 6) return; // กันข้อมูลผิดรูปที่ซ้อนลึกผิดปกติ

    if (value === null || value === undefined) {
      out.set(path, "");
      return;
    }
    if (typeof value === "string" || typeof value === "number") {
      out.set(path, String(value));
      return;
    }
    /* `false` ถือเท่ากับ "ไม่มีค่า" — กันความต่างหลอก (เช่น `hasWatermark: false` กับฟิลด์ที่ยังไม่มี) */
    if (typeof value === "boolean") {
      out.set(path, value ? "true" : "");
      return;
    }
    if (Array.isArray(value)) {
      /* `columns` ของแถว: เอาแค่โครง (id/ความกว้าง) — บล็อกลูกถูกเทียบแยก */
      value.forEach((entry, index) => {
        if (path === "columns" && typeof entry === "object" && entry !== null) {
          const record = entry as Record<string, unknown>;
          out.set(`columns[${index}].id`, typeof record["id"] === "string" ? record["id"] : "");
          visit(record["width"], `columns[${index}].width`, depth + 1);
          return;
        }
        visit(entry, `${path}[${index}]`, depth + 1);
      });
      return;
    }
    if (typeof value === "object") {
      /*
        `visibility`: รายงานเฉพาะ "ขนาดจอที่ถูกซ่อน" (ค่าที่เป็น true คือค่าปกติ ไม่ใช่สิ่งที่ผู้ใช้แก้)
        ⇒ ผู้ใช้เห็นแค่ "ซ่อนบนมือถือ" ไม่ต้องเห็นสามบรรทัดเวลาซ่อนจอเดียว
      */
      if (path === "visibility") {
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
          if (child === false) out.set(`visibility.${key}`, "false");
        }
        return;
      }

      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (IGNORED_KEYS.has(key)) continue;
        visit(child, path === "" ? key : `${path}.${key}`, depth + 1);
      }
    }
  };

  visit(block, "", 0);
  return out;
}

export function documentDiff(base: BlockDocument, next: BlockDocument): DocumentDiff {
  const baseLocated = locate(base);
  const nextLocated = locate(next);

  const baseById = new Map(baseLocated.map((entry) => [entry.block.id, entry]));
  const nextById = new Map(nextLocated.map((entry) => [entry.block.id, entry]));

  const rawEntries: DiffEntry[] = [];
  let unchanged = 0;

  /* บล็อกที่อยู่ในรุ่นใหม่ (เพิ่มใหม่ หรือเทียบกับของเดิม) — เรียงตามลำดับในรุ่นใหม่ */
  for (const entry of nextLocated) {
    const previous = baseById.get(entry.block.id);

    if (previous === undefined) {
      rawEntries.push({
        kind: "added",
        blockId: entry.block.id,
        blockType: entry.block.type,
        index: entry.index,
        columnIndex: entry.columnIndex,
        fields: [],
        truncated: false,
      });
      continue;
    }

    const before = flattenBlock(previous.block);
    const after = flattenBlock(entry.block);
    const keys = new Set([...before.keys(), ...after.keys()]);
    const fields: DiffFieldChange[] = [];

    for (const key of [...keys].sort()) {
      const beforeValue = before.get(key) ?? "";
      const afterValue = after.get(key) ?? "";
      if (beforeValue === afterValue) continue;
      fields.push({ path: key, before: beforeValue, after: afterValue });
    }

    if (fields.length > 0) {
      rawEntries.push({
        kind: "changed",
        blockId: entry.block.id,
        blockType: entry.block.type,
        index: entry.index,
        columnIndex: entry.columnIndex,
        fields: fields.slice(0, MAX_DIFF_FIELDS_PER_BLOCK),
        truncated: fields.length > MAX_DIFF_FIELDS_PER_BLOCK,
      });
      continue;
    }

    const samePosition = previous.index === entry.index && previous.containerKey === entry.containerKey;
    if (!samePosition) {
      rawEntries.push({
        kind: "moved",
        blockId: entry.block.id,
        blockType: entry.block.type,
        index: entry.index,
        columnIndex: entry.columnIndex,
        fields: [],
        truncated: false,
      });
      continue;
    }

    unchanged += 1;
  }

  /* บล็อกที่หายไปจากรุ่นใหม่ — รายงานหลังสุด (เรียงตามลำดับเดิม) */
  for (const entry of baseLocated) {
    if (nextById.has(entry.block.id)) continue;
    rawEntries.push({
      kind: "removed",
      blockId: entry.block.id,
      blockType: entry.block.type,
      index: entry.index,
      columnIndex: entry.columnIndex,
      fields: [],
      truncated: false,
    });
  }

  /* เลย์เอาต์ของทั้งหน้า (X1.8) — ความต่างระดับหน้า ไม่ผูกกับบล็อกใด ๆ */
  const baseLayout = layoutOf(base);
  const nextLayout = layoutOf(next);
  if (baseLayout !== nextLayout) {
    rawEntries.push({
      kind: "changed",
      blockId: "",
      blockType: LAYOUT_DIFF_BLOCK_TYPE,
      index: 0,
      columnIndex: null,
      fields: [{ path: "layout", before: baseLayout, after: nextLayout }],
      truncated: false,
    });
  }

  const added = rawEntries.filter((entry) => entry.kind === "added").length;
  const removed = rawEntries.filter((entry) => entry.kind === "removed").length;
  const changed = rawEntries.filter((entry) => entry.kind === "changed").length;
  const moved = rawEntries.filter((entry) => entry.kind === "moved").length;

  const baseOrder = baseLocated.map((entry) => entry.block.id).join("\u0000");
  const nextOrder = nextLocated.map((entry) => entry.block.id).join("\u0000");

  return {
    summary: { added, removed, changed, moved, unchanged, total: added + removed + changed + moved },
    orderChanged: baseOrder !== nextOrder,
    entries: rawEntries.slice(0, MAX_DIFF_ENTRIES),
    truncated: rawEntries.length > MAX_DIFF_ENTRIES,
    identical: rawEntries.length === 0,
  };
}

/** จำนวน "จุดที่ต่าง" (ใช้กับตัวนับงานที่ยังไม่บันทึก) */
export function diffCount(diff: DocumentDiff): number {
  return diff.summary.total;
}

/** เอกสารสองใบเหมือนกันทุกอย่างหรือไม่ (เทียบผ่าน diff — ไม่ใช้ JSON.stringify เพราะลำดับคีย์ไม่สำคัญกับเรา) */
export function documentsEqual(base: BlockDocument, next: BlockDocument): boolean {
  return documentDiff(base, next).identical;
}

/** รายชื่อชนิดบล็อกที่ปรากฏในความต่าง (ไว้โชว์สรุปสั้น ๆ) */
export function diffBlockTypes(diff: DocumentDiff): readonly string[] {
  return [...new Set(diff.entries.map((entry) => entry.blockType))];
}

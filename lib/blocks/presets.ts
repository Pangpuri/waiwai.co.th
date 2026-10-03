import { randomBytes } from "node:crypto";

import { getPool } from "@/db/pool";
import { parseBlockDocument } from "@/lib/blocks/parse";
import type { Block } from "@/lib/blocks/types";

/**
 * พรีเซ็ตบล็อก = "คลังแบบสำเร็จ" (ผู้ใช้สั่ง รอบที่ 52)
 * *"บันทึกบล็อก/แบนเนอร์ที่ทำไว้เป็นพรีเซ็ต แล้วดึงมาวาง หรือเอาขึ้นไปทับของเดิมได้เลย"*
 *
 * เก็บ **บล็อกทั้งก้อน** (ข้อความ ภาพ สไตล์) เป็น JSONB ⇒ ดึงไปวางในหน้าไหนก็ได้
 * ⚠️ ภาพที่พรีเซ็ตอ้างถึงอยู่ในตาราง `media` (พาธ `/media/<id>`) ⇒ **อย่าลบภาพที่พรีเซ็ตยังใช้อยู่**
 */

export const MAX_PRESET_NAME_LENGTH = 60;
export const MAX_PRESETS = 200;

export function newPresetId(): string {
  return randomBytes(9).toString("base64url");
}

/** ชื่อพรีเซ็ตที่ใช้ได้: ตัดช่องว่างหัวท้าย · ว่าง = ใช้ไม่ได้ · ยาวเกินเพดาน = ตัดให้พอดี */
export function normalizePresetName(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed === "") return null;
  return trimmed.slice(0, MAX_PRESET_NAME_LENGTH);
}

export type BlockPreset = {
  readonly id: string;
  readonly name: string;
  readonly blockType: string;
  /** บล็อกที่ผ่านการตรวจรูปทรงแล้ว (parse สำเร็จ) */
  readonly block: Block;
  readonly createdAt: string;
};

type PresetRow = {
  readonly id: string;
  readonly name: string;
  readonly block_type: string;
  readonly block: unknown;
  readonly created_at: Date | string;
};

/**
 * แปลงแถวจากฐานข้อมูลเป็นพรีเซ็ตที่ใช้ได้
 * - **ต้องผ่าน `parseBlockDocument` ทุกครั้ง** (ข้อมูลใน DB ถูกแก้จากภายนอกได้เสมอ)
 * - แถวที่อ่านไม่ได้ = ข้าม (ไม่ทำให้หน้าจอพัง)
 */
function toPreset(row: PresetRow): BlockPreset | null {
  const parsed = parseBlockDocument("preset", { blocks: [row.block] });
  const block = parsed.ok ? parsed.document.blocks[0] : undefined;
  if (block === undefined) return null;

  return {
    id: row.id,
    name: row.name,
    blockType: row.block_type,
    block,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function listBlockPresets(): Promise<readonly BlockPreset[]> {
  const { rows } = await getPool().query<PresetRow>(
    "select id, name, block_type, block, created_at from block_preset order by created_at desc limit $1",
    [MAX_PRESETS],
  );

  return rows.map((row) => toPreset(row)).filter((preset): preset is BlockPreset => preset !== null);
}

export async function countBlockPresets(): Promise<number> {
  const { rows } = await getPool().query<{ readonly count: string }>("select count(*)::text as count from block_preset");
  return Number.parseInt(rows[0]?.count ?? "0", 10);
}

/** บันทึกพรีเซ็ตใหม่ · ชื่อซ้ำ (ไม่สนตัวพิมพ์) = เขียนทับของเดิม (ตั้งใจให้แก้ชื่อเดิมได้ง่าย) */
export async function saveBlockPreset(name: string, block: Block, actor: string): Promise<void> {
  await getPool().query(
    `insert into block_preset (id, name, block_type, block, created_by)
       values ($1, $2, $3, $4::jsonb, $5)
     on conflict (lower(name)) do update set
       name = excluded.name,
       block_type = excluded.block_type,
       block = excluded.block,
       updated_at = now(),
       created_by = excluded.created_by`,
    [newPresetId(), name, block.type, JSON.stringify(block), actor],
  );
}

export async function deleteBlockPreset(id: string): Promise<void> {
  await getPool().query("delete from block_preset where id = $1", [id]);
}

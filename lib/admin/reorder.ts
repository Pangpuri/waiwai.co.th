import { getPool, isDatabaseConfigured } from "@/db/pool";

/**
 * "จัดลำดับรายการ" จากหลังบ้าน (รอบที่ 153) — ลาก/เลื่อนแล้วบันทึก
 *
 * ใช้กับ สินค้า · เมนูอาหาร · ข่าว (ทั้งสามมีคอลัมน์ `sort_order` + `deleted_at` เหมือนกัน)
 *
 * ⚠️ ความปลอดภัย: ชื่อตารางมาจาก **ตารางที่อนุญาต (whitelist) เท่านั้น** — ไม่รับจากผู้ใช้ตรง ๆ
 *    ค่าลำดับถูกส่งเป็น **พารามิเตอร์** (`unnest($1::text[]) with ordinality`) ⇒ ไม่มีทางเป็น SQL injection
 * ⚠️ รายการที่ไม่ถูกส่งมา (เช่นถูกกรองออก) จะ **ไม่ถูกแตะ** — ที่ส่งมาต้องเป็นรายการที่เห็นบนจอเท่านั้น
 */

const TABLE_BY_KIND = { product: "product", recipe: "recipe", news: "news" } as const;

export type ReorderKind = keyof typeof TABLE_BY_KIND;

export function isReorderKind(value: string): value is ReorderKind {
  return Object.prototype.hasOwnProperty.call(TABLE_BY_KIND, value);
}

/** "id1,id2,id3" → ['id1','id2','id3'] (ตัดช่องว่าง/ค่าว่าง/ตัวซ้ำ) */
export function parseOrderCsv(raw: string): readonly string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id === "" || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export type ReorderItem = { readonly id: string; readonly title: string; readonly subtitle: string };

/** คอลัมน์หัวข้อ/บรรทัดรองต่อชนิด (ใช้ทำรายการให้ลาก) */
const TITLE_COLUMN_BY_KIND: Readonly<Record<ReorderKind, string>> = {
  product: "coalesce(nullif(name_th, ''), id)",
  recipe: "coalesce(nullif(title_th, ''), id)",
  news: "coalesce(nullif(title_th, ''), id)",
};

const SUBTITLE_COLUMN_BY_KIND: Readonly<Record<ReorderKind, string>> = {
  product: "category_id",
  recipe: "coalesce(video_id, '')",
  news: "coalesce(to_char(published_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD'), '')",
};

/** รายการที่ยังใช้งาน เรียงตามลำดับปัจจุบัน (ให้หน้าจอลาก) */
export async function listReorderItems(kind: ReorderKind): Promise<readonly ReorderItem[]> {
  if (!isDatabaseConfigured()) return [];
  const table = TABLE_BY_KIND[kind];
  try {
    const result = await getPool().query<{ id: string; title: string; subtitle: string }>(
      `select id,
              ${TITLE_COLUMN_BY_KIND[kind]} as title,
              coalesce(${SUBTITLE_COLUMN_BY_KIND[kind]}, '') as subtitle
         from ${table}
        where deleted_at is null
        order by sort_order, id`,
    );
    return result.rows.map((row) => ({ id: row.id, title: row.title, subtitle: row.subtitle }));
  } catch {
    return [];
  }
}

/** เขียนลำดับใหม่: แถวแรก = 1, ถัดไป = 2, … (คืนจำนวนแถวที่ถูกแก้) */
export async function reorderRows(kind: ReorderKind, ids: readonly string[], actor: string): Promise<number> {
  if (!isDatabaseConfigured() || ids.length === 0) return 0;
  const table = TABLE_BY_KIND[kind];
  try {
    const result = await getPool().query(
      `update ${table} as target
          set sort_order = ordered.ord,
              updated_at = now(),
              updated_by = $2
         from (
           select id, ordinality::int as ord
             from unnest($1::text[]) with ordinality as t(id, ordinality)
         ) as ordered
        where target.id = ordered.id`,
      [ids, actor],
    );
    return result.rowCount ?? 0;
  } catch {
    return 0;
  }
}

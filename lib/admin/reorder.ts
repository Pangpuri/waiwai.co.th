import { getPool, isDatabaseConfigured } from "@/db/pool";

/**
 * "จัดลำดับรายการ" จากหลังบ้าน (รอบที่ 153–154) — ลาก/เลื่อนแล้วบันทึก
 *
 * ใช้กับ สินค้า · เมนูอาหาร · ข่าว
 *
 * ⚠️ ความปลอดภัย: ชื่อตารางมาจาก **ตารางที่อนุญาต (whitelist) เท่านั้น** — ไม่รับจากผู้ใช้ตรง ๆ
 *    ค่าลำดับถูกส่งเป็น **พารามิเตอร์** (`unnest($1::text[]) with ordinality`) ⇒ ไม่มีทางเป็น SQL injection
 * ⚠️ รายการที่ไม่ถูกส่งมา (เช่นถูกกรองออก) จะ **ไม่ถูกแตะ** — ที่ส่งมาต้องเป็นรายการที่เห็นบนจอเท่านั้น
 *
 * รอบที่ 154 (ฟีดแบ็กเจ้าของ):
 *   · **สินค้าต้องแยกตามหมวด** — เว็บแสดงสินค้าเป็นรายหมวด ลำดับจึงต้องจัด "ภายในหมวด"
 *     ⇒ `listReorderItems("product", { categoryId })` และหน้าจอมีตัวเลือกหมวด
 *   · **ข่าวไม่แสดง** — ต้นเหตุคือตาราง `news` ยังไม่มี `sort_order` (แก้ที่ migration 0025)
 */

const TABLE_BY_KIND = {
  product: "product",
  recipe: "recipe",
  category: "product_category",
  /* ประกาศรับสมัครงาน (รอบที่ 265 · มติ D26) — มีถังขยะ (`deleted_at`) จึงไม่ต้องยกเว้น */
  job: "job_posting",
} as const;

export type ReorderKind = keyof typeof TABLE_BY_KIND;

/**
 * ตารางที่ **ไม่มี** คอลัมน์ `deleted_at` (จึงไม่ต้องกรองถังขยะ)
 * ⚠️ `product_category` ไม่มีถังขยะ — มติ D25 ใช้ "ซ่อนจากเว็บ" (`is_hidden`) แทนการลบ
 */
const KINDS_WITHOUT_TRASH: readonly ReorderKind[] = ["category"];

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

/**
 * คอลัมน์หัวข้อ/บรรทัดรองต่อชนิด — ตรวจกับสคีมาจริงแล้ว
 * ⚠️ รอบที่ 272: **ไม่มี `news`** แล้ว — เจ้าของสั่งถอด "จัดลำดับข่าว" (หน้าเว็บเรียงตามวันที่เสมอ)
 */
const TITLE_COLUMN_BY_KIND: Readonly<Record<ReorderKind, string>> = {
  product: "coalesce(nullif(name_th, ''), id)",
  recipe: "coalesce(nullif(title_th, ''), id)",
  /* หมวดสินค้า: ชื่อไทยว่างได้ (ถอยพจนานุกรม) ⇒ โชว์ id เพื่อให้ยังจัดลำดับได้ */
  category: "coalesce(nullif(name_th, ''), id)",
  job: "coalesce(nullif(title_th, ''), id)",
};

const SUBTITLE_COLUMN_BY_KIND: Readonly<Record<ReorderKind, string>> = {
  product: "category_id",
  recipe: "coalesce(video_id, '')",
  category: "case when is_hidden then 'hidden' else '' end",
  job: "coalesce(department_th, '')",
};

/** หมวดสินค้าที่มีอยู่จริง (ใช้ทำตัวเลือกในหน้าจัดลำดับ · เรียงตามชื่อ) */
export async function listReorderCategoryIds(): Promise<readonly string[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<{ category_id: string }>(
      `select distinct category_id
         from product
        where deleted_at is null and category_id <> ''
        order by category_id`,
    );
    return result.rows.map((row) => row.category_id);
  } catch {
    return [];
  }
}

/**
 * รายการที่ยังใช้งาน เรียงตามลำดับปัจจุบัน
 * ⚠️ สินค้า: ต้องระบุ `categoryId` (จัดลำดับภายในหมวดเท่านั้น) — ไม่ระบุ = คืนทุกรายการ (ไม่ควรใช้บนจอ)
 */
export async function listReorderItems(
  kind: ReorderKind,
  options?: { readonly categoryId?: string },
): Promise<readonly ReorderItem[]> {
  if (!isDatabaseConfigured()) return [];
  const table = TABLE_BY_KIND[kind];
  const params: string[] = [];
  const where: string[] = [];
  if (!KINDS_WITHOUT_TRASH.includes(kind)) where.push("deleted_at is null");
  if (kind === "product") {
    const categoryId = options?.categoryId ?? "";
    if (categoryId === "") return [];
    params.push(categoryId);
    where.push(`category_id = $${String(params.length)}`);
  }
  const whereClause = where.length === 0 ? "" : `where ${where.join(" and ")}`;
  try {
    const result = await getPool().query<{ id: string; title: string; subtitle: string }>(
      `select id,
              ${TITLE_COLUMN_BY_KIND[kind]} as title,
              coalesce(${SUBTITLE_COLUMN_BY_KIND[kind]}, '') as subtitle
         from ${table}
        ${whereClause}
        order by sort_order, id`,
      params,
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

import { randomUUID } from "node:crypto";

import { getPool, isDatabaseConfigured } from "@/db/pool";
import {
  categoryPresetApplyPlan,
  defaultSortOrderOf,
  sortCategoryRows,
  type CategoryDefaultRecord,
  type CategoryPresetPayload,
  type CategorySnapshot,
} from "@/lib/products/categories";

/**
 * ชั้นข้อมูลของ **"หมวดสินค้า" ฝั่งหลังบ้าน** (รอบที่ 264 · มติ D25) — ฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * หลักการเดียวกับส่วนอื่นของโปรเจกต์
 * - **ห้ามทำให้หน้าจอ/หน้าเว็บพังเพราะฐานข้อมูล** — อ่านไม่สำเร็จ ⇒ คืน `[]`/`null` (ผู้เรียกถอยค่าเดิม)
 * - ข้อมูลจาก DB ผ่าน mapper เสมอ (ไม่เชื่อค่าดิบ) · วันที่ (`timestamptz`) แปลงเป็น ISO string ที่ชั้นนี้
 *   (บทเรียนรอบที่ 197: `pg` คืน `Date` ให้ `timestamptz` — ห้ามประกาศเป็น `string` ลอย ๆ)
 *
 * ⚠️ ตาราง `product_category_default` = **ค่าเริ่มต้นถาวร (immutable)**
 *   · แอปเขียนได้ **เฉพาะตอนเติมครั้งแรก** (`insert … on conflict do nothing` — fill-only) ผ่าน `insertCategoryDefaults()`
 *   · ห้ามมี `update`/`delete` ที่ไฟล์อื่น (มีเทสต์สแกนซอร์สกันไว้)
 */

export type AdminCategoryRow = {
  /** slug ของหมวด (= `id` ใน DB = ส่วนท้าย URL `/products/<slug>`) */
  readonly id: string;
  readonly sourceId: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  readonly imagePath: string | null;
  readonly imageWidth: number | null;
  readonly imageHeight: number | null;
  readonly logoPath: string | null;
  readonly logoWidth: number | null;
  readonly logoHeight: number | null;
  readonly productCount: number;
  readonly sortOrder: number;
  readonly isHidden: boolean;
  readonly updatedAt: string;
  readonly updatedBy: string;
};

export type CategoryPresetRecord = {
  readonly id: string;
  readonly name: string;
  readonly payload: CategoryPresetPayload;
  readonly createdAt: string;
  readonly createdBy: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mediaPath(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? `/media/${value}` : null;
}

function dimension(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/*
  แปลง `timestamptz` → ISO string (รับได้ทั้ง `Date` และ `string`)
  ⚠️ ห้ามโยน error — ค่าเพี้ยน = คืนสตริงว่าง (หน้าจอต้องไม่พัง) · บทเรียนรอบที่ 197
*/
function toIsoStamp(value: unknown): string {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : "";
  if (typeof value === "string") return value;
  return "";
}

const ADMIN_CATEGORY_COLUMNS = `c.id,
  c.source_id       as "sourceId",
  c.name_th         as "nameTh",
  c.name_en         as "nameEn",
  c.description_th  as "descriptionTh",
  c.description_en  as "descriptionEn",
  m.id              as "imageId",
  m.width           as "imageWidth",
  m.height          as "imageHeight",
  lm.id             as "logoId",
  lm.width          as "logoWidth",
  lm.height         as "logoHeight",
  c.sort_order      as "sortOrder",
  c.is_hidden       as "isHidden",
  c.updated_at      as "updatedAt",
  c.updated_by      as "updatedBy",
  count(p.id)::text as "productCount"`;

function toAdminCategoryRow(row: Record<string, unknown>): AdminCategoryRow {
  const count = Number.parseInt(text(row.productCount), 10);
  return {
    id: text(row.id),
    sourceId: text(row.sourceId),
    nameTh: text(row.nameTh),
    nameEn: text(row.nameEn),
    descriptionTh: text(row.descriptionTh),
    descriptionEn: text(row.descriptionEn),
    imagePath: mediaPath(row.imageId),
    imageWidth: dimension(row.imageWidth),
    imageHeight: dimension(row.imageHeight),
    logoPath: mediaPath(row.logoId),
    logoWidth: dimension(row.logoWidth),
    logoHeight: dimension(row.logoHeight),
    productCount: Number.isFinite(count) ? count : 0,
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : defaultSortOrderOf(text(row.id)),
    isHidden: row.isHidden === true,
    updatedAt: toIsoStamp(row.updatedAt),
    updatedBy: text(row.updatedBy),
  };
}

/** หมวดทั้งหมดสำหรับหน้าจอหลังบ้าน (เรียงตามลำดับที่ผู้ดูแลจัดไว้) — คืน `[]` ถ้าอ่านไม่ได้ */
export async function listAdminCategories(): Promise<readonly AdminCategoryRow[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select ${ADMIN_CATEGORY_COLUMNS}
         from product_category c
         left join media m on m.id = c.image_media_id
         left join media lm on lm.id = c.logo_media_id
         left join product p on p.category_id = c.id
        group by c.id, c.source_id, c.name_th, c.name_en, c.description_th, c.description_en,
                 m.id, m.width, m.height, lm.id, lm.width, lm.height,
                 c.sort_order, c.is_hidden, c.updated_at, c.updated_by`,
    );
    return sortCategoryRows(result.rows.map(toAdminCategoryRow));
  } catch {
    return [];
  }
}

/** หมวดเดียว (ใช้หลังบันทึกเพื่อรายงานผล) */
export async function loadAdminCategory(id: string): Promise<AdminCategoryRow | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select ${ADMIN_CATEGORY_COLUMNS}
         from product_category c
         left join media m on m.id = c.image_media_id
         left join media lm on lm.id = c.logo_media_id
         left join product p on p.category_id = c.id
        where c.id = $1
        group by c.id, c.source_id, c.name_th, c.name_en, c.description_th, c.description_en,
                 m.id, m.width, m.height, lm.id, lm.width, lm.height,
                 c.sort_order, c.is_hidden, c.updated_at, c.updated_by`,
      [id],
    );
    const row = result.rows[0];
    return row === undefined ? null : toAdminCategoryRow(row);
  } catch {
    return null;
  }
}

/** รายชื่อ id ของหมวดที่มีอยู่ (ใช้ตรวจ slug ซ้ำ/เพดานจำนวน) */
export async function listCategoryIds(): Promise<readonly string[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<{ id: string }>(`select id from product_category order by id`);
    return result.rows.map((row) => text(row.id)).filter((id) => id !== "");
  } catch {
    return [];
  }
}

/* ── ค่าเริ่มต้นถาวร (immutable) ─────────────────────────────────────────────── */

function toDefaultRecord(row: Record<string, unknown>): CategoryDefaultRecord {
  return {
    id: text(row.id),
    nameTh: text(row.nameTh),
    nameEn: text(row.nameEn),
    descriptionTh: text(row.descriptionTh),
    descriptionEn: text(row.descriptionEn),
    imageMediaId: typeof row.imageId === "string" && row.imageId.trim() !== "" ? row.imageId : null,
    logoMediaId: typeof row.logoId === "string" && row.logoId.trim() !== "" ? row.logoId : null,
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : defaultSortOrderOf(text(row.id)),
    /* ค่าเริ่มต้น = สถานะที่ "ไม่ซ่อน" เสมอ (กดคืนค่าแล้วหมวดกลับมาแสดงบนเว็บ) */
    isHidden: false,
    capturedAt: toIsoStamp(row.capturedAt),
    capturedBy: text(row.capturedBy),
  };
}

export async function listCategoryDefaults(): Promise<readonly CategoryDefaultRecord[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select id,
              name_th        as "nameTh",
              name_en        as "nameEn",
              description_th as "descriptionTh",
              description_en as "descriptionEn",
              image_media_id as "imageId",
              logo_media_id  as "logoId",
              sort_order     as "sortOrder",
              captured_at    as "capturedAt",
              captured_by    as "capturedBy"
         from product_category_default
        order by sort_order, id`,
    );
    return result.rows.map(toDefaultRecord);
  } catch {
    return [];
  }
}

/**
 * เติมค่าเริ่มต้น (fill-only) — ใช้โดยสคริปต์ `npm run products:category-defaults`
 * ⚠️ `on conflict do nothing` ⇒ **ไม่ทับชุดเดิม** (นี่คือกลไกที่ทำให้ "ล็อกถาวร" จริง)
 * ⚠️ ห้ามเรียกจาก UI (หน้าจอไม่มีทางเขียนตารางนี้)
 */
export async function insertCategoryDefaults(
  records: readonly CategorySnapshot[],
  actor: string,
): Promise<number> {
  if (records.length === 0) return 0;
  let written = 0;
  for (const record of records) {
    const result = await getPool().query(
      `insert into product_category_default
         (id, name_th, name_en, description_th, description_en, image_media_id, logo_media_id, sort_order, captured_at, captured_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9)
       on conflict (id) do nothing`,
      [
        record.id,
        record.nameTh,
        record.nameEn,
        record.descriptionTh,
        record.descriptionEn,
        record.imageMediaId,
        record.logoMediaId,
        record.sortOrder,
        actor,
      ],
    );
    written += result.rowCount ?? 0;
  }
  return written;
}

/**
 * คืนค่าหมวดจากค่าเริ่มต้น (รายหมวด)
 * - แถวหมวดยังไม่มี (ฐานข้อมูลใหม่ที่ยังไม่รันตัวนำเข้า) ⇒ **สร้างจากค่าเริ่มต้นให้**
 * - คืน `true` = เขียนจริง
 */
export async function restoreCategoryFromDefault(id: string, actor: string): Promise<boolean> {
  const result = await getPool().query(
    `insert into product_category
       (id, name_th, name_en, description_th, description_en, image_media_id, logo_media_id, sort_order, is_hidden, updated_at, updated_by)
     select d.id, d.name_th, d.name_en, d.description_th, d.description_en,
            d.image_media_id, d.logo_media_id, d.sort_order, false, now(), $2
       from product_category_default d
      where d.id = $1
     on conflict (id) do update set
       name_th        = excluded.name_th,
       name_en        = excluded.name_en,
       description_th = excluded.description_th,
       description_en = excluded.description_en,
       image_media_id = excluded.image_media_id,
       logo_media_id  = excluded.logo_media_id,
       sort_order     = excluded.sort_order,
       is_hidden      = false,
       updated_at     = now(),
       updated_by     = excluded.updated_by`,
    [id, actor],
  );
  return (result.rowCount ?? 0) > 0;
}

/** คืนค่าเริ่มต้น **ทั้งชุด** (ทุกหมวดที่มีค่าเริ่มต้น) — คืนจำนวนแถวที่เขียน */
export async function restoreAllCategoriesFromDefault(actor: string): Promise<number> {
  const result = await getPool().query(
    `insert into product_category
       (id, name_th, name_en, description_th, description_en, image_media_id, logo_media_id, sort_order, is_hidden, updated_at, updated_by)
     select d.id, d.name_th, d.name_en, d.description_th, d.description_en,
            d.image_media_id, d.logo_media_id, d.sort_order, false, now(), $1
       from product_category_default d
     on conflict (id) do update set
       name_th        = excluded.name_th,
       name_en        = excluded.name_en,
       description_th = excluded.description_th,
       description_en = excluded.description_en,
       image_media_id = excluded.image_media_id,
       logo_media_id  = excluded.logo_media_id,
       sort_order     = excluded.sort_order,
       is_hidden      = false,
       updated_at     = now(),
       updated_by     = excluded.updated_by`,
    [actor],
  );
  return result.rowCount ?? 0;
}

/* ── เขียนค่าหมวด (หลังบ้าน) ─────────────────────────────────────────────────── */

export type CategoryWriteInput = {
  readonly id: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  readonly sortOrder: number;
  readonly isHidden: boolean;
  /** `undefined` = ไม่แตะภาพ (คนละเรื่องกับ `null` = ลบภาพ) */
  readonly imageMediaId?: string | null;
  readonly logoMediaId?: string | null;
};

/**
 * สร้างหมวดใหม่ (มติ D25: slug สร้างจากชื่ออังกฤษ · `source_id` ไม่บังคับสำหรับหมวดที่สร้างเอง)
 * คืน `false` = มี id นี้อยู่แล้ว (ไม่ทับของเดิม — ผู้เรียกต้องแจ้งผู้ใช้)
 */
export async function createProductCategoryAdmin(
  input: Omit<CategoryWriteInput, "isHidden">,
  actor: string,
): Promise<boolean> {
  const result = await getPool().query(
    `insert into product_category
       (id, source_id, name_th, name_en, description_th, description_en, image_media_id, logo_media_id, sort_order, is_hidden, updated_at, updated_by)
     values ($1, '', $2, $3, $4, $5, $6, $7, $8, false, now(), $9)
     on conflict (id) do nothing`,
    [
      input.id,
      input.nameTh,
      input.nameEn,
      input.descriptionTh,
      input.descriptionEn,
      input.imageMediaId ?? null,
      input.logoMediaId ?? null,
      input.sortOrder,
      actor,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * บันทึกค่าหมวด (เฉพาะแถวที่มีอยู่) — คืน `false` ถ้าไม่พบหมวด
 * ⚠️ ใช้ `undefined` = ไม่แตะภาพ · `null` = ลบภาพ (ถอยไปใช้ไฟล์ใน `public/` หรือไม่มีภาพ)
 *    ⇒ กันเคสจริงรอบที่ 263 (POST ที่ไม่ส่งฟิลด์แล้วเผลอลบภาพ) ด้วยการแยก `undefined`/`null` ให้ชัด
 */
export async function updateProductCategoryAdmin(input: CategoryWriteInput, actor: string): Promise<boolean> {
  const touchImage = input.imageMediaId !== undefined;
  const touchLogo = input.logoMediaId !== undefined;
  const result = await getPool().query(
    `update product_category
        set name_th        = $2,
            name_en        = $3,
            description_th = $4,
            description_en = $5,
            sort_order     = $6,
            is_hidden      = $7,
            image_media_id = case when $8::boolean then $9::text else image_media_id end,
            logo_media_id  = case when $10::boolean then $11::text else logo_media_id end,
            updated_at     = now(),
            updated_by     = $12
      where id = $1`,
    [
      input.id,
      input.nameTh,
      input.nameEn,
      input.descriptionTh,
      input.descriptionEn,
      input.sortOrder,
      input.isHidden,
      touchImage,
      input.imageMediaId ?? null,
      touchLogo,
      input.logoMediaId ?? null,
      actor,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

/** ซ่อน/แสดงหมวดบนเว็บ (มติ D25 ข้อ 3 — "ซ่อน" แทน "ลบ") · คืน `false` ถ้าไม่พบหมวด */
export async function setCategoryHidden(id: string, hidden: boolean, actor: string): Promise<boolean> {
  const result = await getPool().query(
    `update product_category
        set is_hidden = $2, updated_at = now(), updated_by = $3
      where id = $1`,
    [id, hidden, actor],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * จัดลำดับหมวดตามรายการ id ที่ส่งมา (ลำดับที่ไม่อยู่ในรายการ = ไม่ถูกแตะ)
 * ใช้ `case` ในคำสั่งเดียว ⇒ atomic และรันซ้ำได้ผลเดิม
 */
export async function reorderCategories(ids: readonly string[], actor: string): Promise<boolean> {
  if (ids.length === 0) return false;
  /* `(values …)` ผูก id ↔ ลำดับใหม่ในคำสั่งเดียว ⇒ atomic · id ที่ไม่ส่งมาไม่ถูกแตะ */
  const values = ids.map((_, index) => `($${index * 2 + 2}::text, $${index * 2 + 3}::int)`).join(", ");
  const params: unknown[] = [actor];
  ids.forEach((id, index) => params.push(id, (index + 1) * 10));
  const result = await getPool().query(
    `update product_category as c
        set sort_order = v.sort_order,
            updated_at = now(),
            updated_by = $1
       from (values ${values}) as v(id, sort_order)
      where c.id = v.id`,
    params,
  );
  return (result.rowCount ?? 0) > 0;
}

/* ── พรีเซ็ต (มติ D25 ข้อ 5) ─────────────────────────────────────────────────── */

function readPresetPayload(raw: unknown): CategoryPresetPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (record["version"] !== 1 || !Array.isArray(record["categories"])) return null;
  const categories: CategorySnapshot[] = [];
  for (const entry of record["categories"]) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const id = text(row["id"]).trim();
    if (id === "") continue;
    categories.push({
      id,
      nameTh: text(row["nameTh"]),
      nameEn: text(row["nameEn"]),
      descriptionTh: text(row["descriptionTh"]),
      descriptionEn: text(row["descriptionEn"]),
      imageMediaId: typeof row["imageMediaId"] === "string" && row["imageMediaId"].trim() !== "" ? row["imageMediaId"] : null,
      logoMediaId: typeof row["logoMediaId"] === "string" && row["logoMediaId"].trim() !== "" ? row["logoMediaId"] : null,
      sortOrder: typeof row["sortOrder"] === "number" ? row["sortOrder"] : 100,
      isHidden: row["isHidden"] === true,
    });
  }
  return { version: 1, categories };
}

export async function listCategoryPresets(): Promise<readonly CategoryPresetRecord[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select id, name, payload, created_at as "createdAt", created_by as "createdBy"
         from product_category_preset
        order by created_at desc, name`,
    );
    const presets: CategoryPresetRecord[] = [];
    for (const row of result.rows) {
      const payload = readPresetPayload(row.payload);
      const id = text(row.id);
      const name = text(row.name);
      if (payload === null || id === "" || name === "") continue;
      presets.push({ id, name, payload, createdAt: toIsoStamp(row.createdAt), createdBy: text(row.createdBy) });
    }
    return presets;
  } catch {
    return [];
  }
}

export async function loadCategoryPreset(id: string): Promise<CategoryPresetRecord | null> {
  const presets = await listCategoryPresets();
  return presets.find((preset) => preset.id === id) ?? null;
}

/**
 * บันทึกชุด — ชื่อซ้ำ (ไม่สนตัวพิมพ์) = **เขียนทับชุดเดิม** (แบบเดียวกับพรีเซ็ตส่วนกลาง W3b)
 * คืน id ของชุดที่บันทึก
 */
export async function saveCategoryPreset(
  name: string,
  payload: CategoryPresetPayload,
  actor: string,
): Promise<string> {
  const trimmed = name.trim();
  const existing = await getPool().query<{ id: string }>(
    `select id from product_category_preset where lower(name) = lower($1) limit 1`,
    [trimmed],
  );
  const existingId = existing.rows[0]?.id;
  if (typeof existingId === "string" && existingId !== "") {
    await getPool().query(
      `update product_category_preset
          set name = $2, payload = $3::jsonb, updated_at = now(), updated_by = $4
        where id = $1`,
      [existingId, trimmed, JSON.stringify(payload), actor],
    );
    return existingId;
  }
  const id = randomUUID();
  await getPool().query(
    `insert into product_category_preset (id, name, payload, created_at, created_by, updated_at, updated_by)
     values ($1, $2, $3::jsonb, now(), $4, now(), $4)`,
    [id, trimmed, JSON.stringify(payload), actor],
  );
  return id;
}

export async function deleteCategoryPreset(id: string): Promise<boolean> {
  const result = await getPool().query(`delete from product_category_preset where id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * ใช้พรีเซ็ต — เขียนทับ **เฉพาะหมวดที่มีอยู่จริง** (ไม่ลบ/ไม่สร้างหมวดใหม่)
 * ⇒ "กดใช้ชุดแล้วข้อมูลหาย" เป็นไปไม่ได้ (มติ D25 ข้อ 5 · ปลอดภัยกว่า)
 */
export async function applyCategoryPreset(
  payload: CategoryPresetPayload,
  actor: string,
): Promise<{ readonly applied: number; readonly skipped: readonly string[] }> {
  const existing = await listCategoryIds();
  const plan = categoryPresetApplyPlan(payload, existing);
  let applied = 0;
  for (const item of plan.apply) {
    const wrote = await updateProductCategoryAdmin(
      {
        id: item.id,
        nameTh: item.nameTh,
        nameEn: item.nameEn,
        descriptionTh: item.descriptionTh,
        descriptionEn: item.descriptionEn,
        sortOrder: item.sortOrder,
        isHidden: item.isHidden,
        imageMediaId: item.imageMediaId,
        logoMediaId: item.logoMediaId,
      },
      actor,
    );
    if (wrote) applied += 1;
  }
  return { applied, skipped: plan.skipped };
}

/** ประกอบ snapshot ของหมวด (ใช้บันทึกเป็นพรีเซ็ต) — pure จากแถวที่อ่านมาแล้ว */
export function categorySnapshotOf(row: AdminCategoryRow): CategorySnapshot {
  return {
    id: row.id,
    nameTh: row.nameTh,
    nameEn: row.nameEn,
    descriptionTh: row.descriptionTh,
    descriptionEn: row.descriptionEn,
    imageMediaId: row.imagePath === null ? null : row.imagePath.replace(/^\/media\//, ""),
    logoMediaId: row.logoPath === null ? null : row.logoPath.replace(/^\/media\//, ""),
    sortOrder: row.sortOrder,
    isHidden: row.isHidden,
  };
}

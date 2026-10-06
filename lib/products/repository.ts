import { getPool, isDatabaseConfigured, withTransaction } from "@/db/pool";
import type { ProductCategoryInput, ProductIngredientInput, ProductInput } from "@/lib/products/model";

/**
 * อ่าน/เขียน "สินค้า" ในฐานข้อมูล (S3 ส่วนที่ 3 · รอบที่ 103 · ถังขยะ รอบที่ 139) — ฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * หลักการเดียวกับส่วนอื่นของโปรเจกต์: **ห้ามทำให้เว็บพังเพราะฐานข้อมูล**
 * - ยังไม่ตั้ง `DATABASE_URL` / ตารางว่าง / อ่านไม่สำเร็จ → คืน `[]` หรือ `null` (หน้าเว็บถอยไปใช้เลย์เอาต์เดิม)
 * - ข้อมูลจาก DB ต้องผ่าน mapper (ไม่เชื่อค่าดิบ) · แถวที่ไม่ผ่านตัวตรวจถูก **ข้าม** ไม่ทำให้ทั้งหน้าล่ม
 * - รูปเก็บเป็น id ของ `media` ⇒ ที่นี่คืนพาธ `/media/<id>` (มติ D9: ห้ามเก็บ/ส่ง URL เต็ม)
 *
 * รอบที่ 139 เพิ่ม **ถังขยะของสินค้า** (`deleted_at`)
 * ⚠️ ฝั่งเว็บสาธารณะต้องเห็นเฉพาะ `deleted_at is null` **เสมอ** (การ์ดหมวด · สินค้าในหมวด · สินค้าเด่น)
 * ⚠️ `product_category` **ไม่มี** deleted_at — หมวดถูกล็อก 6 หมวดตามมติ Q-D (ไม่มี "ลบหมวด")
 */

/** เงื่อนไข "สินค้าที่เว็บสาธารณะเห็นได้" — ใช้ร่วมทุกคำสั่งอ่านฝั่งเว็บ (ห้ามลืม) */
const PUBLIC_PRODUCT_CONDITION = "p.deleted_at is null";

export type ProductIngredientRecord = {
  readonly nameTh: string;
  readonly nameEn: string;
  readonly percentText: string;
};

export type ProductRecord = {
  readonly id: string;
  readonly categoryId: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly groupTh: string;
  readonly groupEn: string;
  readonly taglineTh: string;
  readonly taglineEn: string;
  readonly detailsTh: string;
  readonly allergensTh: string;
  readonly netWeightTh: string;
  readonly fdaNumber: string;
  readonly packagingTh: string;
  /** พาธของภาพ (`/media/<id>`) หรือ null */
  readonly imagePath: string | null;
  /** ขนาดจริงของภาพ (อ่านจากหัวไฟล์ตอนนำเข้า) — ใช้ตั้งสัดส่วนภาพโดยไม่ต้องรอโหลด */
  readonly imageWidth: number | null;
  readonly imageHeight: number | null;
  readonly sortOrder: number;
  readonly ingredients: readonly ProductIngredientRecord[];
};

export type ProductCategoryRecord = {
  readonly id: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  readonly imagePath: string | null;
};

/*
  ⚠️ ต้องระบุ `p.` ทุกคอลัมน์: ตาราง `media` มีคอลัมน์ `id` เหมือนกัน ⇒ เขียนลอย ๆ จะได้
  "column reference \"id\" is ambiguous" แล้วหน้าจะไม่แสดงสินค้าเลยทั้งที่ข้อมูลอยู่ (เจอจริงตอนเขียนด่าน check:db)
*/
const PRODUCT_COLUMNS =
  "p.id, p.category_id, p.name_th, p.name_en, p.group_th, p.group_en, p.tagline_th, p.tagline_en, p.details_th, p.allergens_th, p.net_weight_th, p.fda_number, p.packaging_th, p.image_media_id, p.sort_order";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mediaPath(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? `/media/${value}` : null;
}

function readIngredients(raw: unknown): readonly ProductIngredientRecord[] {
  if (!Array.isArray(raw)) return [];
  const items: ProductIngredientRecord[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const nameTh = text(row.nameTh).trim();
    if (nameTh === "") continue;
    items.push({ nameTh, nameEn: text(row.nameEn), percentText: text(row.percentText) });
  }
  return items;
}

function toProductRecord(row: Record<string, unknown>): ProductRecord | null {
  const id = text(row.id).trim();
  const categoryId = text(row.category_id).trim();
  const nameTh = text(row.name_th).trim();
  if (id === "" || categoryId === "" || nameTh === "") return null;

  return {
    id,
    categoryId,
    nameTh,
    nameEn: text(row.name_en),
    groupTh: text(row.group_th),
    groupEn: text(row.group_en),
    taglineTh: text(row.tagline_th),
    taglineEn: text(row.tagline_en),
    detailsTh: text(row.details_th),
    allergensTh: text(row.allergens_th),
    netWeightTh: text(row.net_weight_th),
    fdaNumber: text(row.fda_number),
    packagingTh: text(row.packaging_th),
    imagePath: mediaPath(row.image_media_id),
    imageWidth: typeof row.image_width === "number" && row.image_width > 0 ? row.image_width : null,
    imageHeight: typeof row.image_height === "number" && row.image_height > 0 ? row.image_height : null,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    ingredients: readIngredients(row.ingredients),
  };
}

/**
 * หมวดสินค้า (คำอธิบาย/ภาพที่นำเข้า) — คืน null ถ้าไม่รู้จัก/อ่านไม่ได้
 * ⚠️ ชื่อหมวดไม่ได้อยู่ที่นี่ — อยู่ที่ `features/products/catalog.ts` (แหล่งเดียว)
 */
export async function loadProductCategory(categoryId: string): Promise<ProductCategoryRecord | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const result = await getPool().query<Record<string, unknown>>(
      "select id, description_th, description_en, image_media_id from product_category where id = $1 limit 1",
      [categoryId],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    const id = text(row.id).trim();
    if (id === "") return null;
    return { id, descriptionTh: text(row.description_th), descriptionEn: text(row.description_en), imagePath: mediaPath(row.image_media_id) };
  } catch {
    return null;
  }
}

/** สินค้าในหมวด (เรียงตามลำดับที่นำเข้า) พร้อมส่วนผสม — คืน `[]` เสมอถ้าอ่านไม่ได้ */
export async function listProductsByCategory(categoryId: string): Promise<readonly ProductRecord[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select ${PRODUCT_COLUMNS},
              min(m.width)  as image_width,
              min(m.height) as image_height,
              coalesce(
                json_agg(
                  json_build_object('nameTh', i.name_th, 'nameEn', i.name_en, 'percentText', i.percent_text)
                  order by i.sort_order
                ) filter (where i.product_id is not null),
                '[]'::json
              ) as ingredients
         from product p
         left join product_ingredient i on i.product_id = p.id
         left join media m on m.id = p.image_media_id
        where p.category_id = $1
          and ${PUBLIC_PRODUCT_CONDITION}
        group by p.id
        order by p.sort_order, p.id`,
      [categoryId],
    );

    const items: ProductRecord[] = [];
    for (const row of result.rows) {
      const record = toProductRecord(row);
      if (record !== null) items.push(record);
    }
    return items;
  } catch {
    return [];
  }
}

/** จำนวนสินค้าต่อหมวด — ใช้แสดงผลสรุป (คืน {} ถ้าอ่านไม่ได้) */
export async function countProductsByCategory(): Promise<Readonly<Record<string, number>>> {
  if (!isDatabaseConfigured()) return {};
  try {
    const result = await getPool().query<{ category_id: string; total: string }>(
      `select p.category_id, count(*)::text as total
         from product p
        where ${PUBLIC_PRODUCT_CONDITION}
        group by p.category_id`,
    );
    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      const total = Number.parseInt(row.total, 10);
      if (typeof row.category_id === "string" && Number.isFinite(total)) counts[row.category_id] = total;
    }
    return counts;
  } catch {
    return {};
  }
}

/**
 * การ์ดหมวดสำหรับ **หน้าแรก** (รอบที่ 108) — หมวด + คำอธิบาย + ภาพ + จำนวนสินค้า ใน **คิวรีเดียว**
 *
 * ทำไมต้องมีตัวนี้: หน้าแรกเคยใช้ข้อมูลจำลองในโค้ด (`features/home/content.ts`) ซึ่งมี slug เก่า
 * ที่ไม่มีอยู่จริง (`/products/cup-noodles` ฯลฯ) ⇒ **ลิงก์เสีย 4 เส้น** · ตัวนี้ดึงของจริงจากฐานข้อมูล
 * (หมวด/ภาพ/คำอธิบายมาจากการนำเข้าเว็บเดิม · `product_category.image_media_id` → `/media/<id>`)
 * ⚠️ ลำดับการแสดง **ไม่ได้** มาจากฐานข้อมูล — ผู้เรียกเรียงตาม `CATALOG_ITEMS` ในโค้ด (แหล่งความจริงเดียวของ slug)
 */
export type ProductCategoryCardRecord = {
  readonly id: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  /** `/media/<id>` หรือ null */
  readonly imagePath: string | null;
  readonly imageWidth: number | null;
  readonly imageHeight: number | null;
  readonly productCount: number;
};

export async function listProductCategoryCards(): Promise<readonly ProductCategoryCardRecord[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<{
      id: string;
      descriptionTh: string;
      descriptionEn: string;
      imageId: string | null;
      imageWidth: number | null;
      imageHeight: number | null;
      productCount: string;
    }>(
      `select c.id,
              c.description_th as "descriptionTh",
              c.description_en as "descriptionEn",
              m.id             as "imageId",
              m.width          as "imageWidth",
              m.height         as "imageHeight",
              count(p.id)::text as "productCount"
         from product_category c
         left join media m on m.id = c.image_media_id
         /* ⚠️ รอบที่ 139: ใส่เงื่อนไขถังขยะใน join (ไม่ใช่ where) เพื่อให้หมวดที่ไม่มีสินค้าเหลือยังได้การ์ดอยู่ */
         left join product p on p.category_id = c.id and ${PUBLIC_PRODUCT_CONDITION}
        group by c.id, m.id, m.width, m.height`,
    );

    const cards: ProductCategoryCardRecord[] = [];
    for (const row of result.rows) {
      const count = Number.parseInt(row.productCount, 10);
      cards.push({
        id: row.id,
        descriptionTh: row.descriptionTh,
        descriptionEn: row.descriptionEn,
        imagePath: mediaPath(row.imageId),
        imageWidth: row.imageWidth,
        imageHeight: row.imageHeight,
        productCount: Number.isFinite(count) ? count : 0,
      });
    }
    return cards;
  } catch {
    return [];
  }
}

/**
 * สินค้าเด่นสำหรับ **หน้าแรก** — 1 ตัวต่อหมวด (ตัวแรกตามลำดับในหมวด) ใน **คิวรีเดียว**
 * · เอาเฉพาะสินค้าที่มีภาพ (การ์ดต้องมีภาพจึงจะดูดี) · ผู้เรียกเรียงตาม `CATALOG_ITEMS` เอง
 */
export type ProductHighlightRecord = {
  readonly id: string;
  readonly categoryId: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly imagePath: string | null;
  readonly imageWidth: number | null;
  readonly imageHeight: number | null;
};

export async function listProductHighlights(): Promise<readonly ProductHighlightRecord[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<{
      id: string;
      categoryId: string;
      nameTh: string;
      nameEn: string;
      imageId: string | null;
      imageWidth: number | null;
      imageHeight: number | null;
    }>(
      /* `distinct on` = เลือกแถวแรกของแต่ละหมวดตามลำดับ sort_order */
      `select distinct on (p.category_id)
              p.id,
              p.category_id as "categoryId",
              p.name_th     as "nameTh",
              p.name_en     as "nameEn",
              m.id          as "imageId",
              m.width       as "imageWidth",
              m.height      as "imageHeight"
         from product p
         join media m on m.id = p.image_media_id
        where ${PUBLIC_PRODUCT_CONDITION}
        order by p.category_id, p.sort_order, p.id`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      nameTh: row.nameTh,
      nameEn: row.nameEn,
      imagePath: mediaPath(row.imageId),
      imageWidth: row.imageWidth,
      imageHeight: row.imageHeight,
    }));
  } catch {
    return [];
  }
}

/* ── ฝั่งเขียน (ใช้โดยสคริปต์นำเข้า) — โยน error ออกไปถ้าล้มเหลว (ห้ามกลืน) ────── */

/**
 * วิธีเขียนภาพ (รอบที่ 134)
 * - `keep` (ค่าตั้งต้น) — ภาพ `null` = **คงภาพเดิมไว้** ⇒ ใช้โดยสคริปต์นำเข้า
 *   (เว็บเดิมมีหมวด/สินค้าที่ไม่มีภาพ ⇒ นำเข้าซ้ำต้องไม่ลบภาพที่ผู้ดูแลเลือกไว้)
 * - `set` — เขียนทับตามค่าที่ส่งมา (`null` = ล้างภาพ) ⇒ ใช้โดย **หน้าจอหลังบ้าน**
 *   (ผู้ดูแลเลือก "ไม่ใช้ภาพ" แล้วต้องลบได้จริง ไม่ใช่เงียบ ๆ คงของเดิมไว้)
 */
export type ImageWriteMode = "keep" | "set";

function imageWriteExpression(mode: ImageWriteMode | undefined, table: string): string {
  if ((mode ?? "keep") === "set") return "excluded.image_media_id";
  return `coalesce(excluded.image_media_id, ${table}.image_media_id)`;
}

export async function upsertProductCategory(
  input: ProductCategoryInput,
  actor: string,
  imageMediaId: string | null,
  options: { readonly imageMode?: ImageWriteMode } = {},
): Promise<void> {
  await getPool().query(
    `insert into product_category (id, source_id, description_th, description_en, image_media_id, updated_at, updated_by)
       values ($1, $2, $3, $4, $5, now(), $6)
     on conflict (id) do update set
       /* ค่าว่างต้องไม่ลบ source_id เดิม (แบบฟอร์มหลังบ้านส่งค่านี้ผ่านช่องซ่อน) */
       source_id      = coalesce(nullif(excluded.source_id, ''), product_category.source_id),
       description_th = excluded.description_th,
       description_en = excluded.description_en,
       image_media_id = ${imageWriteExpression(options.imageMode, "product_category")},
       updated_at     = now(),
       updated_by     = excluded.updated_by`,
    [input.id, input.sourceId, input.descriptionTh, input.descriptionEn, imageMediaId, actor],
  );
}

export async function upsertProduct(
  input: ProductInput,
  actor: string,
  imageMediaId: string | null,
  options: { readonly imageMode?: ImageWriteMode } = {},
): Promise<void> {
  await getPool().query(
    `insert into product (
        id, category_id, source_id, source_url, name_th, name_en, group_th, group_en,
        tagline_th, tagline_en, details_th, allergens_th, net_weight_th, fda_number, packaging_th,
        image_media_id, sort_order, updated_at, updated_by
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now(), $18)
     on conflict (id) do update set
        category_id    = excluded.category_id,
        source_id      = excluded.source_id,
        source_url     = excluded.source_url,
        name_th        = excluded.name_th,
        name_en        = excluded.name_en,
        group_th       = excluded.group_th,
        group_en       = excluded.group_en,
        tagline_th     = excluded.tagline_th,
        tagline_en     = excluded.tagline_en,
        details_th     = excluded.details_th,
        allergens_th   = excluded.allergens_th,
        net_weight_th  = excluded.net_weight_th,
        fda_number     = excluded.fda_number,
        packaging_th   = excluded.packaging_th,
        image_media_id = ${imageWriteExpression(options.imageMode, "product")},
        sort_order     = excluded.sort_order,
        updated_at     = now(),
        updated_by     = excluded.updated_by`,
    [
      input.id,
      input.categoryId,
      input.sourceId,
      input.sourceUrl,
      input.nameTh,
      input.nameEn,
      input.groupTh,
      input.groupEn,
      input.taglineTh,
      input.taglineEn,
      input.detailsTh,
      input.allergensTh,
      input.netWeightTh,
      input.fdaNumber,
      input.packagingTh,
      imageMediaId,
      input.sortOrder,
      actor,
    ],
  );
}

/** แทนที่ส่วนผสมทั้งชุดของสินค้า (ใน transaction เดียว — นำเข้าซ้ำแล้วได้ผลเท่าเดิม) */
export async function replaceProductIngredients(productId: string, items: readonly ProductIngredientInput[]): Promise<void> {
  await withTransaction(async (client) => {
    await client.query("delete from product_ingredient where product_id = $1", [productId]);
    for (const [index, item] of items.entries()) {
      await client.query(
        "insert into product_ingredient (product_id, sort_order, name_th, name_en, percent_text) values ($1, $2, $3, $4, $5)",
        [productId, index, item.nameTh, item.nameEn, item.percentText],
      );
    }
  });
}

/** ลบสินค้า 1 รายการ **ถาวร** (ใช้ในด่านตรวจ/สคริปต์นำเข้า/ล้างข้อมูลทดสอบ) — ส่วนผสมถูกลบตาม (on delete cascade)
 *  ⚠️ หลังบ้านต้องใช้ `deleteProductForever()` (มีประตูถังขยะ) ไม่ใช่ตัวนี้ */
export async function deleteProduct(id: string): Promise<void> {
  await getPool().query("delete from product where id = $1", [id]);
}

/**
 * ลบสินค้า **ถาวรจากถังขยะ** (รอบที่ 139) — ใช้เฉพาะหลังบ้าน
 *
 * ⚠️ **ประตูอยู่ที่ SQL เอง**: `and deleted_at is not null` ⇒ สินค้าที่ไม่เคยเข้าถังขยะ
 *    ถูกลบไม่ได้แม้ action จะถูกเรียกตรง ๆ (fail-closed · เทสต์ได้ที่ `check:db` วงจรที่ 26)
 * คืน `true` = ลบจริง 1 แถว · `false` = ไม่เข้าเงื่อนไข (ยังไม่เข้า ถังขยะ/ไม่มีแถว)
 */
export async function deleteProductForever(id: string): Promise<boolean> {
  const result = await getPool().query("delete from product where id = $1 and deleted_at is not null", [id]);
  return (result.rowCount ?? 0) > 0;
}

/** ลบหมวด (ใช้ในด่านตรวจ/ล้างข้อมูลทดสอบ) */
export async function deleteProductCategory(id: string): Promise<void> {
  await getPool().query("delete from product_category where id = $1", [id]);
}

/* ── หลังบ้าน (รอบที่ 131 · ถังขยะ รอบที่ 139) — แก้สินค้า/ส่วนผสม/หมวด ───────── */

export type AdminProductListItem = {
  readonly id: string;
  readonly sourceId: string;
  readonly categoryId: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly groupTh: string;
  readonly imagePath: string | null;
  readonly imageWidth: number | null;
  readonly imageHeight: number | null;
  readonly ingredientCount: number;
  /** ลำดับการแสดงในหมวด — ต้องส่งกลับตอนบันทึก ไม่งั้นแก้สินค้าแล้วลำดับเพี้ยน (เคสจริงรอบที่ 134) */
  readonly sortOrder: number;
  /** `true` = อยู่ในถังขยะ (ไม่ขึ้นเว็บ) — รอบที่ 139 */
  readonly trashed: boolean;
  /** `YYYY-MM-DDTHH:MM` (เวลาไทย) หรือ null */
  readonly updatedLocal: string | null;
};

export type AdminProductDetail = AdminProductListItem & {
  readonly groupEn: string;
  readonly taglineTh: string;
  readonly taglineEn: string;
  readonly detailsTh: string;
  readonly allergensTh: string;
  readonly netWeightTh: string;
  readonly fdaNumber: string;
  readonly packagingTh: string;
  readonly ingredients: readonly ProductIngredientRecord[];
};

const ADMIN_PRODUCT_COLUMNS = `p.id, p.source_id, p.category_id, p.name_th, p.name_en, p.group_th, p.group_en,
       p.tagline_th, p.tagline_en, p.details_th, p.allergens_th, p.net_weight_th, p.fda_number, p.packaging_th, p.sort_order,
       (p.deleted_at is not null) as trashed,
       m.id as image_id, m.width as image_width, m.height as image_height,
       (select count(*)::int from product_ingredient i where i.product_id = p.id) as ingredient_count,
       to_char(p.updated_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI') as updated_local`;

function toAdminProduct(row: Record<string, unknown>): AdminProductListItem | null {
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (id === "") return null;
  const imageId = typeof row.image_id === "string" ? row.image_id.trim() : "";
  const updatedLocal = typeof row.updated_local === "string" ? row.updated_local.trim() : "";
  const num = (value: unknown): number | null =>
    typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

  return {
    id,
    sourceId: typeof row.source_id === "string" ? row.source_id : "",
    categoryId: typeof row.category_id === "string" ? row.category_id : "",
    nameTh: typeof row.name_th === "string" ? row.name_th : "",
    nameEn: typeof row.name_en === "string" ? row.name_en : "",
    groupTh: typeof row.group_th === "string" ? row.group_th : "",
    imagePath: imageId === "" ? null : `/media/${imageId}`,
    imageWidth: num(row.image_width),
    imageHeight: num(row.image_height),
    ingredientCount: typeof row.ingredient_count === "number" ? row.ingredient_count : 0,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    trashed: row.trashed === true,
    updatedLocal: updatedLocal === "" ? null : updatedLocal,
  };
}

/** แท็บของหน้ารายการสินค้าหลังบ้าน (รอบที่ 139) */
export type AdminProductTab = "all" | "trash";

/** ตัวนับของแต่ละแท็บ — ใช้โชว์บนหัวแท็บ */
export async function adminProductCounts(): Promise<{ readonly all: number; readonly trash: number }> {
  if (!isDatabaseConfigured()) return { all: 0, trash: 0 };
  try {
    const result = await getPool().query<{ all: string; trash: string }>(
      `select count(*) filter (where deleted_at is null)::text as "all",
              count(*) filter (where deleted_at is not null)::text as trash
         from product`,
    );
    const row = result.rows[0];
    return {
      all: Number.parseInt(row?.all ?? "0", 10) || 0,
      trash: Number.parseInt(row?.trash ?? "0", 10) || 0,
    };
  } catch {
    return { all: 0, trash: 0 };
  }
}

/**
 * ย้ายสินค้าเข้าถังขยะ / กู้คืน (รอบที่ 139)
 * - ตั้ง `updated_by` ด้วย ⇒ รู้ว่าใครทำ (audit log มีรายละเอียดอีกชั้น)
 * - **ไม่แตะเนื้อหา/ส่วนผสม/ภาพ** ⇒ กู้คืนได้ครบเหมือนเดิม
 */
export async function setProductTrashed(id: string, trashed: boolean, actor: string): Promise<boolean> {
  const result = await getPool().query(
    `update product
        set deleted_at = case when $2 then now() else null end,
            updated_at = now(),
            updated_by = $3
      where id = $1`,
    [id, trashed, actor],
  );
  return (result.rowCount ?? 0) > 0;
}

/** รายการสินค้าสำหรับหลังบ้าน (กรองตามหมวด + ค้นหา + แท็บ) */
export async function listProductsForAdmin(input: {
  readonly categoryId?: string;
  readonly search?: string;
  readonly tab?: AdminProductTab;
}): Promise<{ readonly items: readonly AdminProductListItem[]; readonly total: number }> {
  if (!isDatabaseConfigured()) return { items: [], total: 0 };

  const params: unknown[] = [];
  const where: string[] = [];

  /* แท็บเป็นตัวกำหนดว่าจะเห็นของในถังหรือของใช้งาน (ไม่ระบุ = ของใช้งาน ปลอดภัยกว่า) */
  where.push((input.tab ?? "all") === "trash" ? "p.deleted_at is not null" : "p.deleted_at is null");

  const category = (input.categoryId ?? "").trim();
  if (category !== "") {
    params.push(category);
    where.push(`p.category_id = $${String(params.length)}`);
  }
  const term = (input.search ?? "").trim();
  if (term !== "") {
    params.push(`%${term}%`);
    const index = params.length;
    where.push(`(p.name_th ilike $${String(index)} or p.name_en ilike $${String(index)} or p.group_th ilike $${String(index)})`);
  }

  const clause = where.length === 0 ? "" : `where ${where.join(" and ")}`;

  try {
    const totalResult = await getPool().query<{ count: string }>(
      `select count(*)::text as count from product p ${clause}`,
      params,
    );
    const total = Number.parseInt(totalResult.rows[0]?.count ?? "0", 10);

    const result = await getPool().query<Record<string, unknown>>(
      `select ${ADMIN_PRODUCT_COLUMNS}
         from product p
         left join media m on m.id = p.image_media_id
         ${clause}
        order by p.category_id, p.sort_order, p.id`,
      params,
    );

    const items: AdminProductListItem[] = [];
    for (const row of result.rows) {
      const item = toAdminProduct(row);
      if (item !== null) items.push(item);
    }
    return { items, total: Number.isFinite(total) ? total : 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

/** สินค้า 1 ชิ้นพร้อมส่วนผสม (สำหรับหน้าจอแก้) */
export async function loadProductForAdmin(id: string): Promise<AdminProductDetail | null> {
  if (!isDatabaseConfigured()) return null;
  const key = id.trim();
  if (key === "") return null;

  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select ${ADMIN_PRODUCT_COLUMNS}
         from product p
         left join media m on m.id = p.image_media_id
        where p.id = $1
        limit 1`,
      [key],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    const base = toAdminProduct(row);
    if (base === null) return null;

    const ingredients = await getPool().query<Record<string, unknown>>(
      `select sort_order, name_th, name_en, percent_text from product_ingredient where product_id = $1 order by sort_order`,
      [key],
    );

    return {
      ...base,
      groupEn: typeof row.group_en === "string" ? row.group_en : "",
      taglineTh: typeof row.tagline_th === "string" ? row.tagline_th : "",
      taglineEn: typeof row.tagline_en === "string" ? row.tagline_en : "",
      detailsTh: typeof row.details_th === "string" ? row.details_th : "",
      allergensTh: typeof row.allergens_th === "string" ? row.allergens_th : "",
      netWeightTh: typeof row.net_weight_th === "string" ? row.net_weight_th : "",
      fdaNumber: typeof row.fda_number === "string" ? row.fda_number : "",
      packagingTh: typeof row.packaging_th === "string" ? row.packaging_th : "",
      ingredients: ingredients.rows.map((item) => ({
        sortOrder: typeof item.sort_order === "number" ? item.sort_order : 0,
        nameTh: typeof item.name_th === "string" ? item.name_th : "",
        nameEn: typeof item.name_en === "string" ? item.name_en : "",
        percentText: typeof item.percent_text === "string" ? item.percent_text : "",
      })),
    };
  } catch {
    return null;
  }
}

export type AdminProductCategoryItem = {
  /** slug ของหมวด (ตรงกับ `CATALOG_ITEMS` ในโค้ด) */
  readonly id: string;
  /** id ของหน้าในเว็บเดิม — ต้องส่งกลับตอนบันทึก (ไม่งั้นเขียนทับเป็นค่าว่าง) */
  readonly sourceId: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  readonly imagePath: string | null;
  readonly imageWidth: number | null;
  readonly imageHeight: number | null;
  readonly productCount: number;
};

/**
 * หมวดสินค้าสำหรับ **หน้าจอหลังบ้าน** (รอบที่ 134) — ใช้ทำแฟอร์ม "คำอธิบาย/ภาพปกหมวด"
 *
 * - คืนเฉพาะแถวที่มีใน DB ⇒ ผู้เรียกต้อง **ประกอบกับ `CATALOG_ITEMS`** เพื่อให้ครบ 6 หมวดเสมอ
 *   (หมวดที่ยังไม่มีแถว = ยังไม่มีคำอธิบาย/ภาพ ⇒ ฟอร์มเริ่มจากช่องว่างได้)
 * - `sourceId` ต้องคืนออกไปให้ฟอร์มส่งกลับ (repository กันค่าว่างเขียนทับอยู่แล้ว แต่ไม่ควรพึ่งชั้นเดียว)
 * - ⚠️ ไม่มีชื่อหมวดในฐานข้อมูล (ชื่อมาจาก `features/products/catalog.ts` = แหล่งความจริงเดียว)
 */
export async function listProductCategoriesForAdmin(): Promise<readonly AdminProductCategoryItem[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<{
      id: string;
      sourceId: string | null;
      descriptionTh: string;
      descriptionEn: string;
      imageId: string | null;
      imageWidth: number | null;
      imageHeight: number | null;
      productCount: string;
    }>(
      `select c.id,
              c.source_id       as "sourceId",
              c.description_th  as "descriptionTh",
              c.description_en  as "descriptionEn",
              m.id              as "imageId",
              m.width           as "imageWidth",
              m.height          as "imageHeight",
              count(p.id)::text as "productCount"
         from product_category c
         left join media m on m.id = c.image_media_id
         left join product p on p.category_id = c.id
        group by c.id, c.source_id, c.description_th, c.description_en, m.id, m.width, m.height
        order by c.id`,
    );

    return result.rows.map((row) => {
      const count = Number.parseInt(row.productCount, 10);
      return {
        id: row.id,
        sourceId: typeof row.sourceId === "string" ? row.sourceId : "",
        descriptionTh: row.descriptionTh,
        descriptionEn: row.descriptionEn,
        imagePath: mediaPath(row.imageId),
        imageWidth: row.imageWidth,
        imageHeight: row.imageHeight,
        productCount: Number.isFinite(count) ? count : 0,
      };
    });
  } catch {
    return [];
  }
}

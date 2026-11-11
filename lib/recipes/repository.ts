import { getPool, isDatabaseConfigured } from "@/db/pool";
import { readQuery } from "@/lib/db/read";
import { mediaIdFromPath } from "@/lib/media/usage";
import { isYouTubeVideoId, type RecipeInput } from "@/lib/recipes/model";
import { normalizeSearchText } from "@/lib/search/params";

/**
 * อ่าน/เขียน "เมนูอาหาร (วิดีโอ)" ในฐานข้อมูล (S3 ส่วนที่ 4 · รอบที่ 104 · หลังบ้าน รอบที่ 135) — ฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * หลักการเดียวกับสินค้า (รอบที่ 103): **ห้ามทำให้เว็บพังเพราะฐานข้อมูล**
 * - ไม่มี `DATABASE_URL` / อ่านไม่สำเร็จ → คืน `[]` / `null` / `0` (หน้าเว็บถอยไปใช้เลย์เอาต์เดิม)
 * - แถวที่ข้อมูลผิดรูป (ไม่มีชื่อ/ไม่มี video id) → ข้ามแถวนั้น
 * - ภาพเก็บเป็น id ของ `media` ⇒ ที่นี่คืนพาธ `/media/<id>` (มติ D9)
 *
 * รอบที่ 135 เพิ่มมิติของ "หลังบ้าน" (แบบ WordPress Posts — เหมือน `news`)
 * - `status` — `draft` ยังไม่ขึ้นเว็บ · `published` ขึ้นเว็บ
 * - `deleted_at` — **ถังขยะ** (soft delete) กู้คืนได้
 * ⚠️ ฝั่งเว็บสาธารณะต้องเห็นเฉพาะ `status = 'published' and deleted_at is null` **เสมอ**
 */

/** เงื่อนไข "เมนูที่เว็บสาธารณะเห็นได้" — ใช้ร่วมทุกคำสั่งอ่านฝั่งเว็บ (ห้ามลืม) */
const PUBLIC_RECIPE_CONDITION = "r.status = 'published' and r.deleted_at is null";

export type RecipeRecord = {
  readonly id: string;
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly titleTh: string;
  readonly titleEn: string;
  /** `/media/<id>` หรือ null */
  readonly coverPath: string | null;
  readonly coverWidth: number | null;
  readonly coverHeight: number | null;
  /** ข้อความสูตร (migration 0048) — ว่าง = ไม่มีสูตรให้กาง */
  readonly detailsTh: string;
  readonly detailsEn: string;
  /** ภาพสูตร (migration 0048) — null = ไม่มีภาพ */
  readonly recipeImagePath: string | null;
  readonly recipeImageWidth: number | null;
  readonly recipeImageHeight: number | null;
  /** ยอดวิว YouTube ที่แคชไว้ (migration 0048) */
  readonly viewCount: number;
  /** เวลารีเฟรชยอดวิวล่าสุด (ISO) หรือ null */
  readonly viewCountUpdatedAt: string | null;
  readonly videoProvider: "youtube";
  readonly videoId: string;
  /** ISO `YYYY-MM-DD` หรือ null */
  readonly publishedOn: string | null;
  readonly sortOrder: number;
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mediaPath(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? `/media/${value}` : null;
}

function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/** `bigint`/`numeric` ของ Postgres อาจกลับมาเป็นสตริง — แปลงเป็นจำนวนเต็ม ≥ 0 */
function countValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(text(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** `timestamptz` → ISO string (หรือ null) — แปลงที่ชั้นข้อมูลเสมอ */
function isoStamp(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const raw = text(value).trim();
  if (raw === "") return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function toRecipeRecord(row: Record<string, unknown>): RecipeRecord | null {
  const id = text(row.id).trim();
  const titleTh = text(row.title_th).trim();
  const videoId = text(row.video_id).trim();
  if (id === "" || titleTh === "" || !isYouTubeVideoId(videoId)) return null;

  return {
    id,
    sourceId: text(row.source_id),
    sourceUrl: text(row.source_url),
    titleTh,
    titleEn: text(row.title_en),
    coverPath: mediaPath(row.cover_media_id),
    coverWidth: positiveInt(row.cover_width),
    coverHeight: positiveInt(row.cover_height),
    detailsTh: text(row.details_th),
    detailsEn: text(row.details_en),
    recipeImagePath: mediaPath(row.recipe_image_media_id),
    recipeImageWidth: positiveInt(row.recipe_image_width),
    recipeImageHeight: positiveInt(row.recipe_image_height),
    viewCount: countValue(row.view_count),
    viewCountUpdatedAt: isoStamp(row.view_count_updated_at),
    videoProvider: "youtube",
    videoId,
    publishedOn: text(row.published_on) === "" ? null : text(row.published_on),
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
  };
}

/**
 * เมนูทั้งหมด (เรียงตามลำดับที่นำเข้าจากเว็บเดิม)
 * ⚠️ `published_on::text` — ให้ได้สตริง ISO ตรง ๆ ไม่ให้ `pg` แปลงเป็น Date แล้วเลื่อนเขตเวลา
 * ⚠️ เว็บสาธารณะเห็นเฉพาะ "เผยแพร่และไม่ถังขยะ" เท่านั้น (รอบที่ 135 — หลังบ้านมีร่าง/ถังขยะ)
 */
export async function listRecipes(): Promise<readonly RecipeRecord[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await readQuery<Record<string, unknown>>(
      `select r.id, r.source_id, r.source_url, r.title_th, r.title_en, r.cover_media_id,
              r.details_th, r.details_en, r.recipe_image_media_id, r.view_count,
              r.view_count_updated_at,
              r.video_provider, r.video_id, r.published_on::text as published_on, r.sort_order,
              m.width as cover_width, m.height as cover_height,
              ri.width as recipe_image_width, ri.height as recipe_image_height
         from recipe r
         left join media m on m.id = r.cover_media_id
         left join media ri on ri.id = r.recipe_image_media_id
        where ${PUBLIC_RECIPE_CONDITION}
        order by r.sort_order, r.id`,
    );

    const items: RecipeRecord[] = [];
    for (const row of result.rows) {
      const record = toRecipeRecord(row);
      if (record !== null) items.push(record);
    }
    return items;
  } catch {
    return [];
  }
}

/* ── ฝั่งเขียน (ใช้โดยสคริปต์นำเข้า) — โยน error ออกไปถ้าล้มเหลว (ห้ามกลืน) ────── */

/**
 * โหมดเขียนทับของเมนูอาหาร (รอบที่ 142 · หนี้ A1) — แบบเดียวกับสินค้า (รอบที่ 140)
 * - `replace` (ค่าเริ่มต้น) — เขียนทับทุกช่อง (หลังบ้านใช้: ผู้ดูแลกดบันทึกต้องชนะ)
 * - `protect-edited` — **สคริปต์นำเข้าใช้**: ถ้าแถวเดิมถูกแก้โดยผู้ใช้อื่น ให้คงค่าเดิม
 */
export type RecipeWriteMode = "replace" | "protect-edited";

export type RecipeUpsertResult = {
  readonly created: boolean;
  readonly protectedEdit: boolean;
};

/** เงื่อนไข "แถวเดิมถูกแก้โดยคนอื่น" — ใช้ทั้งการคงค่าและตัดสินว่าเขียน updated_at/by ไหม */
const RECIPE_PROTECTED_EDIT = "recipe.updated_by is distinct from excluded.updated_by";

function recipeColumn(mode: RecipeWriteMode | undefined, column: string, fallback: string): string {
  if ((mode ?? "replace") !== "protect-edited") return fallback;
  return `case when ${RECIPE_PROTECTED_EDIT} then recipe.${column} else ${fallback} end`;
}

export async function upsertRecipe(
  input: RecipeInput,
  actor: string,
  coverMediaId: string | null,
  options: { readonly writeMode?: RecipeWriteMode } = {},
): Promise<RecipeUpsertResult> {
  /*
    ⚠️ โหมด protect-edited ต้องคง updated_at/updated_by เดิมด้วย
    ไม่งั้นการนำเข้าครั้งที่ 2 จะเห็นว่าตนเองเป็นคนแก้ล่าสุด แล้วทับงานคนทันที (บทเรียนรอบที่ 140)
  */
  const mode = options.writeMode;
  const result = await getPool().query<{ previous_total: number; previous_actor: string | null }>(
    `with previous as (
        select count(*)::int as total, max(updated_by) as actor from recipe where id = $1
      ),
      upserted as (
        insert into recipe (id, source_id, source_url, title_th, title_en, cover_media_id, video_provider, video_id, published_on, sort_order, updated_at, updated_by)
          values ($1, $2, $3, $4, $5, $6, 'youtube', $7, $8::date, $9, now(), $10)
        on conflict (id) do update set
          source_id      = excluded.source_id,
          source_url     = excluded.source_url,
          title_th       = ${recipeColumn(mode, "title_th", "excluded.title_th")},
          title_en       = ${recipeColumn(mode, "title_en", "excluded.title_en")},
          cover_media_id = ${recipeColumn(mode, "cover_media_id", "coalesce(excluded.cover_media_id, recipe.cover_media_id)")},
          video_provider = ${recipeColumn(mode, "video_provider", "excluded.video_provider")},
          video_id       = ${recipeColumn(mode, "video_id", "excluded.video_id")},
          published_on   = ${recipeColumn(mode, "published_on", "coalesce(excluded.published_on, recipe.published_on)")},
          sort_order     = ${recipeColumn(mode, "sort_order", "excluded.sort_order")},
          updated_at     = ${recipeColumn(mode, "updated_at", "now()")},
          updated_by     = ${recipeColumn(mode, "updated_by", "excluded.updated_by")}
        returning id
      )
     select (select total from previous) as previous_total,
            (select actor from previous) as previous_actor`,
    [
      input.id,
      input.sourceId,
      input.sourceUrl,
      input.titleTh,
      input.titleEn,
      coverMediaId,
      input.videoId,
      input.publishedOn,
      input.sortOrder,
      actor,
    ],
  );

  const total = result.rows[0]?.previous_total ?? 0;
  const previousActor = result.rows[0]?.previous_actor ?? null;
  const created = total === 0;
  return {
    created,
    protectedEdit: !created && (mode ?? "replace") === "protect-edited" && previousActor !== actor,
  };
}

/** id เมนูที่ยังใช้งาน (ไม่รวมของในถัง) — ใช้คำนวณ `--prune` (รอบที่ 142) */
export async function listRecipeIds(): Promise<readonly string[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<{ id: string }>("select id from recipe where deleted_at is null order by id");
    return result.rows.map((row) => row.id);
  } catch {
    return [];
  }
}

/**
 * บันทึกยอดวิว YouTube ที่ดึงมา (รอบ 342) — เขียนเฉพาะแถวที่ยังใช้งาน
 * ⚠️ ใช้โดยสคริปต์ `recipes:views` (หลังบ้าน) ไม่ใช่หน้าเว็บสาธารณะ
 */
export async function setRecipeViewCount(id: string, count: number): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const key = id.trim();
  if (key === "" || !Number.isFinite(count) || count < 0) return false;
  try {
    const result = await getPool().query(
      "update recipe set view_count = $2, view_count_updated_at = now() where id = $1 and deleted_at is null",
      [key, Math.floor(count)],
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

/** ลบเมนู 1 รายการ **ถาวร** (ใช้ในด่านตรวจ/สคริปต์นำเข้า/ล้างข้อมูลทดสอบ)
 *  ⚠️ หลังบ้านต้องใช้ `deleteRecipeForever()` (มีประตูถังขยะ) ไม่ใช่ตัวนี้ */
export async function deleteRecipe(id: string): Promise<void> {
  await getPool().query("delete from recipe where id = $1", [id]);
}

/* ── หลังบ้าน (รอบที่ 135) — แก้เมนูแบบ WordPress "Posts" ─────────────────────── */

export type AdminRecipeStatus = "draft" | "published";

/** แท็บของหน้ารายการ (เหมือน WP: ทั้งหมด · ฉบับร่าง · เผยแพร่ · ถังขยะ) */
export type AdminRecipeTab = "all" | "draft" | "published" | "trash";

export type AdminRecipeCounts = {
  readonly all: number;
  readonly draft: number;
  readonly published: number;
  readonly trashed: number;
};

export type AdminRecipeListItem = {
  readonly id: string;
  readonly sourceId: string;
  readonly titleTh: string;
  readonly titleEn: string;
  readonly status: AdminRecipeStatus;
  readonly trashed: boolean;
  readonly videoId: string;
  /** `/media/<id>` หรือ null */
  readonly coverPath: string | null;
  readonly coverWidth: number | null;
  readonly coverHeight: number | null;
  /** ข้อความสูตร (migration 0048) */
  readonly detailsTh: string;
  readonly detailsEn: string;
  /** ภาพสูตร (migration 0048) */
  readonly recipeImagePath: string | null;
  readonly recipeImageWidth: number | null;
  readonly recipeImageHeight: number | null;
  readonly viewCount: number;
  readonly viewCountUpdatedAt: string | null;
  /** ISO `YYYY-MM-DD` หรือ null */
  readonly publishedOn: string | null;
  readonly sortOrder: number;
  /** `YYYY-MM-DDTHH:MM` (เวลาไทย) หรือ null */
  readonly updatedLocal: string | null;
};

/** รายละเอียดสำหรับหน้าจอแก้ — ตอนนี้มีฟิลด์เท่ารายการ (เผื่ออนาคตถ้าเพิ่มเนื้อหา) */
export type AdminRecipeDetail = AdminRecipeListItem;

export type AdminRecipeInput = {
  readonly titleTh: string;
  readonly titleEn: string;
  readonly videoId: string;
  /** ข้อความสูตร TH/EN (migration 0048) — ไม่ส่ง = ว่าง */
  readonly detailsTh?: string;
  readonly detailsEn?: string;
  /** ISO `YYYY-MM-DD` หรือ null = ไม่ระบุ */
  readonly publishedOn: string | null;
  readonly sortOrder: number;
  /** `/media/<id>` หรือ null (ค่าว่าง = เอาภาพปกออก) */
  readonly coverPath: string | null;
  /** ภาพสูตร — undefined = ไม่ส่ง/ว่าง = ไม่มีภาพ */
  readonly recipeImagePath?: string | null;
  readonly status: AdminRecipeStatus;
};

const ADMIN_RECIPE_COLUMNS = `r.id, r.source_id, r.title_th, r.title_en, r.cover_media_id, r.video_id,
       r.details_th, r.details_en, r.recipe_image_media_id, r.view_count, r.view_count_updated_at,
       r.published_on::text as published_on, r.sort_order, r.status, r.deleted_at,
       to_char(r.updated_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI') as updated_local,
       m.width as cover_width, m.height as cover_height,
       ri.width as recipe_image_width, ri.height as recipe_image_height`;

const ADMIN_RECIPE_ORDER = "order by r.sort_order, r.id";

function adminStatusOf(value: unknown): AdminRecipeStatus {
  return value === "draft" ? "draft" : "published";
}

function countOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toAdminRecipe(row: Record<string, unknown>): AdminRecipeListItem | null {
  const id = text(row.id).trim();
  const titleTh = text(row.title_th).trim();
  if (id === "") return null;

  const updatedLocal = text(row.updated_local).trim();
  const publishedOn = text(row.published_on).trim();

  return {
    id,
    sourceId: text(row.source_id),
    titleTh,
    titleEn: text(row.title_en),
    status: adminStatusOf(row.status),
    trashed: row.deleted_at !== null && row.deleted_at !== undefined,
    videoId: text(row.video_id),
    coverPath: mediaPath(row.cover_media_id),
    coverWidth: positiveInt(row.cover_width),
    coverHeight: positiveInt(row.cover_height),
    detailsTh: text(row.details_th),
    detailsEn: text(row.details_en),
    recipeImagePath: mediaPath(row.recipe_image_media_id),
    recipeImageWidth: positiveInt(row.recipe_image_width),
    recipeImageHeight: positiveInt(row.recipe_image_height),
    viewCount: countValue(row.view_count),
    viewCountUpdatedAt: isoStamp(row.view_count_updated_at),
    publishedOn: publishedOn === "" ? null : publishedOn,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    updatedLocal: updatedLocal === "" ? null : updatedLocal,
  };
}

function conditionForTab(tab: AdminRecipeTab): string {
  if (tab === "trash") return "r.deleted_at is not null";
  if (tab === "draft") return "r.deleted_at is null and r.status = 'draft'";
  if (tab === "published") return "r.deleted_at is null and r.status = 'published'";
  return "r.deleted_at is null";
}

/** นับจำนวนเมนูแยกตามแท็บ (ใช้ทำตัวเลขบนแท็บเหมือน WP) */
export async function adminRecipeCounts(): Promise<AdminRecipeCounts> {
  const empty: AdminRecipeCounts = { all: 0, draft: 0, published: 0, trashed: 0 };
  if (!isDatabaseConfigured()) return empty;
  try {
    const result = await getPool().query<Record<string, unknown>>(
      /* ⚠️ `count(*)` เป็น bigint ⇒ node-postgres คืนเป็น "สตริง" ต้อง cast `::int` ให้ชัด (บทเรียนรอบที่ 123) */
      `select count(*) filter (where deleted_at is null)::int as all_count,
              count(*) filter (where deleted_at is null and status = 'draft')::int as draft_count,
              count(*) filter (where deleted_at is null and status = 'published')::int as published_count,
              count(*) filter (where deleted_at is not null)::int as trashed_count
         from recipe`,
    );
    const row = result.rows[0];
    if (row === undefined) return empty;
    return {
      all: countOf(row.all_count),
      draft: countOf(row.draft_count),
      published: countOf(row.published_count),
      trashed: countOf(row.trashed_count),
    };
  } catch {
    return empty;
  }
}

/**
 * รายการเมนูสำหรับหลังบ้าน (ค้นหา/กรองตามแท็บ)
 * ⚠️ ไม่มีแบ่งหน้าโดยเจตนา — เมนูมีหลักสิบรายการ (ต่างจากข่าว 151 ชิ้น) การแบ่งหน้าจะทำให้เข้าใจยากเปล่า ๆ
 */
export async function listRecipesForAdmin(input: {
  readonly tab: AdminRecipeTab;
  readonly search: string;
}): Promise<{ readonly items: readonly AdminRecipeListItem[]; readonly total: number }> {
  if (!isDatabaseConfigured()) return { items: [], total: 0 };

  /* ⚠️ ประตูที่ชั้นข้อมูล (รอบที่ 291): ห้ามให้อักขระควบคุม/NUL ถึง SQL */
  const term = normalizeSearchText(input.search, 80);
  const params: unknown[] = [];
  let where = conditionForTab(input.tab);
  if (term !== "") {
    params.push(`%${term}%`);
    const index = params.length;
    where += ` and (r.title_th ilike $${String(index)} or r.title_en ilike $${String(index)} or r.video_id ilike $${String(index)})`;
  }

  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select ${ADMIN_RECIPE_COLUMNS}
         from recipe r
         left join media m on m.id = r.cover_media_id
         left join media ri on ri.id = r.recipe_image_media_id
        where ${where}
        ${ADMIN_RECIPE_ORDER}`,
      params,
    );

    const items: AdminRecipeListItem[] = [];
    for (const row of result.rows) {
      const item = toAdminRecipe(row);
      if (item !== null) items.push(item);
    }
    return { items, total: items.length };
  } catch {
    return { items: [], total: 0 };
  }
}

/** เมนู 1 รายการสำหรับหน้าจอแก้ไข (เห็นได้ทั้งฉบับร่าง/ในถังขยะ) */
export async function loadRecipeForAdmin(id: string): Promise<AdminRecipeDetail | null> {
  if (!isDatabaseConfigured()) return null;
  const key = id.trim();
  if (key === "") return null;

  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select ${ADMIN_RECIPE_COLUMNS}
         from recipe r
         left join media m on m.id = r.cover_media_id
         left join media ri on ri.id = r.recipe_image_media_id
        where r.id = $1
        limit 1`,
      [key],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    return toAdminRecipe(row);
  } catch {
    return null;
  }
}

/**
 * สร้างเมนูใหม่จากหลังบ้าน — คืน id ที่สร้าง
 * ⚠️ `source_id` ต้องเป็นตัวเลข (validator กลางบังคับ และ id = `r<source_id>`) ⇒ ใช้เวลาปัจจุบัน
 * ⚠️ ภาพปกเขียนทับตรง ๆ (ผู้ดูแลล้างภาพได้จริง) — ต่างจาก `upsertRecipe` ของสคริปต์นำเข้าที่ใช้ `coalesce`
 */
export async function createRecipeForAdmin(input: AdminRecipeInput, actor: string): Promise<string> {
  const sourceId = String(Date.now());
  const id = `r${sourceId}`;
  await getPool().query(
    `insert into recipe (id, source_id, source_url, title_th, title_en, cover_media_id, video_provider, video_id,
                         details_th, details_en, recipe_image_media_id, published_on, sort_order, status, updated_at, updated_by)
       values ($1, $2, '', $3, $4, $5, 'youtube', $6, $7, $8, $9, $10::date, $11, $12, now(), $13)`,
    [
      id,
      sourceId,
      input.titleTh,
      input.titleEn,
      mediaIdFromPath(input.coverPath ?? ""),
      input.videoId,
      input.detailsTh ?? "",
      input.detailsEn ?? "",
      mediaIdFromPath(input.recipeImagePath ?? ""),
      input.publishedOn,
      input.sortOrder,
      input.status,
      actor,
    ],
  );
  return id;
}

/** บันทึกทับเมนูที่มีอยู่ (หลังบ้าน) — ไม่แตะ `source_id`/`source_url`/`video_provider` */
export async function updateRecipeForAdmin(id: string, input: AdminRecipeInput, actor: string): Promise<void> {
  await getPool().query(
    `update recipe
        set title_th = $2, title_en = $3, cover_media_id = $4, video_id = $5,
            details_th = $6, details_en = $7, recipe_image_media_id = $8,
            published_on = $9::date, sort_order = $10, status = $11, updated_at = now(), updated_by = $12
      where id = $1`,
    [
      id,
      input.titleTh,
      input.titleEn,
      mediaIdFromPath(input.coverPath ?? ""),
      input.videoId,
      input.detailsTh ?? "",
      input.detailsEn ?? "",
      mediaIdFromPath(input.recipeImagePath ?? ""),
      input.publishedOn,
      input.sortOrder,
      input.status,
      actor,
    ],
  );
}

/**
 * ย้ายเมนูเข้าถังขยะ / กู้คืน (รอบที่ 135 · **ประตูสองทาง รอบที่ 177**)
 *
 * ⚠️ ประตูอยู่ที่ SQL: `trashed=true` ต้องเป็นของที่ยังใช้งานอยู่ · `trashed=false` ต้องเป็นของในถัง
 *    ⇒ เรียกซ้ำ/ยิงฟอร์มปลอมหาของผิดสถานะ = ไม่มีแถวถูกแก้ (คืน `false`)
 * ⚠️ `deleted_at` กับ `deleted_by` เป็นคู่กันเสมอ (กู้คืน = ล้างทั้งสอง)
 */
export async function setRecipeTrashed(id: string, trashed: boolean, actor: string): Promise<boolean> {
  /* สองสตริงคงที่เท่านั้น (ไม่มีค่าจากผู้ใช้) */
  const guard = trashed ? "deleted_at is null" : "deleted_at is not null";
  const result = await getPool().query(
    `update recipe
        set deleted_at = case when $2 then now() else null end,
            deleted_by = case when $2 then $3 else null end,
            updated_at = now(),
            updated_by = $3
      where id = $1 and ${guard}`,
    [id, trashed, actor],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * ลบเมนู **ถาวรจากถังขยะ** (รอบที่ 139) — ใช้เฉพาะหลังบ้าน
 *
 * ⚠️ **ประตูอยู่ที่ SQL เอง**: `and deleted_at is not null` ⇒ เมนูที่ยังใช้งานอยู่ลบไม่ได้
 *    แม้ action จะถูกเรียกตรง ๆ (fail-closed · เทสต์ได้ที่ `check:db` วงจรที่ 26)
 * คืน `true` = ลบจริง 1 แถว · `false` = ไม่เข้าเงื่อนไข
 */
export async function deleteRecipeForever(id: string): Promise<boolean> {
  const result = await getPool().query("delete from recipe where id = $1 and deleted_at is not null", [id]);
  return (result.rowCount ?? 0) > 0;
}

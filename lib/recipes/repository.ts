import { getPool, isDatabaseConfigured } from "@/db/pool";
import { isYouTubeVideoId, type RecipeInput } from "@/lib/recipes/model";

/**
 * อ่าน/เขียน "เมนูอาหาร (วิดีโอ)" ในฐานข้อมูล (S3 ส่วนที่ 4 · รอบที่ 104) — ฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * หลักการเดียวกับสินค้า (รอบที่ 103): **ห้ามทำให้เว็บพังเพราะฐานข้อมูล**
 * - ไม่มี `DATABASE_URL` / อ่านไม่สำเร็จ → คืน `[]` (หน้าเว็บถอยไปใช้เลย์เอาต์เดิม)
 * - แถวที่ข้อมูลผิดรูป (ไม่มีชื่อ/ไม่มี video id) → ข้ามแถวนั้น
 * - ภาพเก็บเป็น id ของ `media` ⇒ ที่นี่คืนพาธ `/media/<id>` (มติ D9)
 */

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
    videoProvider: "youtube",
    videoId,
    publishedOn: text(row.published_on) === "" ? null : text(row.published_on),
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
  };
}

/**
 * เมนูทั้งหมด (เรียงตามลำดับที่นำเข้าจากเว็บเดิม)
 * ⚠️ `published_on::text` — ให้ได้สตริง ISO ตรง ๆ ไม่ให้ `pg` แปลงเป็น Date แล้วเลื่อนเขตเวลา
 */
export async function listRecipes(): Promise<readonly RecipeRecord[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select r.id, r.source_id, r.source_url, r.title_th, r.title_en, r.cover_media_id,
              r.video_provider, r.video_id, r.published_on::text as published_on, r.sort_order,
              m.width as cover_width, m.height as cover_height
         from recipe r
         left join media m on m.id = r.cover_media_id
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

export async function upsertRecipe(input: RecipeInput, actor: string, coverMediaId: string | null): Promise<void> {
  await getPool().query(
    `insert into recipe (id, source_id, source_url, title_th, title_en, cover_media_id, video_provider, video_id, published_on, sort_order, updated_at, updated_by)
       values ($1, $2, $3, $4, $5, $6, 'youtube', $7, $8::date, $9, now(), $10)
     on conflict (id) do update set
       source_id      = excluded.source_id,
       source_url     = excluded.source_url,
       title_th       = excluded.title_th,
       title_en       = excluded.title_en,
       cover_media_id = coalesce(excluded.cover_media_id, recipe.cover_media_id),
       video_provider = excluded.video_provider,
       video_id       = excluded.video_id,
       published_on   = coalesce(excluded.published_on, recipe.published_on),
       sort_order     = excluded.sort_order,
       updated_at     = now(),
       updated_by     = excluded.updated_by`,
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
}

/** ลบเมนู 1 รายการ (ใช้ในด่านตรวจ/ล้างข้อมูลทดสอบ) */
export async function deleteRecipe(id: string): Promise<void> {
  await getPool().query("delete from recipe where id = $1", [id]);
}

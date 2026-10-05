import { getPool, isDatabaseConfigured } from "@/db/pool";
import { parseNewsBody, type NewsBlock } from "@/lib/news/body";
import type { NewsInput } from "@/lib/news/model";

/**
 * อ่าน/เขียน "ข่าวสาร & กิจกรรม" ในฐานข้อมูล (หน้า /news · รอบที่ 105) — ฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * หลักการเดียวกับสินค้า/เมนู (รอบที่ 103–104): **ห้ามทำให้เว็บพังเพราะฐานข้อมูล**
 * - ไม่มี `DATABASE_URL` / อ่านไม่สำเร็จ → คืน `[]` / `0` / `null`
 * - เนื้อหา (`body`) ต้องผ่าน `parseNewsBody()` เสมอ (ห้ามเชื่อข้อมูลจาก DB)
 * - **วันที่อ่านกลับเป็นสตริงเวลาไทย** (`at time zone 'Asia/Bangkok'`) ⇒ ฝั่งแสดงผลไม่ต้องคิดเขตเวลาเลย
 */

/** จำนวนข่าวต่อหน้า (เท่ากับเว็บเดิม: 15) */
export const NEWS_PER_PAGE = 15;

export type NewsRecord = {
  readonly id: string;
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly titleTh: string;
  readonly titleEn: string;
  readonly excerptTh: string;
  readonly excerptEn: string;
  /** `/media/<id>` หรือ null */
  readonly coverPath: string | null;
  readonly coverWidth: number | null;
  readonly coverHeight: number | null;
  readonly body: readonly NewsBlock[];
  /** `YYYY-MM-DDTHH:MM` (เวลาไทย) หรือ null */
  readonly publishedLocal: string | null;
  readonly publishedLabel: string;
};

const NEWS_COLUMNS = `n.id, n.source_id, n.source_url, n.title_th, n.title_en, n.excerpt_th, n.excerpt_en,
       n.cover_media_id, n.body, n.published_label,
       to_char(n.published_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI') as published_local,
       m.width as cover_width, m.height as cover_height`;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function toNewsRecord(row: Record<string, unknown>): NewsRecord | null {
  const id = text(row.id).trim();
  const titleTh = text(row.title_th).trim();
  if (id === "" || titleTh === "") return null;

  const coverId = text(row.cover_media_id).trim();
  const publishedLocal = text(row.published_local).trim();

  return {
    id,
    sourceId: text(row.source_id),
    sourceUrl: text(row.source_url),
    titleTh,
    titleEn: text(row.title_en),
    excerptTh: text(row.excerpt_th),
    excerptEn: text(row.excerpt_en),
    coverPath: coverId === "" ? null : `/media/${coverId}`,
    coverWidth: positiveInt(row.cover_width),
    coverHeight: positiveInt(row.cover_height),
    body: parseNewsBody(row.body),
    publishedLocal: publishedLocal === "" ? null : publishedLocal,
    publishedLabel: text(row.published_label),
  };
}

/** จำนวนข่าวทั้งหมด (ใช้คำนวณจำนวนหน้า) */
export async function countNews(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  try {
    const result = await getPool().query<{ count: string }>("select count(*)::text as count from news");
    const value = Number.parseInt(result.rows[0]?.count ?? "0", 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/** ข่าวชุดหนึ่ง (เรียงใหม่สุดก่อน) — `offset` เริ่มที่ 0 */
export async function listNews(limit = NEWS_PER_PAGE, offset = 0): Promise<readonly NewsRecord[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select ${NEWS_COLUMNS}
         from news n
         left join media m on m.id = n.cover_media_id
        order by n.published_at desc nulls last, n.id desc
        limit $1 offset $2`,
      [Math.max(0, limit), Math.max(0, offset)],
    );

    const items: NewsRecord[] = [];
    for (const row of result.rows) {
      const record = toNewsRecord(row);
      if (record !== null) items.push(record);
    }
    return items;
  } catch {
    return [];
  }
}

/** ข่าว 1 ชิ้นจาก source id (ใช้กับพาธ `/news/<source_id>`) */
export async function loadNewsBySourceId(sourceId: string): Promise<NewsRecord | null> {
  if (!isDatabaseConfigured()) return null;
  if (!/^\d{3,}$/.test(sourceId.trim())) return null;
  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select ${NEWS_COLUMNS}
         from news n
         left join media m on m.id = n.cover_media_id
        where n.source_id = $1
        limit 1`,
      [sourceId.trim()],
    );
    const row = result.rows[0];
    return row === undefined ? null : toNewsRecord(row);
  } catch {
    return null;
  }
}

/** source id ของข่าวทั้งหมด (เรียงใหม่สุดก่อน) — ใช้ตอน build/ตรวจสอบ */
export async function listNewsSourceIds(): Promise<readonly string[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<{ source_id: string }>(
      "select source_id from news order by published_at desc nulls last, id desc",
    );
    return result.rows.map((row) => row.source_id).filter((value) => /^\d{3,}$/.test(value));
  } catch {
    return [];
  }
}

/* ── ฝั่งเขียน (ใช้โดยสคริปต์นำเข้า) — โยน error ออกไปถ้าล้มเหลว (ห้ามกลืน) ────── */

export async function upsertNews(
  input: NewsInput,
  actor: string,
  coverMediaId: string | null,
  body: readonly NewsBlock[],
): Promise<void> {
  await getPool().query(
    `insert into news (id, source_id, source_url, title_th, title_en, excerpt_th, excerpt_en,
                       cover_media_id, body, published_at, published_label, updated_at, updated_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamptz, $11, now(), $12)
     on conflict (id) do update set
       source_id       = excluded.source_id,
       source_url      = excluded.source_url,
       title_th        = excluded.title_th,
       title_en        = excluded.title_en,
       excerpt_th      = excluded.excerpt_th,
       excerpt_en      = excluded.excerpt_en,
       cover_media_id  = coalesce(excluded.cover_media_id, news.cover_media_id),
       body            = excluded.body,
       published_at    = coalesce(excluded.published_at, news.published_at),
       published_label = excluded.published_label,
       updated_at      = now(),
       updated_by      = excluded.updated_by`,
    [
      input.id,
      input.sourceId,
      input.sourceUrl,
      input.titleTh,
      input.titleEn,
      input.excerptTh,
      input.excerptEn,
      coverMediaId,
      JSON.stringify(body),
      /* เวลาไทย → timestamptz (null ได้) */
      input.publishedLocal === null ? null : `${input.publishedLocal}:00+07:00`,
      input.publishedLabel,
      actor,
    ],
  );
}

/** ลบข่าว 1 ชิ้น (ใช้ในด่านตรวจ/ล้างข้อมูลทดสอบ) */
export async function deleteNews(id: string): Promise<void> {
  await getPool().query("delete from news where id = $1", [id]);
}

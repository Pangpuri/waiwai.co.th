import { getPool, isDatabaseConfigured } from "@/db/pool";
import { mediaIdFromPath } from "@/lib/media/usage";
import { parseNewsBody, type NewsBlock } from "@/lib/news/body";
import type { NewsInput } from "@/lib/news/model";

/**
 * อ่าน/เขียน "ข่าวสาร & กิจกรรม" ในฐานข้อมูล (หน้า /news · รอบที่ 105 · หลังบ้าน รอบที่ 123)
 *
 * หลักการเดียวกับสินค้า/เมนู (รอบที่ 103–104): **ห้ามทำให้เว็บพังเพราะฐานข้อมูล**
 * - ไม่มี `DATABASE_URL` / อ่านไม่สำเร็จ → คืน `[]` / `0` / `null`
 * - เนื้อหา (`body`) ต้องผ่าน `parseNewsBody()` เสมอ (ห้ามเชื่อข้อมูลจาก DB)
 * - **วันที่อ่านกลับเป็นสตริงเวลาไทย** (`at time zone 'Asia/Bangkok'`) ⇒ ฝั่งแสดงผลไม่ต้องคิดเขตเวลาเลย
 *
 * รอบที่ 123 เพิ่มมิติของ "หลังบ้าน" (แบบ WordPress Posts)
 * - `status` — `draft` ยังไม่ขึ้นเว็บ · `published` ขึ้นเว็บ
 * - `deleted_at` — **ถังขยะ** (soft delete) กู้คืนได้
 * ⚠️ ฝั่งเว็บสาธารณะต้องเห็นเฉพาะ `status = 'published' and deleted_at is null` **เสมอ**
 */

/** จำนวนข่าวต่อหน้า (เท่ากับเว็บเดิม: 15) */
export const NEWS_PER_PAGE = 15;

/** จำนวนข่าวต่อหน้าในหลังบ้าน */
export const ADMIN_NEWS_PER_PAGE = 20;

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

/** เงื่อนไข "ข่าวที่เว็บสาธารณะเห็นได้" — ใช้ร่วมทุกคำสั่งอ่านฝั่งเว็บ (ห้ามลืม) */
const PUBLIC_NEWS_CONDITION = "n.status = 'published' and n.deleted_at is null";

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

/** จำนวนข่าวที่ **ขึ้นเว็บ** แล้ว (ใช้คำนวณจำนวนหน้า) */
export async function countNews(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  try {
    const result = await getPool().query<{ count: string }>(
      `select count(*)::text as count from news n where ${PUBLIC_NEWS_CONDITION}`,
    );
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
        where ${PUBLIC_NEWS_CONDITION}
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

/** ข่าว 1 ชิ้นจาก source id (ใช้กับพาธ `/news/<source_id>`) — เฉพาะที่เผยแพร่และไม่ถังขยะ */
export async function loadNewsBySourceId(sourceId: string): Promise<NewsRecord | null> {
  if (!isDatabaseConfigured()) return null;
  if (!/^\d{3,}$/.test(sourceId.trim())) return null;
  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select ${NEWS_COLUMNS}
         from news n
         left join media m on m.id = n.cover_media_id
        where n.source_id = $1 and ${PUBLIC_NEWS_CONDITION}
        limit 1`,
      [sourceId.trim()],
    );
    const row = result.rows[0];
    return row === undefined ? null : toNewsRecord(row);
  } catch {
    return null;
  }
}

/** source id ของข่าวที่ขึ้นเว็บทั้งหมด (เรียงใหม่สุดก่อน) — ใช้ตอน build/ตรวจสอบ */
export async function listNewsSourceIds(): Promise<readonly string[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<{ source_id: string }>(
      `select n.source_id from news n where ${PUBLIC_NEWS_CONDITION} order by n.published_at desc nulls last, n.id desc`,
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

/** ลบข่าว 1 ชิ้นถาวร (ใช้ในด่านตรวจ/ล้างข้อมูลทดสอบ) */
export async function deleteNews(id: string): Promise<void> {
  await getPool().query("delete from news where id = $1", [id]);
}

/* ── หลังบ้าน (รอบที่ 123) — แก้ข่าวแบบ WordPress "Posts" ─────────────────────── */

export type AdminNewsStatus = "draft" | "published";

/** แท็บของหน้ารายการ (เหมือน WP: ทั้งหมด · ฉบับร่าง · เผยแพร่ · ถังขยะ) */
export type AdminNewsTab = "all" | "draft" | "published" | "trash";

export type AdminNewsCounts = {
  readonly all: number;
  readonly draft: number;
  readonly published: number;
  readonly trashed: number;
};

export type AdminNewsListItem = {
  readonly id: string;
  readonly sourceId: string;
  readonly titleTh: string;
  readonly titleEn: string;
  readonly status: AdminNewsStatus;
  readonly trashed: boolean;
  /** `YYYY-MM-DDTHH:MM` (เวลาไทย) หรือ null */
  readonly publishedLocal: string | null;
  readonly updatedLocal: string | null;
  readonly coverPath: string | null;
  readonly coverWidth: number | null;
  readonly coverHeight: number | null;
  readonly blockCount: number;
  readonly imageCount: number;
};

export type AdminNewsDetail = AdminNewsListItem & {
  readonly excerptTh: string;
  readonly excerptEn: string;
  readonly publishedLabel: string;
  readonly body: readonly NewsBlock[];
};

export type AdminNewsInput = {
  readonly titleTh: string;
  readonly titleEn: string;
  readonly excerptTh: string;
  readonly excerptEn: string;
  /** `/media/<id>` หรือ null (ค่าว่าง = เอาภาพปกออก) */
  readonly coverPath: string | null;
  /** `YYYY-MM-DDTHH:MM` (เวลาไทย) หรือ null = ไม่ระบุ */
  readonly publishedLocal: string | null;
  readonly status: AdminNewsStatus;
  readonly body: readonly NewsBlock[];
};

const ADMIN_NEWS_COLUMNS = `n.id, n.source_id, n.title_th, n.title_en, n.excerpt_th, n.excerpt_en,
       n.cover_media_id, n.body, n.published_label, n.status, n.deleted_at,
       to_char(n.published_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI') as published_local,
       to_char(n.updated_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI') as updated_local,
       m.width as cover_width, m.height as cover_height,
       jsonb_array_length(n.body) as block_count,
       (select count(*) from jsonb_array_elements(n.body) e where e ->> 'type' = 'image') as image_count`;

const ADMIN_NEWS_ORDER = "order by n.published_at desc nulls last, n.id desc";

function statusOf(value: unknown): AdminNewsStatus {
  return value === "draft" ? "draft" : "published";
}

function countOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toAdminListItem(row: Record<string, unknown>): AdminNewsListItem | null {
  const id = text(row.id).trim();
  const titleTh = text(row.title_th).trim();
  if (id === "") return null;

  const coverId = text(row.cover_media_id).trim();
  const publishedLocal = text(row.published_local).trim();
  const updatedLocal = text(row.updated_local).trim();

  return {
    id,
    sourceId: text(row.source_id),
    titleTh,
    titleEn: text(row.title_en),
    status: statusOf(row.status),
    trashed: row.deleted_at !== null && row.deleted_at !== undefined,
    publishedLocal: publishedLocal === "" ? null : publishedLocal,
    updatedLocal: updatedLocal === "" ? null : updatedLocal,
    coverPath: coverId === "" ? null : `/media/${coverId}`,
    coverWidth: positiveInt(row.cover_width),
    coverHeight: positiveInt(row.cover_height),
    blockCount: countOf(row.block_count),
    imageCount: countOf(row.image_count),
  };
}

function conditionForTab(tab: AdminNewsTab): string {
  if (tab === "trash") return "n.deleted_at is not null";
  if (tab === "draft") return "n.deleted_at is null and n.status = 'draft'";
  if (tab === "published") return "n.deleted_at is null and n.status = 'published'";
  return "n.deleted_at is null";
}

/** นับจำนวนข่าวแยกตามแท็บ (ใช้ทำตัวเลขบนแท็บเหมือน WP) */
export async function adminNewsCounts(): Promise<AdminNewsCounts> {
  const empty: AdminNewsCounts = { all: 0, draft: 0, published: 0, trashed: 0 };
  if (!isDatabaseConfigured()) return empty;
  try {
    const result = await getPool().query<Record<string, unknown>>(
      /* ⚠️ `count(*)` เป็น bigint ⇒ node-postgres คืนเป็น "สตริง" ต้อง cast `::int` ให้ชัด
         (เคสจริงรอบที่ 123: ลืม cast แล้วตัวเลขบนแท็บกลายเป็น 0 ทั้งที่ข้อมูลมี) */
      `select count(*) filter (where deleted_at is null)::int as all_count,
              count(*) filter (where deleted_at is null and status = 'draft')::int as draft_count,
              count(*) filter (where deleted_at is null and status = 'published')::int as published_count,
              count(*) filter (where deleted_at is not null)::int as trashed_count
         from news`,
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

/** รายการข่าวสำหรับหลังบ้าน (ค้นหา/กรอง/แบ่งหน้า) — คืนทั้งรายการและจำนวนทั้งหมดในแท็บนั้น */
export async function listNewsForAdmin(input: {
  readonly tab: AdminNewsTab;
  readonly search: string;
  readonly page: number;
  readonly perPage?: number;
}): Promise<{ readonly items: readonly AdminNewsListItem[]; readonly total: number }> {
  if (!isDatabaseConfigured()) return { items: [], total: 0 };

  const perPage = Math.max(1, Math.min(100, input.perPage ?? ADMIN_NEWS_PER_PAGE));
  const page = Math.max(1, input.page);
  const offset = (page - 1) * perPage;
  const term = input.search.trim();

  const params: unknown[] = [];
  let where = conditionForTab(input.tab);
  if (term !== "") {
    params.push(`%${term}%`);
    const index = params.length;
    where += ` and (n.title_th ilike $${String(index)} or n.title_en ilike $${String(index)} or n.excerpt_th ilike $${String(index)})`;
  }

  try {
    const totalResult = await getPool().query<{ count: string }>(
      `select count(*)::text as count from news n where ${where}`,
      params,
    );
    const total = Number.parseInt(totalResult.rows[0]?.count ?? "0", 10);

    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;
    const result = await getPool().query<Record<string, unknown>>(
      `select ${ADMIN_NEWS_COLUMNS}
         from news n
         left join media m on m.id = n.cover_media_id
        where ${where}
        ${ADMIN_NEWS_ORDER}
        limit $${String(limitIndex)} offset $${String(offsetIndex)}`,
      [...params, perPage, offset],
    );

    const items: AdminNewsListItem[] = [];
    for (const row of result.rows) {
      const item = toAdminListItem(row);
      if (item !== null) items.push(item);
    }
    return { items, total: Number.isFinite(total) ? total : 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

/** ข่าว 1 ชิ้นสำหรับหน้าจอแก้ไข (เห็นได้ทั้งฉบับร่าง/ในถังขยะ) */
export async function loadNewsForAdmin(id: string): Promise<AdminNewsDetail | null> {
  if (!isDatabaseConfigured()) return null;
  const key = id.trim();
  if (key === "") return null;

  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select ${ADMIN_NEWS_COLUMNS}
         from news n
         left join media m on m.id = n.cover_media_id
        where n.id = $1
        limit 1`,
      [key],
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    const base = toAdminListItem(row);
    if (base === null) return null;

    return {
      ...base,
      excerptTh: text(row.excerpt_th),
      excerptEn: text(row.excerpt_en),
      publishedLabel: text(row.published_label),
      body: parseNewsBody(row.body),
    };
  } catch {
    return null;
  }
}

/** สร้าง id ให้ข่าวที่สร้างจากหลังบ้าน — ใช้รูปแบบเดียวกับที่นำเข้า (`n<source_id>`) */
function newAdminNewsIds(now: Date): { readonly id: string; readonly sourceId: string } {
  /* source_id ต้องเป็นตัวเลข (พาธเว็บคือ /news/<source_id> และ `loadNewsBySourceId` ตรวจ ^\d{3,}$) */
  const sourceId = String(now.getTime());
  return { id: `n${sourceId}`, sourceId };
}

/** สร้างข่าวใหม่จากหลังบ้าน — คืน id ที่สร้าง */
export async function createNewsForAdmin(input: AdminNewsInput, actor: string): Promise<string> {
  const { id, sourceId } = newAdminNewsIds(new Date());
  await getPool().query(
    `insert into news (id, source_id, source_url, title_th, title_en, excerpt_th, excerpt_en,
                       cover_media_id, body, published_at, published_label, status, updated_at, updated_by)
       values ($1, $2, '', $3, $4, $5, $6, $7, $8::jsonb, $9::timestamptz, '', $10, now(), $11)`,
    [
      id,
      sourceId,
      input.titleTh,
      input.titleEn,
      input.excerptTh,
      input.excerptEn,
      mediaIdFromPath(input.coverPath ?? ""),
      JSON.stringify(input.body),
      input.publishedLocal === null ? null : `${input.publishedLocal}:00+07:00`,
      input.status,
      actor,
    ],
  );
  return id;
}

/** บันทึกทับข่าวที่มีอยู่ (หลังบ้าน) */
export async function updateNewsForAdmin(id: string, input: AdminNewsInput, actor: string): Promise<void> {
  await getPool().query(
    `update news
        set title_th = $2, title_en = $3, excerpt_th = $4, excerpt_en = $5,
            cover_media_id = $6, body = $7::jsonb, published_at = $8::timestamptz,
            status = $9, updated_at = now(), updated_by = $10
      where id = $1`,
    [
      id,
      input.titleTh,
      input.titleEn,
      input.excerptTh,
      input.excerptEn,
      mediaIdFromPath(input.coverPath ?? ""),
      JSON.stringify(input.body),
      input.publishedLocal === null ? null : `${input.publishedLocal}:00+07:00`,
      input.status,
      actor,
    ],
  );
}

/** ย้ายเข้าถังขยะ / กู้คืน */
export async function setNewsTrashed(id: string, trashed: boolean, actor: string): Promise<void> {
  await getPool().query("update news set deleted_at = case when $2 then now() else null end, updated_at = now(), updated_by = $3 where id = $1", [
    id,
    trashed,
    actor,
  ]);
}

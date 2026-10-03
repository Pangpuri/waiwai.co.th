import { randomBytes } from "node:crypto";

import { getPool } from "@/db/pool";
import type { AllowedImageMime } from "@/lib/media/image-info";

/**
 * คลังภาพ — ที่เก็บไฟล์ในฐานข้อมูล (มติ D11)
 *
 * - บล็อกเก็บ **พาธ** `/media/<id>` (ไม่ใช่ URL เต็ม — มติ D9)
 * - มีแต่ฟังก์ชันฝั่งเซิร์ฟเวอร์ · ผู้เรียกต้องตรวจสิทธิ์ก่อนเสมอ (ทำใน Server Action)
 * - id เป็น base64url 12 ตัวอักษรจาก crypto ⇒ เดาไม่ได้ และไม่ซ้ำในทางปฏิบัติ
 */

export function newMediaId(): string {
  return randomBytes(9).toString("base64url");
}

export type MediaListItem = {
  readonly id: string;
  readonly filename: string;
  readonly mime: AllowedImageMime;
  readonly sizeBytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly altTh: string;
  readonly altEn: string;
  readonly createdAt: string;
};

export type MediaBinary = {
  readonly mime: AllowedImageMime;
  readonly data: Buffer;
  readonly sizeBytes: number;
  readonly filename: string;
  readonly createdAt: string;
};

export async function insertMedia(input: {
  readonly id: string;
  readonly filename: string;
  readonly mime: AllowedImageMime;
  readonly sizeBytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly data: Buffer;
  readonly altTh: string;
  readonly altEn: string;
  readonly createdBy: string;
}): Promise<void> {
  await getPool().query(
    `insert into media (id, filename, mime, size_bytes, width, height, data, alt_th, alt_en, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.id,
      input.filename,
      input.mime,
      input.sizeBytes,
      input.width,
      input.height,
      input.data,
      input.altTh,
      input.altEn,
      input.createdBy,
    ],
  );
}

export async function getMediaBinary(id: string): Promise<MediaBinary | null> {
  const result = await getPool().query<{
    mime: AllowedImageMime;
    data: Buffer;
    size_bytes: number;
    filename: string;
    created_at: Date;
  }>(`select mime, data, size_bytes, filename, created_at from media where id = $1`, [id]);

  const row = result.rows[0];
  if (row === undefined) return null;

  return {
    mime: row.mime,
    data: row.data,
    sizeBytes: row.size_bytes,
    filename: row.filename,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listMedia(limit = 40): Promise<readonly MediaListItem[]> {
  const result = await getPool().query<{
    id: string;
    filename: string;
    mime: AllowedImageMime;
    size_bytes: number;
    width: number | null;
    height: number | null;
    alt_th: string;
    alt_en: string;
    created_at: Date;
  }>(
    `select id, filename, mime, size_bytes, width, height, alt_th, alt_en, created_at
       from media order by created_at desc limit $1`,
    [limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    altTh: row.alt_th,
    altEn: row.alt_en,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function updateMediaAlt(id: string, altTh: string, altEn: string): Promise<void> {
  await getPool().query(`update media set alt_th = $2, alt_en = $3 where id = $1`, [id, altTh, altEn]);
}

export async function deleteMedia(id: string): Promise<boolean> {
  const result = await getPool().query(`delete from media where id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

/* ── คลังภาพ (X1.2) ───────────────────────────────────────────────────────── */

export type MediaUsage = {
  /** ชนิดของที่อ้างถึง: เอกสาร (เพจ/navbar/footer/ป้าย/ตั้งค่า) หรือคอลัมน์ OG ของหน้า */
  readonly kind: "document" | "og-image" | "favicon";
  /** คีย์ที่ใช้เรียกในระบบ เช่น `home:draft` */
  readonly target: string;
  readonly detail: string | null;
};

/**
 * หาว่าภาพนี้ถูกใช้ที่ไหน (เดินดูทุกเอกสาร + คอลัมน์ OG + favicon)
 * ⚠️ ใช้ `like` บนข้อความ JSON — รหัสภาพเป็น base64url (a-z A-Z 0-9 - _) ⇒ ไม่มีอักขระพิเศษของ LIKE
 */
export async function findMediaUsage(id: string): Promise<readonly MediaUsage[]> {
  const path = `/media/${id}`;
  const usage: MediaUsage[] = [];

  const docs = await getPool().query<{ page: string; status: string }>(
    `select page, status from page_document where document::text like '%' || $1 || '%' order by page, status`,
    [path],
  );
  for (const row of docs.rows) {
    usage.push({ kind: "document", target: `${row.page}:${row.status}`, detail: null });
  }

  const ogRows = await getPool().query<{ id: string }>(`select id from page where og_image_path = $1`, [path]);
  for (const row of ogRows.rows) {
    usage.push({ kind: "og-image", target: row.id, detail: null });
  }

  return usage;
}

/** รายการภาพแบบมีคำค้น (ชื่อไฟล์/คำอธิบายภาพ) — เรียงใหม่สุดก่อน */
export async function searchMedia(query: string, limit = 60): Promise<readonly MediaListItem[]> {
  const trimmed = query.trim();
  const result = await getPool().query<{
    id: string;
    filename: string;
    mime: AllowedImageMime;
    size_bytes: number;
    width: number | null;
    height: number | null;
    alt_th: string;
    alt_en: string;
    created_at: Date;
  }>(
    `select id, filename, mime, size_bytes, width, height, alt_th, alt_en, created_at
       from media
      where $1 = '' or filename ilike '%' || $1 || '%' or alt_th ilike '%' || $1 || '%' or alt_en ilike '%' || $1 || '%'
      order by created_at desc
      limit $2`,
    [trimmed, Math.max(1, Math.min(limit, 200))],
  );

  return result.rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    altTh: row.alt_th,
    altEn: row.alt_en,
    createdAt: row.created_at.toISOString(),
  }));
}

/** สรุปตัวเลขของคลังภาพ */
export async function mediaStats(): Promise<{ readonly count: number; readonly totalBytes: number }> {
  const result = await getPool().query<{ count: string; bytes: string | null }>(
    `select count(*)::text as count, coalesce(sum(size_bytes), 0)::text as bytes from media`,
  );
  const row = result.rows[0];
  return {
    count: row === undefined ? 0 : Number.parseInt(row.count, 10),
    totalBytes: row === undefined || row.bytes === null ? 0 : Number.parseInt(row.bytes, 10),
  };
}

/**
 * "แทนไฟล์" ภาพเดิม (คีย์เดิม) — ใช้เมื่ออยากเปลี่ยนรูปแต่ไม่ต้องแก้ทุกที่ที่อ้างถึง
 * ⇒ พาธ `/media/<id>` ไม่เปลี่ยน ทุกหน้าที่ยังใช้ภาพนี้ได้รูปใหม่ทันที
 */
export async function replaceMediaData(
  id: string,
  file: { readonly mime: AllowedImageMime; readonly sizeBytes: number; readonly width: number | null; readonly height: number | null; readonly data: Uint8Array },
): Promise<boolean> {
  const result = await getPool().query(
    `update media set mime = $2, size_bytes = $3, width = $4, height = $5, data = $6 where id = $1`,
    [id, file.mime, file.sizeBytes, file.width, file.height, Buffer.from(file.data)],
  );
  return (result.rowCount ?? 0) > 0;
}

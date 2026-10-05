import { createHash } from "node:crypto";

import { extensionFor, readImageInfo } from "@/lib/media/image-info";
import { findMediaIdBySha256, insertMedia, newMediaId } from "@/lib/media/repository";

/**
 * ตัวช่วย "เอารูปจากเว็บเดิมเข้าคลังภาพของเรา" — ใช้ร่วมกันโดยตัวนำเข้าสินค้า (รอบที่ 103)
 * และตัวนำเข้าเมนูอาหาร (รอบที่ 104)
 *
 * กติกา
 * - รูปเก็บในตาราง `media` (มติ D11) · ที่เก็บอ้างอิงเป็น id ⇒ ผู้เรียกเก็บพาธ `/media/<id>` (มติ D9)
 * - **ตรวจว่าเป็นภาพจริงจากหัวไฟล์** (`readImageInfo`) — ไม่เชื่อ content-type จากปลายทาง
 * - **dedupe ด้วย sha256** ⇒ นำเข้าซ้ำไม่กินที่ซ้ำ (ผลลัพธ์เท่าเดิม)
 * - ดาวน์โหลดไม่สำเร็จ/ไม่ใช่ภาพ = คืน null + รายงาน (ผู้เรียกยังบันทึกข้อมูลแถวนั้นต่อได้)
 * - `fetchBinary` ถูกส่งเข้ามา ⇒ ไฟล์นี้ไม่ผูกกับวิธีดึงข้อมูล (เทสต์/`--dir` ใช้ตัวอื่นได้)
 */

export type ImportMediaStats = { newImages: number; reusedImages: number };

/** cache ต่อการรัน 1 ครั้ง: url → media id (หรือ null = ใช้ไม่ได้) */
export type ImportMediaCache = Map<string, string | null>;

export function filenameFromUrl(url: string): string {
  const raw = url.split("?")[0]?.split("/").pop() ?? "";
  const decoded = decodeURIComponent(raw);
  return decoded.trim() === "" ? "import" : decoded.slice(0, 120);
}

export async function ensureImportedMedia(options: {
  readonly url: string;
  readonly altTh: string;
  readonly altEn: string;
  readonly cache: ImportMediaCache;
  readonly stats: ImportMediaStats;
  readonly actor: string;
  readonly fetchBinary: (url: string) => Promise<Buffer>;
  readonly log: (message: string) => void;
}): Promise<string | null> {
  const cached = options.cache.get(options.url);
  if (cached !== undefined) return cached;

  let mediaId: string | null = null;
  try {
    const bytes = await options.fetchBinary(options.url);
    const info = readImageInfo(bytes);
    if (info === null) {
      options.log(`   ⚠️ ข้ามภาพที่ไม่ใช่ PNG/JPEG/WebP: ${options.url}`);
    } else {
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const existing = await findMediaIdBySha256(sha256);
      if (existing !== null) {
        mediaId = existing;
        options.stats.reusedImages += 1;
      } else {
        const id = newMediaId();
        const rawName = filenameFromUrl(options.url);
        await insertMedia({
          id,
          filename: rawName.includes(".") ? rawName : `${rawName}.${extensionFor(info.mime)}`,
          mime: info.mime,
          sizeBytes: bytes.length,
          width: info.width,
          height: info.height,
          data: bytes,
          altTh: options.altTh,
          altEn: options.altEn,
          createdBy: options.actor,
          sha256,
        });
        mediaId = id;
        options.stats.newImages += 1;
      }
    }
  } catch (error) {
    options.log(`   ⚠️ ดาวน์โหลดภาพไม่สำเร็จ (ข้าม): ${options.url} — ${error instanceof Error ? error.message : String(error)}`);
  }

  options.cache.set(options.url, mediaId);
  return mediaId;
}

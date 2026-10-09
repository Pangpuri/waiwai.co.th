/**
 * นำเข้ารูปของ **หน้าบริษัท (/about)** จาก `public/` เข้าคลังภาพ (ตาราง `media`) — รอบที่ 253
 *
 * ```bash
 * npm run about:media            # นำเข้า (รันซ้ำได้ — dedupe ด้วย sha256)
 * npm run about:media -- --dry-run
 * npm run about:media -- --report   # แค่รายงานว่าภาพไหนอยู่ในคลังแล้ว/ยังขาด
 * ```
 *
 * มติเจ้าของ 2026-10-09: *"ย้ายข้อมูลบริษัทเข้าไปเก็บไว้ในฐานข้อมูล … รวมถึงจุดที่อัปโหลดภาพเข้าไปได้ด้วย"*
 * ⇒ รูปเดิมใน `public/` (แก้จากหลังบ้านไม่ได้) ถูกนำเข้าคลังภาพ ⇒ บล็อกของหน้าบริษัทอ้างอิง `/media/<id>`
 *    แล้วเจ้าของเปลี่ยน/อัปโหลดทับได้จากตัวสร้างหน้าเว็บ
 *
 * ⚠️ ต้องมี `DATABASE_URL` · รูปถูกอ่านจาก `public/` ในเครื่องนี้เท่านั้น (ไม่ต่ออินเทอร์เน็ต)
 * ⚠️ ไฟล์ใน `public/` **ไม่ถูกลบ** — เป็น fallback ของหน้าเว็บเมื่อยังไม่ได้นำเข้า
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ABOUT_MEDIA, type AboutMediaAsset } from "@/lib/blocks/about-media";
import { ensureImportedMedia, type ImportMediaCache, type ImportMediaStats } from "@/lib/import/media";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { findMediaIdsBySha256 } from "@/lib/media/repository";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const reportOnly = args.includes("--report");

/** alt ตั้งต้นของแต่ละภาพ (ผู้ใช้แก้ทีหลังได้ในคลังภาพ) */
function altOf(asset: AboutMediaAsset): { readonly th: string; readonly en: string } {
  if (asset.key.startsWith("cert:")) {
    return { th: "ใบรับรองมาตรฐานของไวไว", en: "Wai Wai certification" };
  }
  if (asset.key === "executives") {
    return { th: "ผังคณะผู้บริหารไวไว", en: "Wai Wai management team" };
  }
  return { th: "แผนที่โรงงานอยู่น้อย", en: "Om Yai factory map" };
}

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.error("✗ ต้องมี DATABASE_URL (ดู .env.local)");
    process.exit(1);
  }

  const existing = await findMediaIdsBySha256(ABOUT_MEDIA.map((asset) => asset.sha256));
  const missing = ABOUT_MEDIA.filter((asset) => !existing.has(asset.sha256));

  console.log(`รูปของหน้าบริษัททั้งหมด ${ABOUT_MEDIA.length} ไฟล์ · อยู่ในคลังแล้ว ${existing.size} · ยังขาด ${missing.length}`);
  for (const asset of ABOUT_MEDIA) {
    const id = existing.get(asset.sha256);
    console.log(`   ${asset.publicPath.padEnd(46)} ${id === undefined ? "— ยังไม่นำเข้า" : `/media/${id}`}`);
  }

  if (reportOnly) return;

  if (missing.length === 0) {
    console.log("✓ ครบแล้ว — ไม่มีอะไรต้องนำเข้า");
    return;
  }

  if (dryRun) {
    console.log(`(dry-run) จะนำเข้า ${missing.length} ไฟล์ — ไม่เขียนอะไรลงฐานข้อมูล`);
    return;
  }

  const locals = new Map<string, Buffer>(ABOUT_MEDIA.map((asset) => [asset.publicPath, readFileSync(join("public", asset.publicPath))]));
  const cache: ImportMediaCache = new Map();
  const stats: ImportMediaStats = { newImages: 0, reusedImages: 0 };
  const log = (message: string) => console.log(message);

  for (const asset of ABOUT_MEDIA) {
    const alt = altOf(asset);
    const id = await ensureImportedMedia({
      url: asset.publicPath,
      altTh: alt.th,
      altEn: alt.en,
      cache,
      stats,
      actor: "about-media-import",
      /* อ่านจาก public/ ในเครื่อง — ไม่ต่ออินเทอร์เน็ต (เป็นเหตุผลที่ use helper ตัวเดิมได้) */
      fetchBinary: async (path) => {
        const bytes = locals.get(path);
        if (bytes === undefined) throw new Error(`ไม่พบไฟล์ใน public: ${path}`);
        return bytes;
      },
      log,
    });
    console.log(`   ${asset.publicPath} → ${id === null ? "✗ ข้าม" : `/media/${id}`}`);
  }

  console.log(`✓ นำเข้าเสร็จ: ภาพใหม่ ${stats.newImages} · ใช้ของเดิม ${stats.reusedImages}`);
  console.log("ℹ️ รัน `npm run about:media -- --report` เพื่อตรวจว่าไม่มีอะไรขาด");
}

await main();

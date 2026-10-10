/**
 * นำ **โลโก้หมวดสินค้า** จาก `public/products/*.png` เข้าคลังภาพ (ตาราง `media`) — รอบที่ 254
 *
 * ```bash
 * npm run products:logos            # นำเข้า (รันซ้ำได้ — dedupe ด้วย sha256 · ไม่ทับงานที่แก้จากหลังบ้าน)
 * npm run products:logos -- --dry-run
 * npm run products:logos -- --report   # แค่รายงานว่าโลโก้ไหนอยู่ในคลังแล้ว/ยังขาด
 * ```
 *
 * ที่มา: มติเจ้าของ 2026-10-09 (**D24** · หนี้ D-253-3) — หมวดสินค้าต้องแก้ "ชื่อ + โลโก้" ได้จากหลังบ้าน
 * โลโก้เดิมเป็นไฟล์ใน `public/products/` (แก้จากหลังบ้านไม่ได้) ⇒ รอบนี้นำเข้าคลังภาพ ⇒
 * `product_category.logo_media_id` ชี้ `/media/<id>` แล้วเจ้าของเปลี่ยน/อัปโหลดทับได้จาก `/admin/products`
 *
 * ⚠️ **ไม่ทับงานคน**: เขียน `logo_media_id` เฉพาะเมื่อยังว่าง (`importCategoryLogo` · fill-only)
 * ⚠️ ต้องมี `DATABASE_URL` · รูปอ่านจาก `public/` ในเครื่องนี้เท่านั้น (ไม่ต่ออินเทอร์เน็ต)
 * ⚠️ ไฟล์ใน `public/products/` **ไม่ถูกลบ** — เป็น fallback ของหน้าเว็บเมื่อยังไม่ได้นำเข้า
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isDatabaseConfigured } from "@/db/pool";
import { CATALOG_ITEMS } from "@/features/products/catalog";
import { ensureImportedMedia, type ImportMediaCache, type ImportMediaStats } from "@/lib/import/media";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";
import { findMediaIdsBySha256 } from "@/lib/media/repository";
import { importCategoryLogo } from "@/lib/products/repository";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const reportOnly = args.includes("--report");
const ACTOR = "products-logos-import";

/** ไฟล์จริง + ลายนิ้วมือ + คำบรรยายภาพ (ใช้ทั้งรายงานและการนำเข้า) */
function loadLogoFiles(): readonly {
  readonly slug: string;
  readonly publicPath: string;
  readonly bytes: Buffer;
  readonly sha256: string;
  readonly altTh: string;
  readonly altEn: string;
}[] {
  return CATALOG_ITEMS.map((item) => {
    const publicPath = item.image.src.replace(/^\//, "");
    const bytes = readFileSync(join("public", publicPath));
    return {
      slug: item.slug,
      publicPath,
      bytes,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      altTh: th.productsPage.items[item.id].imageAlt,
      altEn: en.productsPage.items[item.id].imageAlt,
    };
  });
}

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.error("✗ ต้องมี DATABASE_URL (ดู .env.local)");
    process.exit(1);
  }

  const files = loadLogoFiles();
  const existing = await findMediaIdsBySha256(files.map((file) => file.sha256));

  console.log(`โลโก้หมวดสินค้าทั้งหมด ${files.length} ไฟล์ · อยู่ในคลังแล้ว ${existing.size} · ยังขาด ${files.length - existing.size}`);
  for (const file of files) {
    const id = existing.get(file.sha256);
    console.log(`   ${`/${file.publicPath}`.padEnd(38)} ${id === undefined ? "— ยังไม่นำเข้า" : `/media/${id}`}`);
  }

  if (reportOnly) return;

  if (dryRun) {
    console.log(`(dry-run) จะนำเข้า ${files.length - existing.size} ไฟล์ — ไม่เขียนอะไรลงฐานข้อมูล`);
    return;
  }

  const locals = new Map<string, Buffer>(files.map((file) => [`/${file.publicPath}`, file.bytes]));
  const cache: ImportMediaCache = new Map();
  const stats: ImportMediaStats = { newImages: 0, reusedImages: 0 };
  const log = (message: string) => console.log(message);

  let linked = 0;
  for (const file of files) {
    const id = await ensureImportedMedia({
      url: `/${file.publicPath}`,
      altTh: file.altTh,
      altEn: file.altEn,
      cache,
      stats,
      actor: ACTOR,
      /* อ่านจาก public/ ในเครื่อง — ไม่ต่ออินเทอร์เน็ต (ใช้ helper ตัวเดิมของตัวนำเข้าสินค้า/เมนู) */
      fetchBinary: async (path) => {
        const bytes = locals.get(path);
        if (bytes === undefined) throw new Error(`ไม่พบไฟล์ใน public: ${path}`);
        return bytes;
      },
      log,
    });
    if (id === null) {
      console.log(`   ${file.slug}: ✗ ข้าม (ใช้ภาพไม่ได้)`);
      continue;
    }
    /* ⚠️ fill-only: รันซ้ำหลังเจ้าของเปลี่ยนโลโก้จากหลังบ้าน = ไม่มีอะไรเปลี่ยน */
    const wrote = await importCategoryLogo(file.slug, id, ACTOR);
    if (wrote) linked += 1;
    console.log(`   ${file.slug}: /media/${id} ${wrote ? "→ ผูกเข้ากับหมวดแล้ว" : "(หมวดมีโลโก้อยู่แล้ว — ไม่เปลี่ยน)"}`);
  }

  console.log(`✓ นำเข้าเสร็จ: ภาพใหม่ ${stats.newImages} · ใช้ของเดิม ${stats.reusedImages} · ผูกกับหมวดใหม่ ${linked} หมวด`);
  console.log("ℹ️ รัน `npm run products:logos -- --report` เพื่อตรวจว่าไม่มีอะไรขาด");
}

await main();

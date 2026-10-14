/**
 * นำ **ค่าเริ่มต้นถาวรของหมวดสินค้า** เข้าตาราง `product_category_default` — รอบที่ 264 (มติ D25 ข้อ 4)
 *
 * ```bash
 * npm run products:category-defaults            # นำเข้า (รันซ้ำได้ — fill-only ไม่ทับชุดเดิม)
 * npm run products:category-defaults -- --dry-run
 * npm run products:category-defaults -- --report   # ดูว่าหมวดไหนมีค่าเริ่มต้นแล้ว
 * ```
 *
 * ที่มา: เจ้าของ 2026-10-10 *"สามารถคืนค่าเริ่มต้นได้ เพราะงั้นค่าเริ่มต้นจะเก็บถาวรเสมอ"*
 * ⇒ ตาราง `product_category_default` = **สำเนาชุด ณ วันที่นำเข้า** (ชื่อ/คำอธิบาย/พาธภาพ/ลำดับ)
 *    · แอป **อ่านอย่างเดียว** — ไม่มี UI ใดเขียนทับตารางนี้
 *    · "คืนค่าเริ่มต้น" = คัดลอกจากตารางนี้ลง `product_category`
 *
 * ⚠️ **fill-only**: `on conflict (id) do nothing` ⇒ รันซ้ำไม่ทับชุดเดิม (นี่คือกลไก "ล็อกถาวร" จริง)
 * ⚠️ ต้องมี `DATABASE_URL` · รูปอ่านจาก `public/` ในเครื่องนี้เท่านั้น (ไม่ต่ออินเทอร์เน็ต)
 * ⚠️ ชื่อจาก **พจนานุกรม** (th/en) — ตัวนำเข้าไม่แต่งชื่อเอง · หมวดที่สร้างใหม่ไม่มีค่าเริ่มต้น (ตั้งใจ)
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
import { defaultSortOrderOf, type CategorySnapshot } from "@/lib/products/categories";
import { insertCategoryDefaults, listAdminCategories, listCategoryDefaults } from "@/lib/products/categories-repository";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const reportOnly = args.includes("--report");
const ACTOR = "products-category-defaults";

type LogoFile = {
  readonly slug: string;
  readonly publicPath: string;
  readonly bytes: Buffer;
  readonly sha256: string;
  readonly altTh: string;
  readonly altEn: string;
};

/** ไฟล์โลโก้จริง + ลายนิ้วมือ (ใช้ทั้งรายงาน/นำเข้า/ผูกค่าเริ่มต้น) */
function loadLogoFiles(): readonly LogoFile[] {
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
  const [existingMedia, defaults, rows] = await Promise.all([
    findMediaIdsBySha256(files.map((file) => file.sha256)),
    listCategoryDefaults(),
    listAdminCategories(),
  ]);
  const defaultIds = new Set(defaults.map((row) => row.id));

  console.log(`หมวดในโค้ด ${String(files.length)} หมวด · มีค่าเริ่มต้นแล้ว ${String(defaults.length)} · โลโก้ในคลัง ${String(existingMedia.size)}/${String(files.length)}`);

  if (reportOnly) {
    for (const file of files) {
      const id = existingMedia.get(file.sha256);
      console.log(
        `   ${file.slug.padEnd(18)} ${defaultIds.has(file.slug) ? "มีค่าเริ่มต้นแล้ว" : "ยังไม่มีค่าเริ่มต้น"} · โลโก้ ${id === undefined ? "— ยังไม่นำเข้า" : `/media/${id}`}`,
      );
    }
    return;
  }

  /* ต้องมั่นใจว่าโลโก้อยู่ในคลังก่อน ⇒ ไม่งั้นค่าเริ่มต้นชี้ภาพที่ไม่มี (เหมือน `products:logos`) */
  const locals = new Map<string, Buffer>(files.map((file) => [`/${file.publicPath}`, file.bytes]));
  const cache: ImportMediaCache = new Map();
  const stats: ImportMediaStats = { newImages: 0, reusedImages: 0 };
  const log = (message: string) => console.log(message);
  const logoMediaIdBySlug = new Map<string, string>();

  for (const file of files) {
    if (dryRun) {
      const id = existingMedia.get(file.sha256);
      if (id !== undefined) logoMediaIdBySlug.set(file.slug, id);
      continue;
    }
    const id = await ensureImportedMedia({
      url: `/${file.publicPath}`,
      altTh: file.altTh,
      altEn: file.altEn,
      cache,
      stats,
      actor: ACTOR,
      fetchBinary: async (path) => {
        const bytes = locals.get(path);
        if (bytes === undefined) throw new Error(`ไม่พบไฟล์ใน public: ${path}`);
        return bytes;
      },
      log,
    });
    if (id !== null) logoMediaIdBySlug.set(file.slug, id);
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const snapshots: CategorySnapshot[] = CATALOG_ITEMS.map((item) => {
    const row = rowById.get(item.slug);
    const logoMediaId = logoMediaIdBySlug.get(item.slug) ?? null;
    return {
      id: item.slug,
      /* ชื่อเริ่มต้น = พจนานุกรม (ล็อกในโค้ด) — ไม่ดึงค่าที่ผู้ดูแลแก้ใน DB มาเป็นค่าเริ่มต้น */
      nameTh: th.productsPage.items[item.id].name,
      nameEn: en.productsPage.items[item.id].name,
      descriptionTh: row?.descriptionTh ?? "",
      descriptionEn: row?.descriptionEn ?? "",
      /* ภาพหัวหมวด: ใช้ค่าที่นำเข้าจากเว็บเดิม (ถ้ามี) · โลโก้: ไฟล์ใน public ที่นำเข้าคลังแล้ว */
      imageMediaId: row?.imagePath === null || row?.imagePath === undefined ? null : row.imagePath.replace(/^\/media\//, ""),
      logoMediaId: logoMediaId ?? (row?.logoPath === null || row?.logoPath === undefined ? null : row.logoPath.replace(/^\/media\//, "")),
      sortOrder: defaultSortOrderOf(item.slug),
      isHidden: false,
    };
  });

  if (dryRun) {
    console.log(`(dry-run) จะเติมค่าเริ่มต้น ${String(snapshots.filter((item) => !defaultIds.has(item.id)).length)} หมวด — ไม่เขียนอะไรลงฐานข้อมูล`);
    for (const snapshot of snapshots) {
      console.log(`   ${snapshot.id.padEnd(18)} order=${String(snapshot.sortOrder)} logo=${snapshot.logoMediaId ?? "—"} image=${snapshot.imageMediaId ?? "—"}`);
    }
    return;
  }

  const written = await insertCategoryDefaults(snapshots, ACTOR);
  console.log(`✓ เติมค่าเริ่มต้น ${String(written)} หมวด (ที่มีอยู่แล้ว ${String(defaults.length)} หมวดไม่ถูกแตะ)`);
  console.log(`ℹ️ ภาพใหม่ ${String(stats.newImages)} · ใช้ของเดิม ${String(stats.reusedImages)}`);
  console.log("ℹ️ ตรวจว่าไม่มีอะไรขาด: `npm run products:category-defaults -- --report`");
}

await main();

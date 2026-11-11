import { closePool, getPool, isDatabaseConfigured } from "@/db/pool";
import { ensureImportedMedia, type ImportMediaCache } from "@/lib/import/media";
import { loadRecipeForAdmin } from "@/lib/recipes/repository";
import { prepareTargetRun } from "./target-env.ts";

/**
 * นำเข้า **ภาพสูตรอาหาร 5 เมนู** จากเว็บเดิม — รอบ 342
 *
 * ใช้
 *   npm run recipes:images                → ดาวน์โหลด 5 ภาพ + ผูกกับเมนู
 *   npm run recipes:images -- --dry-run   → ดูแผน ไม่โหลด/ไม่เขียน
 *   npm run recipes:images -- --target    → ฐานข้อมูลปลายทาง
 *
 * ⚠️ ภาพเป็น JPEG จากเว็บเดิม (เจ้าของให้ลิงก์มา 2026-11-11)
 * ⚠️ ตัวนำเข้าเมนูปกติ (`recipes:import`) ไม่แตะภาพสูตร ⇒ รันซ้ำไม่ทับงานคน
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36";
const ACTOR = "import:waiwai.co.th";

/** id เมนู → URL ภาพสูตร (จาก workplan 2026-11-11) */
const SOURCES: readonly { readonly recipeId: string; readonly url: string }[] = [
  {
    recipeId: "r297734",
    url: "https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/filemanager/ded78b64523b2a7967218d943a05da4f_full.jpg",
  },
  {
    recipeId: "r297157",
    url: "https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/filemanager/20fda6907c2b4dd76199b2b04ceec010_full.jpg",
  },
  {
    recipeId: "r297155",
    url: "https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/filemanager/21b2737e1b642ebd8943cb01bce9ef2c_full.jpg",
  },
  {
    recipeId: "r297153",
    url: "https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/filemanager/4ce78fff9335ba2a5b428e49fd4faf1c_full.jpg",
  },
  {
    recipeId: "r297148",
    url: "https://cache-igetweb-v2.mt108.info/uploads/images-cache/5052/filemanager/486c8c61a114c4617814cb22ff2b9775_full.jpg",
  },
];

type Options = { readonly dryRun: boolean };

function parseArgs(argv: readonly string[]): Options {
  return { dryRun: argv.includes("--dry-run") };
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

async function fetchBinary(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "image/*,*/*" }, redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main(): Promise<void> {
  const target = prepareTargetRun(process.argv.slice(2), process.env, { log: console.log, error: console.error });
  if (!target.ok) process.exit(1);
  const options = parseArgs(target.argv);

  if (!options.dryRun && !isDatabaseConfigured()) {
    log("✗ ต้องมี DATABASE_URL (หรือใช้ --dry-run เพื่อดูแผน)");
    process.exitCode = 1;
    return;
  }

  const cache: ImportMediaCache = new Map();
  const stats = { newImages: 0, reusedImages: 0 };
  let updated = 0;
  let failed = 0;

  for (const source of SOURCES) {
    if (options.dryRun) {
      log(`   · ${source.recipeId} ← ${source.url}`);
      continue;
    }

    const recipe = await loadRecipeForAdmin(source.recipeId);
    if (recipe === null) {
      failed += 1;
      log(`   ⚠️ ${source.recipeId}: ไม่พบเมนู`);
      continue;
    }

    const mediaId = await ensureImportedMedia({
      url: source.url,
      altTh: recipe.titleTh,
      altEn: recipe.titleEn.trim() === "" ? recipe.titleTh : recipe.titleEn,
      cache,
      stats,
      actor: ACTOR,
      fetchBinary,
      log,
      maxBytes: 5 * 1024 * 1024,
    });
    if (mediaId === null) {
      failed += 1;
      log(`   ⚠️ ${source.recipeId}: นำเข้าภาพไม่สำเร็จ`);
      continue;
    }

    const result = await getPool().query(
      "update recipe set recipe_image_media_id = $2, updated_at = now(), updated_by = $3 where id = $1",
      [source.recipeId, mediaId, ACTOR],
    );
    if ((result.rowCount ?? 0) > 0) {
      updated += 1;
      log(`   ✓ ${source.recipeId} ← /media/${mediaId}`);
    } else {
      failed += 1;
      log(`   ⚠️ ${source.recipeId}: ผูกภาพไม่สำเร็จ`);
    }
  }

  log(`\nสรุป: อัปเดต ${updated} เมนู · ล้มเหลว ${failed} · ภาพใหม่ ${stats.newImages} · ภาพเดิม ${stats.reusedImages}`);
  if (options.dryRun) log("(โหมด --dry-run: ไม่ได้โหลด/เขียนอะไร)");
}

main()
  .catch((error: unknown) => {
    log(`✗ นำเข้าไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

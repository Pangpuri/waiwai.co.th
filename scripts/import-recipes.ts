import { closePool, isDatabaseConfigured } from "@/db/pool";
import { ensureImportedMedia, type ImportMediaCache } from "@/lib/import/media";
import { parseRecipeArticlePage, parseRecipeCategoryPage } from "@/lib/recipes/import-parse";
import { recipeIdOfSourceId, recipeTitleOf, validateRecipeInput } from "@/lib/recipes/model";
import { prunePlan } from "@/lib/import/prune";
import { listRecipeIds, setRecipeTrashed, upsertRecipe } from "@/lib/recipes/repository";

/**
 * นำเข้าเมนูอาหาร (วิดีโอ) จากเว็บเดิม (waiwai.co.th · หมวดบทความ 12586) — S3 ส่วนที่ 4 · รอบที่ 104
 *
 * ใช้
 *   npm run recipes:import                     → ดึงจากเว็บจริง (ต้องมี DATABASE_URL)
 *   npm run recipes:import -- --dry-run        → แกะ + รายงานผล ไม่เขียนอะไร
 *   npm run recipes:import -- --dir=<โฟลเดอร์>  → อ่าน HTML ที่บันทึกไว้ (ไม่ต้องต่อเน็ต)
 *                                                (ต้องมี `category.html` + `art-<sourceId>.html`)
 *
 * กติกา
 * - **idempotent**: `id = r<source_id>` · รูป dedupe ด้วย sha256 (ตัวช่วยกลาง `lib/import/media.ts`)
 * - ข้อมูลผ่านตัวตรวจ (`lib/recipes/model.ts`) ก่อนเขียน · แถวที่ไม่ผ่าน = รายงาน + ข้าม
 * - ⚠️ ต้นฉบับเป็นของผู้ตราสินค้าเอง (เจ้าของสั่งให้นำเข้า) · **ห้าม commit HTML/รูปที่ดึงมา**
 * - ⚠️ **ไม่เก็บ URL ของ YouTube** — เก็บแค่ id (ประกอบ URL ตอนแสดงผล)
 */

const BASE_URL = "https://waiwai.co.th";
/** หมวดบทความ "เมนูอาหาร" (เจ้าของให้มา 2026-10-05) */
const CATEGORY_PATH = "/th/articles/category/12586";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36";
const ACTOR = "import:waiwai.co.th";

type Options = {
  readonly dryRun: boolean;
  readonly dir: string | null;
  /** ทับงานที่แก้จากหลังบ้านจริง (ค่าเริ่มต้น = ไม่ทับ · หนี้ A1 รอบที่ 142) */
  readonly force: boolean;
  /** รายงานของที่หายไปจากเว็บเดิม (หนี้ A2) */
  readonly prune: boolean;
  /** ย้ายของที่หายไปเข้าถังขยะจริง (ไม่ลบถาวร) */
  readonly pruneApply: boolean;
};

function parseArgs(argv: readonly string[]): Options {
  let dryRun = false;
  let dir: string | null = null;
  let force = false;
  let prune = false;
  let pruneApply = false;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--force") force = true;
    else if (arg === "--prune") prune = true;
    else if (arg === "--prune-apply") {
      prune = true;
      pruneApply = true;
    }
    else if (arg.startsWith("--dir=")) dir = arg.slice("--dir=".length);
  }
  return { dryRun, dir, force, prune, pruneApply };
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, referer: `${BASE_URL}/`, accept: "text/html,image/*,*/*" },
        redirect: "follow",
      });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status} ${url}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
  }
  throw lastError instanceof Error ? lastError : new Error(`ดึงไม่สำเร็จ: ${url}`);
}

async function fetchText(url: string): Promise<string> {
  return (await fetchWithRetry(url)).text();
}

async function fetchBinary(url: string): Promise<Buffer> {
  return Buffer.from(await (await fetchWithRetry(url)).arrayBuffer());
}

/** ย้ายเมนูที่หายไปจากต้นทางเข้าถังขยะ (ไม่ลบถาวร) — หนี้ A2 รอบที่ 142 */
async function pruneMissingRecipes(options: Options, importedIds: readonly string[]): Promise<void> {
  /* รายงานได้แม้เป็น --dry-run (การอ่านไม่ใช่การเขียน) — เฉพาะลงมือเท่านั้นที่ข้าม */
  if (!options.prune) return;
  const missing = prunePlan(await listRecipeIds(), importedIds);
  if (missing.length === 0) {
    log("🧹 --prune: ไม่มีเมนูค้างที่หายจากเว็บเดิม");
    return;
  }
  log(`🧹 --prune: พบเมนูที่หายจากเว็บเดิม ${missing.length} รายการ → ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? " …" : ""}`);
  if (!options.pruneApply || options.dryRun) {
    log("   (ยังไม่ทำอะไร — ใส่ --prune-apply เพื่อย้ายเข้าถังขยะ · กู้คืนได้เสมอ)");
    return;
  }
  for (const id of missing) await setRecipeTrashed(id, true, ACTOR);
  log(`   ✓ ย้ายเข้าถังขยะแล้ว ${missing.length} รายการ (กู้คืนได้จาก /admin/recipes → แท็บถังขยะ)`);
}

async function readLocal(dir: string, filename: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  return readFile(join(dir, filename), "utf8");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options.dryRun && !isDatabaseConfigured()) {
    log("✗ ต้องมี DATABASE_URL (หรือใช้ --dry-run เพื่อดูผลโดยไม่เขียน)");
    process.exitCode = 1;
    return;
  }

  const mediaCache: ImportMediaCache = new Map();
  const stats = { newImages: 0, reusedImages: 0, recipes: 0, skippedInvalid: 0, protectedEdits: 0 };
  /* id ที่เจอในรอบนี้ — ใช้คำนวณ --prune (ของที่หายจากต้นทาง) */
  const importedIds: string[] = [];
  const issues: string[] = [];

  const categoryHtml =
    options.dir === null ? await fetchText(`${BASE_URL}${CATEGORY_PATH}`) : await readLocal(options.dir, "category.html");
  const cards = parseRecipeCategoryPage(categoryHtml);
  log(`หมวดเมนูอาหาร: พบ ${cards.length} เมนู`);
  if (cards.length === 0) {
    log("⚠️ ไม่พบเมนูเลย — โครงสร้างเว็บเดิมอาจเปลี่ยน (ตรวจ `parseRecipeCategoryPage`)");
  }

  let order = 0;
  for (const card of cards) {
    let articleHtml: string;
    try {
      articleHtml =
        options.dir === null
          ? await fetchText(`${BASE_URL}${card.detailPath}`)
          : await readLocal(options.dir, `art-${card.sourceId}.html`);
    } catch (error) {
      log(`   ⚠️ ดึงบทความไม่ได้ (ข้าม): ${card.detailPath} — ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const article = parseRecipeArticlePage(articleHtml);
    /* ชื่อเมนู: ใช้ของหน้าบทความก่อน (แม่นกว่า) แล้วถอยไปใช้ชื่อบนการ์ดของหน้าหมวด */
    const titleTh = article.title.trim() === "" ? card.title : article.title;
    const input = {
      id: recipeIdOfSourceId(card.sourceId),
      sourceId: card.sourceId,
      sourceUrl: card.detailPath,
      titleTh,
      titleEn: "",
      videoId: article.videoId,
      publishedOn: article.publishedOn,
      sortOrder: order,
    };

    const recipeIssues = validateRecipeInput(input);
    if (recipeIssues.length > 0) {
      stats.skippedInvalid += 1;
      for (const issue of recipeIssues) issues.push(`${card.sourceId}: ${issue.path} — ${issue.message}`);
      log(`   ✗ ข้ามเมนูที่ข้อมูลไม่ผ่าน: ${titleTh}`);
      continue;
    }

    const coverUrl = card.coverUrl !== "" ? card.coverUrl : article.coverUrl;
    const coverId =
      options.dryRun || coverUrl === ""
        ? null
        : await ensureImportedMedia({
            url: coverUrl,
            altTh: recipeTitleOf(titleTh, "", "th"),
            altEn: recipeTitleOf(titleTh, "", "en"),
            cache: mediaCache,
            stats,
            actor: ACTOR,
            fetchBinary,
            log,
          });

    if (!options.dryRun) {
      /* หนี้ A1 (รอบที่ 142): ค่าเริ่มต้น = ไม่ทับงานที่แก้จากหลังบ้าน · ต้องทับจริงใช้ --force */
      const writeMode = options.force ? "replace" : "protect-edited";
      const result = await upsertRecipe(input, ACTOR, coverId, { writeMode });
      if (result.protectedEdit) {
        stats.protectedEdits += 1;
        log(`   ⓘ คงค่าเดิมไว้ (แก้จากหลังบ้าน): ${titleTh.slice(0, 50)}`);
      }
    }
    importedIds.push(input.id);

    stats.recipes += 1;
    order += 1;
    const date = article.publishedOn === null ? "ไม่มีวันที่" : article.publishedOn;
    log(`   · ${titleTh} — วีดีโอ ${article.videoId} · เผยแพร่ ${date}${options.dryRun ? "" : coverId === null ? " · ⚠️ ไม่มีภาพปก" : ""}`);
  }

  log("");
  log(`สรุป: เมนู ${stats.recipes} รายการ · ภาพใหม่ ${stats.newImages} · ใช้ภาพเดิม (sha256 ซ้ำ) ${stats.reusedImages}`);
  if (stats.skippedInvalid > 0) log(`      ข้ามเพราะข้อมูลไม่ผ่าน ${stats.skippedInvalid}`);
  log(`      คงค่าเดิมไว้ (แก้จากหลังบ้าน) ${stats.protectedEdits}`);
  if (options.dryRun) log("      (โหมด --dry-run: ไม่ได้เขียนลงฐานข้อมูล)");
  await pruneMissingRecipes(options, importedIds);
  if (stats.protectedEdits > 0 && !options.force) {
    log("");
    log("ℹ️ เมนูที่ถูกแก้จากหลังบ้านถูก “คงค่าเดิม” ไว้ — ถ้าต้องให้ค่าจากเว็บเดิมทับจริง ใช้ --force");
  }

  if (issues.length > 0) {
    log(`\n⚠️ ข้อที่ต้องดู (${issues.length}):`);
    for (const issue of issues.slice(0, 20)) log(`   · ${issue}`);
  }
}

main()
  .catch((error: unknown) => {
    log(`✗ นำเข้าไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

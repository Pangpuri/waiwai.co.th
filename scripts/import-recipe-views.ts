import { closePool, isDatabaseConfigured } from "@/db/pool";
import { listRecipes, setRecipeViewCount } from "@/lib/recipes/repository";
import { parseYouTubeViewCount } from "@/lib/recipes/youtube-views";
import { prepareTargetRun } from "./target-env.ts";

/**
 * รีเฟรช **ยอดวิว YouTube** ของเมนูอาหาร — รอบ 342
 *
 * ใช้
 *   npm run recipes:views                → ดึงยอดวิวทุกคลิปที่เผยแพร่ แล้วบันทึก
 *   npm run recipes:views -- --dry-run   → ดูผล ไม่เขียน
 *   npm run recipes:views -- --only=r297734,r297153 → เฉพาะบางเมนู
 *   npm run recipes:views -- --target    → ฐานข้อมูลปลายทาง
 *
 * กติกา
 * - ไม่ใช้ YouTube API key · อ่าน `"viewCount":"…"` จากหน้า watch (ดู `lib/recipes/youtube-views.ts`)
 * - ยอดวิวเป็นตัวเลขสาธารณะ ⇒ แสดงบนการ์ดได้ · ล้มเหลวรายคลิป = ข้าม ไม่ทำให้ทั้งรอบล้ม
 * - ควรรันเป็น cron รายวัน/รายสัปดาห์ (หรือกดรันมือ) — ไม่ยิง YouTube ตอนเปิดหน้าเว็บ
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36";

type Options = {
  readonly dryRun: boolean;
  readonly only: readonly string[];
};

function parseArgs(argv: readonly string[]): Options {
  let dryRun = false;
  let only: string[] = [];
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--only=")) {
      only = arg
        .slice("--only=".length)
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value !== "");
    }
  }
  return { dryRun, only };
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
        redirect: "follow",
      });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status} ${url}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
  }
  throw lastError instanceof Error ? lastError : new Error(`ดึงไม่สำเร็จ: ${url}`);
}

async function main(): Promise<void> {
  const target = prepareTargetRun(process.argv.slice(2), process.env, { log: console.log, error: console.error });
  if (!target.ok) process.exit(1);
  const options = parseArgs(target.argv);

  if (!options.dryRun && !isDatabaseConfigured()) {
    log("✗ ต้องมี DATABASE_URL (หรือใช้ --dry-run เพื่อดูผลโดยไม่เขียน)");
    process.exitCode = 1;
    return;
  }

  const recipes = await listRecipes();
  const wanted = options.only.length === 0 ? recipes : recipes.filter((recipe) => options.only.includes(recipe.id));
  if (wanted.length === 0) {
    log("ไม่พบเมนูที่ต้องรีเฟรช");
    return;
  }

  let updated = 0;
  let failed = 0;
  for (const recipe of wanted) {
    const url = `https://www.youtube.com/watch?v=${recipe.videoId}`;
    try {
      const html = await (await fetchWithRetry(url)).text();
      const count = parseYouTubeViewCount(html);
      if (count === null) {
        failed += 1;
        log(`   ⚠️ ${recipe.id} ${recipe.titleTh}: อ่านยอดวิวไม่ได้`);
        continue;
      }
      if (options.dryRun) {
        log(`   · ${recipe.id} ${recipe.titleTh}: ${String(count)}`);
        updated += 1;
        continue;
      }
      const ok = await setRecipeViewCount(recipe.id, count);
      if (ok) {
        updated += 1;
        log(`   ✓ ${recipe.id} ${recipe.titleTh}: ${String(count)}`);
      } else {
        failed += 1;
        log(`   ⚠️ ${recipe.id}: บันทึกไม่สำเร็จ`);
      }
    } catch (error) {
      failed += 1;
      log(`   ⚠️ ${recipe.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    /* เว้นจังหวะเล็กน้อย ไม่ให้ยิง YouTube ถี่เกิน */
    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  log(`\nสรุป: ${options.dryRun ? "จะอัปเดต" : "อัปเดต"} ${updated} คลิป · ล้มเหลว ${failed}`);
  if (options.dryRun) log("(โหมด --dry-run: ไม่ได้เขียนลงฐานข้อมูล)");
}

main()
  .catch((error: unknown) => {
    log(`✗ รีเฟรชไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

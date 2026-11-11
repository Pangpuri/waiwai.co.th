import { closePool, isDatabaseConfigured } from "@/db/pool";
import { parseNewsListingPage } from "@/lib/news/import-parse";
import { setNewsViewCountAtLeast } from "@/lib/news/repository";
import { prepareTargetRun } from "./target-env.ts";

/**
 * นำเข้า **ยอดวิวเดิมของข่าว** จากเว็บเดิม (waiwai.co.th/en/news/) — รอบ 342
 *
 * ใช้
 *   npm run news:views                → ดึง 11 หน้า + ตั้งยอดขั้นต่ำใน DB
 *   npm run news:views -- --dry-run   → ดูว่าจะตั้งอะไร ไม่เขียน
 *   npm run news:views -- --pages=1,2 → จำกัดหน้า (ใช้ตอนลอง)
 *   npm run news:views -- --target    → ฐานข้อมูลปลายทาง
 *
 * กติกา
 * - **ไม่ลดยอด** ที่สะสมจากหน้าเว็บแล้ว (`greatest(view_count, sourceCount)`)
 * - จับคู่ด้วย `source_id` (เลขเดียวกับพาธ `/news/<id>`)
 * - ตัวเลขบนหน้า list = "ยอดวิว" ของเว็บเดิม (ไอคอนตา) — ไม่ใช้ยอดคอมเมนต์
 */

const BASE_URL = "https://waiwai.co.th";
const LISTING_PATH = "/en/news/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36";
const DEFAULT_PAGES = 11;

type Options = {
  readonly dryRun: boolean;
  readonly pages: readonly number[];
};

function parseArgs(argv: readonly string[]): Options {
  let dryRun = false;
  let pages: number[] = [];
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--pages=")) {
      pages = arg
        .slice("--pages=".length)
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value) && value >= 1);
    }
  }
  return { dryRun, pages };
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, referer: `${BASE_URL}/`, accept: "text/html,*/*" },
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

  const pages = options.pages.length > 0 ? options.pages : Array.from({ length: DEFAULT_PAGES }, (_, i) => i + 1);
  const seen = new Map<string, number>();
  let fetchedCards = 0;

  for (const page of pages) {
    const url = page === 1 ? `${BASE_URL}${LISTING_PATH}` : `${BASE_URL}${LISTING_PATH}?page=${String(page)}`;
    const html = await (await fetchWithRetry(url)).text();
    const cards = parseNewsListingPage(html);
    if (cards.length === 0) {
      log(`   ⚠️ หน้า ${page}: ไม่พบการ์ดข่าว (ข้าม)`);
      continue;
    }
    for (const card of cards) {
      fetchedCards += 1;
      if (card.sourceId === "" || card.viewCount <= 0) continue;
      seen.set(card.sourceId, card.viewCount);
    }
    log(`   ✓ หน้า ${page}: ${cards.length} ข่าว`);
  }

  log(`\nพบข่าว ${fetchedCards} รายการ · มียอดวิว ${seen.size} รายการ`);

  let updated = 0;
  let missing = 0;
  for (const [sourceId, count] of seen) {
    if (options.dryRun) {
      if (updated < 10) log(`   · ${sourceId} → ${count}`);
      updated += 1;
      continue;
    }
    const ok = await setNewsViewCountAtLeast(sourceId, count);
    if (ok) updated += 1;
    else missing += 1;
  }

  log(`\nสรุป: ${options.dryRun ? "จะตั้งยอด" : "ตั้งยอดแล้ว"} ${updated} รายการ${missing === 0 ? "" : ` · ไม่พบข่าวใน DB ${missing}`}`);
  if (options.dryRun) log("(โหมด --dry-run: ไม่ได้เขียนลงฐานข้อมูล)");
}

main()
  .catch((error: unknown) => {
    log(`✗ นำเข้าไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

import { closePool, isDatabaseConfigured } from "@/db/pool";
import { ensureImportedMedia, type ImportMediaCache } from "@/lib/import/media";
import { newsImageVariantUrl, parseNewsArticlePage, parseNewsListingPage } from "@/lib/news/import-parse";
import { validateNewsBody, type NewsBlock } from "@/lib/news/body";
import { newsIdOfSourceId, validateNewsInput, type NewsInput } from "@/lib/news/model";
import { upsertNews } from "@/lib/news/repository";

/**
 * นำเข้าข่าวสาร & กิจกรรม จากเว็บเดิม (waiwai.co.th · `/th/news/`) — หน้า /news · รอบที่ 105
 *
 * ใช้
 *   npm run news:import                        → ดึงจากเว็บจริง (ต้องมี DATABASE_URL) · 151 ข่าว / 11 หน้า
 *   npm run news:import -- --dry-run           → แกะ + รายงานผล ไม่เขียนอะไร (ไม่โหลดรูป)
 *   npm run news:import -- --dir=<โฟลเดอร์>     → อ่าน HTML ที่บันทึกไว้ (`list.html` · `list_page_<N>.html` · `detail-<id>.html`)
 *   npm run news:import -- --pages=1,2         → จำกัดหน้า (ใช้ตอนลอง)
 *   npm run news:import -- --limit=5           → จำกัดจำนวนข่าวต่อรอบ
 *
 * กติกา
 * - **idempotent**: `id = n<source_id>` · รูป dedupe ด้วย sha256 · นำเข้าซ้ำ = แถวเดิม + ไม่กินที่เพิ่ม
 * - **รูปในเนื้อหาใช้รุ่นย่อ 1024×768** (มติเจ้าของ 2026-10-05) — ต้นฉบับ 6000×4000 หนัก 4–5 MB/ใบ
 *   ⚠️ กันพลาดด้วย `maxBytes` (1.5 MB): ถ้ารุ่นย่อใช้ไม่ได้ ภาพยักษ์จะถูกข้ามแทนที่จะเข้า DB
 * - ข้อมูลผ่านตัวตรวจทุกขั้น (`validateNewsInput` + `validateNewsBody`) · แถวที่ไม่ผ่าน = รายงาน + ข้าม
 * - ⚠️ ต้นฉบับเป็นของผู้ตราสินค้าเอง (เจ้าของสั่งให้นำเข้า) · **ห้าม commit HTML/รูปที่ดึงมา**
 */

const BASE_URL = "https://waiwai.co.th";
const LISTING_PATH = "/th/news/";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36";
const ACTOR = "import:waiwai.co.th";
/** ขนาดภาพในเนื้อหาที่ใช้เป็นหลัก (มติเจ้าของ 2026-10-05) */
const BODY_IMAGE_SIZE = "1024x768" as const;
/**
 * ⚠️ **CDN ของเว็บเดิมมีรุ่นย่อไม่ครบทุกไฟล์** (เจอจริงตอนนำเข้า: `_1024x768` ตอบ 404 ให้บางภาพ)
 * ⇒ ลองตามลำดับนี้ก่อน แล้วค่อยถอยไปใช้ต้นฉบับ (พร้อมเพดานขนาด)
 */
const BODY_IMAGE_FALLBACKS = [BODY_IMAGE_SIZE, "1200x900", "800x600", "600x450"] as const;
/** เพดานกันไฟล์ยักษ์หลุด (รุ่นย่อ ~243 KB · ต้นฉบับได้ถึง 5 MB) */
const MAX_IMAGE_BYTES = 1_500_000;

type Options = {
  readonly dryRun: boolean;
  readonly dir: string | null;
  readonly pages: readonly number[];
  readonly limit: number | null;
};

function parseArgs(argv: readonly string[]): Options {
  let dryRun = false;
  let dir: string | null = null;
  let pages: number[] = [];
  let limit: number | null = null;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--dir=")) dir = arg.slice("--dir=".length);
    else if (arg.startsWith("--pages=")) {
      pages = arg
        .slice("--pages=".length)
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value) && value >= 1);
    } else if (arg.startsWith("--limit=")) {
      const value = Number.parseInt(arg.slice("--limit=".length), 10);
      limit = Number.isFinite(value) && value > 0 ? value : null;
    }
  }

  return { dryRun, dir, pages, limit };
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
    await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
  }
  throw lastError instanceof Error ? lastError : new Error(`ดึงไม่สำเร็จ: ${url}`);
}

async function fetchText(url: string): Promise<string> {
  return (await fetchWithRetry(url)).text();
}

async function fetchBinary(url: string): Promise<Buffer> {
  return Buffer.from(await (await fetchWithRetry(url)).arrayBuffer());
}

/**
 * ดึงภาพแบบ **ลองครั้งเดียว** — ใช้ตอน "ไล่หารุ่นย่อ" เพราะ 404 ของ CDN เป็นคำตอบที่แน่นอน
 * (ลองซ้ำ 3 ครั้งจะทำให้แต่ละภาพที่ไม่มีรุ่นย่อเสียเวลา ~8 วิ · พบจริงตอนนำเข้า 151 ข่าว)
 */
async function fetchBinaryOnce(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, referer: `${BASE_URL}/`, accept: "image/*,*/*" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

/** เงียบ — ใช้กับความพยายามที่ "ล้มเหลวได้ตามปกติ" (การไล่หารุ่นย่อ) */
function quiet(): void {}

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
  const stats = { newImages: 0, reusedImages: 0, news: 0, skippedInvalid: 0, skippedImages: 0 };
  const issues: string[] = [];

  /* 1) เก็บการ์ดข่าวจากทุกหน้า (เว็บเดิมแบ่ง 15 ข่าว/หน้า · หน้าสุดท้าย 1) */
  const cards = [];
  const wantedPages = options.pages.length > 0 ? options.pages : Array.from({ length: 20 }, (_, index) => index + 1);
  for (const page of wantedPages) {
    let html: string;
    try {
      html =
        options.dir === null
          ? await fetchText(`${BASE_URL}${LISTING_PATH}?page=${page}`)
          : await readLocal(options.dir, page === 1 ? "list.html" : `list_page_${page}.html`);
    } catch (error) {
      log(`⚠️ ดึงหน้ารายการหน้า ${page} ไม่ได้ — หยุด (${error instanceof Error ? error.message : String(error)})`);
      break;
    }

    const pageCards = parseNewsListingPage(html);
    log(`หน้า ${page}: ${pageCards.length} ข่าว`);
    if (pageCards.length === 0) break;
    cards.push(...pageCards);
    if (options.limit !== null && cards.length >= options.limit) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const selected = options.limit === null ? cards : cards.slice(0, options.limit);
  log(`\nรวมการ์ดข่าวที่จะนำเข้า: ${selected.length} ข่าว\n`);

  /* 2) ทีละข่าว: ดึงหน้าข่าว → แกะเนื้อหา → รูปเข้าคลัง → เขียน */
  let order = 0;
  for (const card of selected) {
    order += 1;
    let articleHtml: string;
    try {
      articleHtml =
        options.dir === null
          ? await fetchText(`${BASE_URL}${card.detailPath}`)
          : await readLocal(options.dir, `detail-${card.sourceId}.html`);
    } catch (error) {
      log(`   ⚠️ ดึงข่าวไม่ได้ (ข้าม): ${card.detailPath} — ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const article = parseNewsArticlePage(articleHtml);
    const titleTh = article.title.trim() === "" ? card.title : article.title;
    const publishedLocal = article.publishedLocal ?? card.publishedLocal;
    const publishedLabel = article.publishedLabel !== "" ? article.publishedLabel : card.publishedLabel;

    const input: NewsInput = {
      id: newsIdOfSourceId(card.sourceId),
      sourceId: card.sourceId,
      sourceUrl: card.detailPath,
      titleTh,
      titleEn: "",
      excerptTh: card.excerpt.slice(0, 600),
      excerptEn: "",
      publishedLocal,
      publishedLabel,
    };

    const inputIssues = validateNewsInput(input);
    if (inputIssues.length > 0) {
      stats.skippedInvalid += 1;
      for (const issue of inputIssues) issues.push(`${card.sourceId}: ${issue.path} — ${issue.message}`);
      log(`   ✗ ข้ามข่าวที่ข้อมูลไม่ผ่าน: ${titleTh.slice(0, 60)}`);
      continue;
    }

    /* รูปปก: ภาพย่อ 400×300 จากหน้ารายการ */
    const coverUrl = newsImageVariantUrl(card.coverUrl, "400x300");
    const coverId =
      options.dryRun || coverUrl === ""
        ? null
        : await ensureImportedMedia({
            url: coverUrl,
            altTh: titleTh,
            altEn: titleTh,
            cache: mediaCache,
            stats,
            actor: ACTOR,
            fetchBinary,
            log,
            maxBytes: MAX_IMAGE_BYTES,
          });

    /* เนื้อหา: ย่อหน้า/หัวข้อ เก็บตามเดิม · รูป → mediaId */
    const blocks: NewsBlock[] = [];
    let imageIndex = 0;
    for (const block of article.body) {
      if (block.kind === "image") {
        imageIndex += 1;
        if (options.dryRun) continue;
        const altTh = `${titleTh} — ภาพที่ ${imageIndex}`;
        const altEn = `${titleTh} — image ${imageIndex}`;

        /*
          ลองรุ่นย่อตามลำดับ (CDN มีไม่ครบทุกไฟล์) → ถอยไปใช้ต้นฉบับเป็นทางสุดท้าย
          ⚠️ ต้นฉบับบางใบหนัก 4–5 MB ⇒ `maxBytes` เป็นด่านกันไว้ (ข้าม + รายงาน)
        */
        let mediaId: string | null = null;
        for (const size of BODY_IMAGE_FALLBACKS) {
          const url = newsImageVariantUrl(block.sourceUrl, size);
          if (url === "" || url === block.sourceUrl) break;
          mediaId = await ensureImportedMedia({
            url,
            altTh,
            altEn,
            cache: mediaCache,
            stats,
            actor: ACTOR,
            /* ไล่หารุ่นย่อ: ลองครั้งเดียว + ไม่ต้องเตือน (404 เป็นเรื่องปกติของ CDN นี้) */
            fetchBinary: fetchBinaryOnce,
            log: quiet,
            maxBytes: MAX_IMAGE_BYTES,
          });
          if (mediaId !== null) break;
        }
        if (mediaId === null) {
          mediaId = await ensureImportedMedia({
            url: block.sourceUrl,
            altTh,
            altEn,
            cache: mediaCache,
            stats,
            actor: ACTOR,
            fetchBinary,
            log,
            maxBytes: MAX_IMAGE_BYTES,
          });
        }

        if (mediaId === null) {
          stats.skippedImages += 1;
          continue;
        }
        blocks.push({ type: "image", mediaId, alt: altTh });
        continue;
      }
      blocks.push(block.kind === "heading" ? { type: "heading", text: block.text } : { type: "paragraph", text: block.text });
    }

    const bodyIssues = validateNewsBody(blocks, `${card.sourceId}.body`);
    if (!options.dryRun && bodyIssues.length > 0) {
      stats.skippedInvalid += 1;
      for (const issue of bodyIssues.slice(0, 3)) issues.push(`${card.sourceId}: ${issue.path} — ${issue.message}`);
      log(`   ✗ ข้ามข่าวที่เนื้อหาไม่ผ่าน: ${titleTh.slice(0, 60)}`);
      continue;
    }

    if (!options.dryRun) await upsertNews(input, ACTOR, coverId, blocks);

    stats.news += 1;
    if (order % 10 === 0 || order === selected.length) {
      const images = blocks.filter((block) => block.type === "image").length;
      log(`   … ${order}/${selected.length} · ล่าสุด: ${titleTh.slice(0, 50)} (${blocks.length} บล็อก · ${images} รูป)`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  log("");
  log(
    `สรุป: ข่าว ${stats.news} รายการ · ภาพใหม่ ${stats.newImages} · ใช้ภาพเดิม (sha256 ซ้ำ) ${stats.reusedImages}` +
      (stats.skippedImages > 0 ? ` · ข้ามภาพที่โหลดไม่ได้/ใหญ่เกิน ${stats.skippedImages}` : ""),
  );
  if (stats.skippedInvalid > 0) log(`      ข้ามข่าวเพราะข้อมูลไม่ผ่าน ${stats.skippedInvalid}`);
  if (options.dryRun) log("      (โหมด --dry-run: ไม่ได้เขียนลงฐานข้อมูล/ไม่ได้โหลดรูป)");

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

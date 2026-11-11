import { closePool, isDatabaseConfigured } from "@/db/pool";
import { ensureImportedMedia, type ImportMediaCache } from "@/lib/import/media";
import { productIdOfSourceId, productImageAlt, validateProductInput, type ProductInput } from "@/lib/products/model";
import { parseExportProductPage } from "@/lib/products/export-parse";
import { upsertProduct } from "@/lib/products/repository";
import { prepareTargetRun } from "./target-env.ts";

/**
 * นำเข้า **สินค้าส่งออก** จากเว็บเดิม — รอบ 342 (workplan 2026-11-11)
 *
 * ใช้
 *   npm run products:export-import                 → ดึงจากเว็บจริง (ต้องมี DATABASE_URL)
 *   npm run products:export-import -- --dry-run    → แกะ + รายงานผล ไม่เขียน/ไม่โหลดรูป
 *   npm run products:export-import -- --dir=<โฟลเดอร์> → อ่าน HTML ที่บันทึกไว้ (export-<id>.html)
 *   npm run products:export-import -- --target      → ฐานข้อมูลปลายทาง
 *
 * กติกา
 * - **idempotent**: source id = `x<รหัสหน้า><ลำดับ 2 หลัก>` ⇒ รันซ้ำได้ ไม่สร้างสินค้าซ้ำ
 * - **ไม่ทับงานที่แก้จากหลังบ้าน** (`protect-edited`) — ใช้ `--force` เมื่อต้องการทับจริง
 * - ภาพ GIF จากเว็บเดิมถูกแปลงเป็น WebP ก่อนเก็บใน `media` (คลังภาพรับ PNG/JPEG/WebP)
 *   ⚠️ ใช้ `sharp` ที่ติดมากับ Next อยู่แล้ว — ไม่ได้เพิ่ม dependency ใหม่
 * - ภาษาไทย/อังกฤษของสินค้าส่งออกแก้ได้จาก `/admin/products` หลังนำเข้า
 */

const BASE_URL = "https://waiwai.co.th";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36";
const ACTOR = "import:waiwai.co.th";

type ExportSource = {
  readonly categoryId: string;
  /** รหัสหน้าในเว็บเดิม — ใช้สร้าง source id ของสินค้า */
  readonly pageId: string;
  readonly path: string;
};

/**
 * 4 หน้าสินค้าส่งออกที่เจ้าของให้มา (2026-11-11)
 * ⚠️ 15235 เป็นหน้าของ **ควิกแสบ** ตามเนื้อหาปลายทาง (เจ้าของยืนยันให้ยึดตามหน้าจริง)
 */
const SOURCES: readonly ExportSource[] = [
  {
    categoryId: "instant-noodles",
    pageId: "15154",
    path: "/en/pages/15154-%E0%B9%84%E0%B8%A7%E0%B9%84%E0%B8%A7",
  },
  {
    categoryId: "quick-zabb",
    pageId: "15235",
    path: "/en/pages/15235-%E0%B8%9B%E0%B8%B0%E0%B8%AB%E0%B8%A1%E0%B8%B5%E0%B9%88%E0%B8%81%E0%B8%B6%E0%B9%88%E0%B8%87%E0%B8%AA%E0%B8%B3%E0%B9%80%E0%B8%A3%E0%B9%87%E0%B8%88%E0%B8%A3%E0%B8%B9%E0%B8%9B%E0%B8%84%E0%B8%A7%E0%B8%B4%E0%B8%81%E0%B9%81%E0%B8%AA%E0%B8%9A",
  },
  {
    categoryId: "serda",
    pageId: "15324",
    path: "/en/pages/15324-%E0%B8%9A%E0%B8%B0%E0%B8%AB%E0%B8%A1%E0%B8%B5%E0%B9%88%E0%B8%81%E0%B8%B6%E0%B9%88%E0%B8%87%E0%B8%AA%E0%B8%B3%E0%B9%80%E0%B8%A3%E0%B9%87%E0%B8%88%E0%B8%A3%E0%B8%B9%E0%B8%9B%E0%B8%8B%E0%B8%B7%E0%B8%AD%E0%B8%94%E0%B8%B0",
  },
  {
    categoryId: "rod-ded",
    pageId: "15361",
    path: "/en/pages/15361-%20%E0%B8%9C%E0%B8%87%E0%B8%9B%E0%B8%A3%E0%B8%B8%E0%B8%87%E0%B8%AA%E0%B8%B3%E0%B9%80%E0%B8%A3%E0%B9%87%E0%B8%88",
  },
];

type Options = {
  readonly dryRun: boolean;
  readonly dir: string | null;
  readonly force: boolean;
};

function parseArgs(argv: readonly string[]): Options {
  let dryRun = false;
  let dir: string | null = null;
  let force = false;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--force") force = true;
    else if (arg.startsWith("--dir=")) dir = arg.slice("--dir=".length);
  }
  return { dryRun, dir, force };
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

/** GIF → WebP (ย่อด้านกว้างไม่เกิน 900px · คงแอนิเมชันถ้ามี) — คลังภาพรับเฉพาะ PNG/JPEG/WebP */
async function gifToWebp(bytes: Buffer): Promise<Buffer> {
  const signature = bytes.subarray(0, 6).toString("ascii");
  if (!signature.startsWith("GIF8")) return bytes;

  const { default: sharp } = await import("sharp");
  return sharp(bytes, { animated: true })
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 86, effort: 4 })
    .toBuffer();
}

async function readLocal(dir: string, filename: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  return readFile(join(dir, filename), "utf8");
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

  const mediaCache: ImportMediaCache = new Map();
  const stats = { newImages: 0, reusedImages: 0, products: 0, skippedInvalid: 0, protectedEdits: 0, missingImages: 0 };
  const issues: string[] = [];

  for (const source of SOURCES) {
    log(`\n── ${source.categoryId} · หน้าส่งออก ${source.pageId} ──`);

    const html =
      options.dir === null
        ? await fetchText(`${BASE_URL}${source.path}`)
        : await readLocal(options.dir, `export-${source.pageId}.html`);
    const page = parseExportProductPage(html);
    log(`   ชื่อหน้า: ${page.title === "" ? "(อ่านไม่ได้)" : page.title} · พบ ${page.products.length} รายการ`);

    for (const product of page.products) {
      /* source id ต้องไม่ชนกับสินค้าในประเทศ (เช่น 15361 มีอยู่แล้ว) ⇒ ขึ้นต้นด้วย x */
      const sourceId = `x${source.pageId}${String(product.index + 1).padStart(2, "0")}`;
      const id = productIdOfSourceId(sourceId);
      const sortOrder = (product.index + 1) * 10;

      const input: ProductInput = {
        id,
        categoryId: source.categoryId,
        sourceId,
        sourceUrl: product.detailPath !== "" ? product.detailPath : source.path,
        market: "export",
        nameTh: product.nameTh,
        nameEn: product.nameEn,
        groupTh: "",
        groupEn: "",
        taglineTh: "",
        taglineEn: product.detailsEn,
        detailsTh: "",
        detailsEn: product.detailsEn,
        allergensTh: "",
        allergensEn: "",
        netWeightTh: "",
        netWeightEn: "",
        fdaNumber: "",
        packagingTh: product.packaging,
        packagingEn: product.packaging,
        sortOrder,
      };

      const productIssues = validateProductInput(input);
      if (productIssues.length > 0) {
        stats.skippedInvalid += 1;
        for (const issue of productIssues.slice(0, 2)) issues.push(`${sourceId}: ${issue.path} — ${issue.message}`);
        continue;
      }

      if (options.dryRun) {
        log(`   · ${sourceId} ${product.nameEn}${product.packaging === "" ? "" : ` · ${product.packaging}`}`);
        stats.products += 1;
        continue;
      }

      const imageId = await ensureImportedMedia({
        url: product.imageUrl,
        altTh: productImageAlt(product.nameTh, product.nameEn, "th"),
        altEn: productImageAlt(product.nameTh, product.nameEn, "en"),
        cache: mediaCache,
        stats,
        actor: ACTOR,
        fetchBinary,
        transform: (bytes) => gifToWebp(bytes),
        log,
        maxBytes: 5 * 1024 * 1024,
      });
      if (imageId === null) stats.missingImages += 1;

      const result = await upsertProduct(input, ACTOR, imageId, {
        imageMode: "keep",
        writeMode: options.force ? "replace" : "protect-edited",
      });
      stats.products += 1;
      if (result.protectedEdit) stats.protectedEdits += 1;
      log(`   ✓ ${sourceId} ${product.nameEn}${imageId === null ? " (ไม่มีภาพ)" : ""}`);
    }
  }

  log("");
  log(`สรุป: สินค้าส่งออก ${stats.products} รายการ · ภาพใหม่ ${stats.newImages} · ใช้ภาพเดิม ${stats.reusedImages}`);
  log(`      ข้ามเพราะข้อมูลไม่ผ่าน ${stats.skippedInvalid} · ไม่มีภาพ ${stats.missingImages} · คงค่าเดิม (แก้จากหลังบ้าน) ${stats.protectedEdits}`);
  if (options.dryRun) log("      (โหมด --dry-run: ไม่ได้เขียนลงฐานข้อมูล/ไม่โหลดภาพ)");
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

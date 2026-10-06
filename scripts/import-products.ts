import { closePool, isDatabaseConfigured } from "@/db/pool";
import { ensureImportedMedia, type ImportMediaCache } from "@/lib/import/media";
import { normalizeText, parseCategoryPage, parseDetailPage } from "@/lib/products/import-parse";
import {
  productIdOfSourceId,
  productImageAlt,
  validateCategoryInput,
  validateIngredientInput,
  validateProductInput,
  type ProductIngredientInput,
} from "@/lib/products/model";
import {
  replaceProductIngredients,
  upsertProduct,
  upsertProductCategory,
} from "@/lib/products/repository";

/**
 * นำเข้าสินค้าจากเว็บเดิม (waiwai.co.th) ลงฐานข้อมูล — S3 ส่วนที่ 3 · รอบที่ 103
 *
 * ใช้
 *   npm run products:import                    → ดึงจากเว็บจริง (ต้องมี DATABASE_URL)
 *   npm run products:import -- --dry-run       → แกะ + รายงานผล ไม่เขียนอะไร
 *   npm run products:import -- --dir=<โฟลเดอร์> → อ่าน HTML ที่บันทึกไว้ (ไม่ต้องต่อเน็ต)
 *   npm run products:import -- --force         → ⚠️ เขียนทับแม้สินค้านั้นถูกแก้จากหลังบ้าน (ค่าเริ่มต้น = ไม่ทับ)
 *
 * กติกา
 * - **idempotent**: id ของสินค้า = `p<source_id>` · หมวด = slug จากโค้ด ⇒ รันซ้ำได้ ไม่สร้างซ้ำ
 * - **รูป dedupe ด้วย sha256** ⇒ รันซ้ำไม่โหลด/เก็บไฟล์เดิมซ้ำ
 * - ข้อมูลทุกชิ้นผ่านตัวตรวจ (`lib/products/model.ts`) ก่อนเขียน · แถวที่ไม่ผ่าน = รายงาน + ข้าม
 * - ⚠️ ต้นฉบับเป็นของผู้ตราสินค้าเอง (เจ้าของสั่งให้นำเข้า) · **ห้าม commit HTML/รูปที่ดึงมา**
 */

const BASE_URL = "https://waiwai.co.th";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36";
const ACTOR = "import:waiwai.co.th";

/** 6 หมวดที่เจ้าของให้มา (2026-10-05) — จับคู่กับ slug ที่เจ้าของยืนยันแล้วใน `features/products/catalog.ts` */
const SOURCES = [
  { categoryId: "instant-noodles", sourceId: "40599", path: "/th/pages/40599-%E0%B9%84%E0%B8%A7%E0%B9%84%E0%B8%A7-1" },
  {
    categoryId: "quick-zabb",
    sourceId: "15235",
    path: "/th/pages/15235-%E0%B8%9A%E0%B8%B0%E0%B8%AB%E0%B8%A1%E0%B8%B5%E0%B9%88%E0%B8%81%E0%B8%B6%E0%B9%88%E0%B8%87%E0%B8%AA%E0%B8%B3%E0%B9%80%E0%B8%A3%E0%B9%87%E0%B8%88%E0%B8%A3%E0%B8%B9%E0%B8%9B%E0%B8%84%E0%B8%A7%E0%B8%B4%E0%B8%81%E0%B9%81%E0%B8%AA%E0%B8%9A",
  },
  {
    categoryId: "dried-vermicelli",
    sourceId: "43534",
    path: "/th/pages/43534-%E0%B9%80%E0%B8%AA%E0%B9%89%E0%B8%99%E0%B8%AB%E0%B8%A1%E0%B8%B5%E0%B9%88%20%E0%B9%81%E0%B8%A5%E0%B8%B0%E0%B8%81%E0%B9%8B%E0%B8%A7%E0%B8%A2%E0%B9%80%E0%B8%95%E0%B8%B5%E0%B9%8B%E0%B8%A2%E0%B8%A7%E0%B8%AD%E0%B8%9A%E0%B9%81%E0%B8%AB%E0%B9%89%E0%B8%87%E0%B9%84%E0%B8%A7%E0%B9%84%E0%B8%A7",
  },
  {
    categoryId: "serda",
    sourceId: "15324",
    path: "/th/pages/15324-%E0%B8%9A%E0%B8%B0%E0%B8%AB%E0%B8%A1%E0%B8%B5%E0%B9%88%E0%B8%81%E0%B8%B6%E0%B9%88%E0%B8%87%E0%B8%AA%E0%B8%B3%E0%B9%80%E0%B8%A3%E0%B9%87%E0%B8%88%E0%B8%A3%E0%B8%B9%E0%B8%9B%E0%B8%8B%E0%B8%B7%E0%B8%AD%E0%B8%94%E0%B8%B0",
  },
  {
    categoryId: "rod-ded",
    sourceId: "15361",
    path: "/th/pages/15361-%20%E0%B8%9C%E0%B8%87%E0%B8%9B%E0%B8%A3%E0%B8%B8%E0%B8%87%E0%B8%AA%E0%B8%B3%E0%B9%80%E0%B8%A3%E0%B9%87%E0%B8%88",
  },
  {
    categoryId: "noodie",
    sourceId: "40513",
    path: "/th/pages/40513-%E0%B8%99%E0%B8%B9%E0%B8%94%E0%B8%94%E0%B8%B5%E0%B9%89",
  },
] as const;

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

/** ดึงไฟล์ข้อความจากเว็บเดิม (มี Referer เพราะ CDN ปฏิเสธถ้าไม่มี) + ลองซ้ำ */
async function fetchText(url: string): Promise<string> {
  return (await fetchWithRetry(url)).text();
}

async function fetchBinary(url: string): Promise<Buffer> {
  const response = await fetchWithRetry(url);
  return Buffer.from(await response.arrayBuffer());
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

/** ทำให้ภาพอยู่ในคลังของเรา (ใช้ตัวช่วยกลางร่วมกับตัวนำเข้าเมนูอาหาร) */
async function ensureMedia(
  url: string,
  altTh: string,
  altEn: string,
  cache: ImportMediaCache,
  stats: { newImages: number; reusedImages: number },
): Promise<string | null> {
  return ensureImportedMedia({ url, altTh, altEn, cache, stats, actor: ACTOR, fetchBinary, log });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options.dryRun && !isDatabaseConfigured()) {
    log("✗ ต้องมี DATABASE_URL (หรือใช้ --dry-run เพื่อดูผลโดยไม่เขียน)");
    process.exitCode = 1;
    return;
  }

  const mediaCache: ImportMediaCache = new Map();
  const stats = { newImages: 0, reusedImages: 0, products: 0, ingredients: 0, skippedDuplicates: 0, skippedInvalid: 0, protectedEdits: 0 };
  const issues: string[] = [];

  for (const source of SOURCES) {
    log(`\n── ${source.categoryId} (เว็บเดิม ${source.sourceId}) ──`);

    const categoryHtml =
      options.dir === null ? await fetchText(`${BASE_URL}${source.path}`) : await readLocal(options.dir, `page-${source.sourceId}.html`);
    const parsedPage = parseCategoryPage(categoryHtml);

    const categoryIssues = validateCategoryInput({
      id: source.categoryId,
      sourceId: source.sourceId,
      descriptionTh: parsedPage.descriptionTh,
      descriptionEn: "",
    });
    for (const issue of categoryIssues) issues.push(`${source.categoryId}: ${issue.path} — ${issue.message}`);

    const categoryImageId =
      options.dryRun || parsedPage.heroImageUrl === ""
        ? null
        : await ensureMedia(parsedPage.heroImageUrl, source.categoryId, source.categoryId, mediaCache, stats);

    if (!options.dryRun) {
      await upsertProductCategory(
        { id: source.categoryId, sourceId: source.sourceId, descriptionTh: parsedPage.descriptionTh, descriptionEn: "" },
        ACTOR,
        categoryImageId,
      );
    }

    const seen = new Set<string>();
    let order = 0;
    for (const card of parsedPage.products) {
      if (seen.has(card.sourceId)) {
        stats.skippedDuplicates += 1;
        log(`   · ข้ามสินค้าซ้ำ (source ${card.sourceId}): ${card.nameTh}`);
        continue;
      }
      seen.add(card.sourceId);

      const productInput = {
        id: productIdOfSourceId(card.sourceId),
        categoryId: source.categoryId,
        sourceId: card.sourceId,
        sourceUrl: card.detailPath,
        nameTh: card.nameTh,
        nameEn: card.nameEn,
        groupTh: card.groupTh,
        groupEn: card.groupEn,
        taglineTh: "",
        taglineEn: "",
        detailsTh: "",
        allergensTh: "",
        netWeightTh: "",
        fdaNumber: "",
        packagingTh: "",
        /* ต้นฉบับเว็บเดิมมีแต่ไทย — ช่อง EN การตลาดกรอกเอง (รอบที่ 141) */
        detailsEn: "",
        allergensEn: "",
        netWeightEn: "",
        packagingEn: "",
        sortOrder: order,
      };

      /* หน้ารายละเอียด: คำโปรย + ส่วนผสม + ข้อความ (ถ้าดึงไม่ได้ = สินค้ายังอยู่ แต่ไม่มีรายละเอียด) */
      let ingredients: readonly ProductIngredientInput[] = [];
      try {
        const detailHtml =
          options.dir === null ? await fetchText(`${BASE_URL}${card.detailPath}`) : await readLocal(options.dir, `detail-${card.sourceId}.html`);
        const parsedDetail = parseDetailPage(detailHtml, { nameTh: card.nameTh });
        productInput.taglineTh = parsedDetail.taglineTh;
        productInput.detailsTh = parsedDetail.detailsTh;
        productInput.allergensTh = parsedDetail.allergensTh;
        productInput.netWeightTh = parsedDetail.netWeightTh;
        productInput.fdaNumber = parsedDetail.fdaNumber;
        productInput.packagingTh = parsedDetail.packagingTh;
        ingredients = parsedDetail.ingredients.map((item) => ({
          nameTh: normalizeText(item.nameTh),
          nameEn: normalizeText(item.nameEn),
          percentText: normalizeText(item.percentText),
        }));
      } catch (error) {
        log(`   ⚠️ ดึงหน้ารายละเอียดไม่ได้ (สินค้ายังถูกนำเข้า): ${card.detailPath} — ${error instanceof Error ? error.message : String(error)}`);
      }

      const productIssues = [
        ...validateProductInput(productInput),
        ...ingredients.flatMap((item, index) => validateIngredientInput(item, index)),
      ];
      if (productIssues.length > 0) {
        stats.skippedInvalid += 1;
        for (const issue of productIssues) issues.push(`${card.sourceId}: ${issue.path} — ${issue.message}`);
        log(`   ✗ ข้ามสินค้าที่ข้อมูลไม่ผ่าน: ${card.nameTh}`);
        continue;
      }

      const imageAltTh = productImageAlt(card.nameTh, card.nameEn, "th");
      const imageAltEn = productImageAlt(card.nameTh, card.nameEn, "en");
      const imageId =
        options.dryRun ? null : await ensureMedia(card.imageUrl, imageAltTh, imageAltEn, mediaCache, stats);

      if (!options.dryRun) {
        /*
          รอบที่ 140: ค่าเริ่มต้น **ไม่ทับงานที่แก้จากหลังบ้าน**
          - ถ้าแถวเดิมถูกแก้โดยผู้ใช้อื่น (updated_by ≠ import) ชั้นข้อมูลจะคงค่าเดิมไว้ แล้วคืน protectedEdit = true
          - รายการนั้น = **ข้ามส่วนผสมด้วย** เพราะส่วนผสมที่คนแก้มักแก้พร้อมกับตัวสินค้า (ทับไปก็เสียของ)
          - ต้องทับจริง (เช่น ต้นฉบับแก้ไขเยอะ) ⇒ ใส่ `--force`
        */
        const writeMode = options.force ? "replace" : "protect-edited";
        const result = await upsertProduct(productInput, ACTOR, imageId, { writeMode });
        if (result.protectedEdit) {
          stats.protectedEdits += 1;
          /* นับเป็น "พบ" ใน log ต่อหมวด แต่ไม่นับเป็นรายการที่เขียนทับ */
          order += 1;
          log(`   ⓘ คงค่าเดิมไว้ (แก้จากหลังบ้าน): ${card.nameTh}`);
          continue;
        }
        await replaceProductIngredients(productInput.id, ingredients);
      }

      stats.products += 1;
      stats.ingredients += ingredients.length;
      order += 1;
    }

    log(`   ✓ ${source.categoryId}: ${order} สินค้า · คำอธิบาย ${parsedPage.descriptionTh.length} ตัวอักษร`);
  }

  log("");
  log(`สรุป: หมวด ${SOURCES.length} · สินค้า ${stats.products} · ส่วนผสม ${stats.ingredients}`);
  log(`      ภาพใหม่ ${stats.newImages} · ใช้ภาพเดิม (sha256 ซ้ำ) ${stats.reusedImages}`);
  log(`      ข้ามสินค้าซ้ำ ${stats.skippedDuplicates} · ข้ามเพราะข้อมูลไม่ผ่าน ${stats.skippedInvalid}`);
  log(`      คงค่าเดิมไว้ (แก้จากหลังบ้าน) ${stats.protectedEdits}`);
  if (options.dryRun) log("      (โหมด --dry-run: ไม่ได้เขียนลงฐานข้อมูล)");
  if (stats.protectedEdits > 0 && !options.force) {
    log("");
    log("ℹ️ สินค้าที่ถูกแก้จากหลังบ้านถูก “คงค่าเดิม” ไว้ (ไม่ทับ)");
    log("   ถ้าต้องการให้ค่าจากเว็บเดิมทับจริง ใช้: npm run products:import -- --force");
  }

  if (issues.length > 0) {
    log(`\n⚠️ ข้อที่ต้องดู (${issues.length}):`);
    for (const issue of issues.slice(0, 20)) log(`   · ${issue}`);
  }
}

async function readLocal(dir: string, filename: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  return readFile(join(dir, filename), "utf8");
}

main()
  .catch((error: unknown) => {
    log(`✗ นำเข้าไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

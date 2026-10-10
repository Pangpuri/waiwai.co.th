import { readFileSync } from "node:fs";
import { join } from "node:path";

import { closePool, isDatabaseConfigured } from "@/db/pool";
import { aboutSourceImageUrls, buildAboutDocument } from "@/lib/about/document";
import { parseAboutPage, type AboutSource } from "@/lib/about/import-parse";
import { aboutSourceAssetOf } from "@/lib/about/source-assets";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { loadDocumentRow, saveDraft } from "@/lib/blocks/repository";
import { ensureImportedMedia, type ImportMediaCache, type ImportMediaStats } from "@/lib/import/media";

/**
 * นำเข้า **หน้า "บริษัท" (/about) จากหน้าต้นทาง** → เอกสารบล็อก (ฉบับร่าง) — รอบที่ 255 · หนี้ D-253-1
 *
 * ```bash
 * npm run about:import                  # ดึงหน้าจริง + นำรูปเข้าคลังภาพ + บันทึกฉบับร่าง
 * npm run about:import -- --dry-run     # แกะ + รายงานผล (ไม่ต่อเครือข่าย ไม่เขียนอะไร)
 * npm run about:import -- --dir=<โฟลเดอร์>   # อ่าน HTML ที่บันทึกไว้ (`page-11561.html`)
 * npm run about:import -- --force       # ทับฉบับร่างที่ "คนแก้" ไว้ (ค่าเริ่มต้น = ไม่ทับ)
 * npm run about:import -- --no-images   # ไม่นำรูป (ทดสอบโครงข้อความอย่างเดียว)
 * ```
 *
 * ## มติเจ้าของ 2026-10-09 (เย็น)
 * *"ดูท่าทางฝั่งบล็อคบริษัทจะเยอะไป เสี่ยงข้อมูลเพี้ยน เดี๋ยวเราใช้ภาพ ข้อความ และแบ่งบล็อค
 *   ตามความเหมาะสมจากแหล่งข้อมูลนี้"* ⇒ ยึดของจริงจาก `https://www.waiwai.co.th/th/pages/11561-บริษัท`
 *
 * ## กติกา
 * - **ไม่ทับงานที่คนแก้**: ถ้าฉบับร่างล่าสุดถูกเขียนโดย **คน** (ไม่ใช่ตัวนำเข้า) ⇒ ปฏิเสธ + บอกให้ใช้ `--force`
 * - **idempotent**: รูป dedupe ด้วย sha256 (`media.sha256`) · รันซ้ำ = ได้เอกสารเดิม
 * - ภาพทุกใบเข้าคลังภาพ (มติ D11) และบล็อกเก็บ **พาธ** `/media/<id>` (มติ D9)
 * - คำที่แก้ = เฉพาะในตาราง `ABOUT_TEXT_FIXES` (มติเจ้าของ) · ตัวเลขที่ต้นทางขัดกันเอง **คงไว้ทั้งคู่**
 * - ⚠️ ต้นฉบับเป็นของผู้ตราสินค้าเอง · **ห้าม commit HTML/รูปที่ดึงมา**
 */

const BASE_URL = "https://waiwai.co.th";
/** หน้าต้นทาง (ต้อง percent-encode ชื่อหน้าไทย) */
const PAGE_URL = `${BASE_URL}/th/pages/11561-${encodeURIComponent("บริษัท")}`;
/** ชื่อไฟล์เมื่อใช้ `--dir=` (บันทึกหน้าเว็บไว้ตรวจย้อนหลัง) */
const LOCAL_PAGE_FILE = "page-11561.html";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36";
/** ผู้เขียนที่บันทึกใน `page_document.updated_by` — ใช้แยก "งานคน" ออกจาก "งานตัวนำเข้า" */
const ACTOR = "import:waiwai.co.th/about";

type Options = {
  readonly dryRun: boolean;
  readonly dir: string | null;
  readonly force: boolean;
  readonly withImages: boolean;
};

function parseArgs(argv: readonly string[]): Options {
  let dryRun = false;
  let dir: string | null = null;
  let force = false;
  let withImages = true;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--force") force = true;
    else if (arg === "--no-images") withImages = false;
    else if (arg.startsWith("--dir=")) dir = arg.slice("--dir=".length);
  }

  return { dryRun, dir, force, withImages };
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

async function fetchWithRetry(url: string, accept: string): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, referer: `${BASE_URL}/`, accept },
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

/** รายงานโครงที่แกะได้ (ใช้ทั้ง `--dry-run` และก่อนนำเข้าจริง) */
function reportSource(source: AboutSource, urls: readonly string[]): void {
  const sections = source.nodes.filter((node) => node.kind === "section");
  const groups = source.nodes.filter((node) => node.kind === "images");
  log(`หน้าต้นทาง: "${source.pageTitle}" · แบนเนอร์ ${source.bannerUrl === null ? "ไม่มี" : "มี"}`);
  log(`ส่วน (section): ${String(sections.length)} · กลุ่มภาพ: ${String(groups.length)} · ภาพทั้งหมด: ${String(urls.length)}`);
  for (const node of source.nodes) {
    if (node.kind === "section") {
      const heading = node.heading === "" ? "(ไม่มีหัวข้อ — ส่วนเปิดเรื่อง)" : node.heading;
      log(`   § ${heading} — ${String(node.paragraphs.length)} ย่อหน้า`);
    } else {
      log(`   ▣ ภาพ ${String(node.urls.length)} ใบ`);
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  /* ── 1) อ่านหน้าต้นทาง ────────────────────────────────────────────────────── */
  const html =
    options.dir === null
      ? await (await fetchWithRetry(PAGE_URL, "text/html,*/*")).text()
      : readFileSync(join(options.dir, LOCAL_PAGE_FILE), "utf8");

  const source = parseAboutPage(html);
  const urls = aboutSourceImageUrls(source);
  reportSource(source, urls);

  if (source.nodes.length === 0) {
    log("✗ แกะเนื้อหาไม่ได้เลย — ตรวจว่าหน้าต้นทางเปลี่ยนโครงหรือไม่");
    process.exitCode = 1;
    return;
  }

  if (options.dryRun) {
    log("(dry-run) ไม่แตะฐานข้อมูล/ไม่โหลดรูป");
    return;
  }

  if (!isDatabaseConfigured()) {
    log("✗ ต้องมี DATABASE_URL (ดู .env.local)");
    process.exitCode = 1;
    return;
  }

  /* ── 2) นำรูปเข้าคลังภาพ (dedupe sha256) ──────────────────────────────────── */
  const cache: ImportMediaCache = new Map();
  const stats: ImportMediaStats = { newImages: 0, reusedImages: 0 };
  const paths = new Map<string, string>();

  if (options.withImages) {
    for (const url of urls) {
      const asset = aboutSourceAssetOf(url);
      const mediaId = await ensureImportedMedia({
        /* ไฟล์ที่เตรียมไว้ล่วงหน้าใช้พาธในเครื่องเป็นชื่อไฟล์ (นามสกุลตรงกับไบต์จริง) */
        url: asset === null ? url : asset.publicPath,
        altTh: source.pageTitle === "" ? "ภาพประกอบของบริษัท" : `ภาพประกอบของบริษัท ${source.pageTitle}`,
        altEn: "",
        cache,
        stats,
        actor: ACTOR,
        fetchBinary: async (target) => {
          if (asset !== null) return readFileSync(join("public", asset.publicPath.replace(/^\//, "")));
          const response = await fetchWithRetry(target, "image/*,*/*");
          return Buffer.from(await response.arrayBuffer());
        },
        log,
      });
      if (mediaId !== null) paths.set(url, `/media/${mediaId}`);
    }
    log(`รูป: ใหม่ ${String(stats.newImages)} · ใช้ของเดิม ${String(stats.reusedImages)} · ใช้ไม่ได้ ${String(urls.length - paths.size)}`);
  }

  /* ── 3) ประกอบเอกสาร + ตรวจด้วย parser กลาง ──────────────────────────────── */
  const document = buildAboutDocument(source, (url) => paths.get(url) ?? null);
  const parsed = parseBlockDocument("about", document);
  if (!parsed.ok) {
    log("✗ เอกสารไม่ผ่านตัวตรวจ:");
    for (const problem of parsed.problems) log(`   · ${problem}`);
    process.exitCode = 1;
    return;
  }

  /* ── 4) กันทับงานคน (ค่าเริ่มต้น) ─────────────────────────────────────────── */
  const current = await loadDocumentRow("about", "draft");
  if (current !== null && current.updatedBy !== null && current.updatedBy !== ACTOR && !options.force) {
    log("");
    log(`⚠️ ฉบับร่างของหน้านี้ถูกแก้ล่าสุดโดย "${current.updatedBy}" (ไม่ใช่ตัวนำเข้า)`);
    log(`   เมื่อ ${current.updatedAt} — ยังไม่เขียนทับ (กันงานคนหาย)`);
    log("   ถ้าต้องการแทนที่จริง ๆ ให้รัน: npm run about:import -- --force");
    process.exitCode = 2;
    return;
  }

  await saveDraft("about", parsed.document, ACTOR);
  log("");
  log(`✓ บันทึกฉบับร่างหน้า about แล้ว — ${String(parsed.document.blocks.length)} บล็อก (รูป ${String(paths.size)} ใบ)`);
  log("ℹ️ ตรวจพรีวิวที่ /admin/builder/about แล้วกด \"เผยแพร่\" เมื่อพร้อม (ยังไม่ขึ้นเว็บจนกว่าจะกด)");
}

try {
  await main();
} finally {
  await closePool();
}

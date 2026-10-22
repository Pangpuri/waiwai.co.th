import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { closePool, isDatabaseConfigured } from "@/db/pool";
import { isProductDetailPageLike } from "@/lib/blocks/product-detail";
import { loadDocumentRow, publishDraft, saveJsonDraft } from "@/lib/blocks/repository";
import {
  FOOTER_PAGE_KEY,
  defaultFooterConfig,
  footerErrorsOf,
  parseFooterConfig,
  validateFooterConfig,
  type FooterConfig,
} from "@/lib/chrome/footer";
import {
  NAVBAR_PAGE_KEY,
  applyPageMenu,
  defaultNavbarConfig,
  navbarErrorsOf,
  parseNavbarConfig,
  validateNavbarConfig,
  type NavbarConfig,
} from "@/lib/chrome/navbar";
import { th } from "@/lib/i18n/messages/th";
import { readImageInfo } from "@/lib/media/image-info";
import { findMediaIdBySha256, insertMedia, newMediaId } from "@/lib/media/repository";
import { defaultPages } from "@/lib/pages/model";
import { listPages } from "@/lib/pages/repository";
import { prepareTargetRun } from "./target-env.ts";

/**
 * ตั้ง "โลโก้เริ่มต้น" ของส่วนกลางเว็บ (navbar + footer) — 2026-10-22
 *
 * ## ทำไมต้องมีสคริปต์
 * - โลโก้ที่อัปโหลดจากหลังบ้านเก็บเป็น `/media/<id>` ซึ่ง **id ต่างกันในแต่ละฐานข้อมูล**
 *   ⇒ ห้าม hardcode id ในโค้ด (บทเรียน D-305-1: เอกสารชี้ media คนละชุด)
 * - สคริปต์นี้จึงหาภาพด้วย **sha256** ในฐานข้อมูลปลายทาง แล้วเขียน config ของ navbar/footer
 *   เป็น `/media/<id>` ของฐานข้อมูลนั้น ๆ — รันซ้ำได้ (idempotent)
 *
 * ## กติกา
 * - **ไม่ทับงานคน**: ถ้า config มีโลโก้ที่ไม่ใช่ค่าเริ่มต้นเดิมอยู่แล้ว ⇒ ข้าม (ต้องสั่ง `--force`)
 * - เขียนผ่าน `saveJsonDraft()` + `publishDraft()` เส้นทางเดียวกับปุ่มในหลังบ้าน (มีประวัติ/audit)
 * - `--dry-run` = ดูแผน ไม่เขียนอะไร · `--target` = ยิงฐานข้อมูลปลายทาง (ตาม `TARGET_DATABASE_URL`)
 * - ภาพถูกอ่านจาก `public/brand/logo-navbar-2026.png` (ตัดขอบโปร่งใส + palette PNG แล้ว)
 */

const ACTOR = "import:brand/logo";
const ASSET_PATH = "public/brand/logo-navbar-2026.png";
const FILENAME = "waiwai_logo_2026.png";
const ALT_TH = "โลโก้ไวไว — บริษัท โรงงานผลิตภัณฑ์อาหารไทย จำกัด";
const ALT_EN = "Wai Wai logo — Thai Food Products Factory Co., Ltd.";

/** โลโก้เดิมที่ยังอยู่ในฐานข้อมูล = เปลี่ยนได้โดยไม่ต้อง `--force` */
const OLD_DEFAULT_PATHS: ReadonlySet<string> = new Set(["/brand/logo-navbar.png", "/brand/waiwai_logo.png"]);

type Options = {
  readonly dryRun: boolean;
  readonly force: boolean;
};

function parseOptions(argv: readonly string[]): Options {
  return {
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
  };
}

type Logo = { readonly path: string; readonly altTh: string; readonly altEn: string };

function shouldReplaceLogo(logo: Logo | null, force: boolean): boolean {
  if (logo === null) return true;
  const current = logo.path.trim();
  if (current === "") return true;
  if (OLD_DEFAULT_PATHS.has(current)) return true;
  return force;
}

async function ensureLogoMedia(dryRun: boolean): Promise<{ readonly id: string; readonly created: boolean }> {
  const file = path.resolve(process.cwd(), ASSET_PATH);
  const bytes = readFileSync(file);
  const info = readImageInfo(bytes);
  if (info === null || info.mime !== "image/png") {
    throw new Error(`${ASSET_PATH} ต้องเป็น PNG ที่อ่านหัวไฟล์ได้`);
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = await findMediaIdBySha256(sha256);
  if (existing !== null) {
    console.log(`ℹ️  พบภาพเดิมในคลัง (sha256 ตรงกัน) ⇒ ใช้ /media/${existing}`);
    return { id: existing, created: false };
  }

  if (dryRun) {
    console.log("ℹ️  ยังไม่มีภาพนี้ในคลัง — โหมด --dry-run จะไม่สร้าง");
    return { id: "<new>", created: true };
  }

  const id = newMediaId();
  await insertMedia({
    id,
    filename: FILENAME,
    mime: info.mime,
    sizeBytes: bytes.length,
    width: info.width,
    height: info.height,
    data: bytes,
    altTh: ALT_TH,
    altEn: ALT_EN,
    createdBy: ACTOR,
    sha256,
  });
  console.log(`✅ นำภาพเข้าคลัง: /media/${id} (${Math.round(bytes.length / 1024)} KB · ${info.width}×${info.height})`);
  return { id, created: true };
}

async function navbarBase(): Promise<{ readonly config: NavbarConfig; readonly source: string }> {
  const published = await loadDocumentRow(NAVBAR_PAGE_KEY, "published");
  if (published !== null) {
    const parsed = parseNavbarConfig(published.raw, th);
    if (!parsed.ok) throw new Error(`navbar ฉบับเผยแพร่เสีย: ${parsed.problems.join(" · ")}`);
    return { config: parsed.config, source: "published" };
  }

  const draft = await loadDocumentRow(NAVBAR_PAGE_KEY, "draft");
  if (draft !== null) {
    const parsed = parseNavbarConfig(draft.raw, th);
    if (!parsed.ok) throw new Error(`navbar ฉบับร่างเสีย: ${parsed.problems.join(" · ")}`);
    return { config: parsed.config, source: "draft" };
  }

  /* ยังไม่เคยตั้งค่า = ใช้เมนูเริ่มต้น + ชื่อหน้าจาก DB (เหมือน loadNavbarConfig) */
  const pages = await listPages(defaultPages(th));
  const labels: Record<string, { th: string; en: string }> = {};
  const hidden: string[] = [];
  for (const page of pages) {
    if (page.inMenu && !isProductDetailPageLike(page.id)) {
      labels[page.id] = { th: page.nameTh, en: page.nameEn.trim() === "" ? page.nameTh : page.nameEn };
    } else {
      hidden.push(page.id);
    }
  }
  return { config: applyPageMenu(defaultNavbarConfig(th), { labels, hidden }), source: "default" };
}

async function footerBase(): Promise<{ readonly config: FooterConfig; readonly source: string }> {
  for (const [status, source] of [
    ["published", "published"],
    ["draft", "draft"],
  ] as const) {
    const row = await loadDocumentRow(FOOTER_PAGE_KEY, status);
    if (row === null) continue;
    const parsed = parseFooterConfig(row.raw, th);
    if (!parsed.ok) throw new Error(`footer ฉบับ${status === "published" ? "เผยแพร่" : "ร่าง"}เสีย: ${parsed.problems.join(" · ")}`);
    return { config: parsed.config, source };
  }
  return { config: defaultFooterConfig(th), source: "default" };
}

async function main(): Promise<void> {
  const target = prepareTargetRun(process.argv.slice(2), process.env, { log: console.log, error: console.error });
  if (!target.ok) process.exitCode = 1;
  if (!target.ok) return;

  if (!isDatabaseConfigured()) {
    console.error("✗ ไม่มี DATABASE_URL — ตั้งค่าใน .env.local หรือสั่ง --target");
    process.exitCode = 1;
    return;
  }

  const options = parseOptions(target.argv);
  console.log(`ℹ️  โลโก้: ${ASSET_PATH}${options.dryRun ? " · โหมด --dry-run (ไม่เขียน)" : ""}${options.force ? " · --force" : ""}`);

  try {
    const media = await ensureLogoMedia(options.dryRun);
    const navbar = await navbarBase();
    const footer = await footerBase();

    const navbarNeedsLogo = shouldReplaceLogo(navbar.config.logo, options.force);
    const footerNeedsLogo = shouldReplaceLogo(footer.config.logo, options.force);

    console.log(`ℹ️  navbar: ${navbar.source}${navbarNeedsLogo ? " → ตั้งโลโก้" : " → มีโลโก้ที่ตั้งเองแล้ว (ข้าม)"}`);
    console.log(`ℹ️  footer: ${footer.source}${footerNeedsLogo ? " → ตั้งโลโก้" : " → มีโลโก้ที่ตั้งเองแล้ว (ข้าม)"}`);

    if (!navbarNeedsLogo && !footerNeedsLogo) {
      console.log("✓ ไม่มีอะไรต้องเปลี่ยน (ใช้ --force ถ้าต้องการทับโลโก้ที่ตั้งไว้)");
      return;
    }

    const logo: Logo = { path: `/media/${media.id}`, altTh: ALT_TH, altEn: ALT_EN };

    if (navbarNeedsLogo) {
      const next: NavbarConfig = { ...navbar.config, logo };
      const errors = navbarErrorsOf(validateNavbarConfig(next));
      if (errors.length > 0) throw new Error(`navbar หลังใส่โลโก้ไม่ผ่านการตรวจ: ${errors.map((entry) => entry.code).join(" · ")}`);
      if (!options.dryRun) {
        await saveJsonDraft(NAVBAR_PAGE_KEY, next, ACTOR);
        await publishDraft(NAVBAR_PAGE_KEY, ACTOR, "ตั้งโลโก้เริ่มต้น navbar (2026)");
      }
      console.log(`✅ navbar ${options.dryRun ? "จะตั้ง" : "ตั้งแล้ว"}: ${logo.path}`);
    }

    if (footerNeedsLogo) {
      const next: FooterConfig = { ...footer.config, logo };
      const errors = footerErrorsOf(validateFooterConfig(next));
      if (errors.length > 0) throw new Error(`footer หลังใส่โลโก้ไม่ผ่านการตรวจ: ${errors.map((entry) => entry.code).join(" · ")}`);
      if (!options.dryRun) {
        await saveJsonDraft(FOOTER_PAGE_KEY, next, ACTOR);
        await publishDraft(FOOTER_PAGE_KEY, ACTOR, "ตั้งโลโก้เริ่มต้น footer (2026)");
      }
      console.log(`✅ footer ${options.dryRun ? "จะตั้ง" : "ตั้งแล้ว"}: ${logo.path}`);
    }

    if (!options.dryRun) {
      console.log("ℹ️  หน้าเว็บจะสดใหม่ในรอบ ISR ถัดไป (~5 นาที) หรือเมื่อ redeploy");
    }
  } finally {
    await closePool();
  }
}

await main();

/**
 * นำ **โลโก้ร้านค้า** จาก `public/shop-logos/*` + โลโก้แบรนด์ (Waiwai/Serda) เข้าคลังภาพ
 * แล้วเขียนรายการปุ่มของบล็อก "ที่ซื้อสินค้า" ในหน้าแรกเป็นค่าเริ่มต้นใหม่ — รอบที่ 333
 *
 * ```bash
 * npm run shop-logos:import              # นำเข้า + อัปเดตฉบับร่าง/ฉบับเผยแพร่ (รันซ้ำได้)
 * npm run shop-logos:import -- --dry-run # ดูว่าจะทำอะไร (ไม่เขียน DB)
 * npm run shop-logos:import -- --target # ฐานข้อมูลปลายทาง (ต้องมี TARGET_DATABASE_URL)
 * ```
 *
 * กติกา
 * - ภาพเก็บใน `media` (มติ D11) · บล็อกเก็บพาธ `/media/<id>` (มติ D9) · dedupe ด้วย sha256
 * - อัปเดต **ทั้ง draft และ published** เพื่อให้ค่าเริ่มต้นใหม่เห็นทั้งหลังบ้านและหน้าบ้าน
 *   (ไม่เรียก publishDraft เพราะจะเลื่อนลำดับบล็อกอื่นที่ยังไม่ได้เผยแพร่ขึ้นเว็บโดยไม่ตั้งใจ)
 * - ใช้ optimistic concurrency (`replaceDocumentRaw` + version) ⇒ ถ้ามีคนแก้หน้าพร้อมกันจะไม่ทับ
 * - ไม่ลบภาพเดิม/ไม่แตะข้อความอื่นของหน้า
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isDatabaseConfigured } from "@/db/pool";
import { defaultMarketplaceItems } from "@/lib/blocks/marketplace-links";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { loadDocumentRow, replaceDocumentRaw, type DocumentStatus } from "@/lib/blocks/repository";
import type { Block, BlockDocument, BlockMedia, MarketplaceLinkItem } from "@/lib/blocks/types";
import { ensureImportedMedia, type ImportMediaCache, type ImportMediaStats } from "@/lib/import/media";

import { prepareTargetRun } from "./target-env.ts";

const target = prepareTargetRun(process.argv.slice(2), process.env, { log: console.log, error: console.error });
if (!target.ok) process.exit(1);

const args = target.argv;
const dryRun = args.includes("--dry-run");
const ACTOR = "shop-logos-import";

type LogoFile = {
  readonly path: string;
  readonly bytes: Buffer;
  readonly altTh: string;
  readonly altEn: string;
};

type MediaFileMap = Map<string, { altTh: string; altEn: string }>;

function publicFileOf(path: string): Buffer {
  return readFileSync(join("public", path.replace(/^\/+/, "")));
}

/** เก็บไฟล์ที่ไม่ซ้ำจากรายการเริ่มต้น (โลโก้แพลตฟอร์ม) */
function collectFiles(items: readonly MarketplaceLinkItem[]): readonly LogoFile[] {
  const meta: MediaFileMap = new Map();
  const add = (media: BlockMedia | null): void => {
    if (media === null) return;
    const path = media.path.trim();
    if (path === "" || meta.has(path)) return;
    meta.set(path, { altTh: media.altTh, altEn: media.altEn });
  };

  for (const item of items) {
    add(item.logo);
  }

  return [...meta.entries()].map(([path, alt]) => ({
    path,
    bytes: publicFileOf(path),
    altTh: alt.altTh,
    altEn: alt.altEn,
  }));
}

function withImportedMedia(media: BlockMedia | null, imported: ReadonlyMap<string, string>): BlockMedia | null {
  if (media === null) return null;
  const id = imported.get(media.path);
  return id === undefined ? media : { ...media, path: `/media/${id}` };
}

function replaceItemsInBlocks(
  blocks: readonly Block[],
  items: readonly MarketplaceLinkItem[],
): { readonly blocks: readonly Block[]; readonly changed: boolean } {
  let changed = false;

  const next = blocks.map((block) => {
    if (block.type === "marketplaceLinks") {
      changed = true;
      return { ...block, items };
    }
    if (block.type === "row") {
      const columns = block.columns.map((column) => {
        const nested = replaceItemsInBlocks(column.blocks, items);
        if (nested.changed) changed = true;
        return { ...column, blocks: nested.blocks };
      });
      return { ...block, columns };
    }
    return block;
  });

  return { blocks: next, changed };
}

function replaceItemsInDocument(
  document: BlockDocument,
  items: readonly MarketplaceLinkItem[],
): BlockDocument | null {
  const replaced = replaceItemsInBlocks(document.blocks, items);
  return replaced.changed ? { ...document, blocks: replaced.blocks } : null;
}

async function updateStatus(
  status: DocumentStatus,
  items: readonly MarketplaceLinkItem[],
): Promise<{ readonly changed: boolean; readonly conflict: boolean; readonly missing: boolean }> {
  const row = await loadDocumentRow("home", status);
  if (row === null) return { changed: false, conflict: false, missing: true };

  const parsed = parseBlockDocument("home", row.raw);
  if (!parsed.ok) {
    console.log(`   ✗ ${status}: เอกสารไม่ผ่าน parser — ${parsed.problems.slice(0, 3).join(" · ")}`);
    return { changed: false, conflict: false, missing: false };
  }

  const updated = replaceItemsInDocument(parsed.document, items);
  if (updated === null) return { changed: false, conflict: false, missing: false };

  if (dryRun) return { changed: true, conflict: false, missing: false };

  const written = await replaceDocumentRaw("home", status, updated, ACTOR, row.version);
  return { changed: written, conflict: !written, missing: false };
}

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.error("✗ ต้องมี DATABASE_URL (ดู .env.local)");
    process.exit(1);
  }

  const defaultItems = defaultMarketplaceItems();
  const files = collectFiles(defaultItems);
  console.log(`พบไฟล์โลโก้ที่ต้องใช้ ${files.length} ไฟล์ · ปุ่มเริ่มต้น ${defaultItems.length} ปุ่ม`);

  const cache: ImportMediaCache = new Map();
  const stats: ImportMediaStats = { newImages: 0, reusedImages: 0 };
  const imported = new Map<string, string>();
  let failed = 0;

  for (const file of files) {
    if (dryRun) {
      console.log(`   ${file.path}`);
      continue;
    }
    const id = await ensureImportedMedia({
      url: file.path,
      altTh: file.altTh,
      altEn: file.altEn,
      cache,
      stats,
      actor: ACTOR,
      fetchBinary: async () => file.bytes,
      log: (message) => console.log(message),
    });
    if (id === null) {
      failed += 1;
      console.log(`   ✗ นำเข้าไม่ได้: ${file.path}`);
      continue;
    }
    imported.set(file.path, id);
    console.log(`   ${file.path} → /media/${id}`);
  }

  if (dryRun) {
    console.log(`(dry-run) จะนำเข้า ${files.length} ไฟล์ และอัปเดต items ของ draft/published — ไม่เขียนอะไรลงฐานข้อมูล`);
    return;
  }

  const items: readonly MarketplaceLinkItem[] = defaultItems.map((item) => ({
    ...item,
    logo: withImportedMedia(item.logo, imported),
  }));

  for (const status of ["draft", "published"] as const) {
    const result = await updateStatus(status, items);
    if (result.missing) {
      console.log(`   – ${status}: ยังไม่มีเอกสาร home (ข้าม)`);
      continue;
    }
    if (result.conflict) {
      console.log(`   ✗ ${status}: ถูกแก้ระหว่างนำเข้า (version ไม่ตรง) — ไม่ทับ`);
      failed += 1;
      continue;
    }
    console.log(`   ${result.changed ? "✓" : "–"} ${status}: ${result.changed ? "อัปเดตปุ่มแล้ว" : "ไม่มีบล็อกที่ซื้อสินค้า"}`);
  }

  console.log(`✓ นำเข้าเสร็จ: ภาพใหม่ ${stats.newImages} · ใช้ของเดิม ${stats.reusedImages} · ไฟล์ที่ใช้ไม่ได้ ${failed}`);
  if (failed > 0) process.exit(1);
}

await main();

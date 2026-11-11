import { closePool, getPool, isDatabaseConfigured } from "@/db/pool";
import { prepareTargetRun } from "./target-env.ts";

/**
 * รวมเบอร์โทรโรงงานเข้า **การ์ดโรงงาน** ในหน้า `/contact` — รอบ 342
 *
 * ที่มา (เจ้าของ 2026-11-11): บนมือถือ การ์ดเดิมเรียงเป็น
 * "โทรศัพท์ · โทรศัพท์ · โรงงาน 1 · โรงงาน 2" ⇒ ผู้ชมสับสน
 * ⇒ ย้ายเบอร์ 02-811-5101-6 เข้าการ์ดโรงงาน 1 และ 02-811-6210-6 เข้าการ์ดโรงงาน 2
 *    แล้วเอาการ์ด "โทรศัพท์" ที่แยกออกไปออก
 *
 * ใช้
 *   npm run contact:cards               → แก้ทั้งฉบับร่างและฉบับเผยแพร่
 *   npm run contact:cards -- --dry-run  → ดูว่าจะเปลี่ยนอะไร
 *   npm run contact:cards -- --target   → ฐานข้อมูลปลายทาง
 *
 * ⚠️ idempotent: ถ้าการ์ดมีเบอร์อยู่แล้ว = ไม่ทำอะไร
 */

type Localized = { readonly th: string; readonly en: string };
type CardItem = { readonly title: Localized; readonly body: Localized; readonly href: string; readonly image: unknown };
type BlockRecord = Record<string, unknown>;

const PHONE_1 = "02-811-5101-6";
const PHONE_2 = "02-811-6210-6";

type Options = { readonly dryRun: boolean };

function parseArgs(argv: readonly string[]): Options {
  return { dryRun: argv.includes("--dry-run") };
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function localized(value: unknown): Localized {
  if (!isRecord(value)) return { th: "", en: "" };
  return {
    th: typeof value["th"] === "string" ? value["th"] : "",
    en: typeof value["en"] === "string" ? value["en"] : "",
  };
}

function cardOf(value: unknown): CardItem | null {
  if (!isRecord(value)) return null;
  return {
    title: localized(value["title"]),
    body: localized(value["body"]),
    href: typeof value["href"] === "string" ? value["href"] : "",
    image: value["image"] ?? null,
  };
}

function hasPhone(body: Localized, phone: string): boolean {
  return body.th.includes(phone) || body.en.includes(phone);
}

/** แปลงเอกสาร contact — คืน null เมื่อไม่มีอะไรต้องแก้ */
function transformDocument(document: unknown): { readonly document: Record<string, unknown>; readonly changed: boolean } | null {
  if (!isRecord(document) || !Array.isArray(document["blocks"])) return null;
  let changed = false;
  const blocks = document["blocks"].map((rawBlock) => {
    if (!isRecord(rawBlock) || rawBlock["type"] !== "cards" || !Array.isArray(rawBlock["items"])) return rawBlock;

    const items = rawBlock["items"].map(cardOf).filter((item): item is CardItem => item !== null);
    const factory1 = items.find((item) => /โรงงาน\s*1|Factory\s*1/i.test(`${item.title.th} ${item.title.en}`));
    const factory2 = items.find((item) => /โรงงาน\s*2|Factory\s*2/i.test(`${item.title.th} ${item.title.en}`));
    if (factory1 === undefined || factory2 === undefined) return rawBlock;

    const merged1: CardItem = {
      ...factory1,
      href: `tel:+6628115101`,
      body: {
        th: hasPhone(factory1.body, PHONE_1) ? factory1.body.th : `${factory1.body.th}\nโทรศัพท์: ${PHONE_1}`,
        en: hasPhone(factory1.body, PHONE_1) ? factory1.body.en : `${factory1.body.en}\nPhone: ${PHONE_1}`,
      },
    };
    const merged2: CardItem = {
      ...factory2,
      href: `tel:+6628116210`,
      body: {
        th: hasPhone(factory2.body, PHONE_2) ? factory2.body.th : `${factory2.body.th}\nโทรศัพท์: ${PHONE_2}`,
        en: hasPhone(factory2.body, PHONE_2) ? factory2.body.en : `${factory2.body.en}\nPhone: ${PHONE_2}`,
      },
    };

    const nextItems = [merged1, merged2];
    const nextBlock: BlockRecord = {
      ...rawBlock,
      items: nextItems,
      columns: 2,
    };
    const before = JSON.stringify(rawBlock["items"]);
    const after = JSON.stringify(nextItems);
    if (before !== after) changed = true;
    return nextBlock;
  });

  if (!changed) return { document, changed: false };
  return { document: { ...document, blocks }, changed: true };
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

  const rows = await getPool().query<{ status: string; document: unknown }>(
    "select status, document from page_document where page = 'contact' order by status",
  );
  if (rows.rows.length === 0) {
    log("ไม่พบเอกสารหน้า contact");
    return;
  }

  for (const row of rows.rows) {
    const result = transformDocument(row.document);
    if (result === null || !result.changed) {
      log(`   · ${row.status}: ไม่มีอะไรต้องแก้`);
      continue;
    }
    if (options.dryRun) {
      log(`   · ${row.status}: จะรวมเบอร์โทรเข้าโรงงาน 1/2 และตัดการ์ดโทรศัพท์ออก`);
      continue;
    }
    await getPool().query(
      "update page_document set document = $2::jsonb, updated_at = now(), updated_by = 'system:contact-cards' where page = 'contact' and status = $1",
      [row.status, JSON.stringify(result.document)],
    );
    log(`   ✓ ${row.status}: รวมเบอร์โทรเข้าโรงงาน 1/2 แล้ว`);
  }
}

main()
  .catch((error: unknown) => {
    log(`✗ แก้ข้อมูลไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

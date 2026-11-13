import { closePool, isDatabaseConfigured } from "@/db/pool";
import { withAboutEnglish } from "@/lib/about/english";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { loadDocumentRow, publishDraft, saveDraft, setPageLive } from "@/lib/blocks/repository";
import { documentErrorsOf, validateDocument } from "@/lib/blocks/validate";
import { prepareTargetRun } from "./target-env.ts";

/**
 * เติม **ข้อความภาษาอังกฤษของหน้า "บริษัท" (/about)** ให้เอกสารบล็อกที่มีอยู่แล้ว
 * — รอบที่ 349 · ต่อจากงานนำเข้าหน้าบริษัท (รอบ 255)
 *
 * ```bash
 * npm run about:english                    # ดูว่าจะเติมอะไร (dry-run · ไม่เขียน)
 * npm run about:english -- --apply         # บันทึกเป็นฉบับร่าง
 * npm run about:english -- --apply --publish   # บันทึก + เผยแพร่ + เปิดใช้กับหน้าเว็บ
 * npm run about:english -- --target --apply --publish   # ทำกับฐานข้อมูลปลายทาง (คลาวด์)
 * npm run about:english -- --force         # เขียนทับ EN ที่มีอยู่ (ค่าเริ่มต้น = เติมเฉพาะช่องว่าง)
 * ```
 *
 * ## ทำไมต้องมีสคริปต์นี้ (ไม่ใช้ `about:import` อย่างเดียว)
 * หน้า `/about` บนคลาวด์เป็นเอกสารที่ **เจ้าของ/ตัวนำเข้าสร้างไว้แล้ว** และมีรูป/สไตล์/ลำดับบล็อก
 * ที่ผ่านการตรวจ · การรัน `about:import` ใหม่ทั้งหน้าจะสร้างเอกสารจากศูนย์ (id ใหม่/รูปใหม่)
 * ⇒ สคริปต์นี้แตะ **เฉพาะช่อง EN** ของบล็อก `richText` ที่จับคู่ได้ + `altEn` ของภาพ
 *    ข้อความไทย/รหัสบล็อก/สไตล์/ลำดับ ยังเหมือนเดิมทุกไบต์
 *
 * ## ความปลอดภัย
 * - ค่าเริ่มต้น = dry-run · ต้องส่ง `--apply` หรือ `--publish` จึงเขียน
 * - `--publish` ใช้เส้นทางเดียวกับปุ่มในหลังบ้าน (`publishDraft` + `setPageLive`) ⇒ มี revision + audit
 * - ตรวจ `parseBlockDocument` + `validateDocument` ก่อนเขียนทุกครั้ง (ด่านเดียวกับปุ่มเผยแพร่)
 * - ⚠️ หลังเผยแพร่จาก CLI **ไม่มีบริบท Next** ⇒ ไม่สั่ง revalidate · หน้าเว็บ (ISR 300 วิ) ใหม่เองใน ~5 นาที
 */

const PAGE = "about";
/** ผู้เขียนที่บันทึกใน `updated_by`/revision — แยกงานตัวนำเข้าออกจากงานคน */
const ACTOR = "import:waiwai.co.th/about-en";
const PUBLISH_NOTE = "about: fill English company text (waiwai.co.th/en/pages/11561-Company)";

type Options = {
  readonly apply: boolean;
  readonly publish: boolean;
  readonly overwrite: boolean;
  readonly unknown: readonly string[];
};

function parseArgs(argv: readonly string[]): Options {
  let apply = false;
  let publish = false;
  let overwrite = false;
  const unknown: string[] = [];

  for (const arg of argv) {
    if (arg === "--apply") apply = true;
    else if (arg === "--publish") publish = true;
    else if (arg === "--force") overwrite = true;
    else unknown.push(arg);
  }

  /* `--publish` ต้องบันทึกก่อนเผยแพร่ ⇒ ถือว่า apply ด้วย */
  return { apply: apply || publish, publish, overwrite, unknown };
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function reportMissing(report: ReturnType<typeof withAboutEnglish>["report"]): void {
  if (report.skipped.length === 0) return;
  log(`ℹ️ ข้าม ${String(report.skipped.length)} บล็อก:`);
  for (const entry of report.skipped) {
    const label =
      entry.reason === "already-filled"
        ? "มี EN อยู่แล้ว (ใช้ --force เพื่อเขียนทับ)"
        : entry.reason === "duplicate-role"
          ? "บทบาทซ้ำ"
          : "หัวข้อไม่ตรงกับส่วนที่รู้จัก";
    log(`   · ${entry.blockId} [${label}] ${entry.headingTh}`);
  }
}

async function main(): Promise<void> {
  /*
    `--target` = ยิงไปฐานข้อมูลปลายทาง (คลาวด์) — เรียกก่อนแตะ env/ฐานข้อมูลใด ๆ
    คืน argv ที่ตัด `--target` ออกแล้ว
  */
  const target = prepareTargetRun(process.argv.slice(2), process.env, { log: console.log, error: console.error });
  if (!target.ok) {
    process.exitCode = 1;
    return;
  }

  const options = parseArgs(target.argv);
  if (options.unknown.length > 0) {
    log(`✗ ไม่รู้จักตัวเลือก: ${options.unknown.join(" · ")}`);
    log("   ใช้: --apply · --publish · --force · --target (ต้องมี `--` หน้า npm run)");
    process.exitCode = 1;
    return;
  }

  if (!isDatabaseConfigured()) {
    log("✗ ต้องมี DATABASE_URL (ดู .env.local)");
    process.exitCode = 1;
    return;
  }

  const draft = await loadDocumentRow(PAGE, "draft");
  const published = draft === null ? await loadDocumentRow(PAGE, "published") : null;
  const source = draft ?? published;
  if (source === null) {
    log("✗ ยังไม่มีเอกสารหน้า about ทั้งฉบับร่างและฉบับเผยแพร่");
    log("   เริ่มจาก `npm run about:import` (หรือสร้างใน /admin/builder/about) ก่อน");
    process.exitCode = 1;
    return;
  }

  const parsed = parseBlockDocument(PAGE, source.raw);
  if (!parsed.ok) {
    log("✗ เอกสารในฐานข้อมูลไม่ผ่าน parser — ยังไม่เขียนอะไร:");
    for (const problem of parsed.problems) log(`   · ${problem}`);
    process.exitCode = 1;
    return;
  }

  const result = withAboutEnglish(parsed.document, { overwrite: options.overwrite });
  const errors = documentErrorsOf(validateDocument(result.document));
  if (errors.length > 0) {
    log("✗ เอกสารหลังเติม EN ไม่ผ่าน validator — ยังไม่เขียนอะไร:");
    for (const error of errors) log(`   · ${error.path} — ${error.code}${error.detail === null ? "" : ` (${error.detail})`}`);
    process.exitCode = 1;
    return;
  }

  log(`ℹ️ เอกสารหน้า ${PAGE}: ${String(parsed.document.blocks.length)} บล็อก (อ่านจาก${draft === null ? "ฉบับเผยแพร่" : "ฉบับร่าง"})`);
  log(`✓ เติม EN ${String(result.report.filled.length)} ส่วน: ${result.report.filled.map((entry) => entry.role).join(" · ")}`);
  log(`✓ เติมคำบรรยายภาพ EN ${String(result.report.imageAltsFilled)} ภาพ`);
  reportMissing(result.report);

  if (result.report.filled.length === 0 && result.report.imageAltsFilled === 0) {
    log("ℹ️ ไม่มีอะไรต้องเปลี่ยน (ช่อง EN ครบแล้ว) — ไม่เขียนฐานข้อมูล");
    return;
  }

  if (!options.apply) {
    log("(dry-run) ยังไม่เขียนฐานข้อมูล · ใส่ `--apply` เพื่อบันทึกฉบับร่าง หรือ `--publish` เพื่อเผยแพร่ด้วย");
    return;
  }

  /* ถ้าฉบับร่างเดิมไม่มี (อ่านฉบับเผยแพร่มา) การ saveDraft จะสร้างฉบับร่างให้ก่อนเผยแพร่ */
  await saveDraft(PAGE, result.document, ACTOR);
  log(`✓ บันทึกฉบับร่างหน้า ${PAGE} แล้ว`);

  if (!options.publish) {
    log("ℹ️ ยังไม่เผยแพร่ · ตรวจที่ /admin/builder/about แล้วกด \"เผยแพร่\" หรือรันซ้ำด้วย --publish");
    return;
  }

  const { revision } = await publishDraft(PAGE, ACTOR, PUBLISH_NOTE, { requireBlocks: true });
  await setPageLive(PAGE, true, ACTOR);
  log(`✓ เผยแพร่หน้า ${PAGE} รุ่น ${String(revision)} + เปิดใช้กับหน้าเว็บแล้ว`);
  log("ℹ️ CLI ไม่มีบริบท Next จึงไม่สั่ง revalidate — หน้าเว็บ (ISR 300 วิ) จะใหม่เองภายใน ~5 นาที");
}

try {
  await main();
} finally {
  await closePool();
}

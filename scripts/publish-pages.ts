/**
 * `npm run pages:publish` — **เผยแพร่หน้าที่พร้อมขึ้นเว็บ** จากบรรทัดคำสั่ง — รอบที่ 287 (2026-10-15)
 *
 * ```bash
 * npm run pages:publish -- --pages=about,certifications,executives --from-template --target
 * npm run pages:publish -- --pages=about --dry-run          # ดูว่าจะทำอะไร (ไม่เขียนอะไร)
 * npm run pages:publish -- --pages=about --actor=me@waiwai.co.th --target
 * ```
 *
 * ## ทำไมมีสคริปต์นี้ (เคสจริงจากเจ้าของ)
 * เจ้าของทักว่า *"หน้าบริษัทกับหน้าใบรับรองมาตรฐานใน vercel ยังไม่เปลี่ยน"*
 * ⇒ ตรวจแล้ว **ไม่ใช่โค้ดพัง**: หน้าเว็บเรนเดอร์จาก DB เฉพาะเมื่อมี **ฉบับเผยแพร่ + `is_live`**
 *    (มติเจ้าของ 240/253: "กดเผยแพร่ = ขึ้นเว็บ") แต่บนคลาวด์ `about` มีแค่ **ฉบับร่าง**
 *    ส่วน `certifications`/`executives` **ไม่มีเอกสารเลย** (สร้างไว้แต่ในเครื่อง)
 *    และก่อนหน้านี้ **ไม่มีทางเผยแพร่จาก CLI** (เป็น Server Action) ⇒ ต้องมีคนกดในหลังบ้านเท่านั้น
 *
 * ## หลักความปลอดภัย
 * 1. **ไม่เขียน SQL เอง** — เรียก `publishDraft()` + `setPageLive()` ตัวเดียวกับปุ่มในหลังบ้าน
 *    ⇒ ได้ประวัติรุ่น (revision) · audit log · เพดานประวัติ เหมือนการกดผ่านจอทุกอย่าง
 * 2. **ไม่ทับงานคน**: สร้างฉบับร่างจากเทมเพลต **เฉพาะเมื่อยังไม่มีฉบับร่าง** (`planPagePublish()`)
 * 3. **ต้องระบุ `--pages=` เสมอ** (ไม่มีค่าเริ่มต้น) — กันการเผยแพร่ทั้งเว็บโดยไม่ได้ตั้งใจ
 * 4. เทมเพลตต้องผ่าน **parser + validator** ก่อนเขียน (บทเรียนรอบที่ 257: เอกสารที่ error 1 ข้อ
 *    ทำให้กดเผยแพร่แล้วหน้าเว็บไม่เปลี่ยน) · ไม่ผ่าน = **ไม่เขียนอะไรเลย**
 *
 * ⚠️ สคริปต์นี้ **ไม่สั่ง revalidate หน้าเว็บ** (ไม่มีบริบทของ Next — ดูเหตุผลเดียวกับ
 *    `scripts/publish-scheduled.ts`) ⇒ หน้าเว็บเป็น ISR (300 วิ) จึงใหม่เองภายใน 5 นาที
 *    ต้องการให้ใหม่ทันทีให้กด "เผยแพร่" ในหลังบ้าน (มี `revalidatePath`)
 *
 * ตรรกะการตัดสินใจทั้งหมดอยู่ที่ `lib/blocks/publish-plan.ts` (บริสุทธิ์ + มีเทสต์)
 */
import { closePool, isDatabaseConfigured } from "@/db/pool";
import { hasBlockTemplate, buildBlockTemplate } from "@/lib/blocks/templates";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { documentErrorsOf, documentWarningsOf, validateDocument } from "@/lib/blocks/validate";
import { isPageLive, loadDocumentRow, publishDraft, saveDraft, setPageLive } from "@/lib/blocks/repository";
import { publishGoesLive } from "@/lib/blocks/live-scope";
import { PUBLISH_CLI_ACTOR, PUBLISH_CLI_NOTE, blockedHint, parsePageList, planPagePublish } from "@/lib/blocks/publish-plan";
import { aboutTemplateImageResolver, needsAboutTemplateImages } from "@/lib/blocks/template-images";
import { prepareTargetRun } from "./target-env.ts";

type Options = {
  readonly pages: readonly string[];
  readonly fromTemplate: boolean;
  readonly dryRun: boolean;
  readonly json: boolean;
  readonly actor: string;
};

const USAGE =
  "npm run pages:publish -- --pages=<a,b,c> [--from-template] [--dry-run] [--json] [--actor=email] [--target]\n" +
  "  --pages         หน้าที่จะเผยแพร่ (ต้องระบุ · คั่นด้วยจุลภาค) เช่น about,certifications\n" +
  "  --from-template ไม่มีฉบับร่าง ⇒ สร้างจากเทมเพลตก่อนเผยแพร่ (ไม่ทับฉบับร่างที่มีอยู่)\n" +
  "  --dry-run       รายงานว่าจะทำอะไร โดยไม่เขียนฐานข้อมูล\n" +
  "  --json          พ่นผลเป็น JSON\n" +
  "  --actor         ใครเป็นผู้ทำ (ลง audit log) · ค่าเริ่มต้น " + PUBLISH_CLI_ACTOR + "\n" +
  "  --target        ยิงฐานข้อมูลปลายทาง (TARGET_DATABASE_URL) แทนในเครื่อง\n";

function parseArgs(argv: readonly string[]): Options {
  let pages: readonly string[] = [];
  let invalidPages: readonly string[] = [];
  let fromTemplate = false;
  let dryRun = false;
  let json = false;
  let actor = PUBLISH_CLI_ACTOR;

  for (const arg of argv) {
    if (arg === "--from-template") fromTemplate = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--json") json = true;
    else if (arg.startsWith("--pages=")) {
      const parsed = parsePageList(arg.slice("--pages=".length));
      pages = parsed.pages;
      invalidPages = parsed.invalid;
    } else if (arg.startsWith("--actor=")) {
      const value = arg.slice("--actor=".length).trim();
      if (value !== "") actor = value;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(USAGE);
      process.exit(0);
    } else {
      process.stderr.write(`✗ ไม่รู้จักอาร์กิวเมนต์: ${arg}\n\n${USAGE}`);
      process.exit(1);
    }
  }

  if (invalidPages.length > 0) {
    process.stderr.write(`✗ หน้าเหล่านี้ไม่ใช่หน้าที่ตัวสร้างรู้จัก: ${invalidPages.join(", ")}\n`);
    process.exit(1);
  }
  if (pages.length === 0) {
    process.stderr.write(`✗ ต้องระบุ --pages=<a,b,c> (จงใจไม่มีค่าเริ่มต้น — กันการเผยแพร่ทั้งเว็บพลาด)\n\n${USAGE}`);
    process.exit(1);
  }

  return { pages, fromTemplate, dryRun, json, actor };
}

type PageOutcome =
  | {
      readonly page: string;
      readonly status: "published";
      readonly source: "draft" | "template";
      readonly revision: number;
      readonly live: boolean;
      readonly warnings: number;
    }
  | { readonly page: string; readonly status: "blocked"; readonly reason: "no-draft" | "no-template"; readonly hint: string }
  | { readonly page: string; readonly status: "failed"; readonly reason: string }
  | { readonly page: string; readonly status: "planned"; readonly source: "draft" | "template" };

/**
 * ทำงานกับ **หน้าเดียว** — คืนผลโดยไม่โยน error (หน้าเดียวพังไม่ทำให้ทั้งรอบพัง)
 * ⚠️ ลำดับเหมือน `publishAction` ในหลังบ้านเป๊ะ: บันทึกฉบับร่าง (ถ้าสร้างใหม่) → `publishDraft` → `setPageLive`
 */
async function publishPage(page: string, options: Options): Promise<PageOutcome> {
  const hasDraft = (await loadDocumentRow(page, "draft").catch(() => null)) !== null;
  const plan = planPagePublish({ page, hasDraft, hasTemplate: hasBlockTemplate(page), fromTemplate: options.fromTemplate });

  if (plan.kind === "blocked") {
    return { page, status: "blocked", reason: plan.reason, hint: blockedHint(plan.reason) };
  }

  if (options.dryRun) return { page, status: "planned", source: plan.source };

  try {
    /* ── 1) ยังไม่มีฉบับร่าง ⇒ สร้างจากเทมเพลต (ต้องผ่าน parser + validator ก่อนเขียน) ── */
    if (plan.source === "template") {
      const image = needsAboutTemplateImages(page) ? await aboutTemplateImageResolver() : undefined;
      const template = buildBlockTemplate(page, image === undefined ? undefined : { image });
      if (template === null) {
        return { page, status: "failed", reason: "สร้างเทมเพลตไม่ได้ (hasBlockTemplate กับตัวสร้างไม่ตรงกัน)" };
      }

      const parsed = parseBlockDocument(page, template);
      if (!parsed.ok) return { page, status: "failed", reason: "เทมเพลตไม่ผ่าน parser" };

      const issues = validateDocument(parsed.document);
      const errors = documentErrorsOf(issues);
      if (errors.length > 0) {
        return { page, status: "failed", reason: `เทมเพลตไม่ผ่าน validator (${errors.length} error)` };
      }

      await saveDraft(page, parsed.document, options.actor);
    }

    /* ── 2) เผยแพร่ + เปิดใช้บนหน้าเว็บ (นโยบาย "กดเผยแพร่ = ขึ้นเว็บ") ───────────────── */
    const { revision } = await publishDraft(page, options.actor, PUBLISH_CLI_NOTE);
    if (publishGoesLive(page)) await setPageLive(page, true, options.actor);

    const live = await isPageLive(page).catch(() => false);
    const draftRow = await loadDocumentRow(page, "draft").catch(() => null);
    const warnings =
      draftRow === null
        ? 0
        : (() => {
            const parsed = parseBlockDocument(page, draftRow.raw);
            return parsed.ok ? documentWarningsOf(validateDocument(parsed.document)).length : 0;
          })();

    return { page, status: "published", source: plan.source, revision, live, warnings };
  } catch {
    return { page, status: "failed", reason: "เขียนฐานข้อมูลไม่สำเร็จ (ดู log ของฐานข้อมูล)" };
  }
}

async function main(): Promise<void> {
  /* `--target` ต้องถูกจัดการก่อนใช้ env/ฐานข้อมูลใด ๆ (พิมพ์ปลายทางให้เห็นเสมอ) */
  const target = prepareTargetRun(process.argv.slice(2), process.env, { log: console.log, error: console.error });
  if (!target.ok) process.exit(1);

  const options = parseArgs(target.argv);

  if (!isDatabaseConfigured()) {
    process.stderr.write("✗ ไม่พบ DATABASE_URL — ใส่ใน .env.local ก่อน (ดู AGENTS.md § ตั้งค่า env)\n");
    process.exit(1);
  }

  const outcomes: PageOutcome[] = [];
  for (const page of options.pages) {
    outcomes.push(await publishPage(page, options));
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ dryRun: options.dryRun, actor: options.actor, outcomes }, null, 2)}\n`);
  } else {
    process.stdout.write(`\n${options.dryRun ? "ตรวจแผน" : "เผยแพร่"} ${options.pages.length} หน้า (actor=${options.actor})\n`);
    for (const outcome of outcomes) {
      if (outcome.status === "published") {
        process.stdout.write(
          `    · ${outcome.page.padEnd(15)} เผยแพร่รุ่นที่ ${outcome.revision} (จาก ${outcome.source}) · ` +
            `${outcome.live ? "หน้าเว็บใช้ฉบับนี้แล้ว" : "⚠️ หน้านี้ยังไม่อยู่ในนโยบายขึ้นเว็บอัตโนมัติ"}` +
            `${outcome.warnings > 0 ? ` · มีคำเตือน ${outcome.warnings} รายการ` : ""}\n`,
        );
      } else if (outcome.status === "planned") {
        process.stdout.write(`    · ${outcome.page.padEnd(15)} จะเผยแพร่ (จาก ${outcome.source}) — โหมด --dry-run ไม่เขียนอะไร\n`);
      } else if (outcome.status === "blocked") {
        process.stdout.write(`    · ${outcome.page.padEnd(15)} ข้าม — ${outcome.hint}\n`);
      } else {
        process.stdout.write(`    · ${outcome.page.padEnd(15)} ล้มเหลว — ${outcome.reason}\n`);
      }
    }
    process.stdout.write(
      "\nℹ️ หน้าเว็บจะสดใหม่เองภายใน ~5 นาที (ISR 300 วิ) — ต้องการทันทีให้กด \"เผยแพร่\" ในหลังบ้าน\n",
    );
  }

  await closePool();

  const bad = outcomes.filter((outcome) => outcome.status === "blocked" || outcome.status === "failed");
  if (bad.length > 0) process.exit(1);
}

await main();

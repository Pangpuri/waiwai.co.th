/**
 * นำ **เนื้อหาหน้า "ติดต่อเรา" (/contact) ที่ใช้งานอยู่** เข้าฐานข้อมูลเป็น **ฉบับร่าง** — รอบที่ 267 · มติเจ้าของ D27
 *
 * ```bash
 * npm run contact:import            # เขียนฉบับร่าง (รันซ้ำได้ · ไม่ทับงานที่คนแก้)
 * npm run contact:import -- --dry-run
 * npm run contact:import -- --force    # ทับฉบับร่างที่ "คนแก้" ไว้
 * ```
 *
 * คำเจ้าของ: *"หน้าติดต่อเรา ที่เมนู แก้ไขเนื้อหาหน้าติดต่อเรา เก็บของเก่าเป็นค่าเริ่มต้นใส่ db
 * ส่วนสองใหม่ปรับแต่งโยกย้าย จัดวางบล็อคได้คล้ายๆกับหน้าแรก"*
 *
 * กติกา (แบบเดียวกับ `scripts/import-about.ts` — รอบที่ 255)
 * - **เอกสารมาจากที่เดียว** กับเทมเพลตตั้งต้น (`lib/contact/document.ts`) ⇒
 *   "เริ่มจากเทมเพลต" กับ "นำเข้าของเดิม" ให้ผลเหมือนกันเป๊ะ
 * - **ผ่าน `parseBlockDocument` + `validateDocument` เสมอ** (ต้อง 0 error ก่อนเขียน — บทเรียนรอบที่ 257:
 *   เอกสารที่มี error จะกดเผยแพร่ไม่ได้ แล้วหน้าเว็บจะดูเหมือน "กดแล้วไม่เปลี่ยน")
 * - **ไม่ทับงานที่คนแก้**: ถ้าฉบับร่างล่าสุดเขียนโดยคน (ไม่ใช่ตัวนำเข้า) ⇒ ปฏิเสธ + บอกให้ใช้ `--force`
 * - **idempotent**: รันซ้ำ = ได้เอกสารเดิม (ไม่แตะของที่เผยแพร่อยู่)
 * - ⚠️ ตัวนำเข้าเขียน **เฉพาะฉบับร่าง** — การขึ้นเว็บยังต้องกด "เผยแพร่" ในตัวสร้าง (มติ D27 ข้อ 3 = ขึ้นเว็บทันทีเมื่อกด)
 */
import { closePool, isDatabaseConfigured } from "@/db/pool";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { loadDocumentRow, saveDraft } from "@/lib/blocks/repository";
import { documentErrorsOf, documentWarningsOf, validateDocument } from "@/lib/blocks/validate";
import { buildContactDocument } from "@/lib/contact/document";

/** ผู้เขียนที่บันทึกใน `page_document.updated_by` — ใช้แยก "งานคน" ออกจาก "งานตัวนำเข้า" */
const ACTOR = "import:contact/dictionary";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.error("✗ ต้องมี DATABASE_URL (ดู .env.local)");
    process.exit(1);
  }

  const document = buildContactDocument();
  log(`เอกสารตั้งต้นหน้า /contact: ${String(document.blocks.length)} บล็อก · ${document.blocks.map((block) => block.type).join(" → ")}`);

  /* ตรวจกับ parser + validator ของระบบเองก่อนเขียน (0 error เท่านั้น) */
  const parsed = parseBlockDocument("contact", JSON.parse(JSON.stringify(document)) as unknown);
  if (!parsed.ok) {
    console.error("✗ เอกสารไม่ผ่าน parser:");
    for (const problem of parsed.problems) console.error(`   · ${problem}`);
    process.exit(1);
  }
  const issues = validateDocument(parsed.document);
  const errors = documentErrorsOf(issues);
  const warnings = documentWarningsOf(issues);
  log(`validator: error ${String(errors.length)} · warning ${String(warnings.length)}`);
  for (const warning of warnings) log(`   ⚠️ ${warning.code} — ${warning.detail ?? ""}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`   ✗ ${error.code} — ${error.detail ?? ""} (${error.path})`);
    console.error("✗ ต้องแก้ให้ error = 0 ก่อนเขียนลงฐานข้อมูล");
    process.exit(1);
  }

  if (dryRun) {
    for (const block of parsed.document.blocks) {
      const cards = block.type === "cards" ? ` · ${String(block.items.length)} การ์ด` : "";
      const hrefs = block.type === "cards" ? block.items.map((card) => card.href).filter((href) => href !== "") : [];
      log(`   ${block.id.padEnd(9)} ${block.type}${cards}${hrefs.length === 0 ? "" : ` · ลิงก์: ${hrefs.join(", ")}`}`);
    }
    log("(dry-run) ไม่เขียนอะไรลงฐานข้อมูล");
    return;
  }

  const current = await loadDocumentRow("contact", "draft");
  const humanEdited = current !== null && current.updatedBy !== null && current.updatedBy !== "" && current.updatedBy !== ACTOR;
  if (humanEdited && !force) {
    log(`⛔ ฉบับร่างล่าสุดถูกแก้โดย "${current.updatedBy ?? "?"}" — ไม่ทับงานคน`);
    log("   ถ้าต้องการแทนที่จริง ๆ ให้รัน: npm run contact:import -- --force");
    return;
  }

  await saveDraft("contact", parsed.document, ACTOR);
  log(`✓ บันทึกฉบับร่างหน้า /contact แล้ว (ผู้เขียน: ${ACTOR})`);
  log("ℹ️ ขั้นต่อไป: เปิด /admin/builder/contact → ตรวจ/ย้ายบล็อก → กด “เผยแพร่” (ขึ้นเว็บทันทีตามมติ D27)");
}

await main();
await closePool();

/**
 * นำ **เอกสารตั้งต้นของหน้า "รายละเอียดหมวดสินค้า" 6 หน้า** เข้าฐานข้อมูลเป็น **ฉบับร่าง** — รอบที่ 270 · มติเจ้าของ
 *
 * ```bash
 * npm run products:detail-import            # เขียนฉบับร่าง 6 หน้า (ไม่ทับงานคน)
 * npm run products:detail-import -- --dry-run
 * npm run products:detail-import -- --force    # ทับฉบับร่างที่ "คนแก้" ไว้
 * ```
 *
 * คำเจ้าของ: *"จอตัวสร้างหน้า รายละเอียดหมวดสินค้า 6 หน้า จัดการใส่ db พร้อมบล็อคเอกสาร
 * จัดการเรื่องการกดเผยแพร่ให้ขึ้นเว็บ พร้อมมีค่าดีฟอล ตามหน้าหน้าบ้าน หลังบ้านเพิ่มลบ จัดการได้ตาม
 * โครงสร้างหน้าบ้าน จัดการเปลี่ยนภาพ แก้ไขส่วนต่างๆได้อิสระ แต่ต้องบันทึกค่าเริ่มต้นตอนนี้เอาไว้"*
 *
 * กติกา (แบบเดียวกับ `about:import` รอบ 255 · `contact:import` รอบ 267)
 * - เอกสารมาจาก **ที่เดียวกับเทมเพลต** (`lib/products/detail-document.ts`) ⇒ "เริ่มจากเทมเพลต" = คืนค่าเริ่มต้น
 * - **ผ่าน `parseBlockDocument` + `validateDocument` (0 error) ก่อนเขียน** (บทเรียนรอบ 257)
 * - **ไม่ทับงานที่คนแก้**: ฉบับร่างที่ผู้เขียนไม่ใช่ตัวนำเข้า ⇒ ข้าม + บอกให้ใช้ `--force`
 * - **idempotent** · เขียน **เฉพาะฉบับร่าง** (ไม่เผยแพร่เอง — เจ้าของกด "เผยแพร่" ในตัวสร้าง ซึ่งขึ้นเว็บทันทีตามนโยบาย)
 * - ค่าจริง (ชื่อ/คำอธิบาย/โลโก้) อ่านจากฐานข้อมูล ณ ตอนรัน ⇒ เปลี่ยนชื่อหมวดแล้วรันซ้ำได้ค่าใหม่
 */
import { closePool, isDatabaseConfigured } from "@/db/pool";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { productDetailPageId } from "@/lib/blocks/product-detail";
import { loadDocumentRow, saveDraft } from "@/lib/blocks/repository";
import { documentErrorsOf, documentWarningsOf, validateDocument } from "@/lib/blocks/validate";
import { buildProductDetailDocument, defaultProductDetailSlugs } from "@/lib/products/detail-document";
import { loadProductDetailCategoryValues } from "@/lib/products/repository";

/** ผู้เขียนที่บันทึกใน `page_document.updated_by` — ใช้แยก "งานคน" ออกจาก "งานตัวนำเข้า" */
const ACTOR = "import:products/detail-defaults";

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

  const values = await loadProductDetailCategoryValues();
  const slugs = defaultProductDetailSlugs();
  log(`หมวดที่จะนำเข้า: ${String(slugs.length)} หน้า · มีค่าจริงในฐานข้อมูล ${String(values.size)} หมวด`);

  let written = 0;
  let skipped = 0;

  for (const slug of slugs) {
    const pageId = productDetailPageId(slug);
    const document = buildProductDetailDocument(slug, values.get(slug) ?? null);
    if (document === null) {
      log(`   ⛔ ${pageId}: สร้างเอกสารไม่ได้ (ไม่รู้จักหมวดนี้) — ข้าม`);
      skipped += 1;
      continue;
    }

    /* ตรวจกับ parser + validator ของระบบเองก่อนเขียน (0 error เท่านั้น) */
    const parsed = parseBlockDocument(pageId, JSON.parse(JSON.stringify(document)) as unknown);
    if (!parsed.ok) {
      console.error(`   ✗ ${pageId}: เอกสารไม่ผ่าน parser`);
      for (const problem of parsed.problems) console.error(`      · ${problem}`);
      process.exit(1);
    }
    const issues = validateDocument(parsed.document);
    const errors = documentErrorsOf(issues);
    const warnings = documentWarningsOf(issues);
    if (errors.length > 0) {
      for (const error of errors) console.error(`   ✗ ${pageId}: ${error.code} — ${error.detail ?? ""} (${error.path})`);
      console.error("✗ ต้องแก้ให้ error = 0 ก่อนเขียนลงฐานข้อมูล");
      process.exit(1);
    }

    const hero = parsed.document.blocks[0];
    const title = hero !== undefined && hero.type === "hero" ? hero.title.th : "";
    const image = hero !== undefined && hero.type === "hero" && hero.image !== null ? hero.image.path : "(ไม่มีภาพ)";
    log(`   ${pageId.padEnd(28)} ${title} · ภาพ ${image} · warning ${String(warnings.length)}`);

    if (dryRun) continue;

    const current = await loadDocumentRow(pageId, "draft");
    const humanEdited =
      current !== null && current.updatedBy !== null && current.updatedBy !== "" && current.updatedBy !== ACTOR;
    if (humanEdited && !force) {
      log(`      ⏭ มีฉบับร่างที่ "${current.updatedBy ?? "?"}" แก้ไว้ — ไม่ทับ (ใช้ --force ถ้าต้องการแทนที่)`);
      skipped += 1;
      continue;
    }

    await saveDraft(pageId, parsed.document, ACTOR);
    written += 1;
  }

  if (dryRun) {
    log("(dry-run) ไม่เขียนอะไรลงฐานข้อมูล");
    return;
  }
  log(`✓ บันทึกฉบับร่าง ${String(written)} หน้า · ข้าม ${String(skipped)} หน้า (ผู้เขียน: ${ACTOR})`);
  log("ℹ️ ขั้นต่อไป: เปิด /admin/builder/product-<slug> → ตรวจ/เพิ่ม/ย้ายบล็อก → กด “เผยแพร่” (ขึ้นเว็บทันที)");
  log("ℹ️ ค่าเริ่มต้นย้อนกลับได้เสมอด้วยปุ่ม “เริ่มจากเทมเพลต” (สร้างจากเทมเพลต + ค่าจริงในฐานข้อมูล)");
}

await main();
await closePool();

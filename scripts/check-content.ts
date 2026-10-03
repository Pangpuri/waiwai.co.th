/**
 * `npm run check:content`
 *
 * ด่านตรวจเนื้อหาหลังบ้าน (เฟส B1) — รันได้ **โดยไม่ต้องมีฐานข้อมูล**
 *
 * ตรวจ 2 อย่าง
 * 1. **error** → ทำให้ด่านแดง: TH ว่าง · EN หายในฟิลด์ระดับส่วน/หน้า · EN มาไม่ครบทั้งรายการ ·
 *    ภาพไม่มี alt · เก็บ URL เต็มแทนพาธ (ผิดมติ D9) · ลำดับซ้ำ · ฟิลด์/ส่วนที่ไม่รู้จัก
 * 2. **warning** → ไม่ทำให้แดง แต่ต้องเห็น: ข้อความ placeholder (`XX` · `ข้อมูลทดสอบ`) · ภาพติดลายน้ำ
 *
 * ภายหลัง (B4) ด่านนี้จะตรวจ "เนื้อหาที่ดึงจาก DB" ด้วย validator ตัวเดียวกัน (lib/content/validate.ts)
 * — ตรรกะอยู่ที่เดียว ไม่มีสำเนากติกา
 */
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { HOME_SEED } from "@/lib/content/home-seed";
import { errorsOf, missingEnglishReport, validateContent, warningsOf } from "@/lib/content/validate";
import type { ContentIssue, IssueCode } from "@/lib/content/validate";

function summarizeByCode(issues: readonly ContentIssue[]): readonly (readonly [IssueCode, number])[] {
  const counts = new Map<IssueCode, number>();
  for (const issue of issues) {
    counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function main(): void {
  const spec = HOME_PAGE_SPEC;
  const content = HOME_SEED;

  let sectionFields = 0;
  let itemGroups = 0;
  let itemFields = 0;
  let itemRows = 0;

  for (const section of spec.sections) {
    sectionFields += section.fields.length;
    for (const group of section.items) {
      itemGroups += 1;
      itemFields += group.fields.length;
      const rows = content.sections[section.key]?.items[group.key] ?? [];
      itemRows += rows.length;
    }
  }

  const issues = validateContent(spec, content);
  const errors = errorsOf(issues);
  const warnings = warningsOf(issues);
  const missingEn = missingEnglishReport(spec, content);

  process.stdout.write(
    `  หน้า ${spec.page}: ${spec.sections.length} section · ${sectionFields} ฟิลด์ระดับส่วน · ` +
      `${itemGroups} กลุ่มรายการ · ${itemRows} แถว · ${itemFields} ฟิลด์ระดับรายการ\n`,
  );
  process.stdout.write(`  error ${errors.length} · warning ${warnings.length} · รายการที่ยังไม่มี EN ${missingEn.length}\n`);

  if (warnings.length > 0) {
    process.stdout.write("\n  คำเตือน (ไม่ทำให้ด่านแดง):\n");
    for (const [code, count] of summarizeByCode(warnings)) {
      process.stdout.write(`    · ${code} = ${count}\n`);
    }
    if (missingEn.length > 0) {
      process.stdout.write(`    · ยังไม่มี EN: ${missingEn.join(", ")}\n`);
    }
  }

  if (errors.length > 0) {
    process.stderr.write(`\n✗ check:content ไม่ผ่าน (${errors.length} error)\n\n`);
    for (const issue of errors) {
      process.stderr.write(`  [${issue.code}] ${issue.path}${issue.detail === "" ? "" : ` — ${issue.detail}`}\n`);
    }
    process.stderr.write(
      "\n  กติกาอยู่ที่ lib/content/validate.ts · โครงฟิลด์อยู่ที่ lib/content/model.ts\n" +
        "  (มติ D3: EN บังคับเฉพาะฟิลด์ระดับส่วน/หน้า · มติ D9: เก็บพาธไฟล์ ไม่เก็บ URL)\n\n",
    );
    process.exit(1);
  }

  process.stdout.write("✓ check:content ผ่าน\n");
}

main();

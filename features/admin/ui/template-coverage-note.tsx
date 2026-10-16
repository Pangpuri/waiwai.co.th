/**
 * กล่องคำเตือน "ส่วนที่เทมเพลตนี้ยังไม่ครอบคลุม" (S2)
 *
 * ทำไมต้องเป็นคอมโพเนนต์กลาง
 * - ต้องแสดง **สองที่**: สถานะ "ยังไม่มีฉบับร่าง" (ก่อนตัดสินใจเริ่มใช้บล็อก) และข้างสวิตช์
 *   "ใช้กับหน้าเว็บจริง" (ก่อนเปิดใช้จริง) — เคสจริงที่เจอจากการยิงจริงรอบที่ 83:
 *   ตอนแรกแสดงเฉพาะที่สอง ⇒ หน้าที่ว่างไม่เห็นคำเตือนเลย ซึ่งสายเกินไป
 * - เป็น JSX ล้วน (ไม่มี hook/ไม่แตะ DB) ⇒ ใช้ได้ทั้ง server component และ client component
 *
 * 🆕 รอบที่ 290 (หนี้ D-252-2): แต่ละส่วนเป็น **ลิงก์ที่ไปถึงจริง** ไม่ใช่ข้อความเฉย ๆ
 *   · ปลายทางมาจากทะเบียนกลาง `coveragePartTarget()` (`lib/blocks/templates.ts`)
 *     — สมอย (anchor) ในหน้าตัวสร้างเอง หรือลิงก์ไปจอที่เป็นเจ้าของส่วนนั้น
 *   · ใช้ `<a href>` ล้วน ⇒ กดได้ทั้งก่อนและหลังไฮเดรต (ไม่ต้องมี JavaScript)
 *   · ⚠️ ปลายทางแบบ `#…` ต้องมี `id="…"` จริงในหน้าจอ (มีเทสต์บังคับที่ `scripts/test-templates.ts`)
 */
export type TemplateCoveragePart = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
};

export type TemplateCoverage = {
  readonly title: string;
  readonly note: string;
  readonly noneLabel: string;
  /** บอกผู้ใช้ว่ารายการด้านบนกดได้ (แสดงเฉพาะตอนมีส่วนที่ขาด) */
  readonly jumpHint: string;
  readonly parts: readonly TemplateCoveragePart[];
};

export function TemplateCoverageNote({ title, note, noneLabel, jumpHint, parts }: TemplateCoverage) {
  return (
    <div className="border-line bg-surface rounded-xl border p-3 text-xs">
      <p className="text-fg font-semibold">{title}</p>
      {parts.length === 0 ? (
        <p className="text-fg-muted">{noneLabel}</p>
      ) : (
        <>
          <ul className="text-fg-muted mt-1 list-disc pl-4">
            {parts.map((part) => (
              <li key={part.id}>
                <a
                  href={part.href}
                  className="text-link focus-visible:ring-ring rounded underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {part.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-fg-muted mt-1">{jumpHint}</p>
          <p className="text-fg-muted mt-1">{note}</p>
        </>
      )}
    </div>
  );
}

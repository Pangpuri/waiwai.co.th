/**
 * กล่องคำเตือน "ส่วนที่เทมเพลตนี้ยังไม่ครอบคลุม" (S2)
 *
 * ทำไมต้องเป็นคอมโพเนนต์กลาง
 * - ต้องแสดง **สองที่**: สถานะ "ยังไม่มีฉบับร่าง" (ก่อนตัดสินใจเริ่มใช้บล็อก) และข้างสวิตช์
 *   "ใช้กับหน้าเว็บจริง" (ก่อนเปิดใช้จริง) — เคสจริงที่เจอจากการยิงจริงรอบที่ 83:
 *   ตอนแรกแสดงเฉพาะที่สอง ⇒ หน้าที่ว่างไม่เห็นคำเตือนเลย ซึ่งสายเกินไป
 * - เป็น JSX ล้วน (ไม่มี hook/ไม่แตะ DB) ⇒ ใช้ได้ทั้ง server component และ client component
 */
export type TemplateCoverage = {
  readonly title: string;
  readonly note: string;
  readonly noneLabel: string;
  readonly parts: readonly string[];
};

export function TemplateCoverageNote({ title, note, noneLabel, parts }: TemplateCoverage) {
  return (
    <div className="border-line bg-surface rounded-xl border p-3 text-xs">
      <p className="text-fg font-semibold">{title}</p>
      {parts.length === 0 ? (
        <p className="text-fg-muted">{noneLabel}</p>
      ) : (
        <>
          <ul className="text-fg-muted mt-1 list-disc pl-4">
            {parts.map((part) => (
              <li key={part}>{part}</li>
            ))}
          </ul>
          <p className="text-fg-muted mt-1">{note}</p>
        </>
      )}
    </div>
  );
}

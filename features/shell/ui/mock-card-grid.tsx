import { MOCK_CARD_COUNT } from "@/features/shell/mock-cards";

import { MockFigure, type MockFigureIcon } from "./mock-figure";

/**
 * กริดการ์ดตัวอย่าง (mockup) — ใช้กับหน้าที่ "ยังไม่มีข้อมูลจริง"
 *
 * ผู้ใช้ระบุรูปแบบว่า "เรียง 3 การ์ด 2 แถว" → บนจอใหญ่ 3 คอลัมน์ × 2 แถว = 6 ใบ
 * (จอเล็กย่อเป็น 2 คอลัมน์ แล้ว 1 คอลัมน์ตามลำดับ เพื่อไม่ให้การ์ดแคบเกินอ่าน)
 * จำนวนมาจาก `features/shell/mock-cards.ts` เพื่อให้ unit test ตรวจได้ (เทสต์โหลด .tsx ไม่ได้)
 *
 * ⚠️ ทุกใบเป็นข้อมูลทดสอบ: ชื่อการ์ดคือ `<ป้ายจากพจนานุกรม> <ลำดับ>` เช่น "เมนูทดสอบ 1"
 *    ไม่มีคำบรรยาย/ตัวเลขที่แต่งขึ้นเอง — ตามข้อตกลง placeholder ของโปรเจกต์
 *
 * การ์ด **ไม่เป็นลิงก์** โดยตั้งใจ เพราะยังไม่มีปลายทาง (จะเปลี่ยนเป็นลิงก์เมื่อทำหน้ารายละเอียด)
 */

type MockCardGridProps = {
  /** ใช้ทำ key ให้ไม่ชนกันเมื่อมีมากกว่าหนึ่งกริดในหน้าเดียว */
  readonly idPrefix: string;
  /** ป้ายชื่อการ์ด — จะถูกต่อด้วยลำดับ เช่น "เมนูทดสอบ" → "เมนูทดสอบ 1" */
  readonly titlePrefix: string;
  /** ป้ายคำบรรยายใต้ภาพ — ต่อด้วยลำดับเช่นกัน */
  readonly captionPrefix: string;
  /** ป้ายมุมภาพ (ต้องบอกว่าเป็นภาพตัวอย่าง) */
  readonly badge: string;
  /** ป้ายสั้นบนการ์ด เช่น "XX" (เวลา/ระดับ) หรือ "XX" (หมวดข่าว) */
  readonly metaLabel: string;
  readonly icon: MockFigureIcon;
  readonly count?: number;
};

export function MockCardGrid({
  idPrefix,
  titlePrefix,
  captionPrefix,
  badge,
  metaLabel,
  icon,
  count = MOCK_CARD_COUNT,
}: MockCardGridProps) {
  const indexes = Array.from({ length: count }, (_, index) => index + 1);

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {indexes.map((index) => (
        <li
          key={`${idPrefix}-${index}`}
          className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4"
        >
          <MockFigure
            badge={badge}
            caption={`${captionPrefix} ${index}`}
            icon={icon}
            ratio="standard"
            tone="yellow"
          />

          <span className="mt-4 inline-flex w-fit rounded-full border border-line bg-bg-subtle px-2.5 py-1 text-[11px] font-semibold text-fg-muted">
            {metaLabel}
          </span>

          <span className="mt-3 font-display text-base font-extrabold text-fg">
            {`${titlePrefix} ${index}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

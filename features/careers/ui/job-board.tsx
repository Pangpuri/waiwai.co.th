"use client";

import type { Board } from "../board";

/**
 * กระดานรับสมัครงาน — **แสดงเฉพาะตำแหน่งที่เปิดรับ** (รอบ 342 · คำสั่งเจ้าของ 2026-11-11)
 *
 * สิ่งที่ถูกถอดออกตามคำสั่งเจ้าของ:
 * - ตัวกรองตามฝ่าย (และป้ายฝ่ายบนการ์ด)
 * - จำนวนอัตราที่เปิดรับ
 *
 * ยังคงเป็น client component ตามโครงเดิม (ไม่ต้องใช้ state แล้ว) และรับ `Board` ชนิดเดิม
 * เพื่อไม่ให้กระทบหน้าจอ/เทสต์ที่สร้างข้อมูลชุดเดียวกัน
 */
type JobBoardProps = {
  readonly board: Board;
};

export function JobBoard({ board }: JobBoardProps) {
  const { labels } = board;

  if (board.cards.length === 0) {
    return <p className="mt-6 rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-fg">{labels.empty}</p>;
  }

  return (
    <ul className="mt-6 grid gap-5 lg:grid-cols-2">
      {board.cards.map((card) => (
        <li key={card.id} className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5">
          <h3 className="font-display text-lg leading-snug font-extrabold text-fg">{card.title}</h3>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {/* ประกาศใหม่ "ไม่บังคับ" กรอกเพศ/อายุ (มติ D26 ข้อ 4) ⇒ ไม่กรอก = ไม่แสดงบรรทัดว่าง */}
            {card.genderLabel.trim() === "" ? null : (
              <>
                <dt className="text-fg-muted">{labels.fieldGender}</dt>
                <dd className="text-fg">{card.genderLabel}</dd>
              </>
            )}

            {card.ageLabel.trim() === "" ? null : (
              <>
                <dt className="text-fg-muted">{labels.fieldAge}</dt>
                <dd className="text-fg">{card.ageLabel}</dd>
              </>
            )}

            <dt className="text-fg-muted">{labels.fieldExperience}</dt>
            <dd className="text-fg">{card.experienceLabel}</dd>

            {card.qualificationsLabel.trim() === "" ? null : (
              <>
                <dt className="text-fg-muted">{labels.fieldQualifications}</dt>
                <dd className="text-fg">{card.qualificationsLabel}</dd>
              </>
            )}
          </dl>
        </li>
      ))}
    </ul>
  );
}

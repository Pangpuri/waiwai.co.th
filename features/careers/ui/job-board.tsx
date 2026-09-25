"use client";

import { useMemo, useState } from "react";

import { filterCards, type Board } from "../board";
import type { DepartmentId } from "../jobs";

/**
 * กระดานรับสมัครงาน — กรองตามฝ่ายได้ (แทนตารางทึบ ๆ ของเว็บเดิม)
 *
 * ทำเป็น client component เพราะการกรองต้องไม่ทำให้หน้าหลุดจากการ prerender เป็น static
 * (ถ้าใช้ searchParams หน้าจะกลายเป็น dynamic) — หน้าจึงยังเป็น static ทั้งหน้า
 * และค่าเริ่มต้นคือ "ทั้งหมด" → ไม่มีเนื้อหาถูกซ่อนเมื่อ JS ยังไม่ทำงาน/ปิด JS
 *
 * รับข้อมูลที่แปลแล้วเป็น props ธรรมดา (ไม่ส่งพจนานุกรมทั้งก้อนไปฝั่ง client)
 */

type JobBoardProps = {
  readonly board: Board;
};

export function JobBoard({ board }: JobBoardProps) {
  const [active, setActive] = useState<DepartmentId | "all">("all");

  const visible = useMemo(() => filterCards(board.cards, active), [board.cards, active]);
  const { labels } = board;

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={labels.filterGroup}>
        {board.filters.map((filter) => {
          const isActive = filter.id === active;

          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActive(filter.id)}
              className={[
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                isActive
                  ? "border-transparent bg-brand-red text-on-brand"
                  : "border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg",
              ].join(" ")}
            >
              {filter.label}
              <span className="text-xs opacity-80">{filter.count}</span>
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="mt-6 text-sm font-semibold text-fg-muted">
        {visible.length} {labels.positionUnit}
      </p>

      {visible.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-fg">
          {labels.empty}
        </p>
      ) : (
        <ul className="mt-6 grid gap-5 lg:grid-cols-2">
          {visible.map((card) => (
            <li
              key={card.id}
              className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-line bg-bg-subtle px-2.5 py-1 text-[11px] font-semibold text-fg-muted">
                  {card.departmentLabel}
                </span>
                <span className="rounded-full border border-line bg-bg-cream px-2.5 py-1 text-[11px] font-bold text-fg">
                  {card.openings} {labels.openingsUnit}
                </span>
              </div>

              <h3 className="mt-3 font-display text-lg leading-snug font-extrabold text-fg">
                {card.title}
              </h3>

              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-fg-muted">{labels.fieldGender}</dt>
                <dd className="text-fg">{card.genderLabel}</dd>

                <dt className="text-fg-muted">{labels.fieldAge}</dt>
                <dd className="text-fg">{card.ageLabel}</dd>

                <dt className="text-fg-muted">{labels.fieldExperience}</dt>
                <dd className="text-fg">{card.experienceLabel}</dd>

                <dt className="text-fg-muted">{labels.fieldQualifications}</dt>
                <dd className="text-fg">{card.qualificationsLabel}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

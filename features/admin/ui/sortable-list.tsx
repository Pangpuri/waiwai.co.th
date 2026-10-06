"use client";

import { useActionState, useState } from "react";

/**
 * รายการจัดลำดับด้วยการลาก (รอบที่ 153–154)
 *
 * - **ลาก** แถวไปวางบนแถวเป้าหมาย (HTML5 drag & drop — ไม่เพิ่ม dependency)
 * - มีปุ่ม **ขึ้น/ลง** ด้วย เพราะการลากอย่างเดียวใช้บนจอสัมผัส/คีย์บอร์ดไม่ได้ (a11y)
 * - ส่งลำดับเป็น `order=id1,id2,…` แล้วบันทึกด้วย Server Action
 *
 * รอบที่ 154 (ฟีดแบ็กเจ้าของ):
 *   · **ตอบกลับให้ชัด** — ใช้ `useActionState` แสดง "บันทึกแล้ว N รายการ" / ข้อความผิดพลาด
 *     และประกาศผ่าน `aria-live` (ผู้ใช้จะได้รู้ว่ากดติด ไม่ต้องเดา)
 *   · **ไม่ต้องรีเฟรชเอง** — หลังบันทึก หน้าจอ remount ด้วยข้อมูลใหม่จากเซิร์ฟเวอร์
 *     (ผู้เรียกส่ง `key` ตาม "ลายนิ้วมือของลำดับที่บันทึก" ⇒ ล้าง state ที่ค้างในจอ)
 */

export type SortableListStrings = {
  readonly up: string;
  readonly down: string;
  readonly save: string;
  readonly saveHint: string;
  readonly handle: string;
  readonly saved: string;
  readonly failed: string;
};

export type ReorderState = { readonly saved: number; readonly failed: boolean };

export const INITIAL_REORDER_STATE: ReorderState = { saved: 0, failed: false };

export function SortableList({
  kind,
  items,
  strings,
  action,
}: {
  readonly kind: string;
  readonly items: readonly { readonly id: string; readonly title: string; readonly subtitle: string }[];
  readonly strings: SortableListStrings;
  readonly action: (previous: ReorderState, formData: FormData) => Promise<ReorderState>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_REORDER_STATE);
  const [order, setOrder] = useState<string[]>(items.map((item) => item.id));
  const [dragging, setDragging] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const byId = new Map(items.map((item) => [item.id, item]));

  const applyOrder = (next: string[]): void => {
    setOrder(next);
    setDirty(true);
  };

  const move = (id: string, delta: number): void => {
    setOrder((current) => {
      const from = current.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved === undefined) return current;
      next.splice(to, 0, moved);
      setDirty(true);
      return next;
    });
  };

  const dropOn = (targetId: string): void => {
    if (dragging === "" || dragging === targetId) return;
    setOrder((current) => {
      const from = current.indexOf(dragging);
      const to = current.indexOf(targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved === undefined) return current;
      next.splice(to, 0, moved);
      setDirty(true);
      return next;
    });
    setDragging("");
  };

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="order" value={order.join(",")} />
      <ol className="flex flex-col gap-1">
        {order.map((id, index) => {
          const item = byId.get(id);
          if (item === undefined) return null;
          return (
            <li
              key={id}
              draggable
              onDragStart={() => setDragging(id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropOn(id)}
              className="border-line bg-bg flex items-center gap-3 rounded-xl border px-3 py-2"
            >
              <span aria-hidden className="text-fg-muted cursor-grab text-sm" title={strings.handle}>
                ⠿
              </span>
              <span className="text-fg-muted w-6 text-xs">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="text-fg block truncate text-sm">{item.title}</span>
                {item.subtitle === "" ? null : (
                  <span className="text-fg-muted block truncate text-xs">{item.subtitle}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => move(id, -1)}
                aria-label={`${strings.up}: ${item.title}`}
                className="border-line text-fg focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(id, 1)}
                aria-label={`${strings.down}: ${item.title}`}
                className="border-line text-fg focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
              >
                ↓
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-full px-4 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
        >
          {strings.save}
        </button>
        <span className="text-fg-muted text-xs">{strings.saveHint}</span>
        <span aria-live="polite" className="text-sm font-semibold">
          {state.failed
            ? strings.failed
            : state.saved > 0
              ? strings.saved.replace("{count}", String(state.saved))
              : dirty
                ? "•"
                : ""}
        </span>
      </div>
    </form>
  );
}

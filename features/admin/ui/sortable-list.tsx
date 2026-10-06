"use client";

import { useState } from "react";

/**
 * รายการจัดลำดับด้วยการลาก (รอบที่ 153)
 *
 * - **ลาก** แถวไปวางบนแถวเป้าหมาย (HTML5 drag & drop — ไม่เพิ่ม dependency)
 * - มีปุ่ม **ขึ้น/ลง** ด้วย เพราะการลากอย่างเดียวใช้บนจอสัมผัส/คีย์บอร์ดไม่ได้ (a11y)
 * - ลำดับถูกส่งเป็นค่าเดียว (`order=id1,id2,…`) แล้วบันทึกด้วย Server Action
 */

export type SortableListStrings = {
  readonly up: string;
  readonly down: string;
  readonly save: string;
  readonly saveHint: string;
  readonly handle: string;
};

export function SortableList({
  kind,
  items,
  strings,
  action,
}: {
  readonly kind: string;
  readonly items: readonly { readonly id: string; readonly title: string; readonly subtitle: string }[];
  readonly strings: SortableListStrings;
  readonly action: (formData: FormData) => Promise<void>;
}) {
  const [order, setOrder] = useState<string[]>(items.map((item) => item.id));
  const [dragging, setDragging] = useState<string>("");
  const byId = new Map(items.map((item) => [item.id, item]));

  const move = (id: string, delta: number): void => {
    setOrder((current) => {
      const from = current.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved === undefined) return current;
      next.splice(to, 0, moved);
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
      return next;
    });
    setDragging("");
  };

  return (
    <form action={action} className="flex flex-col gap-3">
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
          className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-full px-4 py-1.5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {strings.save}
        </button>
        <span className="text-fg-muted text-xs">{strings.saveHint}</span>
      </div>
    </form>
  );
}

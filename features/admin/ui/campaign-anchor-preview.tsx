"use client";

import { useRef, useState } from "react";

import type { Messages } from "@/lib/i18n/messages/th";

/**
 * พรีวิว "ลากการ์ดแคมเปญ" บนกรอบสไลด์ (รอบที่ 190 · ส่วนที่ 4)
 *
 * มติเจ้าของ: *"หน้าต่างขยับได้บนสไลด์"* ⇒ ลากการ์ดในกรอบเพื่อกำหนดจุดยึดได้เอง
 * - ใช้ **สูตรเดียวกับหน้าเว็บจริง**: `left: X%` + `top: Y%` + `translate(-X%, -Y%)`
 *   ⇒ ที่เห็นในพรีวิว = ที่จะเห็นบนหน้าแรก
 * - รองรับ **เมาส์ + สัมผัส** (`pointer events` + `setPointerCapture`) และ **คีย์บอร์ด** (ลูกศร = ขยับทีละ 2%)
 * - ⚠️ คอมโพเนนต์นี้ไม่เรนเดอร์ฟอร์มเลย (ถูกวางในพาเนลที่มีฟอร์มบันทึกอยู่แล้ว — ห้ามซ้อนกัน)
 */
export function CampaignAnchorPreview({
  imagePath,
  imageAltFallback,
  title,
  body,
  ctaLabel,
  anchorX,
  anchorY,
  onAnchorChange,
  strings,
}: {
  readonly imagePath: string;
  readonly imageAltFallback: string;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly onAnchorChange: (x: number, y: number) => void;
  readonly strings: Messages["admin"];
}) {
  const frame = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const clamp = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));

  /** คำนวณเปอร์เซ็นต์จากตำแหน่งตัวชี้ภายในกรอบสไลด์ */
  function anchorFromPointer(clientX: number, clientY: number): { x: number; y: number } | null {
    const box = frame.current?.getBoundingClientRect();
    if (box === undefined || box.width === 0 || box.height === 0) return null;
    return {
      x: clamp(((clientX - box.left) / box.width) * 100),
      y: clamp(((clientY - box.top) / box.height) * 100),
    };
  }

  function handlePointer(event: React.PointerEvent<HTMLDivElement>, active: boolean): void {
    if (!active && !dragging) return;
    const next = anchorFromPointer(event.clientX, event.clientY);
    if (next !== null) onAnchorChange(next.x, next.y);
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={frame}
        className="bg-bg-subtle relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-line"
        onPointerMove={(event) => handlePointer(event, false)}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
      >
        {imagePath.trim() === "" ? (
          <div className="text-fg-muted flex h-full w-full items-center justify-center text-xs">{strings.heroAdminNoImage}</div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imagePath} alt={imageAltFallback} className="h-full w-full object-cover" />
        )}

        {/* การ์ด — ลากได้ (ตำแหน่งวาดด้วยจุดยึดเดียวกับหน้าเว็บจริง) */}
        <div
          role="button"
          tabIndex={0}
          aria-label={strings.campaignPosition}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 5 : 2;
            if (event.key === "ArrowLeft") onAnchorChange(clamp(anchorX - step), anchorY);
            else if (event.key === "ArrowRight") onAnchorChange(clamp(anchorX + step), anchorY);
            else if (event.key === "ArrowUp") onAnchorChange(anchorX, clamp(anchorY - step));
            else if (event.key === "ArrowDown") onAnchorChange(anchorX, clamp(anchorY + step));
            else return;
            event.preventDefault();
          }}
          style={{
            left: anchorX + "%",
            top: anchorY + "%",
            transform: "translate(-" + anchorX + "%, -" + anchorY + "%)",
          }}
          className={
            "absolute flex max-w-[70%] cursor-grab touch-none flex-col gap-1 rounded-xl bg-surface/95 p-3 text-fg shadow-lg " +
            (dragging ? "ring-2 ring-brand-red cursor-grabbing" : "")
          }
        >
          <p className="text-sm font-bold">{title.trim() === "" ? strings.heroCardTitleRequired : title}</p>
          {body.trim() === "" ? null : <p className="text-fg-muted text-[11px]">{body}</p>}
          {ctaLabel.trim() === "" ? null : <span className="text-brand-red text-[11px] font-semibold underline">{ctaLabel}</span>}
        </div>
      </div>
      <p className="text-fg-muted text-[11px]">
        {strings.campaignDragHint} · X {anchorX}% · Y {anchorY}%
      </p>
    </div>
  );
}

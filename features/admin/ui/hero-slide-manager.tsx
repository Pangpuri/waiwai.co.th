"use client";

import { useRef, useState } from "react";

import {
  moveHeroSlideAction,
  removeHeroSlideAction,
  reorderHeroSlidesAction,
  saveHeroSlideAction,
} from "@/app/admin/hero/actions";
import { HERO_FOCUS_PRESETS, HERO_ZOOM_PRESETS, heroFocusPresetId } from "@/lib/blocks/hero-slides";
import type { HeroPageSlide } from "@/lib/hero/model";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ตัวจัดการสไลด์หน้าแรก (รอบที่ 184 · เฟส 3)
 *
 * - **ลากการ์ดเพื่อสลับลำดับ** (HTML5 drag & drop · ไม่เพิ่ม dependency) แล้วส่งลำดับใหม่เข้า Server Action
 *   · มีปุ่ม "เลื่อนขึ้น/ลง" เป็นทางสำรองสำหรับคีย์บอร์ด/จอสัมผัส (a11y)
 * - ต่อการ์ด: แก้พาธภาพ · คำอธิบายไทย/อังกฤษ · **จุดโฟกัส 9 จุด** · **ซูม** · เปิด/ปิด · ลบ (ย้ายเข้าถังขยะ)
 *   · ทุกอย่างเป็น `<form>` ธรรมดา ⇒ **ใช้ได้แม้ปิด JavaScript** (ลากไม่ได้ แต่กดปุ่มได้)
 * - ⚠️ ห้ามซ้อน `<form>`: ปุ่มเลื่อน/ลบ เป็นฟอร์ม **พี่น้อง** กับการ์ดรายละเอียด (ไม่ซ้อนในกัน)
 */
export function HeroSlideManager({
  slides,
  strings,
}: {
  readonly slides: readonly HeroPageSlide[];
  readonly strings: Messages["admin"];
}) {
  const [order, setOrder] = useState<readonly string[]>(slides.map((slide) => slide.id));
  const dragging = useRef<string | null>(null);
  const reorderForm = useRef<HTMLFormElement | null>(null);
  const orderInput = useRef<HTMLInputElement | null>(null);
  const byId = new Map(slides.map((slide) => [slide.id, slide]));
  const ordered = order.map((id) => byId.get(id)).filter((slide): slide is HeroPageSlide => slide !== undefined);

  function submitOrder(next: readonly string[]): void {
    setOrder(next);
    if (orderInput.current !== null) orderInput.current.value = next.join(",");
    reorderForm.current?.requestSubmit();
  }

  function dropOn(targetId: string): void {
    const sourceId = dragging.current;
    dragging.current = null;
    if (sourceId === null || sourceId === targetId) return;
    const next = order.filter((id) => id !== sourceId);
    const at = next.indexOf(targetId);
    next.splice(at < 0 ? next.length : at, 0, sourceId);
    submitOrder(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-fg-muted text-xs">{strings.heroAdminDragHint}</p>

      {/* ฟอร์มเดียวสำหรับ "ลำดับใหม่" — ตัวลากเขียนค่าลงช่องซ่อนแล้วส่งฟอร์มนี้ */}
      <form ref={reorderForm} action={reorderHeroSlidesAction} className="hidden">
        <input ref={orderInput} type="hidden" name="order" defaultValue={order.join(",")} />
      </form>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ordered.map((slide, index) => {
          const focusId = heroFocusPresetId(slide.focusX, slide.focusY) ?? HERO_FOCUS_PRESETS[4]?.id ?? "center";
          return (
            <li
              key={slide.id}
              draggable
              onDragStart={() => {
                dragging.current = slide.id;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                dropOn(slide.id);
              }}
              className="border-line bg-surface flex cursor-grab flex-col gap-2 rounded-xl border p-2 active:cursor-grabbing"
            >
              {/* ภาพตัวอย่าง + ลำดับ */}
              <div className="relative">
                {/* ⚠️ ไม่มีพาธ = ไม่เรนเดอร์ <img> เลย (ไม่งั้นเบราว์เซอร์เตือน src="" และยิงคำขอเปล่า) */}
                {slide.mediaPath.trim() === "" ? (
                  <div className="bg-bg-subtle text-fg-muted flex h-32 w-full items-center justify-center rounded-lg text-xs">
                    {strings.heroAdminNoImage}
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={slide.mediaPath} alt={slide.altTh} className="bg-bg-subtle h-32 w-full rounded-lg object-cover" />
                )}
                <span className="bg-surface/90 text-fg absolute top-1 left-1 rounded px-1.5 py-0.5 text-xs font-semibold">
                  {strings.heroAdminOrder} {index + 1}
                </span>
              </div>

              {/* แถวปุ่ม: เลื่อนขึ้น/ลง/ลบ (ฟอร์มแยก ไม่ซ้อนกัน) */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <form action={moveHeroSlideAction}>
                    <input type="hidden" name="id" value={slide.id} />
                    <input type="hidden" name="delta" value="-1" />
                    <button type="submit" className="border-line text-fg-muted rounded-md border px-2 py-1 text-xs">
                      {strings.heroAdminMoveUp}
                    </button>
                  </form>
                  <form action={moveHeroSlideAction}>
                    <input type="hidden" name="id" value={slide.id} />
                    <input type="hidden" name="delta" value="1" />
                    <button type="submit" className="border-line text-fg-muted rounded-md border px-2 py-1 text-xs">
                      {strings.heroAdminMoveDown}
                    </button>
                  </form>
                </div>
                <form action={removeHeroSlideAction}>
                  <input type="hidden" name="id" value={slide.id} />
                  <button type="submit" className="border-line text-fg-muted rounded-md border px-2 py-1 text-xs">
                    {strings.heroAdminRemove}
                  </button>
                </form>
              </div>

              {/* รายละเอียด */}
              <form action={saveHeroSlideAction} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={slide.id} />
                <label className="text-fg-muted flex flex-col gap-1 text-xs">
                  {strings.heroAdminImage}
                  <input
                    type="text"
                    name="mediaPath"
                    defaultValue={slide.mediaPath}
                    placeholder={strings.heroAdminImagePlaceholder}
                    className="border-line text-fg rounded-md border px-2 py-1 text-xs"
                  />
                </label>
                <label className="text-fg-muted flex flex-col gap-1 text-xs">
                  {strings.heroAdminAltTh}
                  <input type="text" name="altTh" defaultValue={slide.altTh} className="border-line text-fg rounded-md border px-2 py-1 text-xs" />
                </label>
                <label className="text-fg-muted flex flex-col gap-1 text-xs">
                  {strings.heroAdminAltEn}
                  <input type="text" name="altEn" defaultValue={slide.altEn} className="border-line text-fg rounded-md border px-2 py-1 text-xs" />
                </label>
                <div className="flex gap-2">
                  <label className="text-fg-muted flex flex-1 flex-col gap-1 text-xs">
                    {strings.heroAdminFocus}
                    <select name="focus" defaultValue={focusId} className="border-line text-fg rounded-md border px-2 py-1 text-xs">
                      {HERO_FOCUS_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-fg-muted flex flex-1 flex-col gap-1 text-xs">
                    {strings.heroAdminZoom}
                    <select name="zoom" defaultValue={String(slide.zoom)} className="border-line text-fg rounded-md border px-2 py-1 text-xs">
                      {HERO_ZOOM_PRESETS.map((zoom) => (
                        <option key={zoom} value={String(zoom)}>
                          {zoom}×
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="text-fg-muted flex items-center gap-2 text-xs">
                  <input type="checkbox" name="isActive" defaultChecked={slide.isActive} />
                  {strings.heroAdminToggle}
                </label>
                <button type="submit" className="bg-brand-red text-on-brand rounded-md px-3 py-1.5 text-xs font-semibold">
                  {strings.heroAdminSave}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

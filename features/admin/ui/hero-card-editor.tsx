"use client";

import { useMemo } from "react";

import { addHeroCardAction, removeHeroCardAction, saveHeroCardAction } from "@/app/admin/hero/card-actions";
import {
  HERO_CARD_POSITIONS,
  MAX_HERO_CARDS_PER_SLIDE,
  heroCardWindowState,
  toDateTimeLocalValue,
  type HeroCard,
  type HeroCardPosition,
} from "@/lib/hero/cards";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * พาเนล "การ์ดบนสไลด์ (แคมเปญ)" — ใช้ในหน้าจอ `/admin/hero` (รอบที่ 188 · ส่วนที่ 2)
 *
 * - การ์ดผูกกับสไลด์หนึ่งใบ · ข้อความ 2 ภาษา (ไทยบังคับ · อังกฤษให้แอดมินกรอกเอง)
 * - **ช่วงเวลาเริ่ม–จบ** ⇒ การ์ดขึ้น/ลงเองตามเวลา (ตัดสินที่ SQL ด้วย `now()` ไม่ต้องมีตัวจับเวลา)
 * - แสดงสถานะล่วงหน้า: แสดงตลอด / รอเริ่ม / กำลังแสดง / หมดเวลา — ให้เห็นก่อนว่าจะเกิดอะไร
 * - ทุกอย่างเป็น `<form>` ธรรมดา ⇒ ใช้ได้แม้ปิด JavaScript
 * ⚠️ ห้ามซ้อน `<form>` — ฟอร์ม "เพิ่มการ์ด" เป็นพี่น้องกับฟอร์มของการ์ดแต่ละใบ (ไม่ซ้อนในกัน)
 */
export function HeroCardEditor({
  slideId,
  cards,
  strings,
  nowIso,
}: {
  readonly slideId: string;
  readonly cards: readonly HeroCard[];
  readonly strings: Messages["admin"];
  /** เวลาปัจจุบันจากเซิร์ฟเวอร์ (ISO) — คำนวณสถานะให้ตรงกับที่หน้าเว็บจะเห็น */
  readonly nowIso: string;
}) {
  const now = useMemo(() => Date.parse(nowIso), [nowIso]);
  const positionLabel: Readonly<Record<HeroCardPosition, string>> = {
    left: strings.heroCardPositionLeft,
    center: strings.heroCardPositionCenter,
    right: strings.heroCardPositionRight,
  };
  const stateLabel: Readonly<Record<string, string>> = {
    always: strings.heroCardStateAlways,
    scheduled: strings.heroCardStateScheduled,
    live: strings.heroCardStateLive,
    expired: strings.heroCardStateExpired,
  };

  return (
    <section className="border-line flex flex-col gap-2 rounded-lg border border-dashed p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <p className="text-fg text-xs font-semibold">{strings.heroCardSectionTitle}</p>
          <p className="text-fg-muted text-[11px]">{strings.heroCardSectionHint}</p>
        </div>
        <form action={addHeroCardAction}>
          <input type="hidden" name="slideId" value={slideId} />
          <button
            type="submit"
            disabled={cards.length >= MAX_HERO_CARDS_PER_SLIDE}
            className="border-line text-fg rounded-md border px-2 py-1 text-xs font-semibold disabled:opacity-50"
          >
            {strings.heroCardAdd}
          </button>
        </form>
      </div>
      <p className="text-fg-muted text-[11px]">{strings.heroCardMax.replace("{max}", String(MAX_HERO_CARDS_PER_SLIDE))}</p>

      {cards.length === 0 ? (
        <p className="text-fg-muted text-xs">{strings.heroCardEmpty}</p>
      ) : (
        cards.map((card) => {
          const state = heroCardWindowState(card, now);
          return (
            <div key={card.id} className="border-line flex flex-col gap-2 rounded-lg border p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-fg-muted text-[11px] font-semibold">{stateLabel[state] ?? state}</span>
                <form action={removeHeroCardAction}>
                  <input type="hidden" name="id" value={card.id} />
                  <button type="submit" className="border-line text-fg-muted rounded-md border px-2 py-1 text-[11px]">
                    {strings.heroCardRemove}
                  </button>
                </form>
              </div>

              <form action={saveHeroCardAction} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={card.id} />
                <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
                  {strings.heroCardTitle} (TH)
                  <input
                    type="text"
                    name="titleTh"
                    defaultValue={card.title.th}
                    className="border-line text-fg rounded-md border px-2 py-1 text-xs"
                  />
                </label>
                <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
                  {strings.heroCardTitle} (EN)
                  <input
                    type="text"
                    name="titleEn"
                    defaultValue={card.title.en}
                    className="border-line text-fg rounded-md border px-2 py-1 text-xs"
                  />
                </label>
                <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
                  {strings.heroCardBody} (TH)
                  <textarea
                    name="bodyTh"
                    defaultValue={card.body.th}
                    rows={2}
                    className="border-line text-fg rounded-md border px-2 py-1 text-xs"
                  />
                </label>
                <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
                  {strings.heroCardBody} (EN)
                  <textarea
                    name="bodyEn"
                    defaultValue={card.body.en}
                    rows={2}
                    className="border-line text-fg rounded-md border px-2 py-1 text-xs"
                  />
                </label>
                <div className="flex gap-2">
                  <label className="text-fg-muted flex flex-1 flex-col gap-1 text-[11px]">
                    {strings.heroCardCtaLabel} (TH)
                    <input
                      type="text"
                      name="ctaLabelTh"
                      defaultValue={card.ctaLabel.th}
                      className="border-line text-fg rounded-md border px-2 py-1 text-xs"
                    />
                  </label>
                  <label className="text-fg-muted flex flex-1 flex-col gap-1 text-[11px]">
                    {strings.heroCardCtaLabel} (EN)
                    <input
                      type="text"
                      name="ctaLabelEn"
                      defaultValue={card.ctaLabel.en}
                      className="border-line text-fg rounded-md border px-2 py-1 text-xs"
                    />
                  </label>
                </div>
                <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
                  {strings.heroCardCtaHref}
                  <input
                    type="text"
                    name="ctaHref"
                    defaultValue={card.ctaHref}
                    placeholder="/products"
                    className="border-line text-fg rounded-md border px-2 py-1 text-xs"
                  />
                </label>
                <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
                  {strings.heroCardPosition}
                  <select name="position" defaultValue={card.position} className="border-line text-fg rounded-md border px-2 py-1 text-xs">
                    {HERO_CARD_POSITIONS.map((position) => (
                      <option key={position} value={position}>
                        {positionLabel[position]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <label className="text-fg-muted flex flex-1 flex-col gap-1 text-[11px]">
                    {strings.heroCardStarts}
                    <input
                      type="datetime-local"
                      name="startsAt"
                      defaultValue={toDateTimeLocalValue(card.startsAt)}
                      className="border-line text-fg rounded-md border px-2 py-1 text-xs"
                    />
                  </label>
                  <label className="text-fg-muted flex flex-1 flex-col gap-1 text-[11px]">
                    {strings.heroCardEnds}
                    <input
                      type="datetime-local"
                      name="endsAt"
                      defaultValue={toDateTimeLocalValue(card.endsAt)}
                      className="border-line text-fg rounded-md border px-2 py-1 text-xs"
                    />
                  </label>
                </div>
                <p className="text-fg-muted text-[11px]">{strings.heroCardWindowHint}</p>
                <p className="text-fg-muted text-[11px]">{strings.heroCardEnglishOptional}</p>
                <label className="text-fg-muted flex items-center gap-2 text-[11px]">
                  <input type="checkbox" name="isActive" defaultChecked={card.isActive} />
                  {strings.heroAdminToggle}
                </label>
                <button type="submit" className="bg-brand-red text-on-brand rounded-md px-3 py-1.5 text-xs font-semibold">
                  {strings.heroCardSave}
                </button>
              </form>
            </div>
          );
        })
      )}
    </section>
  );
}

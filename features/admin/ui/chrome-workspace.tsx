"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { FOOTER_MESSAGE, MOURNING_LIVE_EVENT, MOURNING_MESSAGE, NAVBAR_MESSAGE } from "@/features/blocks/ui/preview-frame";

/**
 * "ส่วนกลางของเว็บ" — พื้นที่ทำงานแบบแท็บ (ผู้ใช้สั่ง รอบที่ 55)
 *
 * *"เราจะทำที่ไม่ใช่ส่วนคอนเท้นก่อน คือ Navbar ป้ายประกาศ footer เพราะพวกนี้แทบจะโชว์ทุกหน้า
 *   แท็บแรกที่จะทำคือ ส่วนกลาง · หน้าพรีวิวแบ่ง 2 โหมด (หน้าเว็บปัจจุบัน / ที่กำลังแก้)
 *   เพิ่มอีก 1 โหมดคือดูภาพรวม … จะเซฟพรีเซ็ต หรือใช้ทำหน้าเว็บเลย · เป็นแท็บเช่นกัน
 *   น่าจะง่าย เข้าใจง่ายต่อคนเขียนเว็บไม่เป็นแต่อยากลากวาง/อัปโหลดภาพ"*
 *
 * โครงหน้าจอ
 * - **ซ้าย = แท็บ "ส่วนของเว็บ"**: แถบเมนู · ป้ายประกาศ · ท้ายเว็บ (ไม่ซ่อนในรายการอีก)
 * - **ขวา = แท็บ "มุมมอง"**: หน้าเว็บปัจจุบัน · ที่กำลังแก้ · ภาพรวม (สรุป + ปุ่มตัดสินใจ)
 *
 * ⚠️ ตัวแก้แต่ละส่วนถูกส่งเข้ามาเป็น slot จาก Server Component (หน้าจอไม่ต้องรู้รายละเอียด)
 *    และค่าที่กำลังแก้ของแถบเมนูถูกส่งต่อเข้า iframe ให้เห็นทันที (hot reload)
 */

export type ChromePart = "navbar" | "notice" | "footer";
export type ChromeMode = "current" | "draft" | "overview";

type Strings = {
  readonly partsLabel: string;
  readonly partNavbar: string;
  readonly partNotice: string;
  readonly partFooter: string;
  readonly viewLabel: string;
  readonly modeCurrent: string;
  readonly modeDraft: string;
  readonly modeOverview: string;
  readonly modeHintCurrent: string;
  readonly modeHintDraft: string;
  readonly modeHintOverview: string;
  readonly reloadPreview: string;
  readonly openInNewTab: string;
  readonly previewTitle: string;
  readonly footerPending: string;
};

export function ChromeWorkspace({
  strings,
  previewSrcCurrent,
  previewSrcDraft,
  footerPreviewSrcCurrent,
  footerPreviewSrcDraft,
  noticePreviewSrcCurrent,
  noticePreviewSrcDraft,
  navbarEditor,
  noticeEditor,
  footerEditor,
  overview,
}: {
  readonly strings: Strings;
  readonly previewSrcCurrent: string;
  readonly previewSrcDraft: string;
  /* ป้ายประกาศมีพรีวิวของตัวเอง (รอบที่ 159 · ฟีดแบ็กเจ้าของ: คลิกแท็บป้ายประกาศแล้วยังเห็น navbar) */
  readonly noticePreviewSrcCurrent: string;
  readonly noticePreviewSrcDraft: string;
  readonly navbarEditor: ReactNode;
  readonly noticeEditor: ReactNode;
  readonly footerEditor: ReactNode;
  readonly footerPreviewSrcCurrent: string;
  readonly footerPreviewSrcDraft: string;
  readonly overview: ReactNode;
}) {
  const [part, setPart] = useState<ChromePart>("navbar");
  const [mode, setMode] = useState<ChromeMode>("draft");
  const [reloadKey, setReloadKey] = useState(0);
  const [liveNavbar, setLiveNavbar] = useState<{ readonly sent: boolean; readonly value: unknown }>({
    sent: false,
    value: null,
  });
  /** ค่าตั้งท้ายเว็บที่กำลังแก้ (W3) — ส่งต่อเข้า iframe ให้พรีวิวเปลี่ยนทันที */
  const [liveFooter, setLiveFooter] = useState<{ readonly sent: boolean; readonly value: unknown }>({ sent: false, value: null });
  /* ค่าล่าสุดของป้ายประกาศที่กำลังแก้ (ยังไม่บันทึก) — รอบที่ 161 */
  const [liveNotice, setLiveNotice] = useState<{ readonly sent: boolean; readonly value: unknown }>({ sent: false, value: null });
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  /**
   * ส่งค่าที่กำลังแก้ (navbar/ท้ายเว็บ/ป้ายประกาศ) เข้า iframe พรีวิว
   *
   * ⚠️ บทเรียนรอบที่ 162 (ฟีดแบ็กเจ้าของ: "พรีวิวสดไม่ทำงาน"):
   *   iframe มี `key` ผูกกับ `mode`/`reloadKey` เท่านั้น ⇒ **สลับแท็บ (part) แล้วไม่ remount**
   *   มีแค่ `src` เปลี่ยน ⇒ ข้อความที่ส่งตอนนั้นไปถึงเอกสารเก่า (หรือก่อน listener ใหม่พร้อม) แล้วหาย
   *   ⇒ ต้องส่ง **ซ้ำตอน `onLoad`** และส่งซ้ำอีกครั้งหลัง hydration ของเอกสารใหม่
   */
    const postLiveValues = useCallback((): void => {
    const target = frameRef.current?.contentWindow;
    if (target === null || target === undefined) return;
    if (liveNavbar.sent) {
      target.postMessage({ type: NAVBAR_MESSAGE, config: liveNavbar.value }, window.location.origin);
    }
    if (liveFooter.sent) {
      target.postMessage({ type: FOOTER_MESSAGE, config: liveFooter.value }, window.location.origin);
    }
    if (liveNotice.sent) {
      target.postMessage({ type: MOURNING_MESSAGE, config: liveNotice.value }, window.location.origin);
    }
  }, [liveNavbar, liveFooter, liveNotice]);

  /* รับค่าที่กำลังแก้จากตัวแก้แถบเมนู → ส่งต่อเข้า iframe (พรีวิวเปลี่ยนทันที) */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data: unknown = event.data;
      if (typeof data !== "object" || data === null) return;
      const type = (data as { type?: unknown }).type;
      if (type === NAVBAR_MESSAGE) {
        setLiveNavbar({ sent: true, value: (data as { config?: unknown }).config ?? null });
        return;
      }
      if (type === FOOTER_MESSAGE) {
        setLiveFooter({ sent: true, value: (data as { config?: unknown }).config ?? null });
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  /* รับค่าสดจากตัวแก้ป้ายประกาศ (CustomEvent) แล้วเก็บไว้ส่งเข้า iframe */
  useEffect(() => {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<unknown>).detail;
      setLiveNotice({ sent: true, value: detail ?? null });
    };
    window.addEventListener(MOURNING_LIVE_EVENT, handler);
    return () => window.removeEventListener(MOURNING_LIVE_EVENT, handler);
  }, []);

  useEffect(() => {
    const target = frameRef.current?.contentWindow;
    if (target === null || target === undefined) return;
    if (liveNavbar.sent) {
      target.postMessage({ type: NAVBAR_MESSAGE, config: liveNavbar.value }, window.location.origin);
    }
    if (liveFooter.sent) {
      target.postMessage({ type: FOOTER_MESSAGE, config: liveFooter.value }, window.location.origin);
    if (liveNotice.sent) {
      target.postMessage({ type: MOURNING_MESSAGE, config: liveNotice.value }, window.location.origin);
    }
    }
  }, [postLiveValues, mode, reloadKey, part]);

  /* ท้ายเว็บใช้พรีวิวคนละโหมด (โชว์ท้ายเว็บอย่างเดียว) — แถบเมนู/ป้ายประกาศใช้โหมด nav */
  const src =
    part === "footer"
      ? mode === "current"
        ? footerPreviewSrcCurrent
        : footerPreviewSrcDraft
      : part === "notice"
        ? mode === "current"
          ? noticePreviewSrcCurrent
          : noticePreviewSrcDraft
        : mode === "current"
          ? previewSrcCurrent
          : previewSrcDraft;
  const modeHint = mode === "current" ? strings.modeHintCurrent : mode === "draft" ? strings.modeHintDraft : strings.modeHintOverview;

  const partTabs: readonly { readonly key: ChromePart; readonly label: string }[] = [
    { key: "navbar", label: strings.partNavbar },
    { key: "notice", label: strings.partNotice },
    { key: "footer", label: strings.partFooter },
  ];

  const modeTabs: readonly { readonly key: ChromeMode; readonly label: string }[] = [
    { key: "current", label: strings.modeCurrent },
    { key: "draft", label: strings.modeDraft },
    { key: "overview", label: strings.modeOverview },
  ];

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none ${
      active ? "bg-brand-red text-on-brand" : "border-line text-fg border hover:bg-surface-raised"
    }`;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]">
      {/* ── ซ้าย: หน้าต่างใหญ่ (พรีวิว) — สลับมาไว้ซ้ายตามที่ผู้ใช้สั่ง รอบที่ 57 ── */}
      <section className="border-line bg-surface flex min-w-0 flex-col gap-2 rounded-2xl border p-3 md:col-start-1 md:row-start-1">
        <div className="flex flex-col gap-2">
          <p className="text-fg-muted text-xs font-semibold uppercase">{strings.viewLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {modeTabs.map((entry) => (
              <button key={entry.key} type="button" onClick={() => setMode(entry.key)} className={tabClass(mode === entry.key)}>
                {entry.label}
              </button>
            ))}
          </div>
          <p className="text-fg-muted text-[11px]">{modeHint}</p>
        </div>

        {mode === "overview" ? (
          overview
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setReloadKey((current) => current + 1)} className={tabClass(false)}>
                {strings.reloadPreview}
              </button>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
              >
                {strings.openInNewTab}
              </a>
            </div>

            <div className="bg-bg-subtle min-h-0 overflow-auto rounded-xl p-2">
              <iframe
                key={`${mode}-${reloadKey}`}
                ref={frameRef}
                onLoad={() => {
                  postLiveValues();
                  /* เอกสารใหม่เพิ่งโหลด — ส่งซ้ำอีกครั้งหลัง hydration จะได้ไม่พลาด */
                  window.setTimeout(postLiveValues, 300);
                }}
                src={src}
                title={strings.previewTitle}
                className="bg-bg h-[74vh] w-full rounded-lg border-0"
              />
            </div>
          </>
        )}
      </section>

      {/* ── ขวา: เมนูปรับแต่ง (ลิสต์ส่วนของเว็บ แล้วตัวแก้ของส่วนที่เลือกอยู่ด้านล่าง) ── */}
      <section className="border-line bg-surface flex min-w-0 flex-col gap-2 self-start rounded-2xl border p-3 md:col-start-2 md:row-span-2 md:row-start-1">
        <h2 className="text-fg text-sm font-semibold">{strings.partsLabel}</h2>

        {/* ลิสต์ส่วนของเว็บ — กดเลือกแล้วตัวแก้ขึ้นด้านล่าง (แบบเดียวกับ "เลเยอร์" ของหน้าสร้างหน้าเว็บ) */}
        <div className="flex flex-col gap-1">
          {partTabs.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setPart(entry.key)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left text-xs font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none ${
                part === entry.key ? "border-brand-red bg-surface-raised text-fg" : "border-line text-fg hover:bg-surface-raised"
              }`}
            >
              <span className="break-words">{entry.label}</span>
              <span aria-hidden="true" className="text-fg-muted text-[11px]">
                {part === entry.key ? "▾" : "▸"}
              </span>
            </button>
          ))}
        </div>

        <div className="border-line min-w-0 border-t pt-2">
          {part === "navbar" ? navbarEditor : null}
          {part === "notice" ? noticeEditor : null}
          {part === "footer" ? footerEditor : null}
        </div>
      </section>

    </div>
  );
}

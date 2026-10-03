"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { shrinkImageFile, shrinkSummary } from "@/features/admin/ui/image-resize";
import { useFormStatus } from "react-dom";

import { uploadImageAction } from "@/app/admin/media/actions";
import { useImageLibrary } from "@/features/admin/ui/image-library";
import { INITIAL_UPLOAD_STATE, type UploadFailure, type UploadState } from "@/features/admin/upload-state";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ช่องภาพแบบ "ลากวางได้" — ใช้ทั้งในบล็อกและการ์ด
 *
 * ทำให้ใช้ง่ายแบบไม่ต้องรู้เทคนิค
 * - **ลากไฟล์จากเครื่องมาวางในกรอบ → อัปโหลดทันที** (ไม่ต้องรู้จักคำว่า "พาธ")
 * - หรือกดกรอบเพื่อเลือกไฟล์ (เปิดหน้าต่างเลือกไฟล์ปกติ)
 * - มีภาพตัวอย่าง + ช่องคำอธิบายภาพ (alt) ไทย/อังกฤษ + ธงลายน้ำ
 * - "พาธ" ยังแก้ได้ในส่วนรายละเอียด (สำหรับคนที่อ้างภาพเดิมในโปรเจกต์)
 *
 * ทำไมใช้ `<form action={...}>` จริง (ไม่เรียก action ลอย ๆ)
 * - ทำงานได้แม้ปิด JavaScript (เลือกไฟล์ → กดปุ่ม) และทำให้ทดสอบด้วย HTTP ได้ตรงไปตรงมา
 * - การลากวาง = ใส่ไฟล์ลง input แล้ว `requestSubmit()` → เส้นทางเดียวกับการกดปุ่ม
 */

type ImageValue = {
  readonly path: string;
  readonly altTh: string;
  readonly altEn: string;
  readonly hasWatermark: boolean;
};

type Props = {
  readonly strings: Messages["admin"];
  readonly value: ImageValue | null;
  readonly onChange: (patch: Partial<ImageValue>) => void;
  readonly label: string;
  readonly compact?: boolean;
  /**
   * สัดส่วนกรอบ (กว้าง ÷ สูง) — ใส่เมื่ออยากให้ช่องว่างมี "โครงกรอบขาวตามสัดส่วนจริง" เช่น 3 = 3000×1000
   * (ผู้ใช้สั่ง รอบที่ 38: "ถ้าไม่มีภาพใด ๆ ให้แสดงโครงหน้าเปล่า ๆ ขาว ๆ")
   */
  readonly frameAspect?: number;
  /** ข้อความในกรอบว่าง เช่น ขนาดภาพที่แนะนำ */
  readonly frameHint?: string;
  /** ข้อความชวนวางภาพ (ค่าเริ่มต้น = imageDropHint) */
  readonly dropPrompt?: string;
};

function failureMessage(strings: Messages["admin"], reason: UploadFailure): string {
  switch (reason) {
    case "no-file":
      return strings.imageErrNoFile;
    case "empty-file":
      return strings.imageErrEmpty;
    case "too-large":
      return strings.imageErrTooLarge;
    case "not-image":
      return strings.imageErrNotImage;
    case "unauthorized":
      return strings.imageErrUnauthorized;
    case "database":
      return strings.imageErrDatabase;
  }
}

function UploadButton({ label, pendingLabel }: { readonly label: string; readonly pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring w-fit rounded-lg border px-3 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ImageDrop({
  strings,
  value,
  onChange,
  label,
  compact = false,
  frameAspect,
  frameHint,
  dropPrompt,
}: Props) {
  const [state, action] = useActionState<UploadState, FormData>(uploadImageAction, INITIAL_UPLOAD_STATE);
  /* คลังภาพในบริบทนี้ (ว่าง = ไม่มีคลัง ⇒ ซ่อนปุ่ม "เลือกจากคลัง" ไม่ทำให้ช่องภาพพัง) */
  const library = useImageLibrary();
  const [dragging, setDragging] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [localError, setLocalError] = useState<UploadFailure | null>(null);
  /* สรุปการย่อภาพอัตโนมัติ (รอบที่ 99) — ตัวเลข KB → KB ล้วน */
  const [shrinkNote, setShrinkNote] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const appliedPath = useRef<string | null>(null);

  /* อัปโหลดเสร็จ → ส่งพาธ + คำอธิบายเริ่มต้นกลับให้หน้าจอ (กันซ้ำด้วย appliedPath) */
  useEffect(() => {
    if (state.status !== "ok" || state.path === null) return;
    if (appliedPath.current === state.path) return;
    appliedPath.current = state.path;
    const base = state.filename ?? "";
    onChange({ path: state.path, altTh: base.replace(/\.[a-z0-9]+$/i, ""), altEn: "" });
  }, [state.status, state.path, state.filename, onChange]);

  /**
   * ใส่ไฟล์ที่ลากมา/เลือก ลงใน input จริง แล้วส่งฟอร์ม (เส้นทางเดียวกับการกดปุ่ม)
   *
   * ⚠️ รอบที่ 99: **ย่อ/แปลงเป็น WebP ก่อนส่ง** (ทำในเบราว์เซอร์ ไม่เพิ่ม dependency)
   *    ถ้าย่อไม่สำเร็จ/ไฟล์ไม่เล็กลง = ใช้ไฟล์เดิม · เบราว์เซอร์เก่าที่ไม่มี `DataTransfer` = ส่งไฟล์เดิม (ไม่พัง)
   */
  async function submitFile(file: File | undefined | null): Promise<void> {
    if (file === undefined || file === null) {
      setLocalError("no-file");
      return;
    }
    setLocalError(null);
    const input = inputRef.current;
    const form = formRef.current;
    if (input === null || form === null) return;

    setShrinkNote(null);
    const outcome = await shrinkImageFile(file);
    setShrinkNote(shrinkSummary(outcome));

    try {
      const transfer = new DataTransfer();
      transfer.items.add(outcome.file);
      input.files = transfer.files;
    } catch {
      /* เบราว์เซอร์เก่า: ส่งไฟล์ที่ผู้ใช้เลือกไว้ใน input ตามเดิม */
    }
    form.requestSubmit();
  }

  const current = value ?? { path: "", altTh: "", altEn: "", hasWatermark: false };
  const reason = localError ?? (state.status === "error" ? state.reason : null);

  const fieldClass =
    "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-fg text-sm font-medium">{label}</p>
        {current.path !== "" ? (
          <button
            type="button"
            onClick={() => onChange({ path: "", altTh: "", altEn: "", hasWatermark: false })}
            className="border-line text-fg-muted hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.imageRemove}
          </button>
        ) : null}
      </div>

      <form ref={formRef} action={action} className="flex flex-col gap-2">
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            submitFile(event.dataTransfer.files.item(0));
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          className={`focus-visible:ring-ring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 text-center focus-visible:ring-2 focus-visible:outline-none ${
            dragging ? "border-brand-red bg-surface-raised" : "border-line bg-surface"
          }`}
        >
          {current.path === "" ? (
            frameAspect === undefined ? (
              <>
                <span className="text-fg text-sm font-semibold">
                  {dragging ? strings.imageDropActive : (dropPrompt ?? strings.imageDropHint)}
                </span>
                <span className="text-fg-muted text-xs">{strings.imageLimits}</span>
              </>
            ) : (
              /* "โครงหน้าเปล่า ๆ ขาว ๆ" ตามสัดส่วนจริง (ผู้ใช้สั่ง รอบที่ 38) — เห็นก่อนว่าภาพจะไปอยู่ตรงไหน */
              <div
                style={{ aspectRatio: `${frameAspect}` }}
                className="bg-bg border-line flex w-full flex-col items-center justify-center gap-1 rounded-lg border p-2"
              >
                <span className="text-fg text-sm font-semibold">
                  {dragging ? strings.imageDropActive : (dropPrompt ?? strings.imageDropHint)}
                </span>
                {frameHint === undefined ? null : <span className="text-fg-muted px-3 text-center text-xs">{frameHint}</span>}
              </div>
            )
          ) : (
            /* ภาพตัวอย่าง — เห็นทันทีว่าใส่อะไรลงไป */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={current.path}
              alt={current.altTh}
              className={`bg-bg-subtle w-full rounded-lg object-cover ${compact ? "h-24" : "h-40"}`}
            />
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.item(0) ?? null;
            if (file !== null) void submitFile(file);
          }}
        />

        {/* ปุ่มนี้มีไว้ให้ใช้งานได้แม้ปิด JavaScript (ปกติลากวาง/เลือกไฟล์แล้วส่งทันที) */}
        <UploadButton label={strings.imageChoose} pendingLabel={strings.imageUploading} />
      </form>

      {/*
        เลือกภาพจากคลัง (หนี้จากรอบที่ 81 · ปิดรอบที่ 93)
        เดิมต้องไปเปิด /admin/media แล้วคัดลอกพาธมาวาง ⇒ ตอนนี้กดเลือกได้เลย
        ⚠️ แสดงเฉพาะเมื่อมีคลังในบริบท (ผู้ใช้ที่ไม่มีสิทธิ์ `media` จะไม่เห็น — หน้าเว็บส่งรายการมาให้เฉพาะผู้มีสิทธิ์)
      */}
      {library.length === 0 ? null : (
        <details className="border-line rounded-lg border p-2">
          <summary className="text-fg-muted cursor-pointer text-xs font-semibold">{strings.mediaPickFromLibrary}</summary>
          <p className="text-fg-muted mt-1 text-[11px]">{strings.mediaPickHint}</p>
          <ul className="mt-2 grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {library.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      path: `/media/${item.id}`,
                      altTh: item.altTh,
                      altEn: item.altEn,
                      hasWatermark: false,
                    })
                  }
                  className="border-line hover:bg-surface-raised focus-visible:ring-ring flex w-full flex-col gap-1 rounded-lg border p-1 text-left focus-visible:ring-2 focus-visible:outline-none"
                >
                  {/* เส้นทางเดียวกันกับหน้าเว็บ (immutable + nosniff) — ย่อด้วย CSS ไม่ต้องมีรูปย่อแยก */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/media/${item.id}`}
                    alt={item.altTh === "" ? item.filename : item.altTh}
                    loading="lazy"
                    className="bg-bg-subtle h-16 w-full rounded object-cover"
                  />
                  <span className="text-fg-muted truncate text-[10px]">{item.filename}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {reason !== null ? <p className="text-fg text-xs font-semibold">{failureMessage(strings, reason)}</p> : null}

      {/* บอกผลการย่ออัตโนมัติ (ตัวเลข KB → KB ล้วน — ไม่ต้องใช้พจนานุกรม) */}
      {shrinkNote === null ? null : (
        <p className="text-fg-muted text-[11px]">
          {strings.imageShrunkHint} {shrinkNote}
        </p>
      )}

      {current.path !== "" ? (
        <div className="grid gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-fg-muted text-xs" htmlFor={`alt-th-${label}`}>
              {strings.imageAltThLabel}
            </label>
            <input
              id={`alt-th-${label}`}
              type="text"
              value={current.altTh}
              onChange={(event) => onChange({ altTh: event.target.value })}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-fg-muted text-xs" htmlFor={`alt-en-${label}`}>
              {strings.imageAltEnLabel}
            </label>
            <input
              id={`alt-en-${label}`}
              type="text"
              value={current.altEn}
              onChange={(event) => onChange({ altEn: event.target.value })}
              className={fieldClass}
            />
          </div>
          <label className="text-fg-muted flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={current.hasWatermark}
              onChange={(event) => onChange({ hasWatermark: event.target.checked })}
              className="border-line accent-brand-red size-4 rounded border"
            />
            {strings.imageWatermarkLabel}
          </label>

          <button
            type="button"
            onClick={() => setShowDetails((current) => !current)}
            className="text-link focus-visible:ring-ring w-fit text-xs font-semibold underline underline-offset-4"
          >
            {strings.imageDetails}
          </button>
          {showDetails ? (
            <input
              type="text"
              value={current.path}
              onChange={(event) => onChange({ path: event.target.value })}
              aria-label={strings.imagePathLabel}
              className={`${fieldClass} font-mono text-xs`}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

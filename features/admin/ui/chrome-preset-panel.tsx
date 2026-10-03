"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  applyChromePresetAction,
  deleteChromePresetAction,
  importChromePresetsAction,
  saveChromePresetAction,
  undoChromePresetAction,
} from "@/app/admin/builder/chrome/preset-actions";
import {
  INITIAL_CHROME_PRESET_IMPORT_STATE,
  INITIAL_CHROME_PRESET_STATE,
  type ChromePresetActionState,
  type ChromePresetImportState,
} from "@/features/admin/chrome-preset-state";
import { fillTemplate } from "@/lib/i18n/template";

/**
 * แผง "พรีเซ็ตของส่วนกลาง" (W3b) — ส่วนที่ต้องมี JS
 *
 * สามฉากตามที่ผู้ใช้ขอ (รอบที่ 58)
 * - **ของเก่า** → ปุ่ม "บันทึกเป็นชุด" โดยเลือก `source = published`
 * - **ของใหม่** → ปุ่มเดียวกันโดยเลือก `source = draft` (ค่าตั้งต้น)
 * - **พรีเซ็ต** → รายการชุดที่บันทึกไว้ + "ใช้ชุดนี้" (เขียนทับเฉพาะฉบับร่าง) + "ลบ" (เข้าถังขยะ)
 *
 * ⚠️ ข้อความทั้งหมดมาจากพจนานุกรม (ห้ามมีข้อความไทยในไฟล์นี้ — ด่าน `check:i18n`)
 * ⚠️ การตัดสินใจจริงอยู่ที่เซิร์ฟเวอร์ (สิทธิ์ · ตรวจรูปทรงชุด · ตรวจชนิดส่วน)
 */

const BUTTON_CLASS =
  "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";
const PRIMARY_CLASS =
  "bg-brand-red text-on-brand focus-visible:ring-ring rounded-lg px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";
const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none";

export type ChromePresetStrings = {
  readonly chromePresetSaveTitle: string;
  readonly chromePresetSaveHint: string;
  readonly chromePresetNameLabel: string;
  readonly chromePresetNamePlaceholder: string;
  readonly chromePresetSourceLabel: string;
  readonly chromePresetSourceDraft: string;
  readonly chromePresetSourcePublished: string;
  readonly chromePresetSave: string;
  readonly chromePresetSaved: string;
  readonly chromePresetOverwritten: string;
  readonly chromePresetEmpty: string;
  readonly chromePresetListTitle: string;
  readonly chromePresetApply: string;
  readonly chromePresetApplied: string;
  readonly chromePresetApplyHint: string;
  readonly chromePresetDelete: string;
  readonly chromePresetDeleted: string;
  readonly chromePresetSavedAt: string;
  readonly chromePresetTooMany: string;
  readonly chromePresetBadName: string;
  readonly chromePresetSavedFromDefault: string;
  readonly chromePresetInvalid: string;
  readonly chromePresetNotFound: string;
  readonly chromePresetDbMissing: string;
  readonly chromePresetUndo: string;
  readonly chromePresetUndoAvailable: string;
  readonly chromePresetUndoHint: string;
  readonly chromePresetUndoDone: string;
  readonly chromePresetUndoMissing: string;
  /* ตัวอย่างชุด + ส่งออก/นำเข้า (W3b ต่อ · รอบที่ 91) */
  readonly chromePresetPreview: string;
  readonly chromePresetPreviewEmpty: string;
  readonly chromePresetIoTitle: string;
  readonly chromePresetIoHint: string;
  readonly chromePresetExport: string;
  readonly chromePresetImportLabel: string;
  readonly chromePresetImport: string;
  readonly chromePresetImported: string;
  readonly chromePresetImportBadJson: string;
  readonly chromePresetImportBadFormat: string;
  readonly chromePresetImportEmpty: string;
  readonly chromePresetImportTooMany: string;
};

export type ChromePresetRow = {
  readonly id: string;
  /** ชนิดของส่วน (navbar/footer/mourning) — ใช้กรองเป็นสามคอลัมน์บนหน้าจอ */
  readonly kind: string;
  readonly name: string;
  readonly detail: string;
  readonly savedAt: string;
  /** ตัวอย่างเนื้อหาในชุด (รอบที่ 91) — ให้เห็นก่อนกด "ใช้ชุดนี้" */
  readonly preview: readonly {
    readonly group: string | null;
    readonly label: string;
    readonly value: string;
  }[];
};

function Submit({ label, primary = false }: { readonly label: string; readonly primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={primary ? PRIMARY_CLASS : BUTTON_CLASS}>
      {label}
    </button>
  );
}

/** รหัสผลลัพธ์ → ข้อความ (รหัสที่ไม่รู้จักถือว่า "ไม่พบชุด" — ปลอดภัยกว่าเงียบ) */
function messageOf(
  state: ChromePresetActionState,
  strings: ChromePresetStrings,
  maxPerKind: number,
): string | null {
  switch (state.code) {
    case null:
      return null;
    case "saved":
      return strings.chromePresetSaved;
    case "saved-default":
      return strings.chromePresetSavedFromDefault;
    case "overwritten":
      return strings.chromePresetOverwritten;
    case "applied":
      return strings.chromePresetApplied;
    case "deleted":
      return strings.chromePresetDeleted;
    case "undo-done":
      return strings.chromePresetUndoDone;
    case "undo-missing":
      return strings.chromePresetUndoMissing;
    case "bad-name":
      return strings.chromePresetBadName;
    case "invalid":
      return strings.chromePresetInvalid;
    case "too-many":
      return fillTemplate(strings.chromePresetTooMany, { max: maxPerKind });
    case "no-database":
      return strings.chromePresetDbMissing;
    default:
      return strings.chromePresetNotFound;
  }
}

function StatusLine({
  state,
  strings,
  maxPerKind,
}: {
  readonly state: ChromePresetActionState;
  readonly strings: ChromePresetStrings;
  readonly maxPerKind: number;
}) {
  const message = messageOf(state, strings, maxPerKind);
  if (message === null) return null;

  return (
    <span className={state.status === "ok" ? "text-fg-muted text-[11px]" : "text-brand-red text-[11px]"}>{message}</span>
  );
}

/** แถวชุดหนึ่งรายการ — ใช้ชุดนี้ · ลบ */
function ChromePresetItem({
  kind,
  row,
  strings,
  maxPerKind,
}: {
  readonly kind: string;
  readonly row: ChromePresetRow;
  readonly strings: ChromePresetStrings;
  readonly maxPerKind: number;
}) {
  const [applyState, applyAction] = useActionState(applyChromePresetAction, INITIAL_CHROME_PRESET_STATE);
  const [deleteState, deleteAction] = useActionState(deleteChromePresetAction, INITIAL_CHROME_PRESET_STATE);

  return (
    <li className="border-line flex flex-col gap-1.5 rounded-lg border p-2">
      <span className="text-fg text-xs font-semibold break-words">{row.name}</span>
      <span className="text-fg-muted text-[11px]">
        {row.detail} · {fillTemplate(strings.chromePresetSavedAt, { time: row.savedAt })}
      </span>

      {/* ตัวอย่างเนื้อหาในชุด (รอบที่ 91) — เห็นก่อนกดใช้ ⇒ ไม่ต้องกดแล้วค่อยย้อนกลับ */}
      <details className="border-line rounded-lg border px-2 py-1">
        <summary className="text-fg-muted cursor-pointer text-[11px] font-semibold">{strings.chromePresetPreview}</summary>
        {row.preview.length === 0 ? (
          <p className="text-fg-muted mt-1 text-[11px]">{strings.chromePresetPreviewEmpty}</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-0.5">
            {row.preview.map((line, index) => (
              <li key={`${line.label}-${index}`} className="flex flex-wrap items-baseline gap-1 text-[11px]">
                {line.group === null ? null : <span className="text-fg-muted">{line.group} ·</span>}
                <span className="text-fg">{line.label}</span>
                {line.value.trim() === "" ? null : <span className="text-fg-muted font-mono">{line.value}</span>}
              </li>
            ))}
          </ul>
        )}
      </details>

      <span className="flex flex-wrap items-center gap-1.5">
        <form action={applyAction}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={row.id} />
          <Submit label={strings.chromePresetApply} primary />
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={row.id} />
          <Submit label={strings.chromePresetDelete} />
        </form>
      </span>
      <StatusLine state={applyState} strings={strings} maxPerKind={maxPerKind} />
      <StatusLine state={deleteState} strings={strings} maxPerKind={maxPerKind} />
    </li>
  );
}

/** รหัสผลลัพธ์การนำเข้า → ข้อความ (รายงานจำนวนด้วย ⇒ ต้องมีเทมเพลตของพจนานุกรม) */
function importMessageOf(state: ChromePresetImportState, strings: ChromePresetStrings, maxImport: number): string | null {
  switch (state.code) {
    case null:
      return null;
    case "imported":
      return fillTemplate(strings.chromePresetImported, { imported: state.imported, skipped: state.skipped });
    case "bad-json":
      return strings.chromePresetImportBadJson;
    case "bad-format":
      return strings.chromePresetImportBadFormat;
    case "empty":
      return strings.chromePresetImportEmpty;
    case "too-many":
      return fillTemplate(strings.chromePresetImportTooMany, { max: maxImport });
    case "no-database":
      return strings.chromePresetDbMissing;
  }
}

/**
 * ส่งออก / นำเข้าชุดทั้งคลัง (W3b ต่อ · รอบที่ 91)
 *
 * - **ส่งออก** = ลิงก์ไป route handler ที่ตรวจสิทธิ์เอง (`/admin/builder/chrome/export`) — ดาวน์โหลดไฟล์ JSON
 * - **นำเข้า** = วางเนื้อหาไฟล์แล้วส่งให้ Server Action (ตรวกรูปแบบ/รูปทรงครบก่อนเขียน)
 * ⚠️ แสดง **ครั้งเดียวต่อหน้า** (ไม่ใช่ต่อส่วน) เพราะเป็นเรื่องของคลังทั้งก้อน
 */
export function ChromePresetIoPanel({
  strings,
  maxImport,
  dbMissing = false,
}: {
  readonly strings: ChromePresetStrings;
  readonly maxImport: number;
  readonly dbMissing?: boolean;
}) {
  const [state, action] = useActionState(importChromePresetsAction, INITIAL_CHROME_PRESET_IMPORT_STATE);
  const message = importMessageOf(state, strings, maxImport);

  return (
    <section className="border-line bg-surface-raised flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-fg text-xs font-semibold">{strings.chromePresetIoTitle}</p>
        <p className="text-fg-muted text-[11px]">{strings.chromePresetIoHint}</p>
      </div>

      {dbMissing ? (
        <p className="text-brand-red text-[11px]">{strings.chromePresetDbMissing}</p>
      ) : (
        <>
          <a
            href="/admin/builder/chrome/export"
            download
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring self-start rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.chromePresetExport}
          </a>

          <form action={action} className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1">
              <span className="text-fg-muted text-[11px]">{strings.chromePresetImportLabel}</span>
              <textarea name="payload" rows={4} spellCheck={false} className={`${FIELD_CLASS} font-mono`} />
            </label>
            <span className="flex flex-wrap items-center gap-2">
              <Submit label={strings.chromePresetImport} />
              {message === null ? null : (
                <span className={state.status === "ok" ? "text-fg-muted text-[11px]" : "text-brand-red text-[11px]"}>{message}</span>
              )}
            </span>
          </form>
        </>
      )}
    </section>
  );
}

export function ChromePresetPanel({
  kind,
  rows,
  strings,
  maxPerKind,
  dbMissing = false,
  undoLabel = null,
}: {
  readonly kind: string;
  readonly rows: readonly ChromePresetRow[];
  readonly strings: ChromePresetStrings;
  readonly maxPerKind: number;
  readonly dbMissing?: boolean;
  /** ข้อความบอกว่าย้อนกลับได้ (แปลงแล้ว) — `null` = ไม่มีให้ย้อน */
  readonly undoLabel?: string | null;
}) {
  const [saveState, saveAction] = useActionState(saveChromePresetAction, INITIAL_CHROME_PRESET_STATE);
  const [undoState, undoAction] = useActionState(undoChromePresetAction, INITIAL_CHROME_PRESET_STATE);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <p className="text-fg text-xs font-semibold">{strings.chromePresetSaveTitle}</p>
        <p className="text-fg-muted text-[11px]">{strings.chromePresetSaveHint}</p>
      </div>

      {dbMissing ? (
        <p className="text-brand-red text-[11px]">{strings.chromePresetDbMissing}</p>
      ) : (
        <form action={saveAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="kind" value={kind} />
          <label className="flex min-w-40 flex-1 flex-col gap-1">
            <span className="text-fg-muted text-[11px]">{strings.chromePresetNameLabel}</span>
            <input
              type="text"
              name="name"
              maxLength={60}
              placeholder={strings.chromePresetNamePlaceholder}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-fg-muted text-[11px]">{strings.chromePresetSourceLabel}</span>
            <select name="source" className={FIELD_CLASS} defaultValue="draft">
              <option value="draft">{strings.chromePresetSourceDraft}</option>
              <option value="published">{strings.chromePresetSourcePublished}</option>
            </select>
          </label>
          <Submit label={strings.chromePresetSave} />
          <StatusLine state={saveState} strings={strings} maxPerKind={maxPerKind} />
        </form>
      )}

      {/* ย้อนกลับฉบับร่างก่อนใช้ชุด (รอบที่ 81) — มีปุ่มเฉพาะเมื่อมีของให้ย้อนจริง */}
      {undoLabel === null || dbMissing ? null : (
        <form action={undoAction} className="border-line flex flex-col gap-1 rounded-lg border p-2">
          <input type="hidden" name="kind" value={kind} />
          <span className="text-fg-muted text-[11px]">{undoLabel}</span>
          <span className="flex flex-wrap items-center gap-2">
            <Submit label={strings.chromePresetUndo} />
            <StatusLine state={undoState} strings={strings} maxPerKind={maxPerKind} />
          </span>
          <span className="text-fg-muted text-[11px]">{strings.chromePresetUndoHint}</span>
        </form>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-fg-muted text-[11px] font-semibold">{strings.chromePresetListTitle}</p>
        {rows.length === 0 ? (
          <p className="text-fg-muted text-[11px]">{strings.chromePresetEmpty}</p>
        ) : (
          <>
            <ul className="flex flex-col gap-1.5">
              {rows.map((row) => (
                <ChromePresetItem key={row.id} kind={kind} row={row} strings={strings} maxPerKind={maxPerKind} />
              ))}
            </ul>
            <p className="text-fg-muted text-[11px]">{strings.chromePresetApplyHint}</p>
          </>
        )}
      </div>
    </div>
  );
}

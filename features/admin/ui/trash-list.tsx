"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteTrashItemAction,
  emptyTrashAction,
  purgeTrashNowAction,
  restoreTrashAction,
} from "@/app/admin/trash/actions";
import { INITIAL_TRASH_STATE, type TrashActionState } from "@/features/admin/trash-state";
import { fillTemplate } from "@/lib/i18n/template";

/**
 * ส่วนที่ต้องมี JS ของ "ถังขยะ" (X2.4)
 *
 * - ข้อความทั้งหมดมาจากพจนานุกรม (ห้ามมีข้อความไทยในไฟล์นี้ — ด่าน `check:i18n`)
 * - **การตัดสินใจจริงอยู่ที่เซิร์ฟเวอร์** (ตรวจสิทธิ์ + เงื่อนไข "ต้องอยู่ในถังแล้ว" ใน SQL)
 *   ที่นี่แค่ส่งฟอร์มและแสดงผลลัพธ์
 * - ⚠️ ภาพในถังไม่ถูกเสิร์ฟบนเว็บ ⇒ ไม่มีตัวอย่างภาพในหน้านี้โดยเจตนา (มีคำอธิบายกำกับ)
 */

const BUTTON_CLASS =
  "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";
const DANGER_CLASS = `${BUTTON_CLASS} text-brand-red`;

export type TrashStrings = {
  readonly trashColItem: string;
  readonly trashColKind: string;
  readonly trashColDeletedAt: string;
  readonly trashColDeletedBy: string;
  readonly trashColExpiry: string;
  readonly trashColActions: string;
  readonly trashKindMedia: string;
  readonly trashKindPreset: string;
  readonly trashDaysLeft: string;
  readonly trashDueNow: string;
  readonly trashRestore: string;
  readonly trashRestoreDone: string;
  readonly trashDeleteForever: string;
  readonly trashDeleteForeverDone: string;
  readonly trashDeleteForeverWarning: string;
  readonly trashEmptyAction: string;
  readonly trashConfirmEmpty: string;
  readonly trashEmptyDone: string;
  readonly trashNotFound: string;
  readonly trashNoPreview: string;
  readonly trashPurgeNow: string;
  readonly trashDbMissing: string;
};

export type TrashRow = {
  readonly kind: "media" | "preset";
  readonly id: string;
  readonly label: string;
  readonly detail: string | null;
  readonly sizeLabel: string | null;
  readonly deletedAt: string;
  readonly deletedBy: string | null;
  readonly daysLeft: number | null;
};

function Submit({ label, danger = false }: { readonly label: string; readonly danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={danger ? DANGER_CLASS : BUTTON_CLASS}>
      {label}
    </button>
  );
}

/** แปลงรหัสผลลัพธ์เป็นข้อความ — รหัสที่ไม่รู้จักถือว่า "ไม่พบรายการ" (ปลอดภัยกว่าเงียบ) */
function messageOf(state: TrashActionState, strings: TrashStrings): string | null {
  switch (state.code) {
    case null:
      return null;
    case "restored":
      return strings.trashRestoreDone;
    case "deleted":
      return strings.trashDeleteForeverDone;
    case "emptied":
      return fillTemplate(strings.trashEmptyDone, { count: state.count ?? 0 });
    case "db-missing":
      return strings.trashDbMissing;
    default:
      return strings.trashNotFound;
  }
}

function StatusLine({ state, strings }: { readonly state: TrashActionState; readonly strings: TrashStrings }) {
  const message = messageOf(state, strings);
  if (message === null) return null;
  return (
    <span className={state.status === "ok" ? "text-fg-muted text-[11px]" : "text-brand-red text-[11px]"}>{message}</span>
  );
}

/** แถวเดียวในตาราง: กู้คืน + ลบถาวร (สองฟอร์มแยกกัน เพื่อให้ผู้ใช้ต้องเลือกให้ชัด) */
function TrashRowItem({
  row,
  strings,
  kindLabel,
  expiryLabel,
}: {
  readonly row: TrashRow;
  readonly strings: TrashStrings;
  readonly kindLabel: string;
  readonly expiryLabel: string;
}) {
  const [restoreState, restoreAction] = useActionState(restoreTrashAction, INITIAL_TRASH_STATE);
  const [deleteState, deleteAction] = useActionState(deleteTrashItemAction, INITIAL_TRASH_STATE);

  return (
    <tr className="border-line border-t align-top">
      <td className="py-2 pr-3">
        <span className="text-fg block text-xs font-semibold break-all">{row.label}</span>
        {row.detail === null ? null : <span className="text-fg-muted block text-[11px]">{row.detail}</span>}
        {row.sizeLabel === null ? null : <span className="text-fg-muted block text-[11px]">{row.sizeLabel}</span>}
      </td>
      <td className="text-fg-muted py-2 pr-3 text-xs whitespace-nowrap">{kindLabel}</td>
      <td className="text-fg-muted py-2 pr-3 font-mono text-[11px] whitespace-nowrap">
        {row.deletedAt.slice(0, 16).replace("T", " ")}
      </td>
      <td className="text-fg-muted py-2 pr-3 text-[11px] break-all">{row.deletedBy ?? "-"}</td>
      <td className="text-fg-muted py-2 pr-3 text-[11px] whitespace-nowrap">{expiryLabel}</td>
      <td className="py-2">
        <div className="flex flex-col gap-1.5">
          <form action={restoreAction} className="flex items-center gap-2">
            <input type="hidden" name="kind" value={row.kind} />
            <input type="hidden" name="id" value={row.id} />
            <Submit label={strings.trashRestore} />
            <StatusLine state={restoreState} strings={strings} />
          </form>
          <form action={deleteAction} className="flex items-center gap-2">
            <input type="hidden" name="kind" value={row.kind} />
            <input type="hidden" name="id" value={row.id} />
            <Submit label={strings.trashDeleteForever} danger />
            <StatusLine state={deleteState} strings={strings} />
          </form>
          <span className="text-fg-muted text-[11px]">{strings.trashDeleteForeverWarning}</span>
        </div>
      </td>
    </tr>
  );
}

export function TrashTable({
  rows,
  strings,
  label,
}: {
  readonly rows: readonly TrashRow[];
  readonly strings: TrashStrings;
  readonly label: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" aria-label={label}>
        <thead>
          <tr className="text-fg-muted text-[11px]">
            <th scope="col" className="py-1.5 pr-3 font-semibold">
              {strings.trashColItem}
            </th>
            <th scope="col" className="py-1.5 pr-3 font-semibold whitespace-nowrap">
              {strings.trashColKind}
            </th>
            <th scope="col" className="py-1.5 pr-3 font-semibold whitespace-nowrap">
              {strings.trashColDeletedAt}
            </th>
            <th scope="col" className="py-1.5 pr-3 font-semibold whitespace-nowrap">
              {strings.trashColDeletedBy}
            </th>
            <th scope="col" className="py-1.5 pr-3 font-semibold whitespace-nowrap">
              {strings.trashColExpiry}
            </th>
            <th scope="col" className="py-1.5 font-semibold">
              {strings.trashColActions}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <TrashRowItem
              key={`${row.kind}-${row.id}`}
              row={row}
              strings={strings}
              kindLabel={row.kind === "media" ? strings.trashKindMedia : strings.trashKindPreset}
              expiryLabel={
                row.daysLeft === null
                  ? strings.trashDueNow
                  : row.daysLeft <= 0
                    ? strings.trashDueNow
                    : fillTemplate(strings.trashDaysLeft, { days: row.daysLeft })
              }
            />
          ))}
        </tbody>
      </table>
      <p className="text-fg-muted mt-2 text-[11px]">{strings.trashNoPreview}</p>
    </div>
  );
}

/** ปุ่ม "ลบถาวรทั้งหมด" — ต้องติ๊กยืนยันก่อน (ด่านจริงอยู่ที่เซิร์ฟเวอร์) */
export function EmptyTrashForm({ strings }: { readonly strings: TrashStrings }) {
  const [state, action] = useActionState(emptyTrashAction, INITIAL_TRASH_STATE);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <label className="text-fg-muted flex items-center gap-1.5 text-[11px]">
        <input type="checkbox" name="confirm" value="yes" className="accent-brand-red" />
        {strings.trashConfirmEmpty}
      </label>
      <Submit label={strings.trashEmptyAction} danger />
      <StatusLine state={state} strings={strings} />
    </form>
  );
}

/** ปุ่ม "ลบของที่พ้นกำหนดเดี๋ยวนี้" — ลบเฉพาะของที่พ้นกำหนดแล้ว (ไม่ต้องยืนยัน) */
export function PurgeTrashForm({ strings }: { readonly strings: TrashStrings }) {
  return (
    <form action={purgeTrashNowAction} className="flex flex-wrap items-center gap-2">
      <Submit label={strings.trashPurgeNow} />
    </form>
  );
}

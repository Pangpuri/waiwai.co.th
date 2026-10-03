"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createPreviewLinkAction, revokePreviewLinkAction } from "@/app/admin/preview-links/actions";
import {
  INITIAL_PREVIEW_LINK_STATE,
  type PreviewLinkActionState,
} from "@/features/admin/preview-link-state";
import { fillTemplate } from "@/lib/i18n/template";

/**
 * ตัวจัดการ "ลิงก์พรีวิวชั่วคราว" (X2.6) — ส่วนที่ต้องมี JS
 *
 * - ข้อความทั้งหมดมาจากพจนานุกรม (ห้ามมีข้อความไทยในไฟล์นี้ — ด่าน `check:i18n`)
 * - **ลิงก์ที่สร้างเสร็จแสดงครั้งเดียว** (ฐานข้อมูลเก็บแต่ hash) ⇒ บอกผู้ใช้ให้คัดลอกทันที
 * - การตัดสินใจจริงอยู่ที่เซิร์ฟเวอร์ (ตรวจสิทธิ์ + ตรวจว่าหน้าพรีวิวได้)
 */

const BUTTON_CLASS =
  "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";
const DANGER_CLASS = `${BUTTON_CLASS} text-brand-red`;
const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

export type PreviewLinkStrings = {
  readonly previewLinkCreate: string;
  readonly previewLinkCreateAction: string;
  readonly previewLinkCreated: string;
  readonly previewLinkCreatedLabel: string;
  readonly previewLinkPageLabel: string;
  readonly previewLinkPageHome: string;
  readonly previewLinkLocaleLabel: string;
  readonly previewLinkLocaleTh: string;
  readonly previewLinkLocaleEn: string;
  readonly previewLinkListTitle: string;
  readonly previewLinkEmpty: string;
  readonly previewLinkColPage: string;
  readonly previewLinkColCreated: string;
  readonly previewLinkColCreatedBy: string;
  readonly previewLinkColExpires: string;
  readonly previewLinkColStatus: string;
  readonly previewLinkColUsed: string;
  readonly previewLinkColActions: string;
  readonly previewLinkStatusActive: string;
  readonly previewLinkStatusExpired: string;
  readonly previewLinkStatusRevoked: string;
  readonly previewLinkHoursLeft: string;
  readonly previewLinkUsedCount: string;
  readonly previewLinkNeverUsed: string;
  readonly previewLinkRevoke: string;
  readonly previewLinkRevoked: string;
  readonly previewLinkNotFound: string;
  readonly previewLinkTooMany: string;
  readonly previewLinkDbMissing: string;
  readonly previewLinkRevokeWarning: string;
};

export type PreviewLinkRow = {
  readonly id: string;
  readonly pageLabel: string;
  readonly createdLabel: string;
  readonly createdBy: string | null;
  readonly expiresLabel: string;
  readonly status: "active" | "expired" | "revoked";
  readonly statusLabel: string;
  readonly usageLabel: string;
};

function Submit({ label, danger = false }: { readonly label: string; readonly danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={danger ? DANGER_CLASS : BUTTON_CLASS}>
      {label}
    </button>
  );
}

/** แปลงรหัสผลลัพธ์เป็นข้อความ — รหัสที่ไม่รู้จักถือว่า "ไม่พบลิงก์" (ปลอดภัยกว่าเงียบ) */
function messageOf(
  state: PreviewLinkActionState,
  strings: PreviewLinkStrings,
  maxActive: number,
): string | null {
  switch (state.code) {
    case null:
      return null;
    case "created":
      return strings.previewLinkCreated;
    case "revoked":
      return strings.previewLinkRevoked;
    case "too-many":
      return fillTemplate(strings.previewLinkTooMany, { max: maxActive });
    case "no-database":
      return strings.previewLinkDbMissing;
    default:
      return strings.previewLinkNotFound;
  }
}

function StatusLine({
  state,
  strings,
  maxActive,
}: {
  readonly state: PreviewLinkActionState;
  readonly strings: PreviewLinkStrings;
  readonly maxActive: number;
}) {
  const message = messageOf(state, strings, maxActive);
  if (message === null) return null;

  return (
    <div className="flex flex-col gap-1">
      <span className={state.status === "ok" ? "text-fg-muted text-[11px]" : "text-brand-red text-[11px]"}>
        {message}
      </span>
      {state.path === null ? null : (
        <span className="flex flex-col gap-0.5">
          <span className="text-fg-muted text-[11px]">{strings.previewLinkCreatedLabel}</span>
          <input type="text" readOnly value={state.path} className={`${FIELD_CLASS} font-mono text-xs`} />
        </span>
      )}
    </div>
  );
}

/** ฟอร์มสร้างลิงก์ใหม่ (หน้า + ภาษา) */
export function PreviewLinkCreateForm({
  strings,
  maxActive,
}: {
  readonly strings: PreviewLinkStrings;
  readonly maxActive: number;
}) {
  const [state, action] = useActionState(createPreviewLinkAction, INITIAL_PREVIEW_LINK_STATE);

  return (
    <form action={action} className="border-line flex flex-wrap items-end gap-3 rounded-2xl border p-3">
      <label className="flex min-w-40 flex-col gap-1">
        <span className="text-fg-muted text-xs">{strings.previewLinkPageLabel}</span>
        <select name="page" className={FIELD_CLASS} defaultValue="home">
          <option value="home">{strings.previewLinkPageHome}</option>
        </select>
      </label>
      <label className="flex min-w-40 flex-col gap-1">
        <span className="text-fg-muted text-xs">{strings.previewLinkLocaleLabel}</span>
        <select name="locale" className={FIELD_CLASS} defaultValue="th">
          <option value="th">{strings.previewLinkLocaleTh}</option>
          <option value="en">{strings.previewLinkLocaleEn}</option>
        </select>
      </label>
      <Submit label={strings.previewLinkCreateAction} />
      <StatusLine state={state} strings={strings} maxActive={maxActive} />
    </form>
  );
}

/** แถวลิงก์หนึ่งรายการ + ปุ่มยกเลิก */
function PreviewLinkRowItem({ row, strings, maxActive }: { readonly row: PreviewLinkRow; readonly strings: PreviewLinkStrings; readonly maxActive: number }) {
  const [state, action] = useActionState(revokePreviewLinkAction, INITIAL_PREVIEW_LINK_STATE);

  return (
    <tr className="border-line border-t align-top">
      <td className="text-fg py-2 pr-3 text-xs font-semibold">{row.pageLabel}</td>
      <td className="text-fg-muted py-2 pr-3 font-mono text-[11px] whitespace-nowrap">{row.createdLabel}</td>
      <td className="text-fg-muted py-2 pr-3 text-[11px] break-all">{row.createdBy ?? "-"}</td>
      <td className="text-fg-muted py-2 pr-3 font-mono text-[11px] whitespace-nowrap">{row.expiresLabel}</td>
      <td className="py-2 pr-3 text-xs whitespace-nowrap">
        <span className={row.status === "active" ? "text-fg font-semibold" : "text-fg-muted"}>{row.statusLabel}</span>
      </td>
      <td className="text-fg-muted py-2 pr-3 text-[11px]">{row.usageLabel}</td>
      <td className="py-2">
        {row.status === "active" ? (
          <form action={action} className="flex flex-col gap-1">
            <input type="hidden" name="id" value={row.id} />
            <Submit label={strings.previewLinkRevoke} danger />
            <StatusLine state={state} strings={strings} maxActive={maxActive} />
          </form>
        ) : (
          <span className="text-fg-muted text-[11px]">{row.statusLabel}</span>
        )}
      </td>
    </tr>
  );
}

export function PreviewLinkTable({
  rows,
  strings,
  maxActive,
}: {
  readonly rows: readonly PreviewLinkRow[];
  readonly strings: PreviewLinkStrings;
  readonly maxActive: number;
}) {
  if (rows.length === 0) {
    return <p className="border-line bg-surface text-fg-muted rounded-2xl border p-5 text-sm">{strings.previewLinkEmpty}</p>;
  }

  return (
    <section className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-4">
      <h2 className="text-fg text-sm font-semibold">{strings.previewLinkListTitle}</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-fg-muted text-[11px]">
              <th scope="col" className="py-1.5 pr-3 font-semibold">
                {strings.previewLinkColPage}
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold whitespace-nowrap">
                {strings.previewLinkColCreated}
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold whitespace-nowrap">
                {strings.previewLinkColCreatedBy}
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold whitespace-nowrap">
                {strings.previewLinkColExpires}
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold whitespace-nowrap">
                {strings.previewLinkColStatus}
              </th>
              <th scope="col" className="py-1.5 pr-3 font-semibold whitespace-nowrap">
                {strings.previewLinkColUsed}
              </th>
              <th scope="col" className="py-1.5 font-semibold">
                {strings.previewLinkColActions}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PreviewLinkRowItem key={row.id} row={row} strings={strings} maxActive={maxActive} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-fg-muted text-[11px]">{strings.previewLinkRevokeWarning}</p>
    </section>
  );
}

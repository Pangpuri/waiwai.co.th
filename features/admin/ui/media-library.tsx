"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteMediaAction,
  replaceMediaAction,
  uploadFromLibraryAction,
  type MediaActionState,
} from "@/app/admin/media/library-actions";


/**
 * ส่วนที่ต้องมี JS ของคลังภาพ (X1.2): อัปโหลด · แทนไฟล์ · ลบ (พร้อมเหตุผลเมื่อลบไม่ได้)
 *
 * ⚠️ ตัวลบไม่ลบถ้าภาพยังถูกใช้ — เซิร์ฟเวอร์เป็นคนตัดสิน (ที่นี่แค่แสดงผลลัพธ์)
 * ⚠️ ข้อความทั้งหมดมาจากพจนานุกรม
 */

const INITIAL: MediaActionState = { status: "idle", message: [] };
const BUTTON_CLASS =
  "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";
const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

function Submit({ label, danger = false }: { readonly label: string; readonly danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={danger ? `${BUTTON_CLASS} text-brand-red` : BUTTON_CLASS}
    >
      {label}
    </button>
  );
}

function StatusLine({ state, strings }: { readonly state: MediaActionState; readonly strings: Strings }) {
  if (state.status === "idle") return null;

  if (state.status === "blocked") {
    return (
      <div className="text-fg-muted flex flex-col gap-0.5 text-[11px]">
        <span className="text-brand-red font-semibold">{strings.mediaDeleteBlocked}</span>
        <span>
          {strings.mediaUsage}: {state.message.join(" · ")}
        </span>
      </div>
    );
  }

  if (state.status === "ok") {
    return (
      <span className="text-fg-muted text-[11px]">
        {state.message[0] === "trashed" ? strings.mediaDeleted : state.message[0] === "replaced" ? "✓" : state.message[0]}
      </span>
    );
  }

  return <span className="text-brand-red text-[11px]">{state.message.join(" · ")}</span>;
}

type Strings = {
  readonly mediaUploadTitle: string;
  readonly mediaUploadAction: string;
  readonly mediaReplace: string;
  readonly mediaReplaceAction: string;
  readonly mediaDelete: string;
  readonly mediaDeleteBlocked: string;
  readonly mediaDeleted: string;
  readonly mediaUsage: string;
};

/** อัปโหลดภาพใหม่จากหน้าคลังภาพ */
export function MediaUpload({ strings }: { readonly strings: Strings }) {
  const [state, action] = useActionState(uploadFromLibraryAction, INITIAL);

  return (
    <form action={action} className="border-line flex flex-wrap items-end gap-2 rounded-2xl border p-3">
      <label className="flex min-w-48 flex-1 flex-col gap-1">
        <span className="text-fg-muted text-xs">{strings.mediaUploadTitle}</span>
        <input type="file" name="file" accept="image/*" className={FIELD_CLASS} />
      </label>
      <Submit label={strings.mediaUploadAction} />
      <StatusLine state={state} strings={strings} />
    </form>
  );
}

/** แทนไฟล์ + ลบ (ใช้ร่วมกันในแต่ละการ์ดภาพ) */
export function MediaItemActions({
  id,
  strings,
  used,
}: {
  readonly id: string;
  readonly strings: Strings;
  readonly used: boolean;
}) {
  const [deleteState, deleteAction] = useActionState(deleteMediaAction, INITIAL);
  const [replaceState, replaceAction] = useActionState(replaceMediaAction, INITIAL);

  return (
    <div className="flex flex-col gap-2">
      <form action={replaceAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={id} />
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-fg-muted text-[11px]">{strings.mediaReplace}</span>
          <input type="file" name="file" accept="image/*" className={FIELD_CLASS} />
        </label>
        <Submit label={strings.mediaReplaceAction} />
        <StatusLine state={replaceState} strings={strings} />
      </form>

      <form action={deleteAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <Submit label={strings.mediaDelete} danger />
        {used ? <span className="text-fg-muted text-[11px]">{strings.mediaUsage}</span> : null}
        <StatusLine state={deleteState} strings={strings} />
      </form>
    </div>
  );
}

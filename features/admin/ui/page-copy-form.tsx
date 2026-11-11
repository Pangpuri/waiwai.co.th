"use client";

import { useActionState } from "react";

import { INITIAL_PAGE_COPY_STATE, type PageCopyFormStrings, type PageCopyState } from "@/features/admin/page-copy-state";
import { AdminToast } from "@/features/admin/ui/admin-toast";
import type { PageCopy } from "@/lib/page-copy/model";

const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring rounded-lg border px-2.5 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";

/**
 * ฟอร์มข้อความหัวหน้าหน้าเนื้อหา (รอบ 342) — ใช้ร่วมกับ recipes/news
 *
 * - eyebrow = ข้อความเล็กเหนือหัวข้อ · title = หัวข้อ · intro = คำโปรย
 * - มี TH/EN คู่กัน · เว้นว่าง = หน้าเว็บใช้ข้อความเดิมจากพจนานุกรม
 * - ปุ่มเดียว = บันทึก + เผยแพร่ทันที (คีย์แยกต่อหน้า)
 */
export function PageCopyForm({
  initial,
  strings,
  action,
}: {
  readonly initial: PageCopy;
  readonly strings: PageCopyFormStrings;
  readonly action: (previous: PageCopyState, formData: FormData) => Promise<PageCopyState>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_PAGE_COPY_STATE);

  const statusText =
    state.status === "idle"
      ? ""
      : state.status === "saved"
        ? strings.saved
        : state.reason === "database"
          ? strings.failed
          : strings.invalid;

  return (
    <section className="border-line bg-bg-subtle mt-6 rounded-2xl border p-4">
      <form action={formAction} className="flex flex-col gap-3">
        <div>
          <h2 className="text-fg text-base font-semibold">{strings.title}</h2>
          <p className="text-fg-muted mt-1 text-sm">{strings.hint}</p>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-fg-muted text-xs font-semibold">{strings.eyebrowTh}</span>
            <input type="text" name="eyebrowTh" defaultValue={initial.eyebrow.th} maxLength={80} className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-fg-muted text-xs font-semibold">{strings.eyebrowEn}</span>
            <input type="text" name="eyebrowEn" defaultValue={initial.eyebrow.en} maxLength={80} className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-fg-muted text-xs font-semibold">{strings.titleTh}</span>
            <input type="text" name="titleTh" defaultValue={initial.title.th} maxLength={120} className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-fg-muted text-xs font-semibold">{strings.titleEn}</span>
            <input type="text" name="titleEn" defaultValue={initial.title.en} maxLength={120} className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-fg-muted text-xs font-semibold">{strings.introTh}</span>
            <textarea name="introTh" defaultValue={initial.intro.th} rows={3} maxLength={600} className={FIELD_CLASS} />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-fg-muted text-xs font-semibold">{strings.introEn}</span>
            <textarea name="introEn" defaultValue={initial.intro.en} rows={3} maxLength={600} className={FIELD_CLASS} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
          >
            {pending ? strings.saving : strings.save}
          </button>
          {statusText === "" ? null : (
            <AdminToast message={statusText} tone={state.status === "error" ? "error" : "success"} trigger={state} />
          )}
        </div>
      </form>
    </section>
  );
}

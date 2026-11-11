"use client";

import { useActionState } from "react";

import { saveProductsPageCopyAction } from "@/app/admin/product-categories/actions";
import { INITIAL_PRODUCTS_PAGE_COPY_STATE } from "@/features/admin/category-state";
import { AdminToast } from "@/features/admin/ui/admin-toast";
import type { Messages } from "@/lib/i18n/messages/th";
import type { ProductsPageCopy } from "@/lib/products/page-copy-model";

const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring rounded-lg border px-2.5 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";

/**
 * ข้อความหัวหน้า `/products` (รอบ 342) — ย้ายมาไว้หน้าจอ "หมวดสินค้า" ตามคำเจ้าของ
 *
 * - eyebrow = ข้อความเล็กเหนือหัวข้อ · title = หัวข้อ · intro = คำโปรย
 * - มี TH/EN คู่กัน · เว้นว่าง = หน้าเว็บใช้ข้อความเดิมจากพจนานุกรม
 * - ปุ่มเดียว = บันทึก + เผยแพร่ทันที (คีย์แยกจาก site-settings)
 */
export function ProductsPageCopyForm({
  initial,
  strings,
}: {
  readonly initial: ProductsPageCopy;
  readonly strings: Messages["adminCategories"];
}) {
  const [state, formAction, pending] = useActionState(saveProductsPageCopyAction, INITIAL_PRODUCTS_PAGE_COPY_STATE);

  const statusText =
    state.status === "idle"
      ? ""
      : state.status === "saved"
        ? strings.productsPageCopySaved
        : state.reason === "database"
          ? strings.productsPageCopyFailed
          : strings.productsPageCopyInvalid;

  return (
    <section className="border-line bg-bg-subtle rounded-2xl border p-4">
      <form action={formAction} className="flex flex-col gap-3">
        <div>
          <h2 className="text-fg text-base font-semibold">{strings.productsPageCopyTitle}</h2>
          <p className="text-fg-muted mt-1 text-sm">{strings.productsPageCopyHint}</p>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-fg-muted text-xs font-semibold">{strings.productsPageCopyEyebrowTh}</span>
            <input
              type="text"
              name="eyebrowTh"
              defaultValue={initial.eyebrow.th}
              maxLength={80}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-fg-muted text-xs font-semibold">{strings.productsPageCopyEyebrowEn}</span>
            <input
              type="text"
              name="eyebrowEn"
              defaultValue={initial.eyebrow.en}
              maxLength={80}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-fg-muted text-xs font-semibold">{strings.productsPageCopyTitleTh}</span>
            <input
              type="text"
              name="titleTh"
              defaultValue={initial.title.th}
              maxLength={120}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-fg-muted text-xs font-semibold">{strings.productsPageCopyTitleEn}</span>
            <input
              type="text"
              name="titleEn"
              defaultValue={initial.title.en}
              maxLength={120}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-fg-muted text-xs font-semibold">{strings.productsPageCopyIntroTh}</span>
            <textarea
              name="introTh"
              defaultValue={initial.intro.th}
              rows={3}
              maxLength={600}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-fg-muted text-xs font-semibold">{strings.productsPageCopyIntroEn}</span>
            <textarea
              name="introEn"
              defaultValue={initial.intro.en}
              rows={3}
              maxLength={600}
              className={FIELD_CLASS}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
          >
            {pending ? strings.productsPageCopySaving : strings.productsPageCopySave}
          </button>
          {statusText === "" ? null : (
            <AdminToast
              message={statusText}
              tone={state.status === "error" ? "error" : "success"}
              trigger={state}
            />
          )}
        </div>
      </form>
    </section>
  );
}

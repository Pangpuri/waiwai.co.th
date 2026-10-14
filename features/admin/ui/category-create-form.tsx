"use client";

import { useActionState, useState } from "react";

import { createCategoryAction } from "@/app/admin/product-categories/actions";
import { INITIAL_CATEGORY_FORM_STATE } from "@/features/admin/category-state";
import { CategoryImagePicker } from "@/features/admin/ui/category-image-picker";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";
import { slugifyCategoryName } from "@/lib/products/categories";

/**
 * ฟอร์ม **เพิ่มหมวดใหม่** (รอบที่ 264 · มติ D25 ข้อ 1/2)
 *
 * - slug สร้างจาก **ชื่ออังกฤษ** อัตโนมัติ และ **ล็อกถาวร** (แสดงตัวอย่าง URL ให้เห็นก่อนกด)
 * - ชื่ออังกฤษที่ไม่มี a–z/0–9 = สร้างไม่ได้ ⇒ บอกผู้ใช้ตรง ๆ (ห้ามเดา slug ให้เจ้าของ)
 * - หมวดใหม่ต้องมีภาพ (โลโก้หรือภาพหัวหมวด) จึงจะขึ้นเว็บ — ตรงกับกติกาของ `mergeSiteCategories`
 * - **ไม่มี `<form>` ซ้อน** — ช่องภาพเรียก Server Action เอง
 */

export type CategoryCreateFormProps = {
  readonly strings: Messages["adminCategories"];
  readonly library: readonly { readonly id: string; readonly filename: string; readonly path: string }[];
  /** ถึงเพดาน 12 หมวดแล้ว = ปิดฟอร์ม (validator ฝั่งเซิร์ฟเวอร์กันซ้ำอีกชั้น) */
  readonly limitReached: boolean;
};

const INPUT_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted mb-1 block text-xs font-semibold";
const PRIMARY_CLASS =
  "bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2";
const DISABLED_CLASS = "bg-surface-raised text-fg-muted inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold";

export function CategoryCreateForm(props: CategoryCreateFormProps) {
  const m = props.strings;
  const [state, formAction, pending] = useActionState(createCategoryAction, INITIAL_CATEGORY_FORM_STATE);

  const [nameTh, setNameTh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [logoPath, setLogoPath] = useState("");

  const slug = slugifyCategoryName(nameEn);
  const statusMessage =
    state.status === "saved"
      ? state.createdSlug === ""
        ? m.created
        : `${m.created} · ${fillTemplate(m.slugPreview, { slug: state.createdSlug })}`
      : state.status === "error"
        ? state.reason === "limit"
          ? m.tooManyCategories
          : state.reason === "duplicate"
            ? m.createFailed
            : m.invalid
        : "";

  return (
    <form action={formAction} className="border-line bg-surface rounded-2xl border p-4">
      <h2 className="text-fg text-base font-semibold">{m.createTitle}</h2>
      <p className="text-fg-muted mt-1 text-sm">{m.createHint}</p>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className={LABEL_CLASS}>{m.fieldNameTh}</span>
          <input
            type="text"
            name="nameTh"
            value={nameTh}
            onChange={(event) => setNameTh(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>{m.fieldNameEn}</span>
          <input
            type="text"
            name="nameEn"
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>
      </div>
      {/* ตัวอย่าง URL: เห็นก่อนกดว่าหมวดใหม่จะอยู่ที่พาธไหน (แก้ทีหลังไม่ได้) */}
      <p className="text-fg-muted mt-1 text-[11px]">
        {slug === "" ? m.slugUnavailable : fillTemplate(m.slugPreview, { slug })}
      </p>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <CategoryImagePicker
          name="imagePath"
          label={m.fieldImage}
          hint={m.fieldImageHint}
          value={imagePath}
          onChange={setImagePath}
          library={props.library}
          imageAlt={nameEn.trim() === "" ? nameTh : nameEn}
          strings={m}
        />
        <CategoryImagePicker
          name="logoPath"
          label={m.fieldLogo}
          hint={m.fieldLogoHint}
          value={logoPath}
          onChange={setLogoPath}
          library={props.library}
          imageAlt={nameEn.trim() === "" ? nameTh : nameEn}
          strings={m}
        />
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <label className="min-w-0 flex-1">
          <span className={LABEL_CLASS}>{m.fieldDescriptionTh}</span>
          <textarea name="descriptionTh" rows={2} className={INPUT_CLASS} />
        </label>
        <label className="min-w-0 flex-1">
          <span className={LABEL_CLASS}>{m.fieldDescriptionEn}</span>
          <textarea name="descriptionEn" rows={2} className={INPUT_CLASS} />
        </label>
      </div>

      {statusMessage === "" ? null : (
        <p
          role="status"
          className={`border-line bg-bg-subtle mt-3 rounded-xl border px-3 py-2 text-sm ${
            state.status === "error" ? "text-danger" : "text-fg"
          }`}
        >
          {statusMessage}
        </p>
      )}

      <div className="mt-3">
        {props.limitReached ? (
          <p className={DISABLED_CLASS}>{m.tooManyCategories}</p>
        ) : (
          <button type="submit" disabled={pending} className={PRIMARY_CLASS}>
            {m.create}
          </button>
        )}
      </div>
    </form>
  );
}

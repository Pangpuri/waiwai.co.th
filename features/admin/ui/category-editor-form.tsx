"use client";

import { useActionState, useState } from "react";

import { saveCategoryAction } from "@/app/admin/product-categories/actions";
import { INITIAL_CATEGORY_FORM_STATE } from "@/features/admin/category-state";
import { CategoryImagePicker } from "@/features/admin/ui/category-image-picker";
import { PreviewFrame, SITE_CATEGORY_CARD_WIDTH } from "@/features/admin/ui/preview-frame";
import { ProductCategoryCard } from "@/features/products/ui/category-card";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ฟอร์มแก้ **หมวดสินค้า 1 ใบ** (รอบที่ 264 · มติ D25)
 *
 * หลักการ (ยึดของเดิมทุกข้อ)
 * - **ไม่มี `<form>` ซ้อน** (บทเรียนรอบที่ 129) — ปุ่มอัปโหลดของช่องภาพเรียก Server Action เอง
 * - ชื่อ/คำอธิบาย/ภาพ/โลโก้/ลำดับ/การซ่อน = แก้ได้ · **slug แก้ไม่ได้** (แสดงให้เห็นว่า URL คืออะไร)
 * - พรีวิวใช้ **`ProductCategoryCard` ตัวเดียวกับหน้าเว็บ** และเรนเดอร์ที่ **ความกว้างการ์ดจริง 1:1**
 *   ⇒ "สิ่งที่เห็นตอนแก้ = สิ่งที่ขึ้นเว็บ"
 * - ข้อความทุกคำมาจากพจนานุกรม · สีใช้ token เท่านั้น
 *
 * ⚠️ การซ่อน/คืนค่าเริ่มต้น **ไม่ใช่ฟอร์มนี้** — หน้าจอวางเป็นฟอร์มย่อยแยก (ห้ามซ้อนฟอร์ม)
 */

export type CategoryEditorInitial = {
  /** ที่อยู่บนเว็บปัจจุบัน (`/products/<slug>`) — แก้ได้ (รอบที่ 280) */
  readonly slug: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  /** พาธ `/media/<id>` หรือ "" = ไม่มีภาพ */
  readonly imagePath: string;
  readonly logoPath: string;
  readonly logoWidth: number | null;
  readonly logoHeight: number | null;
  readonly sortOrder: number;
  readonly isHidden: boolean;
};

export type CategoryEditorFormProps = {
  readonly strings: Messages["adminCategories"];
  readonly categoryId: string;
  /** true = หมวดในโค้ด (มีค่าเริ่มต้นถาวร) */
  readonly builtIn: boolean;
  /** ชื่อที่มีผลจริงตอนนี้ (DB → พจนานุกรม) */
  readonly categoryName: string;
  readonly imageAlt: string;
  readonly productCount: number;
  readonly library: readonly { readonly id: string; readonly filename: string; readonly path: string }[];
  /** โลโก้สำรองจากไฟล์ใน `public/` (เฉพาะหมวดในโค้ด) — null = ไม่มี */
  readonly fallbackLogo: { readonly src: string; readonly width: number; readonly height: number } | null;
  readonly initial: CategoryEditorInitial;
};

const INPUT_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted mb-1 block text-xs font-semibold";
const PRIMARY_CLASS =
  "bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2";

export function CategoryEditorForm(props: CategoryEditorFormProps) {
  const m = props.strings;
  const [state, formAction, pending] = useActionState(saveCategoryAction, INITIAL_CATEGORY_FORM_STATE);

  const [slug, setSlug] = useState(props.initial.slug);
  const [nameTh, setNameTh] = useState(props.initial.nameTh);
  const [nameEn, setNameEn] = useState(props.initial.nameEn);
  const [descriptionTh, setDescriptionTh] = useState(props.initial.descriptionTh);
  const [descriptionEn, setDescriptionEn] = useState(props.initial.descriptionEn);
  const [imagePath, setImagePath] = useState(props.initial.imagePath);
  const [logoPath, setLogoPath] = useState(props.initial.logoPath);
  const [sortOrder, setSortOrder] = useState(String(props.initial.sortOrder));

  /* พรีวิว: ค่าที่แก้ค้างในฟอร์ม ⇒ พิมพ์/เปลี่ยนภาพปุ๊บเห็นปั๊บ (ชื่อว่าง = ถอยชื่อเดิม) */
  const previewName = nameTh.trim() === "" ? props.categoryName : nameTh;
  const previewLogo =
    logoPath === ""
      ? props.fallbackLogo
      : { src: logoPath, width: props.initial.logoWidth ?? 300, height: props.initial.logoHeight ?? 200 };

  const statusMessage = state.status === "saved" ? m.saved : state.status === "error" ? m.saveFailed : "";

  return (
    <form action={formAction} className="border-line bg-surface rounded-2xl border p-4">
      <input type="hidden" name="categoryId" value={props.categoryId} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-fg text-base font-semibold">{props.categoryName}</h3>
        <span className="text-fg-muted text-xs">
          {fillTemplate(m.productCountLabel, { count: String(props.productCount) })}
        </span>
      </div>
      <p className="text-fg-muted mt-1 text-[11px]">
        {fillTemplate(m.slugPreview, { slug: slug.trim() === "" ? props.categoryId : slug.trim() })} · {m.slugHint}
      </p>

      {/* ที่อยู่บนเว็บ — แก้ได้ พร้อมคำอธิบายเรื่อง 301 (รอบที่ 280 · มติ D30) */}
      <label className="mt-3 block">
        <span className={LABEL_CLASS}>{m.fieldSlug}</span>
        <span className="flex items-center gap-2">
          <span className="text-fg-muted text-sm font-semibold">/products/</span>
          <input
            type="text"
            name="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            className={INPUT_CLASS}
          />
        </span>
        <span className="text-fg-muted mt-1 block text-[11px]">{m.slugChangeHint}</span>
      </label>

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
      {props.builtIn ? <p className="text-fg-muted mt-1 text-[11px]">{m.nameThFallbackHint}</p> : null}

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <CategoryImagePicker
          name="imagePath"
          label={m.fieldImage}
          hint={m.fieldImageHint}
          value={imagePath}
          onChange={setImagePath}
          library={props.library}
          imageAlt={props.imageAlt}
          strings={m}
        />
        <CategoryImagePicker
          name="logoPath"
          label={m.fieldLogo}
          hint={m.fieldLogoHint}
          value={logoPath}
          onChange={setLogoPath}
          library={props.library}
          imageAlt={props.imageAlt}
          strings={m}
        />
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <label className="min-w-0 flex-1">
          <span className={LABEL_CLASS}>{m.fieldDescriptionTh}</span>
          <textarea
            name="descriptionTh"
            value={descriptionTh}
            onChange={(event) => setDescriptionTh(event.target.value)}
            rows={3}
            className={INPUT_CLASS}
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className={LABEL_CLASS}>{m.fieldDescriptionEn}</span>
          <textarea
            name="descriptionEn"
            value={descriptionEn}
            onChange={(event) => setDescriptionEn(event.target.value)}
            rows={3}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="block w-32">
          <span className={LABEL_CLASS}>{m.fieldSortOrder}</span>
          <input
            type="number"
            name="sortOrder"
            min={0}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            className={INPUT_CLASS}
          />
          <span className="text-fg-muted mt-1 block text-[11px]">{m.fieldSortOrderHint}</span>
        </label>
        <label className="flex items-center gap-2 pb-1">
          <input type="checkbox" name="isHidden" defaultChecked={props.initial.isHidden} className="h-4 w-4" />
          <span className="text-fg text-sm font-semibold">{m.fieldHidden}</span>
        </label>
      </div>

      {/* พรีวิวการ์ดจริง (คอมโพเนนต์เดียวกับหน้าเว็บ · ความกว้างการ์ดจริง) */}
      <div className="mt-4">
        <p className={LABEL_CLASS}>{m.previewHeading}</p>
        {previewLogo === null ? (
          <p className="border-line bg-bg-subtle text-fg-muted rounded-xl border px-3 py-4 text-xs">{m.noImageHint}</p>
        ) : (
          <PreviewFrame
            singleCard
            width={SITE_CATEGORY_CARD_WIDTH}
            label={fillTemplate(m.slugPreview, { slug: slug.trim() === "" ? props.categoryId : slug.trim() })}
          >
            <ul className="category-card-grid grid gap-6 lg:grid-cols-3">
              <li>
                <ProductCategoryCard
                  name={previewName}
                  imageSrc={previewLogo.src}
                  imageWidth={previewLogo.width}
                  imageHeight={previewLogo.height}
                  imageAlt={props.imageAlt}
                  href={null}
                />
              </li>
            </ul>
          </PreviewFrame>
        )}
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
        <button type="submit" disabled={pending} className={PRIMARY_CLASS}>
          {m.save}
        </button>
      </div>
    </form>
  );
}

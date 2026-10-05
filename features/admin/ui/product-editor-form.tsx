"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import { saveProductAction, uploadProductImageAction } from "@/app/admin/products/actions";
import { INITIAL_ADMIN_UPLOAD_STATE, INITIAL_PRODUCT_SAVE_STATE } from "@/features/admin/product-state";
import { ImageFileInput } from "@/features/admin/ui/image-file-input";
import { ProductListSection, type ProductListStrings } from "@/features/products/ui/product-list";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";
import { mediaIdFromPath } from "@/lib/media/usage";
import type { ProductRecord } from "@/lib/products/repository";

/**
 * หน้าจอแก้ "สินค้า" (รอบที่ 133) — client component
 *
 * ที่มา: เจ้าของเลือก "ครบทั้ง 3 ชั้น" (หมวด · สินค้า · ส่วนผสม) + จอแบบ **การ์ด + พรีวิว**
 *
 * หลักการสำคัญ
 * - **พรีวิวใช้ตัวเรนเดอร์ตัวเดียวกับหน้าเว็บจริง** (`ProductListSection` ตัวที่หน้า `/products/<slug>` ใช้)
 *   ⇒ "สิ่งที่เห็น = สิ่งที่ผู้อ่านเห็น" (กันพรีวิวโกหก แบบเดียวกับข่าวรอบ 128)
 * - **ไม่มี `<form>` ซ้อน** (บทเรียนรอบ 129): ปุ่มอัปโหลดเรียก Server Action เอง ไม่ใช้ `<form>` ย่อย
 * - ค่าที่ส่งไปเซอร์ฟเวอร์ถูกตรวจซ้ำด้วย validator กลางทุกครั้ง · ส่วนผสมส่งเป็น JSON ในช่องซ่อน
 * - คำบรรยาย/ป้ายทั้งหมดมาจากพจนานุกรม (ห้ามพิมพ์ไทยใน .tsx) · สีใช้ token เท่านั้น
 */

export type ProductLibraryItem = {
  readonly id: string;
  readonly filename: string;
  readonly path: string;
};

export type ProductCategoryOption = { readonly slug: string; readonly name: string };

export type ProductEditorInitial = {
  readonly id: string;
  readonly sourceId: string;
  readonly categoryId: string;
  readonly nameTh: string;
  readonly nameEn: string;
  readonly groupTh: string;
  readonly groupEn: string;
  readonly taglineTh: string;
  readonly taglineEn: string;
  readonly detailsTh: string;
  readonly allergensTh: string;
  readonly netWeightTh: string;
  readonly fdaNumber: string;
  readonly packagingTh: string;
  readonly sortOrder: number;
  readonly imagePath: string;
  readonly ingredients: readonly { readonly nameTh: string; readonly nameEn: string; readonly percentText: string }[];
};

type ProductEditorFormProps = {
  readonly strings: Messages["admin"];
  readonly publicStrings: ProductListStrings;
  readonly initial: ProductEditorInitial;
  readonly categories: readonly ProductCategoryOption[];
  readonly library: readonly ProductLibraryItem[];
  readonly language: "th" | "en";
};

const INPUT_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted mb-1 block text-xs font-semibold";
const BUTTON_CLASS =
  "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none";
const PRIMARY_CLASS =
  "bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2";

type IngredientDraft = { readonly key: string; readonly nameTh: string; readonly nameEn: string; readonly percentText: string };

let ingredientCounter = 0;

export function ProductEditorForm(props: ProductEditorFormProps) {
  const m = props.strings;
  const [state, formAction, pending] = useActionState(saveProductAction, INITIAL_PRODUCT_SAVE_STATE);

  const [fields, setFields] = useState({
    categoryId: props.initial.categoryId,
    nameTh: props.initial.nameTh,
    nameEn: props.initial.nameEn,
    groupTh: props.initial.groupTh,
    groupEn: props.initial.groupEn,
    taglineTh: props.initial.taglineTh,
    taglineEn: props.initial.taglineEn,
    detailsTh: props.initial.detailsTh,
    allergensTh: props.initial.allergensTh,
    netWeightTh: props.initial.netWeightTh,
    fdaNumber: props.initial.fdaNumber,
    packagingTh: props.initial.packagingTh,
    sortOrder: String(props.initial.sortOrder),
    imagePath: props.initial.imagePath,
  });
  const [ingredients, setIngredients] = useState<readonly IngredientDraft[]>(() =>
    props.initial.ingredients.map((item) => ({
      key: `i${String((ingredientCounter += 1))}`,
      nameTh: item.nameTh,
      nameEn: item.nameEn,
      percentText: item.percentText,
    })),
  );
  const [uploadState, setUploadState] = useState(INITIAL_ADMIN_UPLOAD_STATE);
  const [uploading, setUploading] = useState(false);

  function setField(key: keyof typeof fields, value: string): void {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function setIngredient(key: string, patch: Partial<IngredientDraft>): void {
    setIngredients((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function addIngredient(): void {
    ingredientCounter += 1;
    setIngredients((current) => [...current, { key: `i${String(ingredientCounter)}`, nameTh: "", nameEn: "", percentText: "" }]);
  }

  function removeIngredient(key: string): void {
    setIngredients((current) => current.filter((item) => item.key !== key));
  }

  function moveIngredient(key: string, direction: -1 | 1): void {
    setIngredients((current) => {
      const index = current.findIndex((item) => item.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (moved === undefined) return current;
      next.splice(target, 0, moved);
      return next;
    });
  }

  /** อัปโหลดภาพจากเครื่อง — เรียก Server Action เอง (ห้ามใช้ <form> ซ้อน) */
  async function submitUpload(event: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    const wrapper = event.currentTarget.closest("div");
    const input = wrapper?.querySelector<HTMLInputElement>('input[type="file"]') ?? null;
    const file = input?.files?.item(0) ?? null;
    if (file === null) {
      setUploadState({ ...INITIAL_ADMIN_UPLOAD_STATE, status: "invalid", reason: "missing" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadProductImageAction(INITIAL_ADMIN_UPLOAD_STATE, formData);
      setUploadState(result);
      if (result.status === "ok" && mediaIdFromPath(result.path) !== null) setField("imagePath", result.path);
    } catch {
      setUploadState({ ...INITIAL_ADMIN_UPLOAD_STATE, status: "failed", reason: "failed" });
    } finally {
      setUploading(false);
    }
  }

  /* พรีวิว: ประกอบเป็น ProductRecord จากค่าที่กำลังพิมพ์ แล้วส่งให้ตัวเรนเดอร์ของหน้าเว็บจริง */
  const previewRecord: ProductRecord = {
    id: props.initial.id === "" ? "preview" : props.initial.id,
    categoryId: fields.categoryId,
    nameTh: fields.nameTh,
    nameEn: fields.nameEn,
    groupTh: fields.groupTh,
    groupEn: fields.groupEn,
    taglineTh: fields.taglineTh,
    taglineEn: fields.taglineEn,
    detailsTh: fields.detailsTh,
    allergensTh: fields.allergensTh,
    netWeightTh: fields.netWeightTh,
    fdaNumber: fields.fdaNumber,
    packagingTh: fields.packagingTh,
    imagePath: fields.imagePath === "" ? null : fields.imagePath,
    imageWidth: null,
    imageHeight: null,
    sortOrder: 0,
    ingredients: ingredients.map((item, index) => ({
      sortOrder: index + 1,
      nameTh: item.nameTh,
      nameEn: item.nameEn,
      percentText: item.percentText,
    })),
  };

  const statusMessage =
    state.status === "saved"
      ? m.adminProductsSaved
      : state.status === "error"
        ? state.reason === "title"
          ? m.adminProductsErrorTitle
          : state.reason === "ingredients"
            ? m.adminProductsErrorIngredients
            : m.adminProductsErrorDatabase
        : "";

  return (
    <form action={formAction} className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <input type="hidden" name="id" value={props.initial.id} />
      <input type="hidden" name="sourceId" value={props.initial.sourceId} />
      <input
        type="hidden"
        name="ingredients"
        value={JSON.stringify(
          ingredients
            .filter((item) => item.nameTh.trim() !== "" || item.nameEn.trim() !== "")
            .map((item) => ({ nameTh: item.nameTh, nameEn: item.nameEn, percentText: item.percentText })),
        )}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {statusMessage === "" ? null : (
          <p
            role="status"
            className={`border-line bg-bg-subtle rounded-xl border px-4 py-3 text-sm ${
              state.status === "error" ? "text-danger" : "text-fg"
            }`}
          >
            {statusMessage}
          </p>
        )}

        <p className="text-fg-muted text-xs">{m.adminProductsSlugLocked}</p>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLASS}>{m.adminProductsFieldCategory}</span>
            <select
              name="categoryId"
              value={fields.categoryId}
              onChange={(event) => setField("categoryId", event.target.value)}
              className={INPUT_CLASS}
            >
              {props.categories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.adminProductsFieldSort}</span>
            <input
              type="number"
              name="sortOrder"
              value={fields.sortOrder}
              onChange={(event) => setField("sortOrder", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.adminProductsFieldNameTh}</span>
            <input
              type="text"
              name="nameTh"
              value={fields.nameTh}
              onChange={(event) => setField("nameTh", event.target.value)}
              className={INPUT_CLASS}
              required
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.adminProductsFieldNameEn}</span>
            <input
              type="text"
              name="nameEn"
              value={fields.nameEn}
              onChange={(event) => setField("nameEn", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.adminProductsFieldGroup}</span>
            <input
              type="text"
              name="groupTh"
              value={fields.groupTh}
              onChange={(event) => setField("groupTh", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.adminProductsFieldGroupEn}</span>
            <input
              type="text"
              name="groupEn"
              value={fields.groupEn}
              onChange={(event) => setField("groupEn", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </div>

        <label className="block">
          <span className={LABEL_CLASS}>{m.adminProductsFieldTagline}</span>
          <textarea
            name="taglineTh"
            value={fields.taglineTh}
            onChange={(event) => setField("taglineTh", event.target.value)}
            rows={2}
            className={INPUT_CLASS}
          />
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>{m.adminProductsFieldTaglineEn}</span>
          <textarea
            name="taglineEn"
            value={fields.taglineEn}
            onChange={(event) => setField("taglineEn", event.target.value)}
            rows={2}
            className={INPUT_CLASS}
          />
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>{m.adminProductsFieldDetails}</span>
          <textarea
            name="detailsTh"
            value={fields.detailsTh}
            onChange={(event) => setField("detailsTh", event.target.value)}
            rows={5}
            className={INPUT_CLASS}
          />
        </label>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLASS}>{m.adminProductsFieldNetWeight}</span>
            <input
              type="text"
              name="netWeightTh"
              value={fields.netWeightTh}
              onChange={(event) => setField("netWeightTh", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.adminProductsFieldFda}</span>
            <input
              type="text"
              name="fdaNumber"
              value={fields.fdaNumber}
              onChange={(event) => setField("fdaNumber", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.adminProductsFieldPackaging}</span>
            <input
              type="text"
              name="packagingTh"
              value={fields.packagingTh}
              onChange={(event) => setField("packagingTh", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.adminProductsFieldAllergens}</span>
            <input
              type="text"
              name="allergensTh"
              value={fields.allergensTh}
              onChange={(event) => setField("allergensTh", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </div>

        {/* ภาพสินค้า: เลือกจากคลัง + อัปโหลดจากเครื่อง (ไม่ใช้ <form> ซ้อน) */}
        <div className="border-line rounded-xl border p-3">
          <span className={LABEL_CLASS}>{m.adminProductsFieldImage}</span>
          <div className="flex flex-wrap items-start gap-3">
            <span className="border-line bg-bg-subtle block h-24 w-24 shrink-0 overflow-hidden rounded-lg border">
              {fields.imagePath === "" ? null : (
                <Image
                  src={fields.imagePath}
                  alt={m.adminProductsFieldImage}
                  width={240}
                  height={240}
                  className="h-full w-full object-contain"
                  unoptimized
                />
              )}
            </span>
            <div className="min-w-56 flex-1">
              <select
                name="imagePath"
                value={fields.imagePath}
                onChange={(event) => setField("imagePath", event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">{m.adminProductsFieldNoImage}</option>
                {props.library.map((item) => (
                  <option key={item.id} value={item.path}>
                    {item.filename}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div className="min-w-48 flex-1">
                  <ImageFileInput
                    className={INPUT_CLASS}
                    label={m.adminProductsUpload}
                    hint={m.adminProductsUploadHint}
                  />
                </div>
                <button type="button" onClick={submitUpload} className={BUTTON_CLASS} disabled={uploading}>
                  {uploading ? m.adminProductsUploading : m.adminProductsUpload}
                </button>
              </div>
              {uploadState.status === "invalid" || uploadState.status === "failed" ? (
                <p className="text-danger mt-2 text-xs">{m.adminProductsUploadFailed}</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* ส่วนผสม */}
        <div className="border-line rounded-xl border p-3">
          <p className="text-fg-muted mb-1 text-xs font-semibold">
            {fillTemplate(m.adminProductsIngredientsCount, { count: ingredients.length })}
          </p>
          <p className="text-fg-muted mb-3 text-xs">{m.adminProductsIngredientsHint}</p>

          <ol className="flex flex-col gap-2">
            {ingredients.map((item, index) => (
              <li key={item.key} className="border-line bg-surface flex flex-wrap items-end gap-2 rounded-lg border p-2">
                <span className="text-fg-muted w-6 text-xs font-semibold">{String(index + 1)}.</span>
                <label className="min-w-40 flex-1">
                  <span className={LABEL_CLASS}>{m.adminProductsIngredientNameTh}</span>
                  <input
                    type="text"
                    value={item.nameTh}
                    onChange={(event) => setIngredient(item.key, { nameTh: event.target.value })}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className="min-w-40 flex-1">
                  <span className={LABEL_CLASS}>{m.adminProductsIngredientNameEn}</span>
                  <input
                    type="text"
                    value={item.nameEn}
                    onChange={(event) => setIngredient(item.key, { nameEn: event.target.value })}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className="w-24">
                  <span className={LABEL_CLASS}>{m.adminProductsIngredientPercent}</span>
                  <input
                    type="text"
                    value={item.percentText}
                    onChange={(event) => setIngredient(item.key, { percentText: event.target.value })}
                    className={INPUT_CLASS}
                  />
                </label>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    className={BUTTON_CLASS}
                    onClick={() => moveIngredient(item.key, -1)}
                    disabled={index === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={BUTTON_CLASS}
                    onClick={() => moveIngredient(item.key, 1)}
                    disabled={index === ingredients.length - 1}
                  >
                    ↓
                  </button>
                  <button type="button" className={BUTTON_CLASS} onClick={() => removeIngredient(item.key)}>
                    {m.adminProductsRemove}
                  </button>
                </span>
              </li>
            ))}
          </ol>

          <button type="button" className={`${BUTTON_CLASS} mt-3`} onClick={addIngredient}>
            + {m.adminProductsAddIngredient}
          </button>
        </div>

        <div>
          <button type="submit" disabled={pending} className={PRIMARY_CLASS}>
            {m.adminProductsSave}
          </button>
        </div>
      </div>

      <aside className="lg:w-[420px] lg:shrink-0">
        <div className="border-line bg-bg-subtle rounded-2xl border p-3 lg:sticky lg:top-6">
          <h2 className="text-fg-muted mb-3 text-xs font-semibold uppercase">{m.adminProductsPreview}</h2>
          <ProductListSection products={[previewRecord]} language={props.language} strings={props.publicStrings} />
          <p className="text-fg-muted mt-2 text-xs">{m.adminProductsPreviewHint}</p>
        </div>
      </aside>
    </form>
  );
}

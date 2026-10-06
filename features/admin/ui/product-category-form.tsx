"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import { saveProductCategoryAction, uploadProductImageAction } from "@/app/admin/products/actions";
import { INITIAL_ADMIN_UPLOAD_STATE, INITIAL_CATEGORY_SAVE_STATE } from "@/features/admin/product-state";
import { ImageFileInput } from "@/features/admin/ui/image-file-input";
import type { ProductLibraryItem } from "@/features/admin/ui/product-editor-form";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";
import { mediaIdFromPath } from "@/lib/media/usage";

/**
 * ฟอร์ม "คำอธิบาย/ภาพปกหมวดสินค้า" (รอบที่ 134) — client component
 *
 * ที่มา: เจ้าของเลือกทำหลังบ้านสินค้า "ครบทั้ง 3 ชั้น" (หมวด · สินค้า · ส่วนผสม)
 * ชั้นหมวดยังขาดจอ ⇒ รอบนี้ปิดช่องนั้น
 *
 * หลักการเดียวกับจอแก้สินค้า (รอบที่ 133)
 * - **ไม่มี `<form>` ซ้อน** (บทเรียนรอบที่ 129): ปุ่มอัปโหลดเรียก Server Action เอง
 * - **`sourceId` ต้องส่งกลับเสมอ** (ช่องซ่อน) — ไม่งั้นบันทึกแล้ว id หน้าต้นทางหาย (มีด่านกัน 2 ชั้น)
 * - ฝั่งเซิร์ฟเวอร์ตรวจซ้ำด้วย validator กลางทุกครั้ง (ไม่เชื่อข้อมูลจากเบราว์เซอร์)
 * - คำบรรยายทุกคำมาจากพจนานุกรม (ห้ามพิมพ์ไทยใน .tsx) · สีใช้ token เท่านั้น
 */

export type ProductCategoryInitial = {
  /** id ของหน้าในเว็บเดิม — ส่งกลับเป็นช่องซ่อน */
  readonly sourceId: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  /** พาธ `/media/<id>` หรือ "" */
  readonly imagePath: string;
};

type ProductCategoryFormProps = {
  readonly strings: Messages["admin"];
  readonly categoryId: string;
  readonly categoryName: string;
  readonly productCount: number;
  readonly library: readonly ProductLibraryItem[];
  readonly initial: ProductCategoryInitial;
};

const INPUT_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted mb-1 block text-xs font-semibold";
const BUTTON_CLASS =
  "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none";
const PRIMARY_CLASS =
  "bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2";

export function ProductCategoryForm(props: ProductCategoryFormProps) {
  const m = props.strings;
  const [state, formAction, pending] = useActionState(saveProductCategoryAction, INITIAL_CATEGORY_SAVE_STATE);

  const [descriptionTh, setDescriptionTh] = useState(props.initial.descriptionTh);
  const [descriptionEn, setDescriptionEn] = useState(props.initial.descriptionEn);
  const [imagePath, setImagePath] = useState(props.initial.imagePath);
  const [uploadState, setUploadState] = useState(INITIAL_ADMIN_UPLOAD_STATE);
  const [uploading, setUploading] = useState(false);

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
      if (result.status === "ok" && mediaIdFromPath(result.path) !== null) setImagePath(result.path);
    } catch {
      setUploadState({ ...INITIAL_ADMIN_UPLOAD_STATE, status: "failed", reason: "failed" });
    } finally {
      setUploading(false);
    }
  }

  const statusMessage =
    state.status === "saved" ? m.adminProductsCategorySaved : state.status === "error" ? m.adminProductsCategoryError : "";

  return (
    <form action={formAction} className="border-line bg-surface rounded-2xl border p-4">
      <input type="hidden" name="categoryId" value={props.categoryId} />
      {/* ⚠️ ต้องส่ง sourceId กลับ — repository กันค่าว่างไว้ชั้นหนึ่งแล้ว แต่ไม่ควรพึ่งชั้นเดียว */}
      <input type="hidden" name="sourceId" value={props.initial.sourceId} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-fg text-base font-semibold">{props.categoryName}</h3>
        <span className="text-fg-muted text-xs">
          {fillTemplate(m.adminProductsCategoryProductCount, { count: String(props.productCount) })}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* ภาพปก: เห็นรูปจริง + เลือกจากคลัง + อัปโหลดจากเครื่อง */}
        <div className="border-line bg-bg-subtle flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border lg:w-52">
          {imagePath === "" ? (
            <span className="text-fg-muted px-3 text-center text-xs">{m.adminProductsFieldNoImage}</span>
          ) : (
            <Image
              src={imagePath}
              alt={props.categoryName}
              width={480}
              height={320}
              className="h-full w-full object-contain"
              unoptimized
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <label className="block">
            <span className={LABEL_CLASS}>{m.adminProductsCategoryDescriptionTh}</span>
            <textarea
              name="descriptionTh"
              value={descriptionTh}
              onChange={(event) => setDescriptionTh(event.target.value)}
              rows={3}
              className={INPUT_CLASS}
            />
          </label>
          <label className="mt-3 block">
            <span className={LABEL_CLASS}>{m.adminProductsCategoryDescriptionEn}</span>
            <textarea
              name="descriptionEn"
              value={descriptionEn}
              onChange={(event) => setDescriptionEn(event.target.value)}
              rows={3}
              className={INPUT_CLASS}
            />
          </label>

          <div className="mt-3">
            <span className={LABEL_CLASS}>{m.adminProductsCategoryImage}</span>
            <select
              name="imagePath"
              value={imagePath}
              onChange={(event) => setImagePath(event.target.value)}
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
                <ImageFileInput className={INPUT_CLASS} label={m.adminProductsUpload} hint={m.adminProductsUploadHint} />
              </div>
              <button type="button" onClick={submitUpload} className={BUTTON_CLASS} disabled={uploading}>
                {uploading ? m.adminProductsUploading : m.adminProductsUpload}
              </button>
            </div>
            {uploadState.status === "invalid" || uploadState.status === "failed" ? (
              <p className="text-danger mt-2 text-xs">{m.adminProductsUploadFailed}</p>
            ) : null}
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
              {m.adminProductsCategorySave}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

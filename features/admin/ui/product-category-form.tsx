"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import { saveProductCategoryAction, uploadProductImageAction } from "@/app/admin/products/actions";
import { INITIAL_ADMIN_UPLOAD_STATE, INITIAL_CATEGORY_SAVE_STATE } from "@/features/admin/product-state";
import { ImageFileInput } from "@/features/admin/ui/image-file-input";
import { PreviewFrame, SITE_CATEGORY_CARD_WIDTH } from "@/features/admin/ui/preview-frame";
import type { ProductLibraryItem } from "@/features/admin/ui/product-editor-form";
import { ProductCategoryCard } from "@/features/products/ui/category-card";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";
import { mediaIdFromPath } from "@/lib/media/usage";

/**
 * ฟอร์มหมวดสินค้า (รอบที่ 134 · **ชื่อ + โลโก้การ์ด รอบที่ 254** · มติ D24)
 *
 * ที่มา: เจ้าของ 2026-10-09 *"หน้าหมวดสินค้า … ยังไม่ได้เพิ่มส่วนที่แก้ไขรูปภาพและข้อความหมวดได้
 *        ต้องทำเหมือนกันในหลังบ้าน เผื่ออนาคตมีการเพิ่มหมวดสินค้าหรือเปลี่ยนโลโก้หมวด"*
 * ⇒ รอบนี้เพิ่ม **ชื่อหมวด (TH/EN)** และ **โลโก้บนการ์ด `/products`** ให้แก้ได้ (เฉพาะ 6 หมวดเดิม)
 *
 * หลักการเดียวกับจอแก้สินค้า (รอบที่ 133)
 * - **ไม่มี `<form>` ซ้อน** (บทเรียนรอบที่ 129): ปุ่มอัปโหลดเรียก Server Action เอง
 * - **`sourceId` ต้องส่งกลับเสมอ** (ช่องซ่อน) — ไม่งั้นบันทึกแล้ว id หน้าต้นทางหาย (มีด่านกัน 2 ชั้น)
 * - ฝั่งเซิร์ฟเวอร์ตรวจซ้ำด้วย validator กลางทุกครั้ง (ไม่เชื่อข้อมูลจากเบราว์เซอร์)
 * - คำบรรยายทุกคำมาจากพจนานุกรม (ห้ามพิมพ์ไทยใน .tsx) · สีใช้ token เท่านั้น
 * - พรีวิวใช้ **`ProductCategoryCard` ตัวเดียวกับหน้าเว็บจริง** ⇒ "สิ่งที่เห็นตอนแก้ = สิ่งที่ขึ้นเว็บ"
 */

export type ProductCategoryInitial = {
  /** id ของหน้าในเว็บเดิม — ส่งกลับเป็นช่องซ่อน */
  readonly sourceId: string;
  /** ชื่อหมวดที่แก้จากหลังบ้าน — "" = ยังใช้ชื่อจากพจนานุกรม */
  readonly nameTh: string;
  readonly nameEn: string;
  readonly descriptionTh: string;
  readonly descriptionEn: string;
  /** พาธ `/media/<id>` หรือ "" */
  readonly imagePath: string;
  /** โลโก้การ์ด `/media/<id>` หรือ "" = ใช้ไฟล์เดิมใน public */
  readonly logoPath: string;
  /** ขนาดจริงของโลโก้ในคลัง (ถ้ามี) — ใช้ตั้งสัดส่วนพรีวิว */
  readonly logoWidth: number | null;
  readonly logoHeight: number | null;
};

type ProductCategoryFormProps = {
  readonly strings: Messages["admin"];
  readonly categoryId: string;
  /** ชื่อที่มีผลจริงตอนนี้ (DB → พจนานุกรม) — ใช้เป็นหัวฟอร์ม + ค่า fallback ของพรีวิว */
  readonly categoryName: string;
  /** คำบรรยายภาพ (alt) จากพจนานุกรม */
  readonly imageAlt: string;
  readonly productCount: number;
  readonly library: readonly ProductLibraryItem[];
  /** โลโก้เดิมของระบบ (ไฟล์ใน public) — ใช้เมื่อยังไม่เลือกจากคลัง */
  readonly fallbackLogo: { readonly src: string; readonly width: number; readonly height: number };
  readonly initial: ProductCategoryInitial;
};

const INPUT_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted mb-1 block text-xs font-semibold";
const BUTTON_CLASS =
  "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none";
const PRIMARY_CLASS =
  "bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2";

/** ช่องเลือกภาพ 1 ช่อง: รูปย่อ + เลือกจากคลัง + อัปโหลดจากเครื่อง (ไม่มี `<form>` ของตัวเอง) */
function ImagePickerBlock(props: {
  readonly name: "imagePath" | "logoPath";
  readonly label: string;
  readonly hint: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly uploading: boolean;
  readonly failed: boolean;
  readonly onUpload: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly library: readonly ProductLibraryItem[];
  readonly imageAlt: string;
  readonly strings: Messages["admin"];
}) {
  const m = props.strings;
  return (
    <div className="min-w-0 flex-1">
      <label className="block">
        <span className={LABEL_CLASS}>{props.label}</span>
        <div className="border-line bg-bg-subtle flex h-28 items-center justify-center overflow-hidden rounded-xl border">
          {props.value === "" ? (
            <span className="text-fg-muted px-3 text-center text-xs">{m.adminProductsFieldNoImage}</span>
          ) : (
            <Image
              src={props.value}
              alt={props.imageAlt}
              width={480}
              height={320}
              className="h-full w-full object-contain"
              unoptimized
            />
          )}
        </div>
        <select
          name={props.name}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          className={`${INPUT_CLASS} mt-2`}
        >
          <option value="">{m.adminProductsFieldNoImage}</option>
          {props.library.map((item) => (
            <option key={item.id} value={item.path}>
              {item.filename}
            </option>
          ))}
        </select>
      </label>
      <p className="text-fg-muted mt-1 text-[11px]">{props.hint}</p>
      {/* ⚠️ ปุ่มอยู่ใน `<div>` เดียวกับช่องไฟล์ ⇒ handler หา input ด้วย closest("div") ได้ (ห้ามมี <form> ซ้อน) */}
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <ImageFileInput className={INPUT_CLASS} label={m.adminProductsUpload} hint={m.adminProductsUploadHint} />
        </div>
        <button type="button" onClick={props.onUpload} className={BUTTON_CLASS} disabled={props.uploading}>
          {props.uploading ? m.adminProductsUploading : m.adminProductsUpload}
        </button>
      </div>
      {props.failed ? <p className="text-danger mt-2 text-xs">{m.adminProductsUploadFailed}</p> : null}
    </div>
  );
}

export function ProductCategoryForm(props: ProductCategoryFormProps) {
  const m = props.strings;
  const [state, formAction, pending] = useActionState(saveProductCategoryAction, INITIAL_CATEGORY_SAVE_STATE);

  const [nameTh, setNameTh] = useState(props.initial.nameTh);
  const [nameEn, setNameEn] = useState(props.initial.nameEn);
  const [descriptionTh, setDescriptionTh] = useState(props.initial.descriptionTh);
  const [descriptionEn, setDescriptionEn] = useState(props.initial.descriptionEn);
  const [imagePath, setImagePath] = useState(props.initial.imagePath);
  const [logoPath, setLogoPath] = useState(props.initial.logoPath);
  const [uploading, setUploading] = useState<"image" | "logo" | null>(null);
  const [uploadFailed, setUploadFailed] = useState<"image" | "logo" | null>(null);

  /** อัปโหลดภาพจากเครื่อง — เรียก Server Action เอง (ห้ามใช้ <form> ซ้อน) */
  async function submitUpload(event: React.MouseEvent<HTMLButtonElement>, target: "image" | "logo"): Promise<void> {
    const wrapper = event.currentTarget.closest("div");
    const input = wrapper?.querySelector<HTMLInputElement>('input[type="file"]') ?? null;
    const file = input?.files?.item(0) ?? null;
    if (file === null) {
      setUploadFailed(target);
      return;
    }
    setUploading(target);
    setUploadFailed(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadProductImageAction(INITIAL_ADMIN_UPLOAD_STATE, formData);
      if (result.status === "ok" && mediaIdFromPath(result.path) !== null) {
        if (target === "image") setImagePath(result.path);
        else setLogoPath(result.path);
      } else {
        setUploadFailed(target);
      }
    } catch {
      setUploadFailed(target);
    } finally {
      setUploading(null);
    }
  }

  const statusMessage =
    state.status === "saved" ? m.adminProductsCategorySaved : state.status === "error" ? m.adminProductsCategoryError : "";

  /* พรีวิว: ใช้ค่าที่แก้ค้างในฟอร์ม ⇒ พิมพ์/เปลี่ยนภาพปุ๊บเห็นปั๊บ (ชื่อว่าง = ถอยชื่อเดิม) */
  const previewName = nameTh.trim() === "" ? props.categoryName : nameTh;
  const previewLogo =
    logoPath === ""
      ? props.fallbackLogo
      : {
          src: logoPath,
          width: props.initial.logoWidth ?? props.fallbackLogo.width,
          height: props.initial.logoHeight ?? props.fallbackLogo.height,
        };

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

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className={LABEL_CLASS}>{m.adminProductsCategoryNameTh}</span>
          <input
            type="text"
            name="nameTh"
            value={nameTh}
            onChange={(event) => setNameTh(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>{m.adminProductsCategoryNameEn}</span>
          <input
            type="text"
            name="nameEn"
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>
      </div>
      <p className="text-fg-muted mt-1 text-[11px]">{m.adminProductsCategoryNameHint}</p>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <ImagePickerBlock
          name="imagePath"
          label={m.adminProductsCategoryImage}
          hint=""
          value={imagePath}
          onChange={setImagePath}
          uploading={uploading === "image"}
          failed={uploadFailed === "image"}
          onUpload={(event) => {
            void submitUpload(event, "image");
          }}
          library={props.library}
          imageAlt={props.imageAlt}
          strings={m}
        />
        <ImagePickerBlock
          name="logoPath"
          label={m.adminProductsCategoryLogo}
          hint={m.adminProductsCategoryLogoHint}
          value={logoPath}
          onChange={setLogoPath}
          uploading={uploading === "logo"}
          failed={uploadFailed === "logo"}
          onUpload={(event) => {
            void submitUpload(event, "logo");
          }}
          library={props.library}
          imageAlt={props.imageAlt}
          strings={m}
        />
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <label className="min-w-0 flex-1">
          <span className={LABEL_CLASS}>{m.adminProductsCategoryDescriptionTh}</span>
          <textarea
            name="descriptionTh"
            value={descriptionTh}
            onChange={(event) => setDescriptionTh(event.target.value)}
            rows={3}
            className={INPUT_CLASS}
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className={LABEL_CLASS}>{m.adminProductsCategoryDescriptionEn}</span>
          <textarea
            name="descriptionEn"
            value={descriptionEn}
            onChange={(event) => setDescriptionEn(event.target.value)}
            rows={3}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      {/* พรีวิวการ์ดจริง (ใช้คอมโพเนนต์เดียวกับหน้าเว็บ) */}
      <div className="mt-4">
        <p className={LABEL_CLASS}>{m.adminProductsCategoryPreview}</p>
        <PreviewFrame
          singleCard
          width={SITE_CATEGORY_CARD_WIDTH}
          label={fillTemplate(m.adminProductsCategoryPreviewWidth, { width: String(SITE_CATEGORY_CARD_WIDTH) })}
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
    </form>
  );
}

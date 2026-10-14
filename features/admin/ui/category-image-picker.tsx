"use client";

import Image from "next/image";
import { useState } from "react";

import { uploadProductImageAction } from "@/app/admin/products/actions";
import { INITIAL_ADMIN_UPLOAD_STATE } from "@/features/admin/product-state";
import { ImageFileInput } from "@/features/admin/ui/image-file-input";
import type { Messages } from "@/lib/i18n/messages/th";
import { mediaIdFromPath } from "@/lib/media/usage";

/**
 * ช่องเลือกภาพของหมวดสินค้า (รอบที่ 264) — **ใช้ร่วมกันทั้งฟอร์มแก้และฟอร์มเพิ่มหมวด**
 *
 * กติกาเดียวกับจอสินค้า (รอบที่ 129/133)
 * - **ไม่มี `<form>` ของตัวเอง** ⇒ ใช้ใน `<form action={…}>` ของหน้าจอได้โดยไม่ซ้อนกัน
 * - ปุ่มอัปโหลดเรียก Server Action เอง (`uploadProductImageAction` — ท่อกลาง: ย่อภาพ/ตรวจหัวไฟล์/เพดาน 5MB)
 * - ค่าที่เลือกถูกส่งเป็นช่อง (`name`) ให้ฟอร์มแม่ ⇒ ฝั่งเซิร์ฟเวอร์อ่านด้วย `mediaIdFromPath()`
 */

const INPUT_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted mb-1 block text-xs font-semibold";
const BUTTON_CLASS =
  "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none";

export type CategoryImagePickerProps = {
  readonly name: "imagePath" | "logoPath";
  readonly label: string;
  readonly hint: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly library: readonly { readonly id: string; readonly filename: string; readonly path: string }[];
  readonly imageAlt: string;
  readonly strings: Messages["adminCategories"];
};

export function CategoryImagePicker(props: CategoryImagePickerProps) {
  const m = props.strings;
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);

  /** อัปโหลดภาพจากเครื่อง — เรียก Server Action เอง (ห้าม `<form>` ซ้อน) */
  async function submitUpload(event: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    const wrapper = event.currentTarget.closest("div");
    const input = wrapper?.querySelector<HTMLInputElement>('input[type="file"]') ?? null;
    const file = input?.files?.item(0) ?? null;
    if (file === null) {
      setFailed(true);
      return;
    }
    setUploading(true);
    setFailed(false);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadProductImageAction(INITIAL_ADMIN_UPLOAD_STATE, formData);
      if (result.status === "ok" && mediaIdFromPath(result.path) !== null) {
        props.onChange(result.path);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-w-0 flex-1">
      <label className="block">
        <span className={LABEL_CLASS}>{props.label}</span>
        <div className="border-line bg-bg-subtle flex h-28 items-center justify-center overflow-hidden rounded-xl border">
          {props.value === "" ? (
            <span className="text-fg-muted px-3 text-center text-xs">{m.noImageHint}</span>
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
          <option value="">{m.noImageHint}</option>
          {props.library.map((item) => (
            <option key={item.id} value={item.path}>
              {item.filename}
            </option>
          ))}
        </select>
      </label>
      <p className="text-fg-muted mt-1 text-[11px]">{props.hint}</p>
      {/* ⚠️ ปุ่มอยู่ใน `<div>` เดียวกับช่องไฟล์ ⇒ handler หา input ด้วย closest("div") ได้ */}
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <ImageFileInput className={INPUT_CLASS} label={m.upload} hint={m.uploadHint} />
        </div>
        <button
          type="button"
          onClick={(event) => {
            void submitUpload(event);
          }}
          className={BUTTON_CLASS}
          disabled={uploading}
        >
          {uploading ? m.uploading : m.upload}
        </button>
      </div>
      {failed ? <p className="text-danger mt-2 text-xs">{m.uploadFailed}</p> : null}
    </div>
  );
}

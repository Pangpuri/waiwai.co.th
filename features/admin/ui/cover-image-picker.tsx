"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { ImageFileInput } from "@/features/admin/ui/image-file-input";
import { ImageGridPicker, type ImageGridItem } from "@/features/admin/ui/image-grid-picker";
import { mediaIdFromPath } from "@/lib/media/usage";

/**
 * ช่อง "ภาพปก" ที่ใช้ร่วมกันทุกจอเนื้อหา (รอบที่ 299)
 *
 * ที่มา — เจ้าของแจ้ง 2 ครั้ง:
 *   1. *"ภาพปกมันจะสามารถถูกเลือกได้แค่ในอัลบั้ม ผมขอเป็นกดอัพโหลดจากเครื่องได้ดีกว่า
 *      ใช้ลอจิกอัพโหลดแบบภาพเนื้อหาก็ได้ … แต่อัลบั้มภาพยังเก็บภาพปกให้ไว้สำรองข้อมูลอยู่นะ"* (ข่าว)
 *   2. *"ภาพปกของ เมนูอาหาร เอาแบบเดียวกับข่าวครับเผื่ออัพโหลดจากเครื่อง"* (เมนูอาหาร)
 * ⇒ แยกเป็น **คอมโพเนนต์เดียว** ใช้ทั้งสองจอ: **อัปโหลดจากเครื่องเป็นทางหลัก** +
 *   **คลังภาพยังเลือกได้** เป็นทางสำรอง
 *
 * กติกาที่ต้องถือ
 * - **ไม่มี `<form>` ของตัวเอง** — ฟอร์มแม่เป็น `<form>` อยู่แล้ว (บทเรียน `<form>` ซ้อน รอบที่ 129)
 * - อัปโหลดผ่าน Server Action ที่ **ผู้เรียกส่งเข้ามา** (`uploadAction`) ⇒ แต่ละจอยังใช้สิทธิ์/ท่อของตัวเอง
 *   (ทั้งคู่ลงเอยที่ `storeImageFile`: ย่อภาพ/WebP · sniff หัวไฟล์ · เพดาน 5MB)
 * - ภาพที่อัปโหลดเข้า `media` อยู่แล้ว ⇒ ไปโผล่ในคลังภาพเอง
 * - ค่าที่ส่งไปเซิร์ฟเวอร์เป็นช่อง `coverPath` = **พาธ** `/media/<id>` (มติ D9)
 */

export type CoverUploadState = {
  readonly status: "idle" | "ok" | "invalid" | "failed";
  readonly path: string;
  readonly reason: string;
};

export type CoverUploadAction = (previous: CoverUploadState, formData: FormData) => Promise<CoverUploadState>;

/** ข้อความทั้งหมดมาจากพจนานุกรมของพื้นที่นั้น ๆ (ห้ามพิมพ์ไทยใน .tsx) */
export type CoverImagePickerLabels = {
  readonly field: string;
  readonly empty: string;
  readonly previewAlt: string;
  readonly upload: string;
  readonly uploadHint: string;
  readonly uploading: string;
  readonly uploadFailed: string;
  readonly pickFromLibrary: string;
  readonly cancel: string;
  readonly remove: string;
  readonly storedInLibrary: string;
  readonly noImages: string;
};

export type CoverImagePickerProps = {
  readonly labels: CoverImagePickerLabels;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly library: readonly ImageGridItem[];
  readonly uploadAction: CoverUploadAction;
  readonly initialUploadState: CoverUploadState;
};

const INPUT_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted mb-1 block text-xs font-semibold";
const BUTTON_CLASS =
  "border-line text-fg hover:bg-bg-subtle focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50";

export function CoverImagePicker({
  labels,
  value,
  onChange,
  library,
  uploadAction,
  initialUploadState,
}: CoverImagePickerProps) {
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);
  const uploadBoxRef = useRef<HTMLDivElement | null>(null);

  /** ส่งไฟล์ที่เลือก (ผ่านการย่อภาพของ ImageFileInput แล้ว) ไปที่ Server Action ที่ผู้เรียกให้มา */
  async function submitUpload(): Promise<void> {
    const input = uploadBoxRef.current?.querySelector<HTMLInputElement>('input[type="file"]');
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
      const result = await uploadAction(initialUploadState, formData);
      /* ⚠️ action คืน **พาธ** /media/<id> ⇒ ต้องแปลงเป็นรหัสภาพแล้วประกอบพาธใหม่ (มติ D9) */
      const mediaId = result.status === "ok" ? mediaIdFromPath(result.path) : null;
      if (mediaId === null) {
        setFailed(true);
        return;
      }
      onChange(`/media/${mediaId}`);
      setPicking(false);
    } catch {
      setFailed(true);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border-line rounded-xl border p-3">
      <span className={LABEL_CLASS}>{labels.field}</span>

      <div className="flex flex-wrap items-start gap-3">
        <span className="border-line bg-bg-subtle block h-24 w-36 shrink-0 overflow-hidden rounded-lg border">
          {value === "" ? (
            <span className="text-fg-muted flex h-full items-center justify-center px-2 text-center text-xs">
              {labels.empty}
            </span>
          ) : (
            <Image
              src={value}
              alt={labels.previewAlt}
              width={288}
              height={192}
              className="h-full w-full object-cover"
              unoptimized
            />
          )}
        </span>

        <div className="min-w-56 flex-1">
          {/* ⚠️ ห้ามใช้ <form> ที่นี่ (บทเรียนรอบที่ 129) — ปุ่มเรียก Server Action เอง */}
          <div ref={uploadBoxRef} className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1">
              <ImageFileInput className={INPUT_CLASS} label={labels.upload} hint={labels.uploadHint} />
            </div>
            <button type="button" onClick={submitUpload} className={BUTTON_CLASS} disabled={uploading}>
              {uploading ? labels.uploading : labels.upload}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className={BUTTON_CLASS} onClick={() => setPicking((current) => !current)}>
              {picking ? labels.cancel : labels.pickFromLibrary}
            </button>
            {value === "" ? null : (
              <button type="button" className={BUTTON_CLASS} onClick={() => onChange("")}>
                {labels.remove}
              </button>
            )}
          </div>

          {failed ? <p className="text-danger mt-2 text-xs">{labels.uploadFailed}</p> : null}
          <p className="text-fg-muted mt-2 text-[11px]">{labels.storedInLibrary}</p>
        </div>
      </div>

      {picking ? (
        <div className="border-line mt-3 rounded-lg border p-3">
          <p className="text-fg-muted mb-2 text-xs font-semibold">{labels.pickFromLibrary}</p>
          <ImageGridPicker
            library={library}
            noImages={labels.noImages}
            onPick={(mediaId) => {
              onChange(`/media/${mediaId}`);
              setPicking(false);
            }}
          />
        </div>
      ) : null}

      {/* ค่าที่ส่งไปเซิร์ฟเวอร์ = พาธของภาพปก (ว่าง = ไม่ใช้ภาพปก) */}
      <input type="hidden" name="coverPath" value={value} />
    </div>
  );
}

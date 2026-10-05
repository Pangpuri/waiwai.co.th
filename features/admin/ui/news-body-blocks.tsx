"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";

import { uploadNewsImageAction } from "@/app/admin/news/actions";
import { INITIAL_NEWS_UPLOAD_STATE } from "@/features/admin/news-state";
import { ImageFileInput } from "@/features/admin/ui/image-file-input";
import { mediaIdFromPath } from "@/lib/media/usage";
import type { NewsEditorBlock } from "@/lib/news/editor-blocks";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ตัวแก้เนื้อหาข่าวแบบ "เห็นภาพ" (รอบที่ 125)
 *
 * ที่มา: เจ้าของทดลองใช้แล้วบอกว่า UI เดิมยากสำหรับคนไม่สายเว็บ (ไม่เห็นตัวอย่างภาพ · เห็นโทเคน [[img:…]])
 * รอบนี้เปลี่ยนเป็น **การ์ดเรียงลงมา**: ข้อความ / หัวข้อย่อย / ภาพ (เห็นรูปย่อ · คำบรรยายใต้ภาพ · ลบ/เลื่อนขึ้น-ลง)
 *
 * หลักการ
 * - ค่าที่ส่งไปเซิร์ฟเวอร์ = JSON ในช่องซ่อน (`name="bodyBlocks"`) แล้วถูกตรวจซ้ำด้วย `parseNewsEditorBlocks()` เสมอ
 * - คำบรรยายใต้ภาพ **ไม่บังคับ** (เว้นว่าง = แสดงภาพเรียงไป ไม่มีแคปชัน)
 * - ไม่มี drag-and-drop โดยเจตนา: ปุ่มเลื่อนขึ้น/ลงใช้ง่ายกว่าและทำงานได้ทุกอุปกรณ์ (รวมคีย์บอร์ด/มือถือ)
 */

export type NewsEditorLibraryItem = {
  readonly id: string;
  readonly filename: string;
  readonly path: string;
};

type NewsBodyBlocksProps = {
  readonly strings: Messages["admin"];
  readonly initial: readonly NewsEditorBlock[];
  readonly library: readonly NewsEditorLibraryItem[];
};

const CARD_CLASS = "border-line bg-surface rounded-xl border p-3";
const BUTTON_CLASS =
  "border-line text-fg hover:bg-bg-subtle focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none";
const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

export function NewsBodyBlocks({ strings: m, initial, library }: NewsBodyBlocksProps) {
  const [items, setItems] = useState<readonly NewsEditorBlock[]>(initial);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [counter, setCounter] = useState(0);
  const [uploadState, uploadAction, uploading] = useActionState(uploadNewsImageAction, INITIAL_NEWS_UPLOAD_STATE);

  /*
    อัปโหลดเสร็จ = ใส่การ์ดภาพให้ทันที (ไม่ต้องรีเฟรชและไม่เสียสิ่งที่พิมพ์ไว้)
    ⚠️ ตัว action คืน **พาธ** /media/<id> ⇒ ต้องแปลงเป็นรหัสภาพก่อนเก็บลงบล็อก (มติ D9: เก็บพาธ ไม่เก็บ URL)
  */
  useEffect(() => {
    if (uploadState.status !== "ok") return;
    const mediaId = mediaIdFromPath(uploadState.path);
    if (mediaId === null) return;
    /* อัปเดต state ตรงในนี้ (ไม่เรียก addImage) ⇒ effect ไม่ต้องพึ่งฟังก์ชันที่สร้างใหม่ทุกเรนเดอร์ */
    setItems((current) => [...current, { id: `upload-${String(Date.now())}`, kind: "image", mediaId, alt: "" }]);
    setPickerFor(null);
  }, [uploadState]);

  function newId(): string {
    setCounter((value) => value + 1);
    return `new-${String(counter + 1)}-${String(Date.now())}`;
  }

  function update(id: string, patch: Partial<NewsEditorBlock>): void {
    setItems((current) => current.map((item) => (item.id === id ? ({ ...item, ...patch } as NewsEditorBlock) : item)));
  }

  function remove(id: string): void {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function move(id: string, direction: -1 | 1): void {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (moved === undefined) return current;
      next.splice(target, 0, moved);
      return next;
    });
  }

  function addText(kind: "paragraph" | "heading"): void {
    setItems((current) => [...current, { id: newId(), kind, text: "" }]);
  }

  function addImage(mediaId: string): void {
    setItems((current) => [...current, { id: newId(), kind: "image", mediaId, alt: "" }]);
    setPickerFor(null);
  }

  /**
   * เลือกภาพให้การ์ดที่มีอยู่ = **แทนที่ภาพเดิม** (เคสจริง: ปุ่ม "เปลี่ยนภาพ" เดิมดันเพิ่มการ์ดใหม่)
   * โดยคงคำบรรยายเดิมไว้ (มักยังใช้ได้) เพื่อไม่ให้คนใช้พิมพ์ซ้ำ
   */
  function replaceImage(targetId: string, mediaId: string): void {
    setItems((current) =>
      current.map((item) => (item.id === targetId && item.kind === "image" ? { ...item, mediaId } : item)),
    );
    setPickerFor(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ค่าที่ส่งไปเซิร์ฟเวอร์ — เฉพาะฟิลด์ที่จำเป็น (ไม่ส่ง id ชั่วคราว) */}
      <input
        type="hidden"
        name="bodyBlocks"
        value={JSON.stringify(
          items.map((item) =>
            item.kind === "image"
              ? { kind: "image", mediaId: item.mediaId, alt: item.alt }
              : { kind: item.kind, text: item.text },
          ),
        )}
      />

      {items.length === 0 ? (
        <p className="border-line bg-bg-subtle text-fg-muted rounded-xl border px-3 py-4 text-sm">{m.newsAdminBlocksEmpty}</p>
      ) : null}

      <ol className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li key={item.id} className={CARD_CLASS}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-fg-muted text-xs font-semibold">
                {String(index + 1)}.{" "}
                {item.kind === "image"
                  ? m.newsAdminBlockImage
                  : item.kind === "heading"
                    ? m.newsAdminBlockHeading
                    : m.newsAdminBlockParagraph}
              </span>
              <span className="flex items-center gap-1">
                <button type="button" className={BUTTON_CLASS} onClick={() => move(item.id, -1)} disabled={index === 0}>
                  ↑ {m.newsAdminMoveUp}
                </button>
                <button
                  type="button"
                  className={BUTTON_CLASS}
                  onClick={() => move(item.id, 1)}
                  disabled={index === items.length - 1}
                >
                  ↓ {m.newsAdminMoveDown}
                </button>
                <button type="button" className={BUTTON_CLASS} onClick={() => remove(item.id)}>
                  {m.newsAdminBlockRemove}
                </button>
              </span>
            </div>

            {item.kind === "image" ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                <span className="border-line bg-bg-subtle block h-24 w-36 shrink-0 overflow-hidden rounded-lg border">
                  <Image
                    src={`/media/${item.mediaId}`}
                    alt={item.alt === "" ? m.newsAdminCoverAlt : item.alt}
                    width={288}
                    height={192}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                </span>
                <div className="flex-1">
                  <label className="block">
                    <span className="text-fg-muted mb-1 block text-xs font-semibold">{m.newsAdminBlockCaption}</span>
                    <input
                      type="text"
                      value={item.alt}
                      onChange={(event) => update(item.id, { alt: event.target.value })}
                      placeholder={m.newsAdminBlockCaptionHint}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <button type="button" className={`${BUTTON_CLASS} mt-2`} onClick={() => setPickerFor(item.id)}>
                    {m.newsAdminBlockChangeImage}
                  </button>
                </div>
              </div>
            ) : (
              <textarea
                value={item.text}
                onChange={(event) => update(item.id, { text: event.target.value })}
                rows={item.kind === "heading" ? 1 : 4}
                placeholder={item.kind === "heading" ? m.newsAdminBlockHeadingHint : m.newsAdminBlockParagraphHint}
                className={`${FIELD_CLASS} mt-2`}
              />
            )}

            {pickerFor === item.id ? (
              <div className="border-line mt-3 rounded-lg border p-3">
                <p className="text-fg-muted mb-2 text-xs font-semibold">{m.newsAdminPickImage}</p>
                <NewsImagePicker library={library} onPick={(mediaId) => replaceImage(item.id, mediaId)} strings={m} />
                <button type="button" className={`${BUTTON_CLASS} mt-2`} onClick={() => setPickerFor(null)}>
                  {m.newsAdminCancel}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BUTTON_CLASS} onClick={() => addText("paragraph")}>
          + {m.newsAdminAddParagraph}
        </button>
        <button type="button" className={BUTTON_CLASS} onClick={() => addText("heading")}>
          + {m.newsAdminAddHeading}
        </button>
        <button type="button" className={BUTTON_CLASS} onClick={() => setPickerFor(items.length === 0 ? "new" : "new")}>
          + {m.newsAdminAddImage}
        </button>
      </div>

      {pickerFor === "new" ? (
        <div className="border-line rounded-xl border p-3">
          <p className="text-fg-muted mb-2 text-xs font-semibold">{m.newsAdminPickImage}</p>
          <NewsImagePicker library={library} onPick={addImage} strings={m} />
          <button type="button" className={`${BUTTON_CLASS} mt-2`} onClick={() => setPickerFor(null)}>
            {m.newsAdminCancel}
          </button>
        </div>
      ) : null}


      <div className="border-line rounded-xl border border-dashed p-3">
        <p className="text-fg-muted mb-2 text-xs font-semibold">{m.newsAdminFromComputer}</p>
        <form action={uploadAction} className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <ImageFileInput className={FIELD_CLASS} label={m.newsAdminUpload} hint={m.newsAdminUploadHint} />
          </div>
          <button type="submit" className={BUTTON_CLASS} disabled={uploading}>
            {uploading ? m.newsAdminUploading : m.newsAdminUpload}
          </button>
        </form>
        {uploadState.status === "invalid" || uploadState.status === "failed" ? (
          <p className="text-danger mt-2 text-xs">{m.newsAdminUploadFailed}</p>
        ) : null}
      </div>

      <p className="text-fg-muted text-xs">{m.newsAdminBodyHint}</p>
    </div>
  );
}

/** ตารางเลือกรูปจากคลัง (เห็นรูปจริง ไม่ใช่ชื่อไฟล์) — ใช้ทั้งตอนแทรกใหม่และตอนเปลี่ยนภาพ */
export function NewsImagePicker({
  library,
  onPick,
  strings: m,
}: {
  readonly library: readonly NewsEditorLibraryItem[];
  readonly onPick: (mediaId: string) => void;
  readonly strings: Messages["admin"];
}) {
  if (library.length === 0) {
    return <p className="text-fg-muted text-sm">{m.newsAdminNoImages}</p>;
  }

  return (
    <ul className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
      {library.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onPick(item.id)}
            className="border-line hover:bg-bg-subtle focus-visible:ring-ring block w-full rounded-lg border p-1 text-left focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="bg-bg-subtle block h-20 w-full overflow-hidden rounded">
              <Image
                src={item.path}
                alt={item.filename}
                width={200}
                height={160}
                className="h-full w-full object-cover"
                unoptimized
              />
            </span>
            <span className="text-fg-muted mt-1 block truncate text-xs">{item.filename}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

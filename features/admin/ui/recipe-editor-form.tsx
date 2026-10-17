"use client";

import { PreviewFrame, SITE_RECIPE_CARD_WIDTH } from "@/features/admin/ui/preview-frame";
import { useActionState, useState } from "react";

import { saveRecipeAction, uploadRecipeImageAction } from "@/app/admin/recipes/actions";
import { INITIAL_RECIPE_SAVE_STATE, INITIAL_RECIPE_UPLOAD_STATE } from "@/features/admin/recipe-state";
import { CoverImagePicker } from "@/features/admin/ui/cover-image-picker";
import { RecipeVideoList, type RecipeVideoListStrings } from "@/features/recipes/ui/recipe-video-list";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";
import { youTubeIdFromInput } from "@/lib/recipes/model";
import type { RecipeRecord } from "@/lib/recipes/repository";

/**
 * หน้าจอแก้ "เมนูอาหาร" (รอบที่ 135 · ฟอร์มง่ายแบบ WP classic editor) — client component
 *
 * หลักการสำคัญ (เหมือนจอแก้ข่าว/สินค้า)
 * - **พรีวิวใช้ตัวเรนเดอร์ตัวเดียวกับหน้าเว็บจริง** (`RecipeVideoList` ตัวที่หน้า `/recipes` ใช้)
 *   ⇒ "สิ่งที่เห็น = สิ่งที่ผู้อ่านเห็น" (กันพรีวิวโกหก)
 * - **ไม่มี `<form>` ซ้อน** (บทเรียนรอบที่ 129): ปุ่มอัปโหลดเรียก Server Action เอง
 * - ค่าที่ส่งไปเซิร์ฟเวอร์ถูกตรวจซ้ำด้วย validator กลางทุกครั้ง · คำบรรยายมาจากพจนานุกรม · สีใช้ token เท่านั้น
 */

export type RecipeEditorLibraryItem = {
  readonly id: string;
  readonly filename: string;
  readonly path: string;
};

export type RecipeEditorInitial = {
  readonly id: string;
  readonly titleTh: string;
  readonly titleEn: string;
  readonly videoId: string;
  /** ISO `YYYY-MM-DD` หรือ "" */
  readonly publishedOn: string;
  readonly sortOrder: number;
  /** `/media/<id>` หรือ "" */
  readonly coverPath: string;
  readonly status: "draft" | "published";
};

type RecipeEditorFormProps = {
  readonly strings: Messages["admin"];
  readonly publicStrings: RecipeVideoListStrings;
  readonly initial: RecipeEditorInitial;
  readonly trashed: boolean;
  readonly library: readonly RecipeEditorLibraryItem[];
};

const INPUT_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted mb-1 block text-xs font-semibold";
const PRIMARY_CLASS =
  "bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2";

export function RecipeEditorForm(props: RecipeEditorFormProps) {
  const m = props.strings;
  const [state, formAction, pending] = useActionState(saveRecipeAction, INITIAL_RECIPE_SAVE_STATE);

  const [fields, setFields] = useState({
    titleTh: props.initial.titleTh,
    titleEn: props.initial.titleEn,
    videoId: props.initial.videoId,
    publishedOn: props.initial.publishedOn,
    sortOrder: String(props.initial.sortOrder),
    coverPath: props.initial.coverPath,
    status: props.initial.status as "draft" | "published",
  });
  /* ภาษาของพรีวิว (รอบที่ 137) — แยกจากค่าที่บันทึก: ดูด่าน EN ได้โดยไม่ต้องสลับทั้งหน้าจอ */
  const [previewLanguage, setPreviewLanguage] = useState<"th" | "en">("th");

  function setField(key: keyof typeof fields, value: string): void {
    setFields((current) => ({ ...current, [key]: value }));
  }

  /*
    รอบที่ 136: ผู้ใช้วาง **ลิงก์ YouTube เต็ม** ได้ — ดึงรหัสให้เห็นสด ๆ ในฟอร์ม
    และพรีวิวต้องใช้ **รหัสที่ดึงได้** (ไม่ใช่ลิงก์) ไม่งั้นผู้เล่นจะชี้ไป URL ที่ผิด
  */
  const detectedVideoId = youTubeIdFromInput(fields.videoId);
  const videoIdTrimmed = fields.videoId.trim();

  /* พรีวิว: ประกอบเป็น RecipeRecord จากค่าที่กำลังพิมพ์ แล้วส่งให้ตัวเรนเดอร์ของหน้าเว็บจริง */
  const previewRecord: RecipeRecord = {
    id: props.initial.id === "" ? "preview" : props.initial.id,
    sourceId: "",
    sourceUrl: "",
    titleTh: fields.titleTh,
    titleEn: fields.titleEn,
    coverPath: fields.coverPath === "" ? null : fields.coverPath,
    coverWidth: null,
    coverHeight: null,
    videoProvider: "youtube",
    videoId: detectedVideoId ?? "",
    publishedOn: fields.publishedOn === "" ? null : fields.publishedOn,
    sortOrder: 0,
  };

  const statusMessage =
    state.status === "saved"
      ? m.recipesAdminSaved
      : state.status === "draft"
        ? m.recipesAdminSavedDraft
        : state.status === "error"
          ? state.reason === "video"
            ? m.recipesAdminErrorVideo
            : state.reason === "date"
              ? m.recipesAdminErrorDate
              : state.reason === "database"
                ? m.recipesAdminErrorDatabase
                : state.reason === "not-found"
                  ? m.recipesAdminErrorNotFound
                  : m.recipesAdminErrorTitle
          : "";

  /*
    ⚠️ id ที่จะส่งจริง: ถ้าเพิ่ง "สร้างใหม่" สำเร็จ (state.createdId) ให้ใช้ id ที่เซิร์ฟเวอร์คืนมา
    ⇒ กดบันทึกซ้ำจะเป็นการ **แก้** ไม่ใช่สร้างเมนูซ้ำอีกใบ (เคสจริงที่ต้องกัน)
    (ทำแบบ derive ตอน render — ไม่ใช้ useEffect + setState ซึ่ง lint `set-state-in-effect` ไม่ให้ผ่าน)
  */
  const effectiveId = props.initial.id !== "" ? props.initial.id : (state.createdId ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-8 lg:flex-row">
      <input type="hidden" name="id" value={effectiveId} />

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {props.trashed ? (
          <p className="border-line bg-bg-subtle text-danger rounded-xl border px-4 py-3 text-sm">
            {m.recipesAdminTrashedNotice}
          </p>
        ) : null}

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

        <p className="text-fg-muted text-xs">{m.recipesAdminSlugLocked}</p>

        <label className="block">
          <span className={LABEL_CLASS}>{m.recipesAdminFieldTitleTh}</span>
          <input
            type="text"
            name="titleTh"
            value={fields.titleTh}
            onChange={(event) => setField("titleTh", event.target.value)}
            className={INPUT_CLASS}
            required
          />
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>{m.recipesAdminFieldTitleEn}</span>
          <input
            type="text"
            name="titleEn"
            value={fields.titleEn}
            onChange={(event) => setField("titleEn", event.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLASS}>{m.recipesAdminFieldVideo}</span>
            <input
              type="text"
              name="videoId"
              value={fields.videoId}
              onChange={(event) => setField("videoId", event.target.value)}
              className={INPUT_CLASS}
              required
            />
            <span className="text-fg-muted mt-1 block text-xs">{m.recipesAdminFieldVideoHint}</span>
            {/* ผลการดึงรหัสจากสิ่งที่วาง (รอบที่ 136) — บอกทันทีว่าวางลิงก์แล้วได้รหัสอะไร */}
            {videoIdTrimmed === "" ? null : detectedVideoId === null ? (
              <span className="text-danger mt-1 block text-xs">{m.recipesAdminVideoNotFound}</span>
            ) : detectedVideoId === videoIdTrimmed ? null : (
              <span className="text-fg-muted mt-1 block text-xs">
                {fillTemplate(m.recipesAdminVideoDetected, { id: detectedVideoId })}
              </span>
            )}
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.recipesAdminFieldPublishedOn}</span>
            <input
              type="date"
              name="publishedOn"
              value={fields.publishedOn}
              onChange={(event) => setField("publishedOn", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.recipesAdminFieldSort}</span>
            <input
              type="number"
              name="sortOrder"
              value={fields.sortOrder}
              onChange={(event) => setField("sortOrder", event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>{m.recipesAdminFieldStatus}</span>
            <select
              name="status"
              value={fields.status}
              onChange={(event) => setField("status", event.target.value)}
              className={INPUT_CLASS}
            >
              <option value="draft">{m.recipesAdminStatusDraft}</option>
              <option value="published">{m.recipesAdminStatusPublished}</option>
            </select>
          </label>
        </div>

        {/* ภาพปก (รอบที่ 299): อัปโหลดจากเครื่องเป็นทางหลัก + เลือกจากคลังเป็นทางสำรอง — ตัวเดียวกับจอข่าว */}
        <CoverImagePicker
          labels={{
            field: m.recipesAdminFieldCover,
            empty: m.recipesAdminNoCover,
            previewAlt: m.recipesAdminFieldCover,
            upload: m.recipesAdminUpload,
            uploadHint: m.recipesAdminUploadHint,
            uploading: m.recipesAdminUploading,
            uploadFailed: m.recipesAdminUploadFailed,
            pickFromLibrary: m.recipesAdminPickImage,
            cancel: m.recipesAdminCancel,
            remove: m.recipesAdminCoverRemove,
            storedInLibrary: m.recipesAdminCoverStoredInLibrary,
            noImages: m.recipesAdminNoImages,
          }}
          value={fields.coverPath}
          onChange={(next) => setField("coverPath", next)}
          library={props.library}
          uploadAction={uploadRecipeImageAction}
          initialUploadState={INITIAL_RECIPE_UPLOAD_STATE}
        />

        <div>
          <button type="submit" disabled={pending} className={PRIMARY_CLASS}>
            {m.recipesAdminSave}
          </button>
        </div>
      </div>

      {/* พรีวิว: ใช้ RecipeVideoList ตัวเดียวกับหน้า /recipes (สลับ ไทย/EN ได้ — แบบเดียวกับจอข่าว) */}
      <aside className="lg:w-[420px] lg:shrink-0">
        <div className="border-line bg-bg-subtle admin-preview-rail rounded-2xl border p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-fg-muted text-xs font-semibold uppercase">{m.recipesAdminPreview}</h2>
            <span className="flex items-center gap-1" role="group" aria-label={m.recipesAdminPreview}>
              {(["th", "en"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPreviewLanguage(item)}
                  aria-pressed={previewLanguage === item}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    previewLanguage === item ? "border-line bg-surface text-fg" : "border-line text-fg-muted"
                  }`}
                >
                  {item === "th" ? m.recipesAdminPreviewTh : m.recipesAdminPreviewEn}
                </button>
              ))}
            </span>
          </div>

          <PreviewFrame singleCard width={SITE_RECIPE_CARD_WIDTH} label={fillTemplate(m.adminProductsPreviewSiteWidth, { width: String(SITE_RECIPE_CARD_WIDTH) })}>

            <RecipeVideoList
            recipes={[previewRecord]}
            language={previewLanguage}
            strings={props.publicStrings}
            titlePlaceholder={m.recipesAdminPreviewUntitled}
          />

          </PreviewFrame>
          <p className="text-fg-muted mt-2 text-xs">
            {fillTemplate(m.recipesAdminPreviewHint, { status: fields.status === "draft" ? m.recipesAdminStatusDraft : m.recipesAdminStatusPublished })}
          </p>
        </div>
      </aside>
    </form>
  );
}

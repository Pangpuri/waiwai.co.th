"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import { saveNewsAction } from "@/app/admin/news/actions";
import type { Messages } from "@/lib/i18n/messages/th";
import { NewsBodyBlocks } from "@/features/admin/ui/news-body-blocks";
import { NewsPreview, type NewsPreviewSize } from "@/features/admin/ui/news-preview";
import { newsBlocksToEditor, parseNewsEditorBlocks, type NewsEditorBlock } from "@/lib/news/editor-blocks";
import type { NewsBlock } from "@/lib/news/body";
import { INITIAL_NEWS_SAVE_STATE } from "@/features/admin/news-state";

/**
 * ฟอร์มแก้ข่าว/กิจกรรม (รอบที่ 123) — **client component** เพราะต้อง
 * 1. ใช้ `useActionState` ⇒ แสดงผลบันทึก/ข้อผิดพลาดโดยไม่ต้องรีเฟรชและ **ไม่เสียสิ่งที่พิมพ์ไว้**
 * 2. ปุ่ม "แทรกภาพนี้" ต้องเติมโทเคน `[[img:…]]` ลงในช่องเนื้อหาตำแหน่งเคอร์เซอร์
 *
 * กติกา: **ข้อความทั้งหมดมาจากพจนานุกรม** (ห้ามพิมพ์ไทยใน .tsx) · สีใช้ token เท่านั้น
 * เนื้อหายังถูกส่งเป็นข้อความธรรมดา ⇒ ฝั่งเซิร์ฟเวอร์แปลงเป็นบล็อกด้วย `newsTextToBlocks()` (ห้ามเชื่อฝั่งนี้)
 */

export type NewsEditorLibraryItem = {
  readonly id: string;
  readonly filename: string;
  readonly path: string;
};

type NewsEditorFormProps = {
  readonly strings: Messages["admin"];
  /** id ของข่าว ("" = สร้างใหม่) */
  readonly id: string;
  readonly titleTh: string;
  readonly titleEn: string;
  readonly excerptTh: string;
  readonly excerptEn: string;
  readonly coverPath: string;
  readonly publishedLocal: string;
  readonly status: "draft" | "published";
  readonly initialBody: readonly NewsBlock[];
  readonly library: readonly NewsEditorLibraryItem[];
  /** ขนาดรูปสำหรับพรีวิว (ส่งเป็นรายการธรรมดา — Map ข้าม RSC boundary ไม่ได้) */
  readonly previewSizes: readonly NewsPreviewSize[];
  readonly trashed: boolean;
};

const INPUT_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-xl border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted mb-1 block text-xs font-semibold";
const BUTTON_CLASS =
  "bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2";

export function NewsEditorForm(props: NewsEditorFormProps) {
  const [state, formAction, pending] = useActionState(saveNewsAction, INITIAL_NEWS_SAVE_STATE);
  const [cover, setCover] = useState(props.coverPath);
  /* ทุกช่องเป็น "ควบคุม" เพื่อให้พรีวิวสะท้อนสิ่งที่กำลังพิมพ์แบบทันที (รอบที่ 128) */
  const [titleTh, setTitleTh] = useState(props.titleTh);
  const [titleEn, setTitleEn] = useState(props.titleEn);
  const [excerptTh, setExcerptTh] = useState(props.excerptTh);
  const [excerptEn, setExcerptEn] = useState(props.excerptEn);
  const [publishedLocal, setPublishedLocal] = useState(props.publishedLocal);
  const [blocks, setBlocks] = useState<readonly NewsEditorBlock[]>(() => newsBlocksToEditor(props.initialBody));
  const m = props.strings;

  /* ข้อความผลลัพธ์ — มาจากพจนานุกรมเท่านั้น (Server Action ส่งกลับแค่รหัสเหตุผล) */
  const statusMessage =
    state.status === "saved"
      ? m.newsAdminSaved
      : state.status === "draft"
        ? m.newsAdminSavedDraft
        : state.status === "error"
          ? state.reason === "title"
            ? m.newsAdminErrorTitle
            : state.reason === "body"
              ? m.newsAdminErrorBody
              : state.reason === "database"
                ? m.newsAdminErrorDatabase
                : m.newsAdminErrorNotFound
          : "";

  return (
    <form action={formAction} className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
      <input type="hidden" name="id" value={props.id} />

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

      {props.trashed ? (
        <p className="border-line bg-bg-subtle text-fg-muted rounded-xl border px-4 py-3 text-sm">
          {m.newsAdminTrashedNote}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className={LABEL_CLASS}>{m.newsAdminFieldTitleTh}</span>
          <input
            type="text"
            name="titleTh"
            value={titleTh}
            onChange={(event) => setTitleTh(event.target.value)}
            className={INPUT_CLASS}
            required
          />
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>{m.newsAdminFieldTitleEn}</span>
          <input
            type="text"
            name="titleEn"
            value={titleEn}
            onChange={(event) => setTitleEn(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>{m.newsAdminFieldExcerptTh}</span>
          <textarea
            name="excerptTh"
            value={excerptTh}
            onChange={(event) => setExcerptTh(event.target.value)}
            rows={3}
            className={INPUT_CLASS}
            placeholder={m.newsAdminSearchPlaceholder}
          />
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>{m.newsAdminFieldExcerptEn}</span>
          <textarea
            name="excerptEn"
            value={excerptEn}
            onChange={(event) => setExcerptEn(event.target.value)}
            rows={3}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className={LABEL_CLASS}>{m.newsAdminFieldCover}</span>
          <select name="coverPath" value={cover} onChange={(event) => setCover(event.target.value)} className={INPUT_CLASS}>
            <option value="">{m.newsAdminCoverNone}</option>
            {props.library.map((item) => (
              <option key={item.id} value={item.path}>
                {item.filename}
              </option>
            ))}
          </select>
          {cover === "" ? null : (
            <span className="border-line bg-bg-subtle mt-2 block h-24 w-36 overflow-hidden rounded-lg border">
              <Image
                src={cover}
                alt={m.newsAdminCoverAlt}
                width={288}
                height={192}
                className="h-full w-full object-cover"
                unoptimized
              />
            </span>
          )}
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>{m.newsAdminFieldPublished}</span>
          <input
            type="datetime-local"
            name="publishedLocal"
            value={publishedLocal}
            onChange={(event) => setPublishedLocal(event.target.value)}
            className={INPUT_CLASS}
          />
          <span className="text-fg-muted mt-1 block text-xs">{m.newsAdminPublishedHint}</span>
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>{m.newsAdminFieldStatus}</span>
          <select name="status" defaultValue={props.status} className={INPUT_CLASS}>
            <option value="published">{m.newsAdminStatusPublished}</option>
            <option value="draft">{m.newsAdminStatusDraft}</option>
          </select>
        </label>
      </div>

      <div>
        <span className={LABEL_CLASS}>{m.newsAdminFieldBody}</span>
        <NewsBodyBlocks strings={m} initial={blocks} library={props.library} onChange={setBlocks} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={BUTTON_CLASS}>
          {m.newsAdminSave}
        </button>
      </div>
      </div>

      <aside className="lg:w-[380px] lg:shrink-0">
        <div className="lg:sticky lg:top-6">
          <NewsPreview
            strings={m}
            titleTh={titleTh}
            titleEn={titleEn}
            excerptTh={excerptTh}
            excerptEn={excerptEn}
            coverPath={cover}
            publishedLocal={publishedLocal}
            blocks={parseNewsEditorBlocks(blocks.map((item) => (item.kind === "image" ? { kind: "image", mediaId: item.mediaId, alt: item.alt } : { kind: item.kind, text: item.text })))}
            sizes={props.previewSizes}
            defaultLanguage="th"
          />
        </div>
      </aside>
    </form>
  );
}

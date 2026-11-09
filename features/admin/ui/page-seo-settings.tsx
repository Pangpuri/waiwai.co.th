"use client";

import { useState } from "react";

import { updatePageSeoAction } from "@/app/admin/builder/page-actions";
import { ImageDrop } from "@/features/admin/ui/image-drop";
import { MAX_SEO_DESCRIPTION_LENGTH, MAX_SEO_TITLE_LENGTH, type PageRecord } from "@/lib/pages/model";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ฟอร์ม "SEO ของหน้านี้" (W2)
 *
 * - **รูป OG อัปโหลด/ลากวางได้จริง** (รอบ 337 ต่อ · คำเจ้าของ 2026-11-09:
 *   *"รูปสำหรับแชร์ (Open Graph) ... อัพภาพไม่ได้ ... ที่เขียนว่าลากเข้ามาได้เลย"*)
 *   ใช้ `ImageDrop` ตัวเดียวกับหน้าจออื่น — อัปโหลดเข้าคลังภาพแล้วเก็บแค่พาธ `/media/<id>` (มติ D9)
 *   ⚠️ `ImageDrop` มี `<form>` ของตัวเอง ⇒ ต้องวาง **นอก** ฟอร์มบันทึก SEO (ห้าม nested form)
 *   แล้วส่งพาธด้วย hidden input ภายในฟอร์ม
 * - ทุกช่อง **เว้นว่างได้** = ใช้ข้อความเดิมจากระบบ (ค่าเริ่มต้น = เว้นว่างทั้งหมด ⇒ หน้าตาเว็บไม่เปลี่ยน)
 * - ต้องกด "บันทึก SEO" หลังอัปโหลดรูป เพื่อให้พาธถูกบันทึกกับหน้านี้
 */

const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted text-xs";

/** สัดส่วนมาตรฐานของ OG image (1200×630) — ใช้เป็นกรอบตัวอย่าง */
const OG_ASPECT = 1200 / 630;

export function PageSeoSettings({
  page,
  strings,
}: {
  readonly page: PageRecord;
  readonly strings: Messages["admin"];
}) {
  const titleHint = strings.seoTitleLength.replace("{n}", String(MAX_SEO_TITLE_LENGTH));
  const descriptionHint = strings.seoTitleLength.replace("{n}", String(MAX_SEO_DESCRIPTION_LENGTH));
  const [ogImage, setOgImage] = useState({
    path: page.seo.ogImagePath,
    altTh: "",
    altEn: "",
    hasWatermark: false,
  });

  return (
    <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-fg text-sm font-semibold">{strings.seoTitle}</h2>
        <p className="text-fg-muted text-xs">{strings.seoHint}</p>
      </div>

      {/*
        รูป OG — อยู่นอกฟอร์ม SEO เพราะ ImageDrop มีฟอร์มอัปโหลดของตัวเอง
        ค่าที่อัปโหลดแล้วจะถูกส่งเข้าฟอร์ม SEO ผ่าน hidden input ด้านล่าง
      */}
      <div className="flex flex-col gap-1">
        <ImageDrop
          strings={strings}
          value={ogImage}
          onChange={(patch) => setOgImage((current) => ({ ...current, ...patch }))}
          label={strings.seoOgImage}
          frameAspect={OG_ASPECT}
          frameHint={strings.seoOgImageHint}
          previewAspect={OG_ASPECT}
          previewFit="contain"
          showWatermark={false}
          showAltFields={false}
        />
      </div>

      <form action={updatePageSeoAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={page.id} />
        <input type="hidden" name="ogImagePath" value={ogImage.path} />

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{strings.seoMetaTitleTh}</span>
          <input type="text" name="seoTitleTh" defaultValue={page.seo.titleTh} maxLength={MAX_SEO_TITLE_LENGTH} className={FIELD_CLASS} />
          <span className="text-fg-muted text-[11px]">{titleHint}</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{strings.seoMetaTitleEn}</span>
          <input type="text" name="seoTitleEn" defaultValue={page.seo.titleEn} maxLength={MAX_SEO_TITLE_LENGTH} className={FIELD_CLASS} />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{strings.seoMetaDescriptionTh}</span>
          <textarea name="seoDescriptionTh" defaultValue={page.seo.descriptionTh} maxLength={MAX_SEO_DESCRIPTION_LENGTH} rows={3} className={FIELD_CLASS} />
          <span className="text-fg-muted text-[11px]">{descriptionHint}</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{strings.seoMetaDescriptionEn}</span>
          <textarea name="seoDescriptionEn" defaultValue={page.seo.descriptionEn} maxLength={MAX_SEO_DESCRIPTION_LENGTH} rows={3} className={FIELD_CLASS} />
        </label>

        <label className="border-line bg-surface-raised flex items-center justify-between gap-2 rounded-lg border p-2">
          <span className="text-fg text-xs font-semibold">{strings.seoNoindex}</span>
          <input type="checkbox" name="seoNoindex" value="1" defaultChecked={page.seo.noindex} className="accent-brand-red h-4 w-4" />
        </label>

        <button
          type="submit"
          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring self-start rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {strings.seoSave}
        </button>
      </form>
    </section>
  );
}

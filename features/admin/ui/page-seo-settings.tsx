import { updatePageSeoAction } from "@/app/admin/builder/page-actions";
import { MAX_SEO_DESCRIPTION_LENGTH, MAX_SEO_TITLE_LENGTH, type PageRecord } from "@/lib/pages/model";

/**
 * ฟอร์ม "SEO ของหน้านี้" (W2)
 *
 * - Server Component + Server Action ⇒ ไม่ต้องมี JS ฝั่งไคลเอนต์
 * - ทุกช่อง **เว้นว่างได้** = ใช้ข้อความเดิมจากระบบ (ค่าเริ่มต้น = เว้นว่างทั้งหมด ⇒ หน้าตาเว็บไม่เปลี่ยน)
 * - รูป OG: ใช้ช่องพาธ (คลังภาพแบบเลือกได้จะมาใน W4 · ตอนนี้ลากวางได้จากช่องของตัวแก้แถบเมนู)
 */

const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted text-xs";

export function PageSeoSettings({
  page,
  strings,
}: {
  readonly page: PageRecord;
  readonly strings: {
    readonly seoTitle: string;
    readonly seoHint: string;
    readonly seoMetaTitleTh: string;
    readonly seoMetaTitleEn: string;
    readonly seoMetaDescriptionTh: string;
    readonly seoMetaDescriptionEn: string;
    readonly seoOgImage: string;
    readonly seoOgImageHint: string;
    readonly seoNoindex: string;
    readonly seoSave: string;
    readonly seoTitleLength: string;
  };
}) {
  const titleHint = strings.seoTitleLength.replace("{n}", String(MAX_SEO_TITLE_LENGTH));
  const descriptionHint = strings.seoTitleLength.replace("{n}", String(MAX_SEO_DESCRIPTION_LENGTH));

  return (
    <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-fg text-sm font-semibold">{strings.seoTitle}</h2>
        <p className="text-fg-muted text-xs">{strings.seoHint}</p>
      </div>

      <form action={updatePageSeoAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={page.id} />

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

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{strings.seoOgImage}</span>
          <input type="text" name="ogImagePath" defaultValue={page.seo.ogImagePath} placeholder={strings.seoOgImageHint} className={FIELD_CLASS} />
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

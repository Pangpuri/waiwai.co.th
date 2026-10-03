import { updatePageAction } from "@/app/admin/builder/page-actions";
import { MAX_PAGE_NAME_LENGTH, type PageRecord } from "@/lib/pages/model";

/**
 * ฟอร์ม "ตั้งค่าหน้านี้" (W1)
 *
 * - เป็น Server Component + Server Action ⇒ **ไม่ต้องมี JS ฝั่งไคลเอนต์เลย** (ฟอร์มส่งได้แม้ปิด JS)
 * - ชื่อหน้า = ชื่อเมนูของหน้านั้น (ดู lib/chrome/loader.ts) ⇒ แก้ที่เดียวได้ทั้งเว็บ
 * - ข้อความทั้งหมดมาจากพจนานุกรม (กฎโปรเจกต์: ห้ามข้อความไทยใน .tsx)
 */

const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted text-xs";

export function PageSettings({
  page,
  strings,
}: {
  readonly page: PageRecord;
  readonly strings: {
    readonly pageSettingsTitle: string;
    readonly pageSettingsHint: string;
    readonly pageNameTh: string;
    readonly pageNameEn: string;
    readonly pageNameEnHint: string;
    readonly pageInMenu: string;
    readonly pageMenuOrder: string;
    readonly pageSave: string;
    readonly pageEditorBlocks: string;
    readonly pageEditorDesigned: string;
  };
}) {
  return (
    <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-fg text-sm font-semibold">{strings.pageSettingsTitle}</h2>
        <p className="text-fg-muted text-xs">{strings.pageSettingsHint}</p>
        <p className="text-fg-muted text-[11px]">
          {page.editor === "blocks" ? strings.pageEditorBlocks : strings.pageEditorDesigned} · <span className="font-mono">{page.id}</span>
        </p>
      </div>

      <form action={updatePageAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={page.id} />

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{strings.pageNameTh}</span>
          <input
            type="text"
            name="nameTh"
            defaultValue={page.nameTh}
            required
            maxLength={MAX_PAGE_NAME_LENGTH}
            className={FIELD_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{strings.pageNameEn}</span>
          <input
            type="text"
            name="nameEn"
            defaultValue={page.nameEn}
            maxLength={MAX_PAGE_NAME_LENGTH}
            placeholder={strings.pageNameEnHint}
            className={FIELD_CLASS}
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.pageMenuOrder}</span>
            <input type="number" name="menuOrder" defaultValue={page.menuOrder} min={0} max={9999} className={FIELD_CLASS} />
          </label>

          <label className="border-line bg-surface-raised flex items-center justify-between gap-2 self-end rounded-lg border p-2">
            <span className="text-fg text-xs font-semibold">{strings.pageInMenu}</span>
            <input type="checkbox" name="inMenu" value="1" defaultChecked={page.inMenu} className="accent-brand-red h-4 w-4" />
          </label>
        </div>

        <button
          type="submit"
          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring self-start rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {strings.pageSave}
        </button>
      </form>
    </section>
  );
}

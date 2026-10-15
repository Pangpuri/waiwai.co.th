import Link from "next/link";

import { updatePageAction } from "@/app/admin/builder/page-actions";
import { MAX_PAGE_NAME_LENGTH, type PageRecord } from "@/lib/pages/model";

/**
 * ฟอร์ม "ตั้งค่าหน้านี้" (W1)
 *
 * - เป็น Server Component + Server Action ⇒ **ไม่ต้องมี JS ฝั่งไคลเอนต์เลย** (ฟอร์มส่งได้แม้ปิด JS)
 * - ชื่อหน้า = ชื่อเมนูของหน้านั้น (ดู lib/chrome/loader.ts) ⇒ แก้ที่เดียวได้ทั้งเว็บ
 * - ข้อความทั้งหมดมาจากพจนานุกรม (กฎโปรเจกต์: ห้ามข้อความไทยใน .tsx)
 *
 * ## 🆕 รอบที่ 286 (ปิดหนี้ D-281-1/D-281-2) — โหมด "ล็อก" สำหรับหน้า `product-<หมวด>`
 * หน้ารายละเอียดหมวดมีชื่อมาจาก **จอหมวดสินค้า** (`product_category.name_th`) ⇒ จอนี้ไม่ให้แก้ชื่อ
 * (ซ่อนช่องกรอกไปเลย ไม่ใช่แค่ disable) และไม่ให้สลับ "ขึ้นเมนูหลัก" เพราะเมนูหลักปิดถาวร (มติ D30)
 * ⇒ เหลือช่อง "ลำดับ" ที่ยังมีผลจริง · ค่าที่แสดงเป็นแบบอ่านอย่างเดียว + ลิงก์ไปจอต้นทาง
 */

const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted text-xs";

/** ข้อความของโหมดล็อก (มาจากพื้นที่พจนานุกรม `adminPages` — รอบที่ 286) */
export type PageSettingsLock = {
  readonly strings: {
    readonly pageNameLockedTitle: string;
    readonly pageNameLockedLink: string;
    readonly pageMenuLockedNote: string;
  };
  /** ลิงก์ไปจอต้นทางของชื่อ/เมนู (จอหมวดสินค้า) */
  readonly href: string;
};

export function PageSettings({
  page,
  strings,
  lock,
}: {
  readonly page: PageRecord;
  readonly lock?: PageSettingsLock;
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

        {lock === undefined ? (
          <>
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
          </>
        ) : (
          /* ชื่อมาจากจอต้นทาง (หมวดสินค้า) ⇒ แสดงอย่างเดียว + ลิงก์ไปแก้ที่นั้น (D-281-1) */
          <div
            className="border-line bg-surface-raised flex flex-col gap-1 rounded-lg border p-2"
            data-page-name-locked=""
          >
            <span className="text-fg text-xs font-semibold">{lock.strings.pageNameLockedTitle}</span>
            <span className="text-fg text-sm font-semibold">{page.nameTh}</span>
            {page.nameEn.trim() === "" ? null : <span className="text-fg-muted text-xs">{page.nameEn}</span>}
            <Link href={lock.href} className="text-accent text-xs font-semibold underline">
              {lock.strings.pageNameLockedLink}
            </Link>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.pageMenuOrder}</span>
            <input type="number" name="menuOrder" defaultValue={page.menuOrder} min={0} max={9999} className={FIELD_CLASS} />
          </label>

          {lock === undefined ? (
            <label className="border-line bg-surface-raised flex items-center justify-between gap-2 self-end rounded-lg border p-2">
              <span className="text-fg text-xs font-semibold">{strings.pageInMenu}</span>
              <input type="checkbox" name="inMenu" value="1" defaultChecked={page.inMenu} className="accent-brand-red h-4 w-4" />
            </label>
          ) : (
            /* หน้า detail ของหมวดไม่ขึ้นเมนูหลักเสมอ ⇒ ไม่มีสวิตช์ให้กด แล้วบอกเหตุผล (D-281-2) */
            <p
              className="border-line bg-surface-raised text-fg-muted self-end rounded-lg border p-2 text-[11px]"
              data-page-menu-locked=""
            >
              {lock.strings.pageMenuLockedNote}
            </p>
          )}
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

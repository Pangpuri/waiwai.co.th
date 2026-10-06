import { cache } from "react";

import { getPool } from "@/db/pool";
import { readQuery } from "@/lib/db/read";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { defaultPages, isPageEditor, sortPages, type PageEditor, type PageRecord, type PageSeo } from "@/lib/pages/model";

/**
 * อ่าน/เขียน "หน้า" จากฐานข้อมูล (W1)
 *
 * ⚠️ หลักการเดียวกับส่วนอื่นของโปรเจกต์: **ห้ามทำให้เว็บพังเพราะฐานข้อมูล**
 * - ยังไม่ตั้ง `DATABASE_URL` / อ่านไม่ได้ / ตารางว่าง → คืนค่าจากโค้ด (`defaultPages`)
 * - แถวที่ข้อมูลผิดรูป → ข้ามแถวนั้น (ไม่ทำให้ทั้งหน้าจอล่ม)
 */

type PageRow = {
  readonly id: string;
  readonly name_th: string;
  readonly name_en: string | null;
  readonly menu_order: number | null;
  readonly in_menu: boolean | null;
  readonly editor: string;
  readonly seo_title_th: string | null;
  readonly seo_title_en: string | null;
  readonly seo_description_th: string | null;
  readonly seo_description_en: string | null;
  readonly og_image_path: string | null;
  readonly seo_noindex: boolean | null;
};

const SELECT_COLUMNS =
  "id, name_th, name_en, menu_order, in_menu, editor, seo_title_th, seo_title_en, seo_description_th, seo_description_en, og_image_path, seo_noindex";

function text(value: string | null): string {
  return typeof value === "string" ? value : "";
}

function toPage(row: PageRow): PageRecord | null {
  if (typeof row.id !== "string" || row.id === "") return null;
  if (typeof row.name_th !== "string" || row.name_th.trim() === "") return null;

  const editor: PageEditor = isPageEditor(row.editor) ? row.editor : "designed";
  return {
    id: row.id,
    nameTh: row.name_th,
    nameEn: typeof row.name_en === "string" ? row.name_en : "",
    menuOrder: typeof row.menu_order === "number" ? row.menu_order : 0,
    inMenu: row.in_menu !== false,
    editor,
    seo: {
      titleTh: text(row.seo_title_th),
      titleEn: text(row.seo_title_en),
      descriptionTh: text(row.seo_description_th),
      descriptionEn: text(row.seo_description_en),
      ogImagePath: text(row.og_image_path),
      noindex: row.seo_noindex === true,
    },
  };
}

/** หน้าทั้งหมด (จากฐานข้อมูล · ถ้าไม่มีอะไรเลย = ค่าในโค้ด) */
export async function listPages(fallback: readonly PageRecord[]): Promise<readonly PageRecord[]> {
  if (!isDatabaseConfigured()) return fallback;

  try {
    const { rows } = await readQuery<PageRow>(`select ${SELECT_COLUMNS} from page`);
    const pages = rows.map((row) => toPage(row)).filter((page): page is PageRecord => page !== null);
    if (pages.length === 0) return fallback;
    return sortPages(pages);
  } catch {
    return fallback;
  }
}

/** หน้าที่ระบุ (ไม่พบ = null) */
export async function findPage(id: string): Promise<PageRecord | null> {
  if (!isDatabaseConfigured()) return null;

  try {
    const { rows } = await readQuery<PageRow>(`select ${SELECT_COLUMNS} from page where id = $1`, [id]);
    const row = rows[0];
    return row === undefined ? null : toPage(row);
  } catch {
    return null;
  }
}

/**
 * อ่าน "ค่า SEO" ของหน้าสำหรับใช้ตอนสร้าง metadata (W2)
 * - ไม่มี DB / ไม่พบหน้า / อ่านพลาด ⇒ `null` (ผู้เรียกจะใช้ค่าเดิมจากพจนานุกรม)
 * - ใช้ React `cache` เพื่อไม่ให้อ่านซ้ำหลายรอบในคำขอเดียวกัน
 */
export const loadPageSeo = cache(async (id: string): Promise<PageSeo | null> => {
  if (!isDatabaseConfigured()) return null;
  const page = await findPage(id);
  return page === null ? null : page.seo;
});

export type PageUpdate = {
  readonly nameTh: string;
  readonly nameEn: string;
  readonly inMenu: boolean;
  readonly menuOrder: number;
};

/** บันทึกชื่อ/เมนู/ลำดับของหน้า (ผู้เรียกต้องตรวจสิทธิ์และตรวจค่าแล้ว) */
export async function updatePage(id: string, update: PageUpdate, actor: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `update page
        set name_th = $2,
            name_en = $3,
            in_menu = $4,
            menu_order = $5,
            updated_at = now(),
            updated_by = $6
      where id = $1`,
    [id, update.nameTh, update.nameEn, update.inMenu, update.menuOrder, actor],
  );
  return (rowCount ?? 0) > 0;
}

/** บันทึกค่า SEO ของหน้า (ผู้เรียกต้องตรวจสิทธิ์และตรวจค่าแล้ว) */
export async function updatePageSeo(id: string, seo: PageSeo, actor: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `update page
        set seo_title_th = $2,
            seo_title_en = $3,
            seo_description_th = $4,
            seo_description_en = $5,
            og_image_path = $6,
            seo_noindex = $7,
            updated_at = now(),
            updated_by = $8
      where id = $1`,
    [id, seo.titleTh, seo.titleEn, seo.descriptionTh, seo.descriptionEn, seo.ogImagePath, seo.noindex, actor],
  );
  return (rowCount ?? 0) > 0;
}

/** ชื่อหน้าสำหรับใช้แทนป้ายเมนูของ navbar (คีย์ = id ของเมนู) */
export async function pageMenuLabels(fallback: readonly PageRecord[]): Promise<Readonly<Record<string, { readonly th: string; readonly en: string }>>> {
  const pages = await listPages(fallback);
  const labels: Record<string, { th: string; en: string }> = {};
  for (const page of pages) {
    if (!page.inMenu) continue;
    labels[page.id] = { th: page.nameTh, en: page.nameEn.trim() === "" ? page.nameTh : page.nameEn };
  }
  return labels;
}

/** ให้หน้าจออื่นเรียกใช้ค่าเริ่มต้นได้จากที่เดียว */
export { defaultPages };

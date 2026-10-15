import Link from "next/link";

import {
  deleteCategoryAction,
  reorderCategoriesAction,
  restoreCategoryDefaultsAction,
  toggleCategoryHiddenAction,
} from "./actions";
import { CategoryCreateForm } from "@/features/admin/ui/category-create-form";
import { CategoryEditorForm } from "@/features/admin/ui/category-editor-form";
import { CategoryPresetPanel } from "@/features/admin/ui/category-preset-panel";
import { SortableList } from "@/features/admin/ui/sortable-list";
import { CATALOG_ITEMS } from "@/features/products/catalog";
import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";
import { listReorderItems } from "@/lib/admin/reorder";
import { listMedia } from "@/lib/media/repository";
import {
  MAX_PRODUCT_CATEGORIES,
  categoryDeletionAllowed,
  isBuiltInCategorySlug,
} from "@/lib/products/categories";
import {
  listAdminCategories,
  listCategoryDefaults,
  listCategoryPresets,
} from "@/lib/products/categories-repository";
import { categoryNameOf } from "@/lib/products/display";

/**
 * หลังบ้าน — **"หมวดสินค้า"** (รอบที่ 264 · มติเจ้าของ D25 · 2026-10-14)
 *
 * ที่มา (คำเจ้าของ 2026-10-10): *"ต้องมีหน้าหมวดสินค้า … เก็บรูปไว้ในฐานข้อมูลเป็นรูปค่าเริ่มต้น
 * และโครงสร้างตามหน้าบ้านเป็นค่าเริ่มต้น … ปรับเปลี่ยนรูปได้ เพิ่มหมวดได้ เผื่อมีสินค้าเพิ่มในอนาคต
 * และสามารถคืนค่าเริ่มต้นได้ เพราะงั้นค่าเริ่มต้นจะเก็บถาวรเสมอ เก็บพรัซเซ็ตได้"*
 *
 * สิ่งที่จอนี้ทำ (มติ D25 ทั้ง 5 ข้อ)
 * 1. slug ของหมวดใหม่สร้างจากชื่ออังกฤษและ **ล็อกถาวร** (ไม่ต้องมี 301)
 * 2. เพิ่มหมวดได้ **ไม่เกิน 12 หมวด** (`MAX_PRODUCT_CATEGORIES`)
 * 3. **ไม่มี "ลบหมวด"** — ใช้ **"ซ่อนจากเว็บ"** (`is_hidden`) แทน (ข้อมูลไม่ตกงาน · กู้คืนได้เสมอ)
 * 4. **ค่าเริ่มต้น = ชุด ณ วันนี้ ล็อกถาวร** — เก็บในตาราง `product_category_default` ที่จอนี้ **แก้ไม่ได้**
 *    (ปุ่ม "คืนค่าเริ่มต้น" = คัดลอกจากตารางนั้น · เติมข้อมูลด้วย `npm run products:category-defaults`)
 * 5. **พรีเซ็ต** เก็บไม่จำกัด · ไม่หมดอายุ · ไม่ขึ้นหน้า `/privacy`
 *
 * ⚠️ ทุกอย่างตรวจสิทธิ์ด้วย `requireAdminUser("content")` ก่อนอ่านข้อมูล
 * ⚠️ ฟอร์มย่อยหลายใบในหน้าเดียว (แก้/ซ่อน/คืนค่า/จัดลำดับ/พรีเซ็ต) — แต่ละใบเป็น `<form>` ของตัวเอง
 *    **ห้ามซ้อนกัน** (บทเรียนรอบที่ 129) · ช่องภาพของฟอร์มเรียก Server Action เอง
 */

const INPUT_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring rounded-lg border px-2.5 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none";
const HELP_CLASS = "border-line bg-bg-subtle text-fg-muted rounded-xl border px-3 py-2 text-sm";

export default async function AdminProductCategoriesPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.admin;

  /* ผลของการลบหมวด (redirect กลับมาพร้อม `?deleted=` / `?error=`) — ฟอร์มธรรมดา ไม่มี JS */
  const query = await searchParams;
  const deletedSlug = typeof query["deleted"] === "string" ? query["deleted"] : "";
  const deleteError = typeof query["error"] === "string" ? query["error"] : "";
  const deleteMessage =
    deletedSlug !== ""
      ? fillTemplate(messages.adminCategories.deleted, { slug: deletedSlug })
      : deleteError === "delete-built-in"
        ? messages.adminCategories.deleteBlockedBuiltIn
        : deleteError === "delete-has-products"
          ? messages.adminCategories.deleteBlockedProducts
          : deleteError === ""
            ? ""
            : messages.adminCategories.deleteCategoryHint;

  const [rows, defaults, presets, media, reorderItems] = await Promise.all([
    listAdminCategories(),
    listCategoryDefaults(),
    listCategoryPresets(),
    listMedia(60),
    listReorderItems("category"),
  ]);

  const m2 = messages.adminCategories;
  const defaultById = new Map(defaults.map((row) => [row.id, row]));
  const library = media.map((item) => ({ id: item.id, filename: item.filename, path: `/media/${item.id}` }));

  /* ชื่อที่มีผลจริง: DB → ถอยพจนานุกรม (เฉพาะหมวดในโค้ด) */
  const effectiveName = (id: string, nameTh: string, nameEn: string): string => {
    const item = CATALOG_ITEMS.find((entry) => entry.slug === id);
    const fallback = item === undefined ? id : messages.productsPage.items[item.id].name;
    return categoryNameOf(nameTh, nameEn, fallback, "th");
  };
  const imageAltOf = (id: string, name: string): string => {
    const item = CATALOG_ITEMS.find((entry) => entry.slug === id);
    return item === undefined ? name : messages.productsPage.items[item.id].imageAlt;
  };

  const defaultsReady = defaults.length > 0;

  return (
    <main className="container-site flex flex-col gap-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-fg text-xl font-semibold">{m2.title}</h1>
          <p className="text-fg-muted mt-1 max-w-3xl text-sm">{m2.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="border-line bg-surface text-fg-muted rounded-full border px-3 py-1 text-xs font-semibold">
            {fillTemplate(m2.countLabel, {
              count: String(rows.length),
              max: String(MAX_PRODUCT_CATEGORIES),
            })}
          </span>
          <Link href="/admin/products" className={INPUT_CLASS}>
            {m2.backToProducts}
          </Link>
        </div>
      </header>

      {/* ผลของการลบหมวด (มาจาก `?deleted=` / `?error=`) — บอกให้ชัดว่าเกิดอะไรขึ้น */}
      {deleteMessage === "" ? null : (
        <p
          role="status"
          className={`rounded-xl border px-3 py-2 text-sm ${
            deleteError === "" ? "border-line bg-bg-subtle text-fg" : "border-brand-red text-brand-red bg-surface"
          }`}
        >
          {deleteMessage}
        </p>
      )}

      {/* สถานะค่าเริ่มต้นถาวร — บอกตรง ๆ ว่าพร้อมใช้หรือยังต้องรันสคริปต์ */}
      <p className={HELP_CLASS}>
        {defaultsReady
          ? fillTemplate(m2.defaultsReady, { count: String(defaults.length) })
          : m2.defaultsMissing}
        <span className="mt-1 block text-xs">{m2.defaultsHint}</span>
      </p>

      {/* เพิ่มหมวดใหม่ (มติ D25 ข้อ 1/2) */}
      <details className="border-line bg-bg-subtle rounded-2xl border p-4">
        <summary className="text-fg cursor-pointer text-base font-semibold">{m2.createTitle}</summary>
        <div className="mt-3">
          <CategoryCreateForm
            strings={m2}
            library={library}
            limitReached={rows.length >= MAX_PRODUCT_CATEGORIES}
          />
        </div>
      </details>

      {/* จัดลำดับการแสดง (ใช้เครื่องมือกลาง — ลาก/ปุ่ม ↑↓) */}
      <section className="border-line bg-bg-subtle rounded-2xl border p-4">
        <h2 className="text-fg text-base font-semibold">{m2.reorderTitle}</h2>
        <p className="text-fg-muted mt-1 text-sm">{m2.reorderHint}</p>
        {reorderItems.length === 0 ? (
          <p className="text-fg-muted mt-3 text-sm">{m2.reorderEmpty}</p>
        ) : (
          <div className="mt-3">
            <SortableList
              kind="category"
              key={reorderItems.map((item) => item.id).join(",")}
              items={reorderItems}
              action={reorderCategoriesAction}
              strings={{
                up: m.sortUp,
                down: m.sortDown,
                save: m.sortSave,
                saveHint: m.sortSaveHint,
                handle: m.sortHandle,
                saved: m.sortSaved,
                failed: m.sortFailed,
              }}
            />
          </div>
        )}
      </section>

      {/* การ์ดหมวดทั้งหมด — ฟอร์มแก้ + ฟอร์มซ่อน/คืนค่า (คนละฟอร์ม ไม่ซ้อนกัน) */}
      <div className="flex flex-col gap-6">
        {rows.map((row) => {
          const builtIn = isBuiltInCategorySlug(row.id);
          const item = CATALOG_ITEMS.find((entry) => entry.slug === row.id);
          const name = effectiveName(row.id, row.nameTh, row.nameEn);
          const imageAlt = imageAltOf(row.id, name);
          const hasDefault = defaultById.has(row.id);

          return (
            /* ⚠️ `id` ของการ์ด = จุดหมายของลิงก์จากจอตัวสร้างหน้าเว็บ (`#category-<รหัสหมวด>`) — รอบที่ 286 */
            <section key={row.id} id={`category-${row.id}`} className="border-line scroll-mt-24 rounded-2xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="border-line bg-surface text-fg-muted rounded-full border px-2.5 py-0.5 text-[11px] font-semibold">
                  {builtIn ? m2.builtInBadge : m2.newBadge}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                    row.isHidden ? "border-brand-red text-brand-red" : "border-line text-fg-muted"
                  }`}
                >
                  {row.isHidden ? m2.hiddenBadge : m2.visibleBadge}
                </span>
                {row.isHidden ? <span className="text-fg-muted text-[11px]">{m2.hiddenHint}</span> : null}
              </div>

              <div className="mt-3">
                <CategoryEditorForm
                  strings={m2}
                  categoryId={row.id}
                  builtIn={builtIn}
                  categoryName={name}
                  imageAlt={imageAlt}
                  productCount={row.productCount}
                  library={library}
                  fallbackLogo={item === undefined ? null : { src: item.image.src, width: item.image.width, height: item.image.height }}
                  initial={{
                    slug: row.slug,
                    nameTh: row.nameTh,
                    nameEn: row.nameEn,
                    descriptionTh: row.descriptionTh,
                    descriptionEn: row.descriptionEn,
                    imagePath: row.imagePath ?? "",
                    logoPath: row.logoPath ?? "",
                    logoWidth: row.logoWidth,
                    logoHeight: row.logoHeight,
                    sortOrder: row.sortOrder,
                    isHidden: row.isHidden,
                  }}
                />
              </div>

              {/* ฟอร์มย่อย: ซ่อน/แสดง + คืนค่าเริ่มต้น (แยกจากฟอร์มแก้ — ห้ามซ้อน) */}
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <form action={toggleCategoryHiddenAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="intent" value={row.isHidden ? "show" : "hide"} />
                  <button type="submit" className={INPUT_CLASS}>
                    {row.isHidden ? m2.show : m2.hide}
                  </button>
                </form>

                {hasDefault ? (
                  <form action={restoreCategoryDefaultsAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit" className={INPUT_CLASS}>
                      {m2.restoreOne}
                    </button>
                  </form>
                ) : (
                  <span className="text-fg-muted text-xs">{m2.restoreUnavailable}</span>
                )}

                <span className="text-fg-muted text-[11px]">{m2.restoreConfirm}</span>
              </div>

              {/*
                ลบหมวดถาวร (รอบที่ 280 · มติ D30 ข้อ 4) — เฉพาะ **หมวดว่างที่ไม่ใช่หมวดในโค้ด**
                ⚠️ ประตูจริงอยู่ที่ SQL (`deleteEmptyCategoryAdmin`) · ที่นี่แค่ไม่เสนอปุ่มที่กดแล้วไม่สำเร็จ
              */}
              <div className="border-line mt-3 border-t pt-3">
                {categoryDeletionAllowed({ builtIn, productCount: row.productCount }) ? (
                  <form action={deleteCategoryAction} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="border-brand-red text-brand-red rounded-lg border px-3 py-1.5 text-sm font-semibold"
                    >
                      {m2.deleteCategory}
                    </button>
                    <span className="text-fg-muted text-[11px]">{m2.deleteCategoryConfirm}</span>
                    {/* รอบที่ 286: ที่อยู่เดิมไม่ตายทาง — บอกผู้ใช้ล่วงหน้าว่าจะเกิดอะไรขึ้นกับลิงก์เก่า */}
                    <span className="text-fg-muted text-[11px]">{m2.deleteRedirectNote}</span>
                  </form>
                ) : (
                  <p className="text-fg-muted text-xs">{builtIn ? m2.deleteBlockedBuiltIn : m2.deleteBlockedProducts}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* คืนค่าเริ่มต้นทั้งชุด (มติ D25 ข้อ 4) */}
      {defaultsReady ? (
        <form action={restoreCategoryDefaultsAction} className="flex flex-wrap items-center gap-3">
          <button type="submit" className={INPUT_CLASS}>
            {m2.restoreAll}
          </button>
          <span className="text-fg-muted text-[11px]">{m2.restoreConfirm}</span>
        </form>
      ) : null}

      {/* พรีเซ็ต (มติ D25 ข้อ 5) */}
      <CategoryPresetPanel
        strings={m2}
        presets={presets.map((preset) => ({
          id: preset.id,
          name: preset.name,
          createdAt: preset.createdAt,
          count: preset.payload.categories.length,
        }))}
      />
    </main>
  );
}

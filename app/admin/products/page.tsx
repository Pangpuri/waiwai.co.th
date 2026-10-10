import Image from "next/image";
import Link from "next/link";

import { requireAdminUser } from "@/lib/auth/dal";
import { ProductCategoryForm } from "@/features/admin/ui/product-category-form";
import type { ProductLibraryItem } from "@/features/admin/ui/product-editor-form";
import { CATALOG_ITEMS } from "@/features/products/catalog";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";
import { listMedia } from "@/lib/media/repository";
import { isCatalogCategoryId } from "@/lib/products/model";
import { adminProductCounts, listProductCategoriesForAdmin, listProductsForAdmin, type AdminProductTab } from "@/lib/products/repository";
import { deleteProductForeverAction, trashProductAction } from "./actions";

/**
 * หลังบ้าน — รายการ "สินค้า" (รอบที่ 133) + ส่วน "คำอธิบาย/ภาพปก 6 หมวด" (รอบที่ 134)
 *                              + **แท็บถังขยะ/กู้คืน/ลบถาวร (รอบที่ 139)**
 *
 * เจ้าของเลือกจอแบบ **การ์ด** (เห็นรูปสินค้า) + ค้นหา + กรองตามหมวด
 * - ทุกอย่างตรวจสิทธิ์ด้วย `requireAdminUser("content")` ก่อนอ่านข้อมูล
 * - ลิงก์ไปหน้าจอแก้ `/admin/products/<id>` (และ `/admin/products/new` สำหรับเพิ่ม)
 * - การ์ดใช้ `<img>` (ไม่ใช้ next/image) เพราะเป็นภาพหลังบ้าน ไม่ต้องปรับขนาด/แคชของหน้าเว็บ
 * - ส่วนล่าง = **ฟอร์มหมวด** 6 ใบ (ฟอร์มย่อยของตัวเอง — ห้าม `<form>` ซ้อน ตามบทเรียนรอบที่ 129)
 *
 * ⚠️ รอบที่ 139 — **การลบต้องผ่านถังขยะเสมอ**
 * - "ย้ายเข้าถังขยะ" = ซ่อนจากเว็บ (กู้คืนได้) · "ลบถาวร" มีให้เฉพาะของที่อยู่ในถังแล้ว
 * - ประตูจริงอยู่ที่ SQL (`deleteProductForever` บังคับ `deleted_at is not null`) ไม่ใช่ที่ปุ่ม
 * - ⚠️ **ไม่มี "ลบหมวด"** — 6 หมวดถูกล็อกตามมติ Q-D (รายการหมวดมาจากโค้ด `CATALOG_ITEMS`)
 */

export default async function AdminProductsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly category?: string; readonly q?: string; readonly tab?: string }>;
}) {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.admin;

  const query = await searchParams;
  const search = (query.q ?? "").trim();
  const rawCategory = (query.category ?? "").trim();
  const categoryId = isCatalogCategoryId(rawCategory) ? rawCategory : "";
  const tab: AdminProductTab = query.tab === "trash" ? "trash" : "all";

  const [listed, categoryRows, media, counts] = await Promise.all([
    listProductsForAdmin({ categoryId, search, tab }),
    listProductCategoriesForAdmin(),
    listMedia(60),
    adminProductCounts(),
  ]);

  const library: readonly ProductLibraryItem[] = media.map((item) => ({
    id: item.id,
    filename: item.filename,
    path: `/media/${item.id}`,
  }));
  const categoryBySlug = new Map(categoryRows.map((row) => [row.id, row]));

  /* ชื่อหมวดที่มีผลจริง: ค่าจากหลังบ้าน (migration 0037) → ถอยพจนานุกรม */
  const categoryName = (slug: string): string => {
    const item = CATALOG_ITEMS.find((entry) => entry.slug === slug);
    const fallback = item === undefined ? slug : messages.productsPage.items[item.id].name;
    const row = categoryBySlug.get(slug);
    if (row === undefined) return fallback;
    return row.nameTh.trim() !== "" ? row.nameTh : fallback;
  };

  const tabs: readonly { readonly id: AdminProductTab; readonly label: string; readonly count: number }[] = [
    { id: "all", label: m.adminProductsTabAll, count: counts.all },
    { id: "trash", label: m.adminProductsTabTrash, count: counts.trash },
  ];

  /* เก็บเงื่อนไขค้นหาไว้ในลิงก์แท็บ (สลับแท็บแล้วไม่หลุดตัวกรอง) */
  const tabHref = (id: AdminProductTab): string => {
    const params = new URLSearchParams();
    if (id === "trash") params.set("tab", "trash");
    if (categoryId !== "") params.set("category", categoryId);
    if (search !== "") params.set("q", search);
    const queryString = params.toString();
    return queryString === "" ? "/admin/products" : `/admin/products?${queryString}`;
  };

  return (
    <main className="container-site py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{m.adminProductsTitle}</h1>
          <p className="text-fg-muted mt-1 text-sm">{m.adminProductsSubtitle}</p>
        </div>
        <Link
          href="/admin/products/new"
          className="bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {m.adminProductsNew}
        </Link>
      </div>

      {/* แท็บ: ใช้งาน / ถังขยะ (ลิงก์ธรรมดา ไม่ต้องมี JS · ตัวนับมาจากฐานข้อมูล) */}
      <nav className="mt-6 flex flex-wrap items-center gap-2" aria-label={m.adminProductsTitle}>
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={tabHref(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-semibold no-underline ${
              tab === item.id ? "border-line bg-surface text-fg" : "border-line text-fg-muted"
            }`}
          >
            {fillTemplate(m.adminProductsTabCount, { label: item.label, count: String(item.count) })}
          </Link>
        ))}
      </nav>

      {/* กรองหมวด + ค้นหา (ฟอร์ม GET ธรรมดา ไม่ต้องมี JS) */}
      <form method="get" action="/admin/products" className="mt-4 flex flex-wrap items-end gap-2">
        {tab === "trash" ? <input type="hidden" name="tab" value="trash" /> : null}
        <label className="block">
          <span className="text-fg-muted mb-1 block text-xs font-semibold">{m.adminProductsFieldCategory}</span>
          <select
            name="category"
            defaultValue={categoryId}
            className="border-line bg-surface text-fg focus-visible:ring-ring rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="">{m.adminProductsAllCategories}</option>
            {CATALOG_ITEMS.map((item) => (
              <option key={item.id} value={item.slug}>
                {messages.productsPage.items[item.id].name}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-64 flex-1">
          <span className="text-fg-muted mb-1 block text-xs font-semibold">{m.adminProductsSearch}</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={m.adminProductsSearchPlaceholder}
            className="border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>
        <button
          type="submit"
          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {m.adminProductsApply}
        </button>
        {search === "" && categoryId === "" ? null : (
          <Link
            href={tab === "trash" ? "/admin/products?tab=trash" : "/admin/products"}
            className="text-fg-muted px-2 py-2 text-sm underline underline-offset-4"
          >
            {m.adminProductsClear}
          </Link>
        )}
      </form>

      <p className="text-fg-muted mt-6 text-sm">
        {fillTemplate(m.adminProductsTotal, { count: String(listed.total) })}
      </p>

      {listed.items.length === 0 ? (
        <p className="border-line bg-bg-subtle text-fg-muted mt-4 rounded-xl border px-4 py-6 text-sm">
          {tab === "trash" ? m.adminProductsTrashEmpty : m.adminProductsEmpty}
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listed.items.map((item) => (
            <li key={item.id} className="border-line bg-surface flex flex-col rounded-2xl border p-3">
              <div className="border-line bg-bg-subtle flex h-32 items-center justify-center overflow-hidden rounded-xl border">
                {item.imagePath === null ? (
                  <span className="text-fg-muted text-xs">{m.adminProductsFieldNoImage}</span>
                ) : (
                  <Image
                    src={item.imagePath}
                    alt={item.nameTh}
                    width={item.imageWidth ?? 600}
                    height={item.imageHeight ?? 400}
                    className="h-full w-full object-contain"
                    unoptimized
                  />
                )}
              </div>
              <p className="text-fg-muted mt-2 text-xs">
                {categoryName(item.categoryId)}
                {item.trashed ? (
                  <span className="border-line bg-bg-subtle text-fg-muted ml-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold">
                    {m.adminProductsTrashed}
                  </span>
                ) : null}
              </p>
              <h2 className="text-fg mt-1 text-sm font-semibold">{item.nameTh}</h2>
              {item.nameEn === "" ? null : <p className="text-fg-muted text-xs">{item.nameEn}</p>}
              <p className="text-fg-muted mt-1 text-xs">
                {fillTemplate(m.adminProductsIngredientsCount, { count: String(item.ingredientCount) })}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/products/${item.id}`}
                  className="border-line text-fg hover:bg-surface-raised rounded-lg border px-2.5 py-1 text-xs font-semibold no-underline"
                >
                  {m.adminProductsEdit}
                </Link>
                {/* ปุ่ม "ดูบนเว็บ" ไม่มีความหมายกับของในถัง (หน้าเว็บไม่แสดง) ⇒ ซ่อน */}
                {item.trashed ? null : (
                  <Link
                    href={`/products/${item.categoryId}`}
                    className="border-line text-fg hover:bg-surface-raised rounded-lg border px-2.5 py-1 text-xs font-semibold no-underline"
                  >
                    {m.adminProductsView}
                  </Link>
                )}
              </div>

              {/* ย้ายเข้าถังขยะ / กู้คืน — ฟอร์มของตัวเอง (ไม่ซ้อนกับฟอร์มไหน) */}
              <form action={trashProductAction} className="mt-2">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="intent" value={item.trashed ? "restore" : "trash"} />
                <button
                  type="submit"
                  className="border-line text-fg-muted hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  {item.trashed ? m.adminProductsRestore : m.adminProductsTrash}
                </button>
              </form>

              {/* ลบถาวร — มีเฉพาะของที่อยู่ในถังแล้ว + เตือนให้ชัด (กู้คืนไม่ได้) */}
              {item.trashed ? (
                <form action={deleteProductForeverAction} className="mt-2 flex flex-col gap-1">
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="border-brand-red text-brand-red hover:bg-surface-raised focus-visible:ring-ring self-start rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {m.adminProductsDeleteForever}
                  </button>
                  <span className="text-fg-muted text-[11px]">{m.adminProductsDeleteForeverWarning}</span>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* ── ส่วน "คำอธิบาย/ภาพปก 6 หมวด" (รอบที่ 134) ────────────────────────────
          ฟอร์มย่อยของตัวเอง (client) — ไม่ได้ซ้อนอยู่ในฟอร์มค้นหา (บทเรียนรอบที่ 129) */}
      <details className="border-line bg-bg-subtle mt-10 rounded-2xl border p-4">
        <summary className="text-fg cursor-pointer text-base font-semibold">
          {m.adminProductsCategoriesHeading}
        </summary>
        <p className="text-fg-muted mt-2 text-sm">{m.adminProductsCategoriesHint}</p>

        <div className="mt-4 flex flex-col gap-4">
          {CATALOG_ITEMS.map((item) => {
            const row = categoryBySlug.get(item.slug);
            const copy = messages.productsPage.items[item.id];
            return (
              <ProductCategoryForm
                key={item.slug}
                strings={m}
                categoryId={item.slug}
                categoryName={categoryName(item.slug)}
                imageAlt={copy.imageAlt}
                productCount={row?.productCount ?? 0}
                library={library}
                fallbackLogo={{ src: item.image.src, width: item.image.width, height: item.image.height }}
                initial={{
                  sourceId: row?.sourceId ?? "",
                  nameTh: row?.nameTh ?? "",
                  nameEn: row?.nameEn ?? "",
                  descriptionTh: row?.descriptionTh ?? "",
                  descriptionEn: row?.descriptionEn ?? "",
                  imagePath: row?.imagePath ?? "",
                  logoPath: row?.logoPath ?? "",
                  logoWidth: row?.logoWidth ?? null,
                  logoHeight: row?.logoHeight ?? null,
                }}
              />
            );
          })}
        </div>
      </details>
    </main>
  );
}

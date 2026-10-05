import Image from "next/image";
import Link from "next/link";

import { requireAdminUser } from "@/lib/auth/dal";
import { CATALOG_ITEMS } from "@/features/products/catalog";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";
import { isCatalogCategoryId } from "@/lib/products/model";
import { listProductsForAdmin } from "@/lib/products/repository";

/**
 * หลังบ้าน — รายการ "สินค้า" (รอบที่ 133)
 *
 * เจ้าของเลือกจอแบบ **การ์ด** (เห็นรูปสินค้า) + ค้นหา + กรองตามหมวด
 * - ทุกอย่างตรวจสิทธิ์ด้วย `requireAdminUser("content")` ก่อนอ่านข้อมูล
 * - ลิงก์ไปหน้าจอแก้ `/admin/products/<id>` (และ `/admin/products/new` สำหรับเพิ่ม)
 * - การ์ดใช้ `<img>` (ไม่ใช้ next/image) เพราะเป็นภาพหลังบ้าน ไม่ต้องปรับขนาด/แคชของหน้าเว็บ
 * ⚠️ ส่วน "คำอธิบาย/ภาพปกหมวด" ยังไม่ได้ทำในรอบนี้ (รอบถัดไป) — บันทึกไว้ใน roadmap
 */

export default async function AdminProductsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly category?: string; readonly q?: string }>;
}) {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.admin;

  const query = await searchParams;
  const search = (query.q ?? "").trim();
  const rawCategory = (query.category ?? "").trim();
  const categoryId = isCatalogCategoryId(rawCategory) ? rawCategory : "";

  const listed = await listProductsForAdmin({ categoryId, search });

  const categoryName = (slug: string): string => {
    const item = CATALOG_ITEMS.find((entry) => entry.slug === slug);
    return item === undefined ? slug : messages.productsPage.items[item.id].name;
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

      {/* กรองหมวด + ค้นหา (ฟอร์ม GET ธรรมดา ไม่ต้องมี JS) */}
      <form method="get" action="/admin/products" className="mt-6 flex flex-wrap items-end gap-2">
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
          <Link href="/admin/products" className="text-fg-muted px-2 py-2 text-sm underline underline-offset-4">
            {m.adminProductsClear}
          </Link>
        )}
      </form>

      <p className="text-fg-muted mt-6 text-sm">
        {fillTemplate(m.adminProductsTotal, { count: String(listed.total) })}
      </p>

      {listed.items.length === 0 ? (
        <p className="border-line bg-bg-subtle text-fg-muted mt-4 rounded-xl border px-4 py-6 text-sm">
          {m.adminProductsEmpty}
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
              <p className="text-fg-muted mt-2 text-xs">{categoryName(item.categoryId)}</p>
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
                <Link
                  href={`/products/${item.categoryId}`}
                  className="border-line text-fg hover:bg-surface-raised rounded-lg border px-2.5 py-1 text-xs font-semibold no-underline"
                >
                  {m.adminProductsView}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

"use client";

import { useState } from "react";

import {
  type ProductShowcaseCategoryChoice,
  type ProductShowcaseProductChoice,
} from "@/lib/blocks/product-showcase";
import type { Messages } from "@/lib/i18n/messages/th";
import { fillTemplate } from "@/lib/i18n/template";

/**
 * ตัวเลือก "สินค้าแนะนำ" ของบล็อก `productShowcase` (2026-11-12)
 *
 * ทำไมต้องมี: เจ้าของต้องการเลือกเองว่าสินค้าใดขึ้นหน้าแรก (ลิส + รูปจริง) และเห็นผลในพรีวิวก่อนบันทึก
 * - ข้อมูลทั้งหมดมาจากฐานข้อมูล (ส่งมาจาก Server Component) — ตัวนี้เป็น client จึงห้ามยิง DB เอง
 * - ค่าที่เลือกถูกเก็บเป็น **id สินค้า** ในเอกสารบล็อก ⇒ ตัวเรนเดอร์เว็บจริงใช้ข้อมูลสดจาก DB เหมือนเดิม
 * - ไม่เลือกเลย = ตัวเรนเดอร์ใช้ N ตัวแรกของแต่ละหมวด (พฤติกรรมเดิม) ⇒ เอกสารเก่าไม่พัง
 * - เลือกได้ไม่เกิน `maxPerCategory` ต่อหมวด (ค่ามาจากเพดานกลางของโมเดล)
 *
 * ⚠️ ข้อความทุกคำมาจากพจนานุกรม (ห้ามพิมพ์ไทยใน .tsx) และสีใช้ token เท่านั้น
 */
export function FeaturedProductPicker({
  categories,
  products,
  categoryIds,
  selectedIds,
  perCategory,
  maxPerCategory,
  strings,
  onChange,
}: {
  readonly categories: readonly ProductShowcaseCategoryChoice[];
  readonly products: readonly ProductShowcaseProductChoice[];
  readonly categoryIds: readonly string[];
  readonly selectedIds: readonly string[];
  readonly perCategory: number;
  /** เพดานจำนวนสินค้าที่เลือกได้ต่อหมวด (ส่งมาจาก Server Component — ที่เดียวที่รู้ค่ากลาง) */
  readonly maxPerCategory: number;
  readonly strings: Messages["admin"];
  readonly onChange: (next: readonly string[]) => void;
}) {
  /** ตัวกรองหมวดของรายการสินค้า — ค่าเริ่มต้น "all" = ทุกหมวดที่แสดง */
  const [filter, setFilter] = useState("all");

  const shownCategories = categoryIds.length === 0 ? categories : categories.filter((row) => categoryIds.includes(row.id));
  const activeFilter = filter !== "all" && shownCategories.some((row) => row.id === filter) ? filter : "all";
  const scopedProducts =
    categoryIds.length === 0 ? products : products.filter((row) => categoryIds.includes(row.categoryId));
  const visibleProducts =
    activeFilter === "all" ? scopedProducts : scopedProducts.filter((row) => row.categoryId === activeFilter);

  const categoryNameById = new Map(categories.map((row) => [row.id, row.name]));
  const selected = new Set(selectedIds);

  /* นับที่เลือกต่อหมวด — ใช้ทั้งการปิดตัวเลือกที่เกินเพดานและคำเตือน "เลือกเกินจำนวนที่แสดง" */
  const selectedByCategory = new Map<string, number>();
  for (const product of products) {
    if (!selected.has(product.id)) continue;
    selectedByCategory.set(product.categoryId, (selectedByCategory.get(product.categoryId) ?? 0) + 1);
  }
  const overflow = shownCategories.reduce(
    (total, category) => total + Math.max(0, (selectedByCategory.get(category.id) ?? 0) - perCategory),
    0,
  );

  const selectedProducts = selectedIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is ProductShowcaseProductChoice => product !== undefined);

  function toggle(product: ProductShowcaseProductChoice, checked: boolean): void {
    if (!checked) {
      onChange(selectedIds.filter((id) => id !== product.id));
      return;
    }
    if (selected.has(product.id)) return;
    if ((selectedByCategory.get(product.categoryId) ?? 0) >= maxPerCategory) return;
    onChange([...selectedIds, product.id]);
  }

  return (
    <section className="border-line bg-surface-raised flex flex-col gap-3 rounded-xl border p-3" data-featured-picker="">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-fg text-sm font-semibold">{strings.blockShowcaseProductsTitle}</p>
          <p className="text-fg-muted mt-1 text-xs">
            {fillTemplate(strings.blockShowcaseProductsHint, { n: String(maxPerCategory) })}
          </p>
        </div>
        <span className="border-line text-fg-muted rounded-full border px-2 py-1 text-xs font-semibold">
          {fillTemplate(strings.blockShowcaseProductsSelected, { n: String(selectedProducts.length) })}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-fg-muted flex flex-col gap-1 text-xs">
          {strings.blockShowcaseFilter}
          <select
            value={activeFilter}
            onChange={(event) => setFilter(event.target.value)}
            className="border-line bg-surface text-fg focus-visible:ring-ring rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="all">{strings.blockShowcaseCategoryAll}</option>
            {shownCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        {selectedProducts.length === 0 ? null : (
          <button
            type="button"
            onClick={() => onChange([])}
            className="border-line text-fg hover:bg-bg-subtle focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.blockShowcaseClearProducts}
          </button>
        )}
      </div>

      {selectedProducts.length === 0 ? null : (
        <ul className="flex flex-wrap gap-2" aria-label={strings.blockShowcaseProductsTitle}>
          {selectedProducts.map((product) => (
            <li key={product.id} className="border-line bg-surface flex max-w-full items-center gap-2 rounded-lg border p-1.5">
              {product.image === null ? (
                <span className="bg-bg-subtle text-fg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded text-[9px]">
                  {strings.blockShowcaseNoImage}
                </span>
              ) : (
                /* ภาพตัวอย่างในหลังบ้าน — ใช้ <img> ตามจอหลังบ้านอื่น (ไม่ต้องผ่าน optimizer ของหน้าเว็บ) */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={product.image} alt={product.title} className="bg-bg-subtle h-9 w-9 shrink-0 rounded object-contain" />
              )}
              <span className="text-fg min-w-0 flex-1 truncate text-xs font-semibold">{product.title}</span>
              <button
                type="button"
                aria-label={`${strings.blockShowcaseRemoveProduct} · ${product.title}`}
                onClick={() => toggle(product, false)}
                className="text-fg-muted hover:bg-bg-subtle hover:text-fg focus-visible:ring-ring rounded px-1.5 py-0.5 text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {overflow === 0 ? null : (
        <p className="text-brand-red text-xs font-semibold" data-featured-overflow="">
          {fillTemplate(strings.blockShowcaseOverflow, { n: String(perCategory) })}
        </p>
      )}

      {visibleProducts.length === 0 ? (
        <p className="text-fg-muted text-xs">{strings.blockShowcaseProductsEmpty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {shownCategories.map((category) => {
            const rows = visibleProducts.filter((row) => row.categoryId === category.id);
            if (rows.length === 0) return null;
            const chosen = selectedByCategory.get(category.id) ?? 0;
            return (
              <div key={category.id} className="flex flex-col gap-1.5">
                <p className="text-fg-muted text-[11px] font-semibold tracking-wide uppercase">
                  {category.name} · {fillTemplate(strings.blockShowcaseProductsLimit, { n: String(maxPerCategory) })} ·{" "}
                  {chosen}/{maxPerCategory}
                </p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {rows.map((product) => {
                    const checked = selected.has(product.id);
                    const disabled = !checked && chosen >= maxPerCategory;
                    return (
                      <li key={product.id}>
                        <label
                          className={`flex items-center gap-2 rounded-lg border p-1.5 ${
                            checked
                              ? "border-brand-red bg-bg-subtle"
                              : disabled
                                ? "border-line bg-surface opacity-50"
                                : "border-line bg-surface hover:bg-bg-subtle"
                          } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(event) => toggle(product, event.target.checked)}
                            className="border-line accent-brand-red size-4 shrink-0 rounded border"
                          />
                          {product.image === null ? (
                            <span className="bg-bg-subtle text-fg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded text-[9px]">
                              {strings.blockShowcaseNoImage}
                            </span>
                          ) : (
                            /* ภาพตัวอย่างในหลังบ้าน — ใช้ <img> ตามจอหลังบ้านอื่น */
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={product.image}
                              alt={product.title}
                              className="bg-bg-subtle h-11 w-11 shrink-0 rounded object-contain"
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="text-fg block truncate text-xs font-semibold">{product.title}</span>
                            <span className="text-fg-muted block truncate text-[11px]">
                              {categoryNameById.get(product.categoryId) ?? product.categoryId}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

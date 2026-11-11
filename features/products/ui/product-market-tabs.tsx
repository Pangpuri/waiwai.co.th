"use client";

import { useState } from "react";

import { ProductListSection, type ProductListStrings } from "@/features/products/ui/product-list";
import type { Locale } from "@/lib/i18n/config";
import type { ProductMarket } from "@/lib/products/model";
import type { ProductRecord } from "@/lib/products/repository";

/**
 * สินค้าในหมวด แยกเป็น **ในประเทศ / ส่งออก** (รอบ 342 · คำสั่งเจ้าของ 2026-11-11)
 *
 * - ภาษาไทยเริ่มที่แท็บ "สินค้าในประเทศ" · ภาษาอังกฤษเริ่มที่แท็บ "สินค้าส่งออก"
 * - สลับดูได้ทั้งสองแท็บตลอด (ไม่ปิดกั้น)
 * - ถ้าประเภทใดไม่มีสินค้าเลย = ไม่แสดงแท็บนั้น (และถ้าเริ่มที่แท็บว่างจะถอยไปอีกแท็บ)
 * ⚠️ เป็น client component เพื่อให้หน้าเว็บยังเป็น static/ISR และไม่ใช้ searchParams
 */
export type ProductMarketTabsStrings = {
  readonly group: string;
  readonly domestic: string;
  readonly export: string;
};

function defaultMarketOf(language: Locale, domestic: readonly ProductRecord[], exported: readonly ProductRecord[]): ProductMarket {
  if (language === "en" && exported.length > 0) return "export";
  return domestic.length > 0 ? "domestic" : "export";
}

export function ProductMarketSection({
  domestic,
  exported,
  language,
  strings,
  listStrings,
}: {
  readonly domestic: readonly ProductRecord[];
  readonly exported: readonly ProductRecord[];
  readonly language: Locale;
  readonly strings: ProductMarketTabsStrings;
  readonly listStrings: ProductListStrings;
}) {
  const [active, setActive] = useState<ProductMarket>(defaultMarketOf(language, domestic, exported));

  if (domestic.length === 0 && exported.length === 0) return null;

  /* มีประเภทเดียว = ไม่ต้องมีแท็บ (เช่นหมวดที่ยังไม่มีสินค้าส่งออก) */
  if (domestic.length === 0 || exported.length === 0) {
    return (
      <ProductListSection
        products={domestic.length > 0 ? domestic : exported}
        language={language}
        strings={listStrings}
      />
    );
  }

  const activeProducts = active === "export" ? exported : domestic;

  return (
    <section className="border-line bg-bg-subtle border-t" aria-label={strings.group}>
      <div className="container-site pt-10 lg:pt-12">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={strings.group}>
          {(["domestic", "export"] as const).map((market) => {
            const isActive = market === active;
            const label = market === "domestic" ? strings.domestic : strings.export;
            const count = market === "domestic" ? domestic.length : exported.length;
            return (
              <button
                key={market}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActive(market)}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "border-transparent bg-brand-red text-on-brand"
                    : "border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg",
                ].join(" ")}
              >
                {label}
                <span className="text-xs opacity-80">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ProductListSection
        products={activeProducts}
        language={language}
        strings={listStrings}
        showHeader={false}
      />
    </section>
  );
}

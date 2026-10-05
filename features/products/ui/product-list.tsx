import Image from "next/image";

import { fillTemplate } from "@/lib/i18n/template";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";
import type { ProductRecord } from "@/lib/products/repository";

/**
 * รายการสินค้าในหมวด — ส่วนที่แสดง **ข้อมูลที่นำเข้าจากเว็บเดิม** (S3 ส่วนที่ 3 · รอบที่ 103)
 *
 * ทำไมเป็น Server Component + `<details>`
 * - ไม่เพิ่ม JS ให้หน้าเว็บ (โปรเจกต์นี้เลี่ยง client component เมื่อทำได้ — เทียบกับบล็อก `recipeCards` รอบที่ 101)
 * - เปิด/ปิดรายละเอียดสินค้าได้ด้วย HTML ล้วน ทำงานแม้ปิด JS
 *
 * ⚠️ ข้อมูลทั้งหมดมาจากฐานข้อมูล (นำเข้าจากเว็บเดิม) — **ห้ามแต่งเพิ่มในหน้าจอ**
 * ⚠️ ชื่ออังกฤษว่างได้ (เว็บเดิมไม่มี) ⇒ ถอยไปใช้ชื่อไทยเสมอ
 */

export type ProductListStrings = {
  readonly title: string;
  readonly count: string;
  readonly details: string;
  readonly ingredients: string;
  readonly ingredientName: string;
  readonly ingredientNameEn: string;
  readonly ingredientPercent: string;
  readonly allergens: string;
  readonly netWeight: string;
  readonly fda: string;
  readonly packaging: string;
  readonly noImage: string;
};

export function productListStringsOf(page: Messages["productsPage"]): ProductListStrings {
  return {
    title: page.dbListTitle,
    count: page.dbListCount,
    details: page.dbDetails,
    ingredients: page.dbIngredients,
    ingredientName: page.dbIngredientName,
    ingredientNameEn: page.dbIngredientNameEn,
    ingredientPercent: page.dbIngredientPercent,
    allergens: page.dbAllergens,
    netWeight: page.dbNetWeight,
    fda: page.dbFda,
    packaging: page.dbPackaging,
    noImage: page.dbNoImage,
  };
}

function nameOf(product: ProductRecord, language: Locale): string {
  const english = product.nameEn.trim();
  return language === "en" && english !== "" ? english : product.nameTh;
}

function groupOf(product: ProductRecord, language: Locale): string {
  const english = product.groupEn.trim();
  const thai = product.groupTh.trim();
  if (language === "en" && english !== "") return english;
  return thai !== "" ? thai : english;
}

function SpecRow({ label, value }: { readonly label: string; readonly value: string }) {
  if (value === "") return null;
  return (
    <div className="flex gap-2">
      <dt className="text-fg-muted w-28 shrink-0 text-xs font-semibold">{label}</dt>
      <dd className="text-fg text-sm">{value}</dd>
    </div>
  );
}

export function ProductListSection({
  products,
  language,
  strings,
}: {
  readonly products: readonly ProductRecord[];
  readonly language: Locale;
  readonly strings: ProductListStrings;
}) {
  if (products.length === 0) return null;

  return (
    <section className="border-line bg-bg-subtle border-t" aria-labelledby="product-list-title">
      <div className="container-site py-12 lg:py-16">
        <h2 id="product-list-title" className="text-fg text-2xl font-bold lg:text-3xl">
          {strings.title}
        </h2>
        <p className="text-fg-muted mt-1 text-sm">{fillTemplate(strings.count, { count: products.length })}</p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const label = nameOf(product, language);
            const group = groupOf(product, language);

            return (
              <li key={product.id} className="border-line bg-bg flex flex-col rounded-2xl border p-4">
                {product.imagePath === null ? (
                  <p className="text-fg-muted flex h-40 items-center justify-center text-xs">{strings.noImage}</p>
                ) : (
                  <Image
                    src={product.imagePath}
                    alt={label}
                    width={product.imageWidth ?? 480}
                    height={product.imageHeight ?? 480}
                    sizes="(max-width: 640px) 80vw, 300px"
                    className="mx-auto h-40 w-auto object-contain"
                  />
                )}

                <h3 className="text-fg mt-3 text-base leading-snug font-semibold">{label}</h3>
                {group === "" ? null : <p className="text-fg-muted mt-0.5 text-xs">{group}</p>}

                <details className="border-line mt-3 rounded-xl border px-3 py-2">
                  <summary className="text-fg focus-visible:ring-ring cursor-pointer text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none">
                    {strings.details}
                  </summary>

                  <div className="mt-3 flex flex-col gap-4">
                    {product.taglineTh === "" ? null : <p className="text-fg text-sm">{product.taglineTh}</p>}

                    {product.ingredients.length === 0 ? null : (
                      <div>
                        <p className="text-fg-muted text-xs font-semibold">{strings.ingredients}</p>
                        <div className="mt-1 overflow-x-auto">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead>
                              <tr className="text-fg-muted">
                                <th scope="col" className="border-line border-b py-1 pr-2 font-semibold">
                                  {strings.ingredientName}
                                </th>
                                <th scope="col" className="border-line border-b py-1 pr-2 font-semibold">
                                  {strings.ingredientNameEn}
                                </th>
                                <th scope="col" className="border-line border-b py-1 font-semibold">
                                  {strings.ingredientPercent}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {product.ingredients.map((ingredient, index) => (
                                <tr key={`${product.id}-${index}`}>
                                  <td className="border-line text-fg border-b py-1 pr-2">{ingredient.nameTh}</td>
                                  <td className="border-line text-fg-muted border-b py-1 pr-2">{ingredient.nameEn}</td>
                                  <td className="border-line text-fg border-b py-1">{ingredient.percentText}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <dl className="flex flex-col gap-1">
                      <SpecRow label={strings.netWeight} value={product.netWeightTh} />
                      <SpecRow label={strings.fda} value={product.fdaNumber} />
                      <SpecRow label={strings.packaging} value={product.packagingTh} />
                      <SpecRow label={strings.allergens} value={product.allergensTh} />
                    </dl>

                    {product.detailsTh === "" ? null : (
                      <p className="text-fg-muted text-xs leading-relaxed">{product.detailsTh}</p>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductEditorForm, type ProductLibraryItem } from "@/features/admin/ui/product-editor-form";
import { requireAdminUser } from "@/lib/auth/dal";
import { CATALOG_ITEMS } from "@/features/products/catalog";
import { productListStringsOf } from "@/features/products/ui/product-list";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { listMedia } from "@/lib/media/repository";
import { loadProductForAdmin } from "@/lib/products/repository";

/**
 * หลังบ้าน — หน้าจอแก้ "สินค้า" (รอบที่ 133)
 *
 * - `/admin/products/new` = เพิ่มสินค้า · `/admin/products/<id>` = แก้ของเดิม
 * - พรีวิวใช้ตัวเรนเดอร์ตัวเดียวกับหน้าเว็บ (`ProductListSection`) — ส่งพจนานุกรมของหน้าเว็บเข้าไปตรง ๆ
 * - ⚠️ รหัสสินค้า/slug แก้ไม่ได้ (URL `/products/<slug>` ต้องคงที่)
 */

export default async function AdminProductEditorPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.admin;

  const { id } = await params;
  const isNew = id === "new";

  const [existing, media] = await Promise.all([
    isNew ? Promise.resolve(null) : loadProductForAdmin(id),
    listMedia(60),
  ]);
  if (!isNew && existing === null) notFound();

  const library: readonly ProductLibraryItem[] = media.map((item) => ({
    id: item.id,
    filename: item.filename,
    path: `/media/${item.id}`,
  }));
  const categories = CATALOG_ITEMS.map((item) => ({
    slug: item.slug,
    name: messages.productsPage.items[item.id].name,
  }));

  return (
    <main className="container-site py-10">
      <p className="text-sm">
        <Link href="/admin/products" className="text-link underline underline-offset-4">
          ← {m.adminProductsBack}
        </Link>
      </p>

      <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight">
        {isNew ? m.adminProductsHeadingNew : m.adminProductsHeadingEdit}
      </h1>

      <div className="mt-8">
        <ProductEditorForm
          strings={m}
          publicStrings={productListStringsOf(messages.productsPage)}
          language="th"
          categories={categories}
          library={library}
          initial={{
            id: existing?.id ?? "",
            sourceId: existing?.sourceId ?? "",
            categoryId: existing?.categoryId ?? categories[0]?.slug ?? "",
            nameTh: existing?.nameTh ?? "",
            nameEn: existing?.nameEn ?? "",
            groupTh: existing?.groupTh ?? "",
            groupEn: existing?.groupEn ?? "",
            taglineTh: existing?.taglineTh ?? "",
            taglineEn: existing?.taglineEn ?? "",
            detailsTh: existing?.detailsTh ?? "",
            allergensTh: existing?.allergensTh ?? "",
            netWeightTh: existing?.netWeightTh ?? "",
            fdaNumber: existing?.fdaNumber ?? "",
            packagingTh: existing?.packagingTh ?? "",
            sortOrder: 0,
            imagePath: existing?.imagePath ?? "",
            ingredients:
              existing?.ingredients.map((item) => ({
                nameTh: item.nameTh,
                nameEn: item.nameEn,
                percentText: item.percentText,
              })) ?? [],
          }}
        />
      </div>
    </main>
  );
}

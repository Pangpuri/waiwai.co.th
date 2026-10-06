import Link from "next/link";

import { reorderAction } from "@/app/admin/sort/actions";
import { SortableList } from "@/features/admin/ui/sortable-list";
import { isReorderKind, listReorderCategoryIds, listReorderItems, type ReorderKind } from "@/lib/admin/reorder";
import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * หน้าจอ "จัดลำดับการแสดง" (รอบที่ 153)
 *
 * ลาก/เลื่อน แล้วกดบันทึกทีเดียว · ใช้ได้กับ สินค้า · เมนูอาหาร · ข่าว (แท็บด้านบน)
 * ⚠️ บันทึกแล้วสั่งสร้างหน้าเว็บใหม่ (`refreshPublicSite`) ⇒ ลำดับบนเว็บเปลี่ยนทันที
 */
export default async function AdminSortPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly kind?: string; readonly category?: string }>;
}) {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.admin;

  const query = await searchParams;
  const requested = query.kind ?? "product";
  const kind: ReorderKind = isReorderKind(requested) ? requested : "product";

  /* สินค้า: เว็บแสดงเป็นรายหมวด ⇒ ลำดับต้องจัด "ภายในหมวด" (ฟีดแบ็กเจ้าของ รอบที่ 154) */
  const categoryIds = kind === "product" ? await listReorderCategoryIds() : [];
  const category = kind === "product" ? (query.category ?? categoryIds[0] ?? "") : "";
  const items = kind === "product" ? await listReorderItems(kind, { categoryId: category }) : await listReorderItems(kind);

  /* ลายนิ้วมือของลำดับที่บันทึก — ใช้เป็น key ให้จอ remount เมื่อเซิร์ฟเวอร์คืนข้อมูลใหม่
     (แก้บั๊ก "สลับไปมาแล้วไม่เรนเดอร์ ต้องรีเฟรช") */
  const orderSignature = items.map((item) => item.id).join(",");

  const tabs: readonly { readonly kind: ReorderKind; readonly label: string }[] = [
    { kind: "product", label: m.sortTabProduct },
    { kind: "recipe", label: m.sortTabRecipe },
    { kind: "news", label: m.sortTabNews },
  ];

  return (
    <main className="container-site flex flex-col gap-4 py-8">
      <h1 className="text-fg text-xl font-semibold">{m.sortTitle}</h1>
      <p className="text-fg-muted text-sm">{m.sortHint}</p>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.kind}
            href={`/admin/sort?kind=${tab.kind}`}
            aria-current={tab.kind === kind ? "page" : undefined}
            className={
              tab.kind === kind
                ? "bg-brand-red text-on-brand rounded-full px-3 py-1 text-xs font-semibold"
                : "border-line text-fg-muted rounded-full border px-3 py-1 text-xs font-semibold"
            }
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {kind !== "product" || categoryIds.length === 0 ? null : (
        <nav aria-label={m.sortCategoryLabel} className="flex flex-wrap gap-2">
          {categoryIds.map((id) => (
            <Link
              key={id}
              href={`/admin/sort?kind=product&category=${encodeURIComponent(id)}`}
              aria-current={id === category ? "true" : undefined}
              className={
                id === category
                  ? "bg-brand-red text-on-brand rounded-full px-3 py-1 text-xs font-semibold"
                  : "border-line text-fg-muted rounded-full border px-3 py-1 text-xs font-semibold"
              }
            >
              {id}
            </Link>
          ))}
        </nav>
      )}

      {kind === "product" ? <p className="text-fg-muted text-xs">{m.sortCategoryHint}</p> : null}

      {items.length === 0 ? (
        <p className="text-fg-muted text-sm">{m.sortEmpty}</p>
      ) : (
        <SortableList
          key={`${kind}:${category}:${orderSignature}`}
          kind={kind}
          items={items}
          action={reorderAction}
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
      )}
    </main>
  );
}

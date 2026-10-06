import Link from "next/link";

import { reorderAction } from "@/app/admin/sort/actions";
import { SortableList } from "@/features/admin/ui/sortable-list";
import { isReorderKind, listReorderItems, type ReorderKind } from "@/lib/admin/reorder";
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
  readonly searchParams: Promise<{ readonly kind?: string }>;
}) {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.admin;

  const requested = (await searchParams).kind ?? "product";
  const kind: ReorderKind = isReorderKind(requested) ? requested : "product";
  const items = await listReorderItems(kind);

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

      {items.length === 0 ? (
        <p className="text-fg-muted text-sm">{m.sortEmpty}</p>
      ) : (
        <SortableList
          kind={kind}
          items={items}
          action={reorderAction}
          strings={{
            up: m.sortUp,
            down: m.sortDown,
            save: m.sortSave,
            saveHint: m.sortSaveHint,
            handle: m.sortHandle,
          }}
        />
      )}
    </main>
  );
}

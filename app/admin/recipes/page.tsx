import Link from "next/link";

import { deleteRecipeForeverAction, reorderRecipesAction, trashRecipeAction } from "@/app/admin/recipes/actions";
import { SortableList } from "@/features/admin/ui/sortable-list";
import { listReorderItems, type ReorderItem } from "@/lib/admin/reorder";
import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { listMedia } from "@/lib/media/repository";
import { formatRecipeDate } from "@/lib/recipes/model";
import { adminRecipeCounts, listRecipesForAdmin, type AdminRecipeTab } from "@/lib/recipes/repository";
import { searchParamText } from "@/lib/search/params";

/**
 * หลังบ้าน — รายการเมนูอาหาร (รอบที่ 135 · แบบ WordPress "Posts")
 *
 * รูปแบบตาม WP: แท็บ (ทั้งหมด/ฉบับร่าง/เผยแพร่/ถังขยะ/จัดลำดับ) → ค้นหา → ตาราง
 * - ฟอร์ม "ย้ายเข้าถังขยะ/กู้คืน" เป็น **ฟอร์มธรรมดา** (ไม่ต้องมี JS) — ใช้ Server Action ตรง ๆ
 * - ทุกอย่างตรวจสิทธิ์ด้วย `requireAdminUser("content")` ก่อนอ่านข้อมูล
 * - **ไม่มีแบ่งหน้าโดยเจตนา** — เมนูมีหลักสิบรายการ (ต่างจากข่าว 151 ชิ้น)
 * - **แท็บ "จัดลำดับ" (รอบที่ 300)** — ย้ายมาจากจอ `/admin/sort` ที่ถูกถอดออก
 */

const TAB_IDS = ["all", "draft", "published", "trash"] as const;
/** แท็บทั้งหมดของจอ (รวม `sort` ที่ไม่ใช่แท็บของ repository) */
const VIEW_IDS = [...TAB_IDS, "sort"] as const;
type AdminRecipeView = (typeof VIEW_IDS)[number];

function viewOf(value: string | undefined): AdminRecipeView {
  return VIEW_IDS.find((tab) => tab === value) ?? "all";
}

export default async function AdminRecipesPage({
  searchParams,
}: {
  readonly searchParams: Promise<Readonly<Record<string, string | readonly string[] | undefined>>>;
}) {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.admin;

  const query = await searchParams;
  /* ⚠️ ผ่าน `searchParamText` เท่านั้น (ค่าซ้ำ = array · อักขระควบคุม/NUL ต้องถูกตัด) — รอบที่ 291 */
  const tab = viewOf(searchParamText(query.tab));
  const search = searchParamText(query.q, 80);
  /* แท็บ `sort` ไม่ใช่แท็บของ repository ⇒ คิวรีรายการใช้ `all` แทน (แท็บ sort ไม่แสดงตาราง) */
  const listTab: AdminRecipeTab = tab === "sort" ? "all" : tab;

  const [counts, listed, library, reorderItems] = await Promise.all([
    adminRecipeCounts(),
    listRecipesForAdmin({ tab: listTab, search }),
    listMedia(1),
    tab === "sort" ? listReorderItems("recipe") : Promise.resolve<readonly ReorderItem[]>([]),
  ]);

  const tabLabel: Record<AdminRecipeView, string> = {
    all: m.recipesAdminTabAll,
    draft: m.recipesAdminTabDraft,
    published: m.recipesAdminTabPublished,
    trash: m.recipesAdminTabTrash,
    /* แท็บที่ย้ายมาจากจอ /admin/sort (รอบที่ 300) */
    sort: m.sortNavLabel,
  };
  const tabCount: Record<AdminRecipeView, number | null> = {
    all: counts.all,
    draft: counts.draft,
    published: counts.published,
    trash: counts.trashed,
    sort: null,
  };

  function tabHref(target: AdminRecipeView): string {
    const params = new URLSearchParams();
    if (target !== "all") params.set("tab", target);
    if (search !== "" && target !== "sort") params.set("q", search);
    const qs = params.toString();
    return qs === "" ? "/admin/recipes" : `/admin/recipes?${qs}`;
  }

  return (
    <main className="container-site py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{m.recipesAdminTitle}</h1>
          <p className="text-fg-muted mt-1 text-sm">{m.recipesAdminSubtitle}</p>
        </div>
        <Link
          href="/admin/recipes/new"
          className="bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {m.recipesAdminNew}
        </Link>
      </div>

      <nav aria-label={m.recipesAdminTitle} className="mt-6 flex flex-wrap items-center gap-2">
        {VIEW_IDS.map((item) => (
          <Link
            key={item}
            href={tabHref(item)}
            aria-current={item === tab ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              item === tab ? "border-line bg-bg-subtle text-fg" : "border-line text-fg-muted hover:bg-bg-subtle"
            }`}
          >
            {tabCount[item] === null ? tabLabel[item] : `${tabLabel[item]} (${String(tabCount[item])})`}
          </Link>
        ))}
      </nav>

      {tab === "sort" ? (
        <section className="border-line bg-bg-subtle mt-6 rounded-2xl border p-4">
          <h2 className="text-fg text-base font-semibold">{m.sortTitle}</h2>
          <p className="text-fg-muted mt-1 text-sm">{m.sortHint}</p>
          {reorderItems.length === 0 ? (
            <p className="text-fg-muted mt-3 text-sm">{m.sortEmpty}</p>
          ) : (
            <div className="mt-3">
              <SortableList
                kind="recipe"
                key={reorderItems.map((item) => item.id).join(",")}
                items={reorderItems}
                action={reorderRecipesAction}
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
      ) : (
        <>
      <form method="get" action="/admin/recipes" className="mt-4 flex flex-wrap items-end gap-2">
        {tab === "all" ? null : <input type="hidden" name="tab" value={tab} />}
        <label className="block min-w-64 flex-1">
          <span className="text-fg-muted mb-1 block text-xs font-semibold">{m.recipesAdminSearch}</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={m.recipesAdminSearchPlaceholder}
            className="border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>
        <button
          type="submit"
          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {m.recipesAdminSearch}
        </button>
        {search === "" ? null : (
          <Link href={tabHref(tab)} className="text-fg-muted px-2 py-2 text-sm underline underline-offset-4">
            {m.recipesAdminClearSearch}
          </Link>
        )}
      </form>

      {listed.items.length === 0 ? (
        <p className="border-line bg-bg-subtle text-fg-muted mt-8 rounded-xl border px-4 py-6 text-sm">
          {tab === "trash" ? m.recipesAdminEmptyTrash : m.recipesAdminEmpty}
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-line text-fg-muted border-b text-left text-xs uppercase">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {m.recipesAdminColTitle}
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {m.recipesAdminColStatus}
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {m.recipesAdminColPublished}
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {m.recipesAdminColUpdated}
                </th>
                <th scope="col" className="py-2 font-semibold">
                  {m.recipesAdminColActions}
                </th>
              </tr>
            </thead>
            <tbody>
              {listed.items.map((item) => (
                <tr key={item.id} className="border-line border-b align-top">
                  <td className="py-3 pr-3">
                    <Link href={`/admin/recipes/${item.id}`} className="text-link font-semibold underline underline-offset-4">
                      {item.titleTh}
                    </Link>
                    {item.titleEn === "" ? null : <span className="text-fg-muted mt-1 block text-xs">{item.titleEn}</span>}
                  </td>
                  <td className="py-3 pr-3">
                    <span className="border-line rounded-full border px-2 py-0.5 text-xs">
                      {item.status === "draft" ? m.recipesAdminStatusDraft : m.recipesAdminStatusPublished}
                    </span>
                    {item.trashed ? (
                      <span className="text-danger mt-1 block text-xs">{m.recipesAdminTabTrash}</span>
                    ) : null}
                  </td>
                  <td className="text-fg-muted py-3 pr-3 text-xs">
                    {item.publishedOn === null ? m.recipesAdminNoDate : formatRecipeDate(item.publishedOn, "th")}
                  </td>
                  <td className="text-fg-muted py-3 pr-3 text-xs">{item.updatedLocal ?? m.recipesAdminNoDate}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/recipes/${item.id}`}
                        className="border-line text-fg hover:bg-surface-raised rounded-lg border px-2.5 py-1 text-xs font-semibold no-underline"
                      >
                        {m.recipesAdminEdit}
                      </Link>
                      {item.trashed ? null : (
                        <Link
                          href="/recipes"
                          className="border-line text-fg hover:bg-surface-raised rounded-lg border px-2.5 py-1 text-xs font-semibold no-underline"
                        >
                          {m.recipesAdminView}
                        </Link>
                      )}
                      <form action={trashRecipeAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="trashed" value={item.trashed ? "0" : "1"} />
                        <button
                          type="submit"
                          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {item.trashed ? m.recipesAdminRestore : m.recipesAdminMoveToTrash}
                        </button>
                      </form>
                      {/* ลบถาวร — มีเฉพาะของที่อยู่ในถังแล้ว (รอบที่ 139) · ประตูจริงอยู่ที่ SQL */}
                      {item.trashed ? (
                        <form action={deleteRecipeForeverAction} className="flex flex-col gap-0.5">
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            type="submit"
                            className="border-brand-red text-brand-red hover:bg-surface-raised focus-visible:ring-ring self-start rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                          >
                            {m.recipesAdminDeleteForever}
                          </button>
                          <span className="text-fg-muted text-[11px]">{m.recipesAdminDeleteForeverWarning}</span>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}

      <p className="text-fg-muted mt-8 text-xs">{m.recipesAdminTrashHint}</p>
      <p className="text-fg-muted mt-1 text-xs">{library.length === 0 ? m.recipesAdminNoImages : ""}</p>
    </main>
  );
}

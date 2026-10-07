import Link from "next/link";

import { deleteNewsForeverAction, trashNewsAction } from "@/app/admin/news/actions";
import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";
import { listMedia } from "@/lib/media/repository";
import {
  ADMIN_NEWS_PER_PAGE,
  adminNewsCounts,
  listNewsForAdmin,
  type AdminNewsTab,
} from "@/lib/news/repository";

/**
 * หลังบ้าน — รายการข่าว/กิจกรรม (รอบที่ 123 · แบบ WordPress "Posts")
 *
 * รูปแบบตาม WP: แท็บ (ทั้งหมด/ฉบับร่าง/เผยแพร่/ถังขยะ) → ค้นหา → ตาราง → แบ่งหน้า
 * - ฟอร์ม "ย้ายเข้าถังขยะ/กู้คืน" เป็น **ฟอร์มธรรมดา** (ไม่ต้องมี JS) — ใช้ Server Action ตรง ๆ
 * - ทุกอย่างตรวจสิทธิ์ด้วย `requireAdminUser("content")` ก่อนอ่านข้อมูล
 */

const TAB_IDS = ["all", "draft", "published", "trash"] as const;

function tabOf(value: string | undefined): AdminNewsTab {
  return TAB_IDS.find((tab) => tab === value) ?? "all";
}

function pageOf(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AdminNewsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly tab?: string; readonly q?: string; readonly page?: string }>;
}) {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.admin;

  const query = await searchParams;
  const tab = tabOf(query.tab);
  const search = (query.q ?? "").trim();
  const page = pageOf(query.page);

  const [counts, listed, library] = await Promise.all([
    adminNewsCounts(),
    listNewsForAdmin({ tab, search, page }),
    listMedia(1),
  ]);

  const pageCount = Math.max(1, Math.ceil(listed.total / ADMIN_NEWS_PER_PAGE));
  const tabLabel: Record<AdminNewsTab, string> = {
    all: m.newsAdminTabAll,
    draft: m.newsAdminTabDraft,
    published: m.newsAdminTabPublished,
    trash: m.newsAdminTabTrash,
  };
  const tabCount: Record<AdminNewsTab, number> = {
    all: counts.all,
    draft: counts.draft,
    published: counts.published,
    trash: counts.trashed,
  };

  function tabHref(target: AdminNewsTab, targetPage = 1): string {
    const params = new URLSearchParams();
    if (target !== "all") params.set("tab", target);
    if (search !== "") params.set("q", search);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs === "" ? "/admin/news" : `/admin/news?${qs}`;
  }

  return (
    <main className="container-site py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{m.newsAdminTitle}</h1>
          <p className="text-fg-muted mt-1 text-sm">{m.newsAdminSubtitle}</p>
        </div>
        <Link
          href="/admin/news/new"
          className="bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {m.newsAdminNew}
        </Link>
      </div>

      <nav aria-label={m.newsAdminTitle} className="mt-6 flex flex-wrap items-center gap-2">
        {TAB_IDS.map((item) => (
          <Link
            key={item}
            href={tabHref(item)}
            aria-current={item === tab ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              item === tab ? "border-line bg-bg-subtle text-fg" : "border-line text-fg-muted hover:bg-bg-subtle"
            }`}
          >
            {tabLabel[item]} ({tabCount[item]})
          </Link>
        ))}
      </nav>

      <form method="get" action="/admin/news" className="mt-4 flex flex-wrap items-end gap-2">
        {tab === "all" ? null : <input type="hidden" name="tab" value={tab} />}
        <label className="block min-w-64 flex-1">
          <span className="text-fg-muted mb-1 block text-xs font-semibold">{m.newsAdminSearch}</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={m.newsAdminSearchPlaceholder}
            className="border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>
        <button
          type="submit"
          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {m.newsAdminSearch}
        </button>
        {search === "" ? null : (
          <Link href={tabHref(tab)} className="text-fg-muted px-2 py-2 text-sm underline underline-offset-4">
            {m.newsAdminClearSearch}
          </Link>
        )}
      </form>

      {listed.items.length === 0 ? (
        <p className="border-line bg-bg-subtle text-fg-muted mt-8 rounded-xl border px-4 py-6 text-sm">
          {tab === "trash" ? m.newsAdminEmptyTrash : m.newsAdminEmpty}
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-line text-fg-muted border-b text-left text-xs uppercase">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {m.newsAdminColTitle}
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {m.newsAdminColStatus}
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {m.newsAdminColPublished}
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {m.newsAdminColUpdated}
                </th>
                <th scope="col" className="py-2 font-semibold">
                  {m.newsAdminColActions}
                </th>
              </tr>
            </thead>
            <tbody>
              {listed.items.map((item) => (
                <tr key={item.id} className="border-line border-b align-top">
                  <td className="py-3 pr-3">
                    <Link href={`/admin/news/${item.id}`} className="text-link font-semibold underline underline-offset-4">
                      {item.titleTh}
                    </Link>
                    <span className="text-fg-muted mt-1 block text-xs">
                      {fillTemplate(m.newsAdminSummary, {
                        blocks: String(item.blockCount),
                        images: String(item.imageCount),
                      })}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <span className="border-line rounded-full border px-2 py-0.5 text-xs">
                      {item.status === "draft" ? m.newsAdminStatusDraft : m.newsAdminStatusPublished}
                    </span>
                    {item.trashed ? (
                      <span className="text-danger mt-1 block text-xs">{m.newsAdminTabTrash}</span>
                    ) : null}
                  </td>
                  <td className="text-fg-muted py-3 pr-3 text-xs">
                    {item.publishedLocal ?? m.newsAdminNoDate}
                  </td>
                  <td className="text-fg-muted py-3 pr-3 text-xs">{item.updatedLocal ?? m.newsAdminNoDate}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/news/${item.id}`}
                        className="border-line text-fg hover:bg-surface-raised rounded-lg border px-2.5 py-1 text-xs font-semibold no-underline"
                      >
                        {m.newsAdminEdit}
                      </Link>
                      {item.trashed ? null : (
                        <Link
                          href={`/news/${item.sourceId}`}
                          className="border-line text-fg hover:bg-surface-raised rounded-lg border px-2.5 py-1 text-xs font-semibold no-underline"
                        >
                          {m.newsAdminView}
                        </Link>
                      )}
                      <form action={trashNewsAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="trashed" value={item.trashed ? "0" : "1"} />
                        <button
                          type="submit"
                          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {item.trashed ? m.newsAdminRestore : m.newsAdminMoveToTrash}
                        </button>
                      </form>

                      {/* ลบถาวร (รอบที่ 174) — มีเฉพาะของที่อยู่ในถังแล้ว + เตือนให้ชัด (กู้คืนไม่ได้) */}
                      {item.trashed ? (
                        <form action={deleteNewsForeverAction} className="flex flex-col gap-0.5">
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            type="submit"
                            className="border-brand-red text-brand-red hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                          >
                            {m.newsAdminDeleteForever}
                          </button>
                          <span className="text-fg-muted text-[11px]">{m.newsAdminDeleteForeverWarning}</span>
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

      {pageCount > 1 ? (
        <nav aria-label={m.newsAdminPageOf} className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={tabHref(tab, page - 1)} className="text-link underline underline-offset-4">
              {m.newsAdminPrev}
            </Link>
          ) : null}
          <span className="text-fg-muted">
            {fillTemplate(m.newsAdminPageOf, { page: String(page), pages: String(pageCount) })}
          </span>
          {page < pageCount ? (
            <Link href={tabHref(tab, page + 1)} className="text-link underline underline-offset-4">
              {m.newsAdminNext}
            </Link>
          ) : null}
        </nav>
      ) : null}

      <p className="text-fg-muted mt-8 text-xs">{m.newsAdminTrashHint}</p>
      <p className="text-fg-muted mt-1 text-xs">{library.length === 0 ? m.newsAdminNoImages : ""}</p>
    </main>
  );
}

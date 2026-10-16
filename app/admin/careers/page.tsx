import Link from "next/link";

import { deleteJobForeverAction, reorderJobsAction, trashJobAction } from "@/app/admin/careers/actions";
import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";
import { jobDepartment, jobStats, type JobPosting } from "@/lib/careers/model";
import { listJobPostingsForAdmin, type AdminJobPosting } from "@/lib/careers/repository";
import { SortableList } from "@/features/admin/ui/sortable-list";
import { searchParamText } from "@/lib/search/params";

/**
 * หลังบ้าน — "ประกาศรับสมัครงาน" ของหน้า /careers (รอบที่ 265 · มติเจ้าของ D26)
 *
 * ที่มา: เจ้าของสั่ง *"ส่วนแก้ไขเนื้อหาร่วมงานกับไวไว หลังบ้าน นำที่มีอยู่ตอนนี้หน้าบ้านเข้า db
 * จากนั้นสามารถเพิ่ม ลบ ประกาศได้เพราะเป็นประกาศรับสมัครงาน"*
 *
 * รูปแบบเดียวกับจอข่าว/สินค้า/เมนู
 * - แท็บ (ทั้งหมด/ฉบับร่าง/เผยแพร่/ถังขยะ) → ค้นหา → ตาราง → ปุ่มย้าย/กู้คืน/ลบถาวร (**ฟอร์มธรรมดา ไม่ต้องมี JS**)
 * - จัดลำดับด้วย `SortableList` ตัวเดิม (เครื่องมือกลาง `reorderRows("job", …)`)
 * - ทุกอย่างเริ่มด้วย `requireAdminUser("content")`
 * ⚠️ ข้อมูลชุดนี้เล็ก (หลักสิบรายการ) ⇒ กรอง/ค้นหาในหน่วยความจำได้ · ไม่มีแบ่งหน้า (ถ้าโตกว่านี้ค่อยย้ายไป SQL)
 */

const TAB_IDS = ["all", "draft", "published", "trash"] as const;
type TabId = (typeof TAB_IDS)[number];

function tabOf(value: string | undefined): TabId {
  return TAB_IDS.find((tab) => tab === value) ?? "all";
}

function matches(posting: AdminJobPosting, search: string): boolean {
  if (search === "") return true;
  const needle = search.toLowerCase();
  const haystack = [posting.titleTh, posting.titleEn, posting.departmentTh, posting.departmentEn, posting.id]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function inTab(posting: AdminJobPosting, tab: TabId): boolean {
  if (tab === "trash") return posting.deletedAt !== null;
  if (posting.deletedAt !== null) return false;
  if (tab === "draft") return posting.status === "draft";
  if (tab === "published") return posting.status === "published";
  return true;
}

export default async function AdminCareersPage({
  searchParams,
}: {
  readonly searchParams: Promise<Readonly<Record<string, string | readonly string[] | undefined>>>;
}) {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.adminCareers;

  const query = await searchParams;
  /* ⚠️ ผ่าน `searchParamText` เท่านั้น (ค่าซ้ำ = array · อักขระควบคุม/NUL ต้องถูกตัด) — รอบที่ 291 */
  const tab = tabOf(searchParamText(query.tab));
  const search = searchParamText(query.q, 80);

  const all = await listJobPostingsForAdmin();
  const visible = all.filter((posting) => inTab(posting, tab) && matches(posting, search));
  const active = all.filter((posting) => posting.deletedAt === null);
  const stats = jobStats(active);

  const tabLabel: Readonly<Record<TabId, string>> = {
    all: m.tabAll,
    draft: m.tabDraft,
    published: m.tabPublished,
    trash: m.tabTrash,
  };
  const tabCount: Readonly<Record<TabId, number>> = {
    all: active.length,
    draft: active.filter((posting) => posting.status === "draft").length,
    published: active.filter((posting) => posting.status === "published").length,
    trash: all.filter((posting) => posting.deletedAt !== null).length,
  };

  function tabHref(target: TabId): string {
    const params = new URLSearchParams();
    if (target !== "all") params.set("tab", target);
    if (search !== "") params.set("q", search);
    const qs = params.toString();
    return qs === "" ? "/admin/careers" : `/admin/careers?${qs}`;
  }

  /* รายการจัดลำดับ = ประกาศที่ใช้งานอยู่ทั้งหมด (ของในถังไม่ต้องจัด) */
  const reorderItems = active.map((posting) => ({
    id: posting.id,
    title: posting.titleTh,
    subtitle: posting.departmentTh,
  }));
  const reorderKey = active.map((posting) => `${posting.id}:${String(posting.sortOrder)}`).join("|");

  function summaryOf(posting: JobPosting): string {
    return [jobDepartment(posting, "th"), posting.openings > 0 ? `${String(posting.openings)} ${m.openingsUnit}` : ""]
      .filter((part) => part !== "")
      .join(" · ");
  }

  return (
    <main className="container-site py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{m.title}</h1>
          <p className="text-fg-muted mt-1 text-sm">{m.subtitle}</p>
          <p className="text-fg-muted mt-2 text-xs">
            {fillTemplate(m.summary, {
              positions: String(stats.positions),
              openings: String(stats.openings),
              departments: String(stats.departments),
            })}
          </p>
        </div>
        <Link
          href="/admin/careers/new"
          className="bg-accent text-accent-fg hover:bg-accent-strong focus-visible:ring-ring inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {m.newPosting}
        </Link>
      </div>

      <nav aria-label={m.title} className="mt-6 flex flex-wrap items-center gap-2">
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

      <form method="get" action="/admin/careers" className="mt-4 flex flex-wrap items-end gap-2">
        {tab === "all" ? null : <input type="hidden" name="tab" value={tab} />}
        <label className="block min-w-64 flex-1">
          <span className="text-fg-muted mb-1 block text-xs font-semibold">{m.search}</span>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={m.searchPlaceholder}
            className="border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </label>
        <button
          type="submit"
          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {m.search}
        </button>
        {search === "" ? null : (
          <Link href={tabHref(tab)} className="text-fg-muted px-2 py-2 text-sm underline underline-offset-4">
            {m.clearSearch}
          </Link>
        )}
      </form>

      {visible.length === 0 ? (
        <p className="border-line bg-bg-subtle text-fg-muted mt-8 rounded-xl border px-4 py-6 text-sm">
          {tab === "trash" ? m.emptyTrash : m.empty}
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-line text-fg-muted border-b text-left text-xs uppercase">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {m.colTitle}
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {m.colStatus}
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {m.colOrder}
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {m.colUpdated}
                </th>
                <th scope="col" className="py-2 font-semibold">
                  {m.colActions}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((posting) => {
                /* `trashed` = อยู่ในถัง — ปุ่มลบถาวรผูกกับค่านี้เท่านั้น (เทสต์บังคับไว้) */
                const trashed = posting.deletedAt !== null;
                return (
                <tr key={posting.id} className="border-line border-b align-top">
                  <td className="py-3 pr-3">
                    <Link
                      href={`/admin/careers/${posting.id}`}
                      className="text-link font-semibold underline underline-offset-4"
                    >
                      {posting.titleTh}
                    </Link>
                    <span className="text-fg-muted mt-1 block text-xs">{summaryOf(posting)}</span>
                  </td>
                  <td className="py-3 pr-3">
                    <span className="border-line rounded-full border px-2 py-0.5 text-xs">
                      {posting.status === "draft" ? m.statusDraft : m.statusPublished}
                    </span>
                    {trashed ? <span className="text-danger mt-1 block text-xs">{m.tabTrash}</span> : null}
                  </td>
                  <td className="text-fg-muted py-3 pr-3 text-xs">{posting.sortOrder}</td>
                  <td className="text-fg-muted py-3 pr-3 text-xs">
                    {posting.updatedBy === "" ? posting.updatedAt.slice(0, 10) : `${posting.updatedAt.slice(0, 10)} · ${posting.updatedBy}`}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/careers/${posting.id}`}
                        className="border-line text-fg hover:bg-surface-raised rounded-lg border px-2.5 py-1 text-xs font-semibold no-underline"
                      >
                        {m.edit}
                      </Link>
                      <form action={trashJobAction}>
                        <input type="hidden" name="id" value={posting.id} />
                        <input type="hidden" name="trashed" value={trashed ? "0" : "1"} />
                        <button
                          type="submit"
                          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {trashed ? m.restore : m.moveToTrash}
                        </button>
                      </form>

                      {trashed ? (
                        <form action={deleteJobForeverAction} className="flex flex-col gap-0.5">
                          <input type="hidden" name="id" value={posting.id} />
                          <button
                            type="submit"
                            className="border-brand-red text-brand-red hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-outline-none"
                          >
                            {m.deleteForever}
                          </button>
                          <span className="text-fg-muted text-[11px]">{m.deleteForeverWarning}</span>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {reorderItems.length < 2 ? null : (
        <section className="border-line bg-surface mt-8 rounded-2xl border p-4">
          <h2 className="text-fg text-base font-semibold">{m.reorderTitle}</h2>
          <p className="text-fg-muted mt-1 text-sm">{m.reorderHint}</p>
          <div className="mt-3">
            <SortableList
              key={reorderKey}
              kind="job"
              items={reorderItems}
              action={reorderJobsAction}
              strings={{
                up: m.reorderUp,
                down: m.reorderDown,
                save: m.reorderSave,
                saveHint: m.reorderSaveHint,
                handle: m.reorderHandle,
                saved: m.reorderSaved,
                failed: m.reorderFailed,
              }}
            />
          </div>
        </section>
      )}

      <p className="text-fg-muted mt-8 text-xs">{m.trashHint}</p>
    </main>
  );
}

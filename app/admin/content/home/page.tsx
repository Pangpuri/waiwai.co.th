import { importHomeSeedAction } from "@/app/admin/content/actions";
import { HomeEditor } from "@/features/admin/ui/home-editor";
import { requireAdminUser } from "@/lib/auth/dal";
import { toDraft } from "@/lib/content/draft";
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { isDatabaseConfigured, loadPageContent } from "@/lib/content/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * หน้าจอแก้เนื้อหาหน้าแรก — Server Component
 *
 * ลำดับการทำงาน
 *   1. `requireAdminUser("<permission>")` — ต้องล็อกอินก่อนเสมอ (เด้งไปหน้าล็อกอินถ้าไม่มีเซสชัน)
 *   2. ถ้าไม่มี `DATABASE_URL` → บอกวิธีตั้งค่า (ไม่ใช่หน้าจอที่กดแล้วเงียบ)
 *   3. อ่านเนื้อหาจาก DB → ถ้าว่างให้ปุ่ม "นำเข้าข้อมูลตั้งต้น" (เนื้อหาจากพจนานุกรมเดิม)
 *   4. ส่ง "ฉบับร่าง" ให้หน้าจอแก้ไข (client) เป็นข้อมูลตั้งต้น
 *
 * หมายเหตุ: หน้านี้เป็น dynamic (อ่านคุกกี้ + DB) — ตั้งใจให้เป็นเช่นนั้น ไม่ใช่ static
 */
export default async function AdminHomeContentPage() {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  const heading = (
    <header className="flex flex-col gap-1">
      <p className="text-fg-muted text-xs font-medium tracking-wide uppercase">{strings.brand}</p>
      <h1 className="text-fg text-2xl font-bold">{strings.contentTitle}</h1>
    </header>
  );

  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-10">
        {heading}
        <section className="border-line bg-surface-raised flex flex-col gap-2 rounded-2xl border p-5">
          <h2 className="text-fg text-lg font-semibold">{strings.dbMissingTitle}</h2>
          <p className="text-fg-muted text-sm">{strings.dbMissingBody}</p>
        </section>
      </main>
    );
  }

  const loaded = await loadPageContent(HOME_PAGE_SPEC);
  const draft = toDraft(HOME_PAGE_SPEC, loaded.content);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-10">
      {heading}

      {loaded.unknownKeys.length > 0 ? (
        <section className="border-line bg-surface-raised rounded-2xl border p-4">
          <p className="text-fg text-sm font-semibold">{strings.warningTitle}</p>
          <ul className="text-fg-muted mt-1 flex list-disc flex-col gap-1 pl-5 text-xs">
            {loaded.unknownKeys.slice(0, 20).map((key) => (
              <li key={key}>
                <span className="font-mono">{key}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loaded.isEmpty ? (
        <section className="border-line bg-surface-raised flex flex-col gap-3 rounded-2xl border p-5">
          <h2 className="text-fg text-lg font-semibold">{strings.emptyTitle}</h2>
          <p className="text-fg-muted text-sm">{strings.emptyBody}</p>
          <form action={importHomeSeedAction}>
            <button
              type="submit"
              className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {strings.importSeed}
            </button>
          </form>
        </section>
      ) : (
        <HomeEditor spec={HOME_PAGE_SPEC} initialDraft={draft} strings={strings} />
      )}
    </main>
  );
}

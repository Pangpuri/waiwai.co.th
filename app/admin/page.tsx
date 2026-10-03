import Link from "next/link";

import { logoutAction } from "@/app/admin/actions";
import { listRecentAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * ภาพรวมหลังบ้าน — หน้าที่ "ต้องล็อกอินก่อน" หน้าที่แรก
 *
 * ทุกหน้าของหลังบ้านต้องเริ่มด้วย `requireAdminUser()` (DAL) — ไม่ล็อกอิน = เด้งไปหน้าล็อกอิน
 * นี่คือจุดเดียวที่ตรวจสิทธิ์ จึงไม่มีทางลืม (กติกา: ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ทุกคำขอ)
 *
 * ⚠️ หน้าจอแก้เนื้อหาหน้าแรก (B2) จะมาแทนที่ส่วน "ขั้นถัดไป" — ต้องมีฐานข้อมูลก่อน
 */
export default async function AdminHomePage() {
  const user = await requireAdminUser();
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  /* ร่องรอยการใช้งาน (X2.2) — เดิมตาราง audit_log แต่ว่างเปล่า ⇒ ตอนนี้เขียนทุกครั้งที่ล็อกอิน/เผยแพร่ */
  const audit = await listRecentAudit(8);
  const actionLabel = (action: string): string => {
    const map: Record<string, string | undefined> = {
      "login-success": strings.auditLoginSuccess,
      "login-failure": strings.auditLoginFailure,
      logout: strings.auditLogout,
      publish: strings.auditPublish,
      "restore-revision": strings.auditRestore,
      "preset-save": strings.auditPresetSave,
      "pages-update": strings.auditPagesUpdate,
      "migrate-blocks": strings.auditBlockMigrate,
    };
    return map[action] ?? action;
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <p className="text-fg-muted text-xs font-medium tracking-wide uppercase">{strings.brand}</p>
          <h1 className="text-fg text-2xl font-bold">{strings.dashboardTitle}</h1>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.logout}
          </button>
        </form>
      </header>

      <section className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-5 sm:p-6">
        <dl className="flex flex-col gap-3 sm:flex-row sm:gap-8">
          <div className="flex flex-col gap-0.5">
            <dt className="text-fg-muted text-xs">{strings.signedInAs}</dt>
            <dd className="text-fg text-sm font-semibold">{user.email}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-fg-muted text-xs">{strings.roleLabel}</dt>
            <dd className="text-fg text-sm font-semibold">{strings.roles[user.role]}</dd>
          </div>
        </dl>
        <p className="text-fg-muted text-xs">{strings.securityNote}</p>
      </section>

      <section className="border-line bg-surface-raised flex flex-col gap-3 rounded-2xl border p-5 sm:p-6">
        <h2 className="text-fg text-lg font-semibold">{strings.nextStepTitle}</h2>
        <p className="text-fg-muted text-sm">{strings.nextStepBody}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/admin/builder/home"
            className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {strings.builderTitle}
          </Link>
          <Link
            href="/admin/builder/mourning"
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.mourningTitle}
          </Link>
          <Link
            href="/admin/content/home"
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.contentTitle}
          </Link>
          <Link
            href="/th"
            className="text-link focus-visible:ring-ring w-fit text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.openSite}
          </Link>
        </div>
      </section>

      <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-fg text-sm font-semibold">{strings.auditTitle}</h2>
          <p className="text-fg-muted text-xs">{strings.auditHint}</p>
        </div>

        {audit.length === 0 ? (
          <p className="text-fg-muted text-sm">{strings.auditEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {audit.map((entry, index) => (
              <li
                key={`${entry.createdAt}-${index}`}
                className="border-line flex flex-wrap items-baseline gap-2 border-b pb-1.5 text-xs last:border-0"
              >
                <span className="text-fg font-semibold">{actionLabel(entry.action)}</span>
                <span className="text-fg-muted font-mono">{entry.target ?? "-"}</span>
                <span className="text-fg-muted">{entry.actorEmail ?? "-"}</span>
                <span className="text-fg-muted ml-auto">{entry.createdAt.slice(0, 16).replace("T", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

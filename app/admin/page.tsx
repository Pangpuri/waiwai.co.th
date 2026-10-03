import Link from "next/link";

import { logoutAction, purgeRetentionNowAction } from "@/app/admin/actions";
import { listRecentAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { maintenanceFlagOf, MAINTENANCE_ENV_VAR } from "@/lib/maintenance/plan";
import { describeRetention } from "@/lib/retention/format";
import { type RetentionClass } from "@/lib/retention/plan";
import { retentionOverview } from "@/lib/retention/purge";

/**
 * ภาพรวมหลังบ้าน — หน้าที่ "ต้องล็อกอินก่อน" หน้าที่แรก
 *
 * ทุกหน้าของหลังบ้านต้องเริ่มด้วย `requireAdminUser()` (DAL) — ไม่ล็อกอิน = เด้งไปหน้าล็อกอิน
 * นี่คือจุดเดียวที่ตรวจสิทธิ์ จึงไม่มีทางลืม (กติกา: ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ทุกคำขอ)
 *
 * หน้านี้รวม "ร่องรอยการใช้งาน" (X2.2) และ "ระยะเก็บข้อมูลส่วนบุคคล" (X2b) ไว้ที่เดียว
 * ⇒ เจ้าของเห็นทันทีว่ามีข้อมูลหมดอายุค้างอยู่ไหม และกดลบเองได้โดยไม่ต้องรอรอบอัตโนมัติ
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
      "retention-purge": strings.auditRetentionPurge,
      "erase-subject": strings.auditEraseSubject,
    };
    return map[action] ?? action;
  };

  /*
    ระยะเก็บข้อมูลส่วนบุคคล (X2b)
    `retentionOverview()` นับแบบ "อ่านล้วน" (dry run) ⇒ ตัวเลขบนจอ = จำนวนแถวที่จะถูกลบจริงในรอบถัดไป
    คืน null = ยังไม่ได้ตั้ง DATABASE_URL (หน้าจอต้องไม่พังเพราะเรื่องนี้)
  */
  const retention = await retentionOverview();
  const labelByClass: Readonly<Record<RetentionClass, string>> = {
    contact: strings.retentionLabelContact,
    newsletter: strings.retentionLabelNewsletter,
    careers: strings.retentionLabelCareers,
    blockRevision: strings.retentionLabelBlockRevision,
    contentRevision: strings.retentionLabelContentRevision,
    loginAttempt: strings.retentionLabelLoginAttempt,
    auditLog: strings.retentionLabelAuditLog,
  };

  /* เวลาบนหน้าจอ — ตัดถึงนาที (รูปแบบเดียวกับรายการ audit ด้านล่าง) */
  const stamp = (iso: string): string => iso.slice(0, 16).replace("T", " ");

  /* สถานะโหมดปิดปรับปรุง (X2.5) — `unclear` = ตั้งค่าไม่ชัด จึงถือว่าปิด (ต้องเตือนให้รู้ ไม่ใช่เงียบ) */
  const maintenanceFlag = maintenanceFlagOf(process.env[MAINTENANCE_ENV_VAR]);

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

      {/* ── ระยะเก็บข้อมูลส่วนบุคคล (X2b) ─────────────────────────────────────── */}
      <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-fg text-sm font-semibold">{strings.retentionTitle}</h2>
          <p className="text-fg-muted text-xs">{strings.retentionHint}</p>
        </div>

        {retention === null ? (
          <p className="text-fg-muted text-sm">{strings.retentionDbMissing}</p>
        ) : (
          <>
            <p className="text-fg-muted text-xs">
              {retention.lastPurgeAt === null
                ? strings.retentionNeverRun
                : strings.retentionLastRun.replace("{time}", stamp(retention.lastPurgeAt))}
              {" · "}
              {retention.nextDueAt === null
                ? strings.retentionDueNow
                : strings.retentionNextRun.replace("{time}", stamp(retention.nextDueAt))}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="text-fg-muted">
                    <th scope="col" className="py-1.5 pr-3 font-semibold">
                      {strings.retentionColData}
                    </th>
                    <th scope="col" className="py-1.5 pr-3 font-semibold whitespace-nowrap">
                      {strings.retentionColKeep}
                    </th>
                    <th scope="col" className="py-1.5 pr-3 font-semibold whitespace-nowrap">
                      {strings.retentionColCutoff}
                    </th>
                    <th scope="col" className="py-1.5 font-semibold whitespace-nowrap">
                      {strings.retentionColDue}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {retention.steps.map((step) => (
                    <tr key={step.cls} className="border-line border-t">
                      <td className="text-fg py-1.5 pr-3">{labelByClass[step.cls]}</td>
                      <td className="text-fg-muted py-1.5 pr-3 whitespace-nowrap">
                        {describeRetention(step.days, "th")}
                      </td>
                      <td className="text-fg-muted py-1.5 pr-3 font-mono whitespace-nowrap">
                        {step.cutoffIso.slice(0, 10)}
                      </td>
                      <td className="text-fg py-1.5 font-semibold">{retention.due[step.cls]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-fg-muted text-xs">
              {retention.dueTotal === 0
                ? strings.retentionNothingDue
                : strings.retentionDueTotal.replace("{count}", String(retention.dueTotal))}
            </p>

            <form action={purgeRetentionNowAction} className="flex flex-col gap-2">
              <button
                type="submit"
                className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring w-fit rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
              >
                {strings.retentionPurgeNow}
              </button>
              <p className="text-fg-muted text-xs">{strings.retentionPurgeWarning}</p>
            </form>
          </>
        )}
      </section>

      <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-fg text-sm font-semibold">{strings.maintenanceTitle}</h2>
          <p className="text-fg-muted text-xs">{strings.maintenanceHint}</p>
        </div>

        {/*
          โหมดปิดปรับปรุง (X2.5) — สวิตช์อยู่ที่ env ไม่ใช่ปุ่มบนหลังบ้าน (เหตุผลใน lib/maintenance/plan.ts)
          ⇒ การ์ดนี้ "บอกสถานะ + วิธีเปิด/ปิด" · อ่าน `process.env` ตรง ๆ ได้เพราะหน้านี้เรนเดอร์แบบ dynamic อยู่แล้ว
        */}
        <p
          className={
            maintenanceFlag === "on"
              ? "text-fg text-sm font-semibold"
              : maintenanceFlag === "unclear"
                ? "text-brand-red text-sm font-semibold"
                : "text-fg-muted text-sm font-semibold"
          }
        >
          {maintenanceFlag === "on"
            ? strings.maintenanceStateOn
            : maintenanceFlag === "unclear"
              ? strings.maintenanceStateUnclear
              : strings.maintenanceStateOff}
        </p>

        <div className="border-line text-fg-muted flex flex-col gap-1 border-t pt-3 text-xs">
          <p className="font-mono">{strings.maintenanceHowTo}</p>
          <p>{strings.maintenanceBypass}</p>
          <p>{strings.maintenanceEnvNote}</p>
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
                <span className="text-fg-muted ml-auto">{stamp(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

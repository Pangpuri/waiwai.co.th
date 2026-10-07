import Link from "next/link";

import { logoutAction, publishScheduledNowAction, purgeRetentionNowAction } from "@/app/admin/actions";
import { auditActionLabel, auditStamp } from "@/features/admin/audit-labels";
import { listRecentAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/roles";
import { scheduledPublishOverview } from "@/lib/blocks/publish-scheduler";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";
import { maintenanceFlagOf, MAINTENANCE_ENV_VAR } from "@/lib/maintenance/plan";
import { describeRetention } from "@/lib/retention/format";
import { type RetentionClass } from "@/lib/retention/plan";
import { retentionOverview } from "@/lib/retention/purge";
import { contentTrashStats } from "@/lib/trash/content";
import { CONTENT_TRASH_KINDS, CONTENT_TRASH_SCREENS, type ContentTrashKind } from "@/lib/trash/plan";
import { trashStats } from "@/lib/trash/repository";

/**
 * ภาพรวมหลังบ้าน — หน้าที่ "ต้องล็อกอินก่อน" หน้าที่แรก
 *
 * ทุกหน้าของหลังบ้านต้องเริ่มด้วย `requireAdminUser("<permission>")` (DAL) — ไม่ล็อกอิน = เด้งไปหน้าล็อกอิน
 * นี่คือจุดเดียวที่ตรวจสิทธิ์ จึงไม่มีทางลืม (กติกา: ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ทุกคำขอ)
 *
 * หน้านี้รวม "ร่องรอยการใช้งาน" (X2.2) และ "ระยะเก็บข้อมูลส่วนบุคคล" (X2b) ไว้ที่เดียว
 * ⇒ เจ้าของเห็นทันทีว่ามีข้อมูลหมดอายุค้างอยู่ไหม และกดลบเองได้โดยไม่ต้องรอรอบอัตโนมัติ
 */
export default async function AdminHomePage() {
  const user = await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  /* ร่องรอยการใช้งาน (X2.2) — เดิมตาราง audit_log แต่ว่างเปล่า ⇒ ตอนนี้เขียนทุกครั้งที่ล็อกอิน/เผยแพร่ */
  const audit = await listRecentAudit(8);
  /* แปลงรหัสเหตุการณ์เป็นข้อความ — ตรรกะอยู่ที่ `features/admin/audit-labels.ts` (ใช้ร่วมกับหน้าอื่น) */
  const actionLabel = (action: string): string => auditActionLabel(strings, action);

  /*
    สิทธิ์ของการ์ด "เฉพาะทาง" (X1.10 · รอบที่ 85)
    หลักการ: การ์ดที่กระทำได้เฉพาะบทบาทสูงกว่า (หรือพาไปหน้าที่บทบาทนี้เข้าไม่ได้) ต้องไม่โชว์
    ⚠️ นี่เป็นแค่การซ่อนใน UI — การบังคับจริงอยู่ที่ Server Action และหน้าเป้าหมาย (`requireAdminUser("<permission>")`)
  */
  const canRetention = can(user.role, "retention");
  const canTrash = can(user.role, "trash");

  /*
    ระยะเก็บข้อมูลส่วนบุคคล (X2b)
    `retentionOverview()` นับแบบ "อ่านล้วน" (dry run) ⇒ ตัวเลขบนจอ = จำนวนแถวที่จะถูกลบจริงในรอบถัดไป
    คืน null = ยังไม่ได้ตั้ง DATABASE_URL (หน้าจอต้องไม่พังเพราะเรื่องนี้)
    อ่านเฉพาะเมื่อมีสิทธิ์ ⇒ ไม่ยิงคำสั่งนับทิ้งให้บทบาทที่มองไม่เห็นการ์ด
  */
  const retention = canRetention ? await retentionOverview() : null;

  /*
    ถังขยะ (X2.4) — นับของที่รอกู้คืน/ลบถาวร
    อ่านล้วน + คืน 0 เมื่อไม่มีฐานข้อมูล ⇒ การ์ดนี้ไม่ทำให้หน้าภาพรวมพัง
    อ่านเฉพาะเมื่อมีสิทธิ์ (เหตุผลเดียวกับระยะเก็บด้านบน)
    รอบที่ 175: นับ **เนื้อหา** (สินค้า/เมนู/ข่าว) ด้วย — เดิมการ์ดนับแค่ภาพ/พรีเซ็ต ⇒ เจ้าของเห็นไม่ครบ
  */
  const trash = canTrash ? await trashStats() : null;
  const contentTrash = canTrash ? await contentTrashStats() : null;
  const trashTotalAll = (trash?.total ?? 0) + (contentTrash?.total ?? 0);

  /* ป้ายชื่อของแต่ละชนิดเนื้อหาในถัง — เพิ่มชนิดใหม่แล้ว type ฟ้องที่นี่ทันที */
  const contentTrashLabels: Readonly<Record<ContentTrashKind, string>> = {
    product: strings.trashContentProduct,
    recipe: strings.trashContentRecipe,
    news: strings.trashContentNews,
  };

  /*
    งานที่ตั้งกำหนดเวลาเผยแพร่ไว้ (X2.7) — ทุกบทบาทมีสิทธิ์ `content` จึงไม่ต้องซ่อนการ์ด
    อ่านล้วน + คืน null เมื่อยังไม่มีฐานข้อมูล ⇒ การ์ดนี้ไม่ทำให้หน้าภาพรวมพัง
  */
  const schedule = await scheduledPublishOverview();
  const labelByClass: Readonly<Record<RetentionClass, string>> = {
    contact: strings.retentionLabelContact,
    newsletter: strings.retentionLabelNewsletter,
    careers: strings.retentionLabelCareers,
    blockRevision: strings.retentionLabelBlockRevision,
    contentRevision: strings.retentionLabelContentRevision,
    entityRevision: strings.retentionLabelEntityRevision,
    loginAttempt: strings.retentionLabelLoginAttempt,
    auditLog: strings.retentionLabelAuditLog,
    adminSession: strings.retentionLabelAdminSession,
  };

  /* เวลาบนหน้าจอ — ตัดถึงนาที (รูปแบบเดียวกับรายการ audit ด้านล่าง) */
  const stamp = (iso: string): string => auditStamp(iso);

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

      {/* ── ระยะเก็บข้อมูลส่วนบุคคล (X2b) — เฉพาะผู้มีสิทธิ์ retention ──────────── */}
      {canRetention ? (
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

            {/* ถังขยะเนื้อหา (รอบที่ 174) — ไม่ใช่ข้อมูลส่วนบุคคล (คนละนโยบาย) แต่ลบในรอบเดียวกัน */}
            <p className="text-fg-muted text-xs">
              {retention.contentTrashDue === 0
                ? strings.retentionContentTrashNone
                : strings.retentionContentTrashDue.replace("{count}", String(retention.contentTrashDue))}
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
      ) : null}

      {/* ── ถังขยะ (X2.4 · ขยายรอบที่ 175) — เฉพาะผู้มีสิทธิ์ trash ─────────────── */}
      {canTrash && trash !== null && contentTrash !== null ? (
      <section className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-fg text-sm font-semibold">{strings.trashCardTitle}</h2>
          <p className="text-fg-muted text-xs">{strings.trashCardHint}</p>
        </div>
        <p className="text-fg text-sm font-semibold">
          {trashTotalAll === 0 ? strings.trashCardEmpty : strings.trashCardCount.replace("{count}", String(trashTotalAll))}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/trash"
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring w-fit rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.trashTitle}
          </Link>
          <span className="text-fg-muted text-xs">
            {fillTemplate(strings.trashStats, {
              media: trash.media,
              preset: trash.preset,
              chrome: trash.chromePreset,
            })}
          </span>
        </div>

        {/* เนื้อหาในถัง (รอบที่ 175) — ของแต่ละชนิดกู้คืน/ลบถาวรในแท็บถังขยะของหน้าจอนั้น */}
        <div className="border-line flex flex-col gap-2 border-t pt-3">
          <p className="text-fg-muted text-xs">
            {fillTemplate(strings.trashContentStats, {
              product: contentTrash.product,
              recipe: contentTrash.recipe,
              news: contentTrash.news,
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {CONTENT_TRASH_KINDS.map((kind) => (
              <Link
                key={kind}
                href={CONTENT_TRASH_SCREENS[kind]}
                className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
              >
                {contentTrashLabels[kind]}
              </Link>
            ))}
          </div>
          <p className="text-fg-muted text-[11px]">{strings.trashContentHint}</p>
        </div>
      </section>
      ) : null}

      {/* ── งานที่ตั้งกำหนดเวลาเผยแพร่ไว้ (X2.7) — ทุกบทบาทเข้าถึงได้ (สิทธิ์ content) ── */}
      {schedule !== null ? (
      <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-fg text-sm font-semibold">{strings.scheduleCardTitle}</h2>
          <p className="text-fg-muted text-xs">{strings.scheduleCardHint}</p>
        </div>

        <p className="text-fg text-sm font-semibold">
          {schedule.upcoming.length === 0 || schedule.nextAt === null
            ? strings.scheduleCardNone
            : schedule.dueCount > 0
              ? strings.scheduleCardDue.replace("{count}", String(schedule.dueCount))
              : strings.scheduleCardNext.replace("{time}", stamp(schedule.nextAt))}
        </p>

        {schedule.upcoming.length === 0 ? null : (
          <ul className="text-fg-muted flex flex-col gap-1 text-xs">
            {schedule.upcoming.map((row) => (
              <li key={row.page} className="font-mono">
                {strings.scheduleCardRow.replace("{page}", row.page).replace("{time}", stamp(row.at))}
              </li>
            ))}
          </ul>
        )}

        <form action={publishScheduledNowAction} className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={schedule.dueCount === 0}
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring w-fit rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            {strings.schedulePublishNow}
          </button>
          <p className="text-fg-muted text-xs">{strings.schedulePublishNowHint}</p>
        </form>
      </section>
      ) : null}

      {/* โหมดปิดปรับปรุง = เรื่องของผู้ดูแลระบบ (สวิตช์อยู่ที่ env/CLI) ⇒ แสดงการ์ดนี้เฉพาะบทบาทที่มีสิทธิ์ maintenance */}
      {can(user.role, "maintenance") ? (
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
      ) : null}

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

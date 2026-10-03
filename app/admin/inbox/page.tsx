import Link from "next/link";

import { deleteSubmissionAction, eraseSubjectAction, setSubmissionStatusAction } from "@/app/admin/inbox/actions";
import { requireAdminUser } from "@/lib/auth/dal";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { formatBytes } from "@/lib/forms/attachment";
import { countSubmissionsByStatus, listAttachments, listSubmissions, type SubmissionRow, type SubmissionStatus } from "@/lib/forms/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";
import { erasureIsEmpty, erasureTotal, isPlausibleEmail } from "@/lib/privacy/erasure";
import { erasurePreview } from "@/lib/privacy/repository";

/**
 * กล่องข้อความหลังบ้าน (X1.9) — ผู้ติดต่อ/ผู้สมัครจากฟอร์มหน้าเว็บ
 *
 * มติผู้ใช้ รอบที่ 64: **เก็บลงฐานข้อมูล** ⇒ หน้านี้คือ "ที่ที่ไม่มีข้อความหาย"
 * ⚠️ ข้อมูลส่วนบุคคล (PDPA) ⇒ ต้องล็อกอินก่อน (บรรทัดแรก) · ลบได้ทันทีเมื่อจัดการเสร็จ
 * ⚠️ ใช้ฟอร์ม + server action ล้วน (ไม่มี JS) ⇒ ทำงานได้ทุกเบราว์เซอร์
 */

const FILTERS: readonly { readonly key: SubmissionStatus | "all"; readonly labelKey: "inboxFilterAll" | "inboxFilterNew" | "inboxFilterHandled" | "inboxFilterSpam" }[] = [
  { key: "all", labelKey: "inboxFilterAll" },
  { key: "new", labelKey: "inboxFilterNew" },
  { key: "handled", labelKey: "inboxFilterHandled" },
  { key: "spam", labelKey: "inboxFilterSpam" },
];

const BUTTON_CLASS =
  "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none";

function formLabel(strings: Awaited<ReturnType<typeof getMessagesFor>>["admin"], form: SubmissionRow["form"]): string {
  if (form === "newsletter") return strings.inboxFormNewsletter;
  if (form === "careers") return strings.inboxFormCareers;
  return strings.inboxFormContact;
}

export default async function AdminInboxPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly status?: string; readonly form?: string; readonly erase?: string }>;
}) {
  await requireAdminUser("inbox");
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  const query = await searchParams;
  const status: SubmissionStatus | "all" = query.status === "handled" || query.status === "spam" || query.status === "new" ? query.status : "all";
  const formFilter = query.form === "newsletter" || query.form === "careers" || query.form === "contact" ? query.form : "all";

  /*
    คำขอใช้สิทธิ์ (ลบข้อมูลของอีเมลนี้) — อ่านจาก query string
    ⚠️ ขั้นนี้ **อ่านล้วน** (นับว่าจะลบอะไร) · การลบจริงเกิดใน server action หลังผ่านการตรวจ 3 ด่าน
  */
  const eraseEmail = (query.erase ?? "").trim();
  const eraseCheckOk = eraseEmail !== "" && isPlausibleEmail(eraseEmail);
  const eraseDbMissing = !isDatabaseConfigured();
  const preview = eraseCheckOk && !eraseDbMissing ? await erasurePreview(eraseEmail) : null;

  const rows = await listSubmissions({ status, form: formFilter, limit: 100 });
  const counts = await countSubmissionsByStatus();

  /* ไฟล์แนบ (เรซูเม่) แยกอ่านต่อแถว — มีเฉพาะใบสมัครงาน */
  const attachments = new Map<number, Awaited<ReturnType<typeof listAttachments>>>();
  for (const row of rows) {
    if (row.form !== "careers") continue;
    attachments.set(row.id, await listAttachments(row.id));
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fg text-2xl font-bold">{strings.inboxTitle}</h1>
        <p className="text-fg-muted text-sm">{strings.inboxHint}</p>
        <p className="text-fg-muted text-xs">
          {fillTemplate(strings.inboxCounts, { n: counts.new, h: counts.handled, s: counts.spam })}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => {
          const active = filter.key === status;
          return (
            <Link
              key={filter.key}
              href={filter.key === "all" ? "/admin/inbox" : `/admin/inbox?status=${filter.key}`}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "bg-brand-red text-on-brand rounded-lg px-3 py-1.5 text-xs font-semibold"
                  : `${BUTTON_CLASS} text-xs`
              }
            >
              {strings[filter.labelKey]}
            </Link>
          );
        })}

        {/* เปิดแท็บใหม่ = ให้เบราว์เซอร์ดาวน์โหลดจริง (ไม่ใช่การนำทางฝั่ง client) */}
        <Link href="/admin/inbox/export" prefetch={false} target="_blank" rel="noreferrer" className={`${BUTTON_CLASS} ml-auto`}>
          {strings.inboxExport}
        </Link>
      </div>

      <p className="text-fg-muted text-xs">{strings.inboxRetentionNote}</p>

      {rows.length === 0 ? (
        <p className="border-line bg-surface text-fg-muted rounded-2xl border p-5 text-sm">{strings.inboxEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="bg-surface-raised text-fg rounded-lg px-2 py-0.5 font-semibold">{formLabel(strings, row.form)}</span>
                <span className={row.status === "new" ? "text-brand-red font-semibold" : "text-fg-muted"}>
                  {row.status === "new" ? strings.inboxFilterNew : row.status === "handled" ? strings.inboxFilterHandled : strings.inboxFilterSpam}
                </span>
                <span className="text-fg-muted font-mono">#{row.id}</span>
                <span className="text-fg-muted ml-auto">{row.createdAt.slice(0, 16).replace("T", " ")}</span>
              </div>

              <div className="text-fg flex flex-col gap-0.5 text-sm">
                <span className="font-semibold">{row.name === "" ? row.email : row.name}</span>
                <span className="text-fg-muted text-xs">
                  {strings.inboxContactInfo}: {row.email}
                  {row.phone === "" ? "" : ` · ${row.phone}`}
                </span>
                {row.topic === "" ? null : <span className="text-fg-muted text-xs">{row.topic}</span>}
              </div>

              {row.subject === "" ? null : <p className="text-fg text-sm font-semibold">{row.subject}</p>}
              {row.message === "" ? null : <p className="text-fg-muted text-sm whitespace-pre-line">{row.message}</p>}

              {(attachments.get(row.id) ?? []).length === 0 ? null : (
                <div className="flex flex-col gap-1">
                  <p className="text-fg-muted text-xs font-semibold">{strings.inboxAttachment}</p>
                  <ul className="flex flex-wrap gap-2">
                    {(attachments.get(row.id) ?? []).map((file) => (
                      <li key={file.id}>
                        <Link
                          href={`/admin/inbox/${file.id}/attachment`}
                          prefetch={false}
                          target="_blank"
                          rel="noreferrer"
                          className={BUTTON_CLASS}
                        >
                          {strings.inboxDownload} {file.filename} ({formatBytes(file.sizeBytes)})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {row.consent ? null : <p className="text-brand-red text-xs font-semibold">{strings.inboxNoConsent}</p>}
              {row.handledBy === null ? null : (
                <p className="text-fg-muted text-xs">
                  {strings.inboxHandledBy}: {row.handledBy}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {row.status === "handled" ? (
                  <form action={setSubmissionStatusAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="status" value="new" />
                    <button type="submit" className={BUTTON_CLASS}>
                      {strings.inboxMarkNew}
                    </button>
                  </form>
                ) : (
                  <form action={setSubmissionStatusAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="status" value="handled" />
                    <button type="submit" className={BUTTON_CLASS}>
                      {strings.inboxMarkHandled}
                    </button>
                  </form>
                )}

                {row.status === "spam" ? null : (
                  <form action={setSubmissionStatusAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="status" value="spam" />
                    <button type="submit" className={BUTTON_CLASS}>
                      {strings.inboxMarkSpam}
                    </button>
                  </form>
                )}

                <form action={deleteSubmissionAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <button type="submit" title={strings.inboxDeleteConfirm} className={`${BUTTON_CLASS} text-brand-red`}>
                    {strings.inboxDelete}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/*
        คำขอใช้สิทธิ์: ลบข้อมูลของอีเมลนี้ (PDPA · รอบที่ 77)
        สองจังหวะโดยตั้งใจ: (1) กรอกอีเมล → เห็นว่าจะลบอะไร (อ่านล้วน ไม่แก้อะไร)
                          (2) พิมพ์อีเมลซ้ำ + ติ๊กยืนยันตัวตน → จึงลบจริง
        ใช้ <form method="get"> ของเบราว์เซอร์ล้วน ๆ (ไม่มี JS) ⇒ ทำงานได้ทุกเครื่อง
      */}
      <section className="border-line bg-surface mt-4 flex flex-col gap-3 rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-brand-red text-sm font-semibold">{strings.eraseTitle}</h2>
          <p className="text-fg-muted text-xs">{strings.eraseHint}</p>
        </div>

        <div className="border-line bg-bg-subtle flex flex-col gap-1 rounded-xl border p-3">
          <p className="text-fg text-xs font-semibold">{strings.eraseProcedureTitle}</p>
          <p className="text-fg-muted text-xs">{strings.eraseProcedure1}</p>
          <p className="text-fg-muted text-xs">{strings.eraseProcedure2}</p>
          <p className="text-fg-muted text-xs">{strings.eraseProcedure3}</p>
        </div>

        {eraseDbMissing ? (
          <p className="text-fg-muted text-xs italic">{strings.eraseDbMissing}</p>
        ) : (
          <>
            <form method="get" action="/admin/inbox" className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-fg-muted text-xs font-medium">{strings.eraseEmailLabel}</span>
                <input
                  type="email"
                  name="erase"
                  required
                  defaultValue={eraseEmail}
                  placeholder={strings.eraseEmailPlaceholder}
                  className="border-line bg-bg text-fg focus-visible:ring-ring w-72 rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                />
              </label>
              <button type="submit" className={BUTTON_CLASS}>
                {strings.eraseCheck}
              </button>
            </form>

            {eraseEmail !== "" ? (
              eraseCheckOk && preview !== null ? (
                <div className="border-line flex flex-col gap-3 rounded-xl border p-4">
                  <p className="text-fg text-sm font-semibold">{strings.erasePreviewTitle}</p>

                  {erasureIsEmpty(preview.counts) ? (
                    <p className="text-fg-muted text-sm">{strings.eraseNothingFound}</p>
                  ) : (
                    <>
                      <p className="text-fg text-sm">
                        {fillTemplate(strings.eraseWillDelete, {
                          total: erasureTotal(preview.counts),
                          contact: preview.counts.contact,
                          newsletter: preview.counts.newsletter,
                          careers: preview.counts.careers,
                          attachments: preview.counts.attachments,
                        })}
                      </p>
                      <p className="text-fg-muted text-xs">
                        {fillTemplate(strings.eraseWillKeep, { attempts: preview.keptLoginAttempts })}
                      </p>

                      <form action={eraseSubjectAction} className="flex flex-col gap-3">
                        <input type="hidden" name="email" value={eraseEmail} />

                        <label className="flex flex-col gap-1">
                          <span className="text-fg-muted text-xs font-medium">{strings.eraseConfirmLabel}</span>
                          <input
                            type="email"
                            name="confirmEmail"
                            required
                            placeholder={strings.eraseConfirmPlaceholder}
                            className="border-line bg-bg text-fg focus-visible:ring-ring w-72 rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                          />
                        </label>

                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="verified" required className="h-4 w-4" />
                          <span className="text-fg text-xs">{strings.eraseVerifiedLabel}</span>
                        </label>

                        <button type="submit" className={`${BUTTON_CLASS} text-brand-red self-start`}>
                          {strings.eraseSubmit}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-brand-red text-xs font-semibold">
                  {eraseCheckOk ? strings.eraseNothingFound : strings.eraseInvalidEmail}
                </p>
              )
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

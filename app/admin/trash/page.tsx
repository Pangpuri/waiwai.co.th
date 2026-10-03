import Link from "next/link";

import { EmptyTrashForm, PurgeTrashForm, TrashTable, type TrashRow, type TrashStrings } from "@/features/admin/ui/trash-list";
import { requireAdminUser } from "@/lib/auth/dal";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { formatBytes } from "@/lib/format/bytes";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";
import { describeRetention } from "@/lib/retention/format";
import { TRASH_RETENTION_DAYS } from "@/lib/retention/plan";
import { daysLeftInTrash } from "@/lib/trash/plan";
import { listTrash, trashStats, type TrashEntry } from "@/lib/trash/repository";

/**
 * ถังขยะ (X2.4 · รอบที่ 78) — ที่พักของสิ่งที่ "ลบ" จากคลังภาพ/พรีเซ็ต
 *
 * ทำไมต้องมี
 * - ก่อนหน้านี้การลบทุกจุดเป็น **ลบถาวรทันที** ⇒ ผู้ใช้ที่ไม่ได้เป็นช่างเทคนิคเผลอกดลบ = ข้อมูลหายถาวร
 * - หน้านี้ให้ "กู้คืน" และ "ลบถาวร" ด้วยการกดครั้งเดียว พร้อมบอกว่าเหลือเวลาอีกกี่วันก่อนระบบลบให้เอง
 *
 * ⚠️ ต้องล็อกอินก่อนเสมอ (`requireAdminUser()`) — ของในถังยังเป็นข้อมูลของบริษัท
 * ⚠️ ตัวเลขระยะเก็บดึงจาก `lib/retention/plan.ts` (ห้ามพิมพ์จำนวนวันในหน้านี้)
 */
export default async function AdminTrashPage() {
  await requireAdminUser();
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  const configured = isDatabaseConfigured();
  const entries: readonly TrashEntry[] = configured ? await listTrash() : [];
  const stats = configured ? await trashStats() : { media: 0, preset: 0, total: 0 };

  const now = new Date();
  const rows: TrashRow[] = entries.map((entry) => ({
    kind: entry.kind,
    id: entry.id,
    label: entry.label,
    detail: entry.detail,
    sizeLabel: entry.sizeBytes === null ? null : formatBytes(entry.sizeBytes),
    deletedAt: entry.deletedAt,
    deletedBy: entry.deletedBy,
    daysLeft: daysLeftInTrash(entry.deletedAt, now),
  }));

  const trashStrings: TrashStrings = {
    trashColItem: strings.trashColItem,
    trashColKind: strings.trashColKind,
    trashColDeletedAt: strings.trashColDeletedAt,
    trashColDeletedBy: strings.trashColDeletedBy,
    trashColExpiry: strings.trashColExpiry,
    trashColActions: strings.trashColActions,
    trashKindMedia: strings.trashKindMedia,
    trashKindPreset: strings.trashKindPreset,
    trashDaysLeft: strings.trashDaysLeft,
    trashDueNow: strings.trashDueNow,
    trashRestore: strings.trashRestore,
    trashRestoreDone: strings.trashRestoreDone,
    trashDeleteForever: strings.trashDeleteForever,
    trashDeleteForeverDone: strings.trashDeleteForeverDone,
    trashDeleteForeverWarning: strings.trashDeleteForeverWarning,
    trashEmptyAction: strings.trashEmptyAction,
    trashConfirmEmpty: strings.trashConfirmEmpty,
    trashEmptyDone: strings.trashEmptyDone,
    trashNotFound: strings.trashNotFound,
    trashNoPreview: strings.trashNoPreview,
    trashPurgeNow: strings.trashPurgeNow,
    trashDbMissing: strings.trashDbMissing,
  };

  /* วันที่อ่านง่ายจากค่ากลาง: "30 วัน" — เอกสารกับของจริงหลุดจากกันไม่ได้ */
  const retentionLabel = describeRetention(TRASH_RETENTION_DAYS, "th");

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fg text-2xl font-bold">{strings.trashTitle}</h1>
        <p className="text-fg-muted text-sm">{strings.trashHint}</p>
        <p className="text-fg-muted text-xs">{fillTemplate(strings.trashRetentionNote, { days: retentionLabel })}</p>
      </header>

      {configured ? null : (
        <p className="border-line bg-surface text-brand-red rounded-2xl border p-5 text-sm">{strings.trashDbMissing}</p>
      )}

      {configured ? (
        <>
          <p className="text-fg-muted text-xs">
            {fillTemplate(strings.trashStats, { media: stats.media, preset: stats.preset })}
          </p>

          {rows.length === 0 ? (
            <p className="border-line bg-surface text-fg-muted rounded-2xl border p-5 text-sm">{strings.trashEmpty}</p>
          ) : (
            <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-4">
              <TrashTable rows={rows} strings={trashStrings} label={strings.trashListLabel} />
              <div className="border-line flex flex-col gap-2 border-t pt-3">
                <EmptyTrashForm strings={trashStrings} />
                <PurgeTrashForm strings={trashStrings} />
                <p className="text-fg-muted text-[11px]">{strings.trashPurgeHint}</p>
              </div>
            </section>
          )}

          <Link
            href="/admin/media"
            className="text-link focus-visible:ring-ring w-fit text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.trashBackToMedia}
          </Link>
        </>
      ) : null}
    </main>
  );
}

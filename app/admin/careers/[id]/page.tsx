import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadJobPostingForAdmin } from "@/lib/careers/repository";
import { loadEntityRevision, listEntityRevisions } from "@/lib/revisions/repository";
import { jobSnapshotOf, revisionDiff } from "@/lib/revisions/model";
import { RevisionHistoryPanel } from "@/features/admin/ui/revision-history";
import { restoreJobRevisionAction } from "@/app/admin/careers/actions";
import { buildBoard } from "@/features/careers/board";
import { JobForm } from "@/features/admin/ui/job-form";

/**
 * หลังบ้าน — แก้ "ประกาศรับสมัครงาน" 1 ใบ (รอบที่ 265 · มติ D26)
 *
 * - ประกาศในถังขยะ: **แก้ไม่ได้** (ต้องกู้คืนก่อน) — บอกผู้ใช้ตรง ๆ ไม่ปล่อยฟอร์มที่กดบันทึกไม่ติด
 * - กด "เผยแพร่" = ขึ้นเว็บทันที (`refreshPublicSite("page")` ใน action) · "ฉบับร่าง" = ยังไม่ขึ้นเว็บ
 * - พรีวิวใช้ `JobBoard` ตัวเดียวกับหน้า /careers ⇒ "สิ่งที่เห็น = สิ่งที่ขึ้นเว็บ"
 */
export default async function AdminCareerEditPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.adminCareers;

  const { id } = await params;
  const posting = await loadJobPostingForAdmin(decodeURIComponent(id));
  if (posting === null) notFound();

  /* ── ประวัติรุ่น (รอบที่ 278 · ปิดหนี้ D-265-3) — แม่แบบเดียวกับสินค้า/เมนู/ข่าว ── */
  const revisionParam = (await searchParams).revision;
  const selectedRevisionId = typeof revisionParam === "string" ? revisionParam : "";
  const currentSnapshot = jobSnapshotOf(posting);
  const revisions = await listEntityRevisions({ kind: "job", entityId: posting.id, current: currentSnapshot });
  const selectedSnapshot =
    selectedRevisionId === ""
      ? null
      : await loadEntityRevision({ kind: "job", entityId: posting.id, revisionId: selectedRevisionId });
  const selectedRevision = selectedSnapshot === null ? null : (revisions.find((item) => item.id === selectedRevisionId) ?? null);
  const revisionChanges = selectedSnapshot === null ? [] : revisionDiff(selectedSnapshot, currentSnapshot);

  const board = buildBoard(messages);

  return (
    <main className="container-site py-10">
      <p className="text-fg-muted text-sm">
        <Link href="/admin/careers" className="text-link underline underline-offset-4">
          {m.backToList}
        </Link>
      </p>
      <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">{posting.titleTh}</h1>
      <p className="text-fg-muted mt-1 text-sm">
        {m.editHint} · <span className="font-mono text-xs">{posting.id}</span>
      </p>
      <p className="text-fg-muted mt-2 text-xs">
        {m.fieldStatus}: {posting.status === "draft" ? m.statusDraft : m.statusPublished}
        {posting.deletedAt === null ? "" : ` · ${m.tabTrash}`}
      </p>

      <div className="mt-6">
        <JobForm
          mode="edit"
          strings={m}
          boardLabels={board.labels}
          filterAll={messages.careersPage.filterAll}
          genderLabels={messages.careersPage.genders}
          trashed={posting.deletedAt !== null}
          values={{
            id: posting.id,
            titleTh: posting.titleTh,
            titleEn: posting.titleEn,
            departmentTh: posting.departmentTh,
            departmentEn: posting.departmentEn,
            openings: posting.openings,
            gender: posting.gender,
            ageTh: posting.ageTh,
            ageEn: posting.ageEn,
            qualificationsTh: posting.qualificationsTh,
            qualificationsEn: posting.qualificationsEn,
            experienceTh: posting.experienceTh,
            experienceEn: posting.experienceEn,
            sortOrder: posting.sortOrder,
            status: posting.status,
          }}
        />
      </div>

      <RevisionHistoryPanel
        strings={messages.admin}
        revisions={revisions.map((item) => ({
          id: item.id,
          revision: item.revision,
          note: item.note,
          createdBy: item.createdBy,
          createdLocal: item.createdLocal,
          changeCount: item.changeCount,
          isCurrent: item.isCurrent,
        }))}
        selected={selectedRevision}
        changes={revisionChanges}
        restoreAction={restoreJobRevisionAction}
        entityId={posting.id}
        basePath={`/admin/careers/${posting.id}`}
      />
    </main>
  );
}

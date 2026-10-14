import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadJobPostingForAdmin } from "@/lib/careers/repository";
import { buildBoard } from "@/features/careers/board";
import { JobForm } from "@/features/admin/ui/job-form";

/**
 * หลังบ้าน — แก้ "ประกาศรับสมัครงาน" 1 ใบ (รอบที่ 265 · มติ D26)
 *
 * - ประกาศในถังขยะ: **แก้ไม่ได้** (ต้องกู้คืนก่อน) — บอกผู้ใช้ตรง ๆ ไม่ปล่อยฟอร์มที่กดบันทึกไม่ติด
 * - กด "เผยแพร่" = ขึ้นเว็บทันที (`refreshPublicSite("page")` ใน action) · "ฉบับร่าง" = ยังไม่ขึ้นเว็บ
 * - พรีวิวใช้ `JobBoard` ตัวเดียวกับหน้า /careers ⇒ "สิ่งที่เห็น = สิ่งที่ขึ้นเว็บ"
 */
export default async function AdminCareerEditPage({ params }: { readonly params: Promise<{ readonly id: string }> }) {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.adminCareers;

  const { id } = await params;
  const posting = await loadJobPostingForAdmin(decodeURIComponent(id));
  if (posting === null) notFound();

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
    </main>
  );
}

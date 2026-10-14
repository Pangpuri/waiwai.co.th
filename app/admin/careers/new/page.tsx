import Link from "next/link";

import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { nextJobSortOrder } from "@/lib/careers/model";
import { listJobPostingsForAdmin } from "@/lib/careers/repository";
import { buildBoard } from "@/features/careers/board";
import { JobForm } from "@/features/admin/ui/job-form";

/**
 * หลังบ้าน — "เพิ่มประกาศรับสมัครงาน" (รอบที่ 265 · มติ D26 ข้อ 5)
 *
 * - ประกาศใหม่ = **ฉบับร่างเสมอ** (ยังไม่ขึ้นเว็บจนกดเผยแพร่ในหน้าแก้)
 * - รหัสออกที่เซิร์ฟเวอร์ (`j<เวลา>`) — ไม่รับจากฟอร์ม (เหมือนสินค้า/หมวดสินค้า)
 * - ลำดับเริ่มต้น = "ต่อท้ายของเดิม" (`nextJobSortOrder`)
 * - พรีวิวใช้ `JobBoard` ตัวเดียวกับหน้า /careers (ส่งเฉพาะป้ายข้อความที่ใช้จริง)
 */
export default async function AdminCareerNewPage() {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.adminCareers;

  const rows = await listJobPostingsForAdmin();
  const active = rows.filter((row) => row.deletedAt === null);
  const sortOrder = nextJobSortOrder(active.map((row) => ({ id: row.id, sortOrder: row.sortOrder })));
  const board = buildBoard(messages);

  return (
    <main className="container-site py-10">
      <p className="text-fg-muted text-sm">
        <Link href="/admin/careers" className="text-link underline underline-offset-4">
          {m.backToList}
        </Link>
      </p>
      <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">{m.newTitle}</h1>
      <p className="text-fg-muted mt-1 text-sm">{m.newHint}</p>

      <div className="mt-6">
        <JobForm
          mode="create"
          strings={m}
          boardLabels={board.labels}
          filterAll={messages.careersPage.filterAll}
          genderLabels={messages.careersPage.genders}
          trashed={false}
          values={{
            id: "",
            titleTh: "",
            titleEn: "",
            departmentTh: "",
            departmentEn: "",
            openings: 1,
            gender: "",
            ageTh: "",
            ageEn: "",
            qualificationsTh: "",
            qualificationsEn: "",
            experienceTh: "",
            experienceEn: "",
            sortOrder,
            status: "draft",
          }}
        />
      </div>
    </main>
  );
}

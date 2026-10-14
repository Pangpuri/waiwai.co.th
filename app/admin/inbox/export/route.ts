import { requireAdminUser } from "@/lib/auth/dal";
import { toCsv, type CsvColumn } from "@/lib/forms/csv";
import { listSubmissions, type SubmissionRow } from "@/lib/forms/repository";
import { jobTitle, jobTitleByTopic } from "@/lib/careers/model";
import { listJobPostingsForAdmin } from "@/lib/careers/repository";

/**
 * ดาวน์โหลดผู้ติดต่อเป็น CSV (X1.9)
 *
 * ⚠️ ข้อมูลส่วนบุคคล ⇒ ต้องล็อกอินก่อนเสมอ (ไม่ใช่เส้นทางสาธารณะ)
 * ⚠️ ตั้ง `no-store` + `noindex` และแนบชื่อไฟล์แบบ ASCII (HTTP header ใส่ภาษาไทยไม่ได้ — บทเรียนรอบที่ 38)
 */

/**
 * คอลัมน์ CSV — เป็นฟังก์ชันเพราะต้องใช้พจนานุกรม id → ชื่อตำแหน่ง (แปลงค่า `topic` เก่า)
 * ⚠️ ห้ามอ่าน DB ในระดับโมดูล (ต้องรันตอนมีคำขอเท่านั้น — เทสต์/บิลด์ต้องไม่ต่อ DB)
 */
function columnsOf(jobTitlesById: ReadonlyMap<string, string>): readonly CsvColumn<SubmissionRow>[] {
  return [
  { header: "id", value: (row) => String(row.id) },
  { header: "form", value: (row) => row.form },
  { header: "created_at", value: (row) => row.createdAt },
  { header: "status", value: (row) => row.status },
  { header: "name", value: (row) => row.name },
  { header: "email", value: (row) => row.email },
  { header: "phone", value: (row) => row.phone },
  /*
    รอบที่ 276 (ปิดหนี้ D-265-2): ใบสมัครใหม่เก็บ "ชื่อตำแหน่ง" แล้ว · ใบเก่าเก็บรหัส
    ⇒ แปลงเป็นชื่อก่อนเขียน CSV เพื่อให้เจ้าหน้าที่อ่านรู้เรื่อง (หาไม่เจอ = ค่าเดิม)
  */
  { header: "topic", value: (row) => jobTitleByTopic(row.topic, jobTitlesById) },
  { header: "subject", value: (row) => row.subject },
  { header: "message", value: (row) => row.message },
  { header: "consent", value: (row) => (row.consent ? "yes" : "no") },
  { header: "handled_by", value: (row) => row.handledBy ?? "" },
  ];
}

/** พจนานุกรม id → ชื่อตำแหน่ง (สำหรับแปลงค่าเก่าในใบสมัคร — รอบที่ 276) */
async function loadJobTitlesById(): Promise<ReadonlyMap<string, string>> {
  const postings = await listJobPostingsForAdmin();
  return new Map(
    postings.map((posting) => {
      const th = jobTitle(posting, "th").trim();
      return [posting.id, th === "" ? jobTitle(posting, "en") : th] as const;
    }),
  );
}

export async function GET(): Promise<Response> {
  await requireAdminUser("inbox");

  const rows = await listSubmissions({ limit: 500 });
  const csv = toCsv(rows, columnsOf(await loadJobTitlesById()));
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="waiwai-contacts-${stamp}.csv"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
      "x-content-type-options": "nosniff",
    },
  });
}

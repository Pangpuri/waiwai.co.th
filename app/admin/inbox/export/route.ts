import { requireAdminUser } from "@/lib/auth/dal";
import { toCsv, type CsvColumn } from "@/lib/forms/csv";
import { listSubmissions, type SubmissionRow } from "@/lib/forms/repository";

/**
 * ดาวน์โหลดผู้ติดต่อเป็น CSV (X1.9)
 *
 * ⚠️ ข้อมูลส่วนบุคคล ⇒ ต้องล็อกอินก่อนเสมอ (ไม่ใช่เส้นทางสาธารณะ)
 * ⚠️ ตั้ง `no-store` + `noindex` และแนบชื่อไฟล์แบบ ASCII (HTTP header ใส่ภาษาไทยไม่ได้ — บทเรียนรอบที่ 38)
 */

const COLUMNS: readonly CsvColumn<SubmissionRow>[] = [
  { header: "id", value: (row) => String(row.id) },
  { header: "form", value: (row) => row.form },
  { header: "created_at", value: (row) => row.createdAt },
  { header: "status", value: (row) => row.status },
  { header: "name", value: (row) => row.name },
  { header: "email", value: (row) => row.email },
  { header: "phone", value: (row) => row.phone },
  { header: "topic", value: (row) => row.topic },
  { header: "subject", value: (row) => row.subject },
  { header: "message", value: (row) => row.message },
  { header: "consent", value: (row) => (row.consent ? "yes" : "no") },
  { header: "handled_by", value: (row) => row.handledBy ?? "" },
];

export async function GET(): Promise<Response> {
  await requireAdminUser("inbox");

  const rows = await listSubmissions({ limit: 500 });
  const csv = toCsv(rows, COLUMNS);
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

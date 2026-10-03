import { getPool } from "@/db/pool";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { SUBMISSION_WINDOW_MS, type FormKind, type SubmissionDraft } from "@/lib/forms/model";

/**
 * อ่าน/เขียน "ผู้ติดต่อ" (X1.9) — มติผู้ใช้ รอบที่ 64: เก็บลงฐานข้อมูลจริง
 *
 * ⚠️ PDPA: ข้อมูลส่วนบุคคล ⇒ หน้ารายการต้องล็อกอินเท่านั้น (ทุกฟังก์ชันในไฟล์นี้ถูกเรียกจากหลังบ้าน/action ที่ตรวจสิทธิ์แล้ว)
 *    · ต้องมีระยะเก็บ + วิธีลบ (หนี้ X2b — มี `deleteSubmission` ไว้ให้ใช้แล้ว)
 */

export type SubmissionStatus = "new" | "handled" | "spam";

export type SubmissionRow = {
  readonly id: number;
  readonly form: FormKind;
  readonly email: string;
  readonly name: string;
  readonly phone: string;
  readonly topic: string;
  readonly subject: string;
  readonly message: string;
  readonly status: SubmissionStatus;
  readonly consent: boolean;
  readonly createdAt: string;
  readonly handledAt: string | null;
  readonly handledBy: string | null;
};

type RawRow = {
  readonly id: string | number;
  readonly form: string;
  readonly email: string;
  readonly name: string;
  readonly phone: string;
  readonly topic: string;
  readonly subject: string;
  readonly message: string;
  readonly status: string;
  readonly consent: boolean;
  readonly created_at: Date;
  readonly handled_at: Date | null;
  readonly handled_by: string | null;
};

const SELECT_COLUMNS = "id, form, email, name, phone, topic, subject, message, status, consent, created_at, handled_at, handled_by";

function toRow(row: RawRow): SubmissionRow {
  const status: SubmissionStatus = row.status === "handled" || row.status === "spam" ? row.status : "new";
  const form: FormKind = row.form === "newsletter" || row.form === "careers" ? row.form : "contact";

  return {
    id: typeof row.id === "number" ? row.id : Number.parseInt(row.id, 10),
    form,
    email: row.email,
    name: row.name,
    phone: row.phone,
    topic: row.topic,
    subject: row.subject,
    message: row.message,
    status,
    consent: row.consent === true,
    createdAt: new Date(row.created_at).toISOString(),
    handledAt: row.handled_at === null ? null : new Date(row.handled_at).toISOString(),
    handledBy: row.handled_by,
  };
}

/** บันทึกผู้ติดต่อใหม่ (คืน id) — เรียกจาก action ที่ตรวจ/จำกัดความถี่แล้ว */
export async function insertSubmission(draft: SubmissionDraft, spam: boolean): Promise<number> {
  const { rows } = await getPool().query<{ id: string }>(
    `insert into form_submission (form, email, name, phone, topic, subject, message, payload, consent, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     returning id`,
    [
      draft.form,
      draft.email,
      draft.name,
      draft.phone,
      draft.topic,
      draft.subject,
      draft.message,
      JSON.stringify(draft.payload),
      draft.consent,
      spam ? "spam" : "new",
    ],
  );
  return Number.parseInt(rows[0]?.id ?? "0", 10);
}

/** เวลาที่อีเมลนี้ส่งล่าสุด (ใช้จำกัดความถี่) */
export async function recentSubmissionTimes(email: string): Promise<readonly number[]> {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await getPool().query<{ created_at: Date }>(
    `select created_at from form_submission
      where lower(email) = lower($1) and created_at > now() - ($2 || ' milliseconds')::interval
      order by created_at desc
      limit 50`,
    [email, String(SUBMISSION_WINDOW_MS)],
  );
  return rows.map((row) => new Date(row.created_at).getTime());
}

export async function listSubmissions(options: {
  readonly status?: SubmissionStatus | "all";
  readonly form?: FormKind | "all";
  readonly limit?: number;
}): Promise<readonly SubmissionRow[]> {
  if (!isDatabaseConfigured()) return [];

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (options.status !== undefined && options.status !== "all") {
    values.push(options.status);
    conditions.push(`status = $${values.length}`);
  }
  if (options.form !== undefined && options.form !== "all") {
    values.push(options.form);
    conditions.push(`form = $${values.length}`);
  }

  values.push(Math.max(1, Math.min(options.limit ?? 100, 500)));
  const where = conditions.length === 0 ? "" : `where ${conditions.join(" and ")}`;

  const { rows } = await getPool().query<RawRow>(
    `select ${SELECT_COLUMNS} from form_submission ${where} order by created_at desc limit $${values.length}`,
    values,
  );
  return rows.map((row) => toRow(row));
}

export async function countSubmissionsByStatus(): Promise<Readonly<Record<SubmissionStatus, number>>> {
  const empty: Record<SubmissionStatus, number> = { new: 0, handled: 0, spam: 0 };
  if (!isDatabaseConfigured()) return empty;

  const { rows } = await getPool().query<{ status: string; total: string }>(
    "select status, count(*)::text as total from form_submission group by status",
  );
  for (const row of rows) {
    if (row.status === "new" || row.status === "handled" || row.status === "spam") {
      empty[row.status] = Number.parseInt(row.total, 10);
    }
  }
  return empty;
}

export async function setSubmissionStatus(id: number, status: SubmissionStatus, actor: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `update form_submission
        set status = $2,
            handled_at = case when $2 = 'new' then null else now() end,
            handled_by = case when $2 = 'new' then null else $3 end
      where id = $1`,
    [id, status, actor.slice(0, 200)],
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteSubmission(id: number): Promise<boolean> {
  const { rowCount } = await getPool().query("delete from form_submission where id = $1", [id]);
  return (rowCount ?? 0) > 0;
}

export async function findSubmission(id: number): Promise<SubmissionRow | null> {
  if (!isDatabaseConfigured()) return null;
  const { rows } = await getPool().query<RawRow>(`select ${SELECT_COLUMNS} from form_submission where id = $1`, [id]);
  const row = rows[0];
  return row === undefined ? null : toRow(row);
}

/* ── ไฟล์แนบ (เรซูเม่) ─────────────────────────────────────────────────────── */

export type AttachmentRow = {
  readonly id: number;
  readonly submissionId: number;
  readonly filename: string;
  readonly mime: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
};

export type AttachmentFile = AttachmentRow & { readonly data: Uint8Array };

/** แนบไฟล์กับใบสมัคร (เรียกหลัง `insertSubmission` สำเร็จ — อยู่ในธุรกรรมเดียวกันได้) */
export async function insertAttachment(
  submissionId: number,
  file: { readonly filename: string; readonly mime: string; readonly sizeBytes: number; readonly data: Uint8Array },
): Promise<number> {
  const { rows } = await getPool().query<{ id: string }>(
    `insert into form_attachment (submission_id, filename, mime, size_bytes, data)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [submissionId, file.filename, file.mime, file.sizeBytes, Buffer.from(file.data)],
  );
  return Number.parseInt(rows[0]?.id ?? "0", 10);
}

/** รายการไฟล์แนบของใบสมัคร (ไม่ดึงไบต์ — ใช้แสดงชื่อ/ขนาด) */
export async function listAttachments(submissionId: number): Promise<readonly AttachmentRow[]> {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await getPool().query<{
    id: string;
    submission_id: string;
    filename: string;
    mime: string;
    size_bytes: number;
    created_at: Date;
  }>(
    `select id, submission_id, filename, mime, size_bytes, created_at
       from form_attachment where submission_id = $1 order by id`,
    [submissionId],
  );

  return rows.map((row) => ({
    id: Number.parseInt(row.id, 10),
    submissionId: Number.parseInt(row.submission_id, 10),
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

/** ดึงไฟล์พร้อมไบต์ (สำหรับเส้นทางดาวน์โหลดหลังบ้าน) */
export async function findAttachment(id: number): Promise<AttachmentFile | null> {
  if (!isDatabaseConfigured()) return null;
  const { rows } = await getPool().query<{
    id: string;
    submission_id: string;
    filename: string;
    mime: string;
    size_bytes: number;
    created_at: Date;
    data: Buffer;
  }>(
    `select id, submission_id, filename, mime, size_bytes, created_at, data from form_attachment where id = $1`,
    [id],
  );

  const row = rows[0];
  if (row === undefined) return null;

  return {
    id: Number.parseInt(row.id, 10),
    submissionId: Number.parseInt(row.submission_id, 10),
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    createdAt: new Date(row.created_at).toISOString(),
    data: new Uint8Array(row.data),
  };
}

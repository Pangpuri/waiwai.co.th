import { getPool, isDatabaseConfigured } from "@/db/pool";
import { readQuery } from "@/lib/db/read";
import { sortJobPostings, type JobPosting } from "@/lib/careers/model";

/**
 * ชั้นข้อมูล "ประกาศรับสมัครงาน" (`job_posting`) — รอบที่ 265 · มติ D26
 *
 * แยกประตูตามบทบาท (รอบที่ 169 · least privilege)
 * - **หน้าเว็บสาธารณะ** → `readQuery()` (role อ่านอย่างเดียว) · อ่านเฉพาะที่เผยแพร่และไม่อยู่ในถัง
 * - **หลังบ้าน/ตัวนำเข้า** → `getPool()` (role หลังบ้าน) · อ่าน/เขียนได้ทุกสถานะ
 *
 * ประตูความปลอดภัย
 * - `PUBLIC_JOB_CONDITION` ต้องอยู่ใน **ทุก** คำสั่งอ่านฝั่งเว็บ (ถ้าลืมที่ใด ประกาศร่าง/ของในถังจะหลุดขึ้นเว็บ)
 * - ย้ายเข้า/กู้คืนใช้ **ประตูสองทางที่ SQL** (`trashed ? "deleted_at is null" : "deleted_at is not null"`)
 *   ⇒ กด "กู้คืน" ของที่ใช้งานอยู่ หรือ "ย้ายเข้าถัง" ซ้ำ จะไม่มีผล (ไม่ใช่แค่ซ่อนที่ UI)
 * - ลบถาวรบังคับ `deleted_at is not null` ⇒ ลบได้เฉพาะของในถัง (fail-closed)
 * - `deleted_at`/`deleted_by` เขียน/ล้างเป็นคู่กันเสมอ
 * - ไม่มี DB / อ่านพัง = คืนค่า `[]`/`null` (หน้าเว็บไม่พัง — ถอยไปใช้ข้อมูลตั้งต้นในโค้ดที่เลย์เอาต์)
 */

const JOB_COLUMNS = `id, title_th, title_en, department_th, department_en, openings, gender,
       age_th, age_en, qualifications_th, qualifications_en, experience_th, experience_en, sort_order`;

/** เงื่อนไข "ประกาศที่เว็บสาธารณะเห็นได้" — ใช้ร่วมทุกคำสั่งอ่านฝั่งเว็บ */
const PUBLIC_JOB_CONDITION = "status = 'published' and deleted_at is null";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toIsoStamp(value: unknown): string {
  /* pg คืน `timestamptz` เป็น Date — แปลงที่ชั้นข้อมูลเสมอ (บทเรียนรอบที่ 197) */
  if (value instanceof Date) return value.toISOString();
  return text(value);
}

/** แปลงแถว → ประกาศ (คืน null เมื่อแถวใช้ไม่ได้ — ไม่ปล่อยให้ค่าขยะขึ้นหน้าจอ) */
function toJobPosting(row: Record<string, unknown>): JobPosting | null {
  const id = text(row.id).trim();
  const titleTh = text(row.title_th).trim();
  if (id === "" || titleTh === "") return null;

  const openings = Number(row.openings);
  return {
    id,
    titleTh,
    titleEn: text(row.title_en),
    departmentTh: text(row.department_th),
    departmentEn: text(row.department_en),
    openings: Number.isFinite(openings) && openings > 0 ? Math.floor(openings) : 0,
    gender: text(row.gender),
    ageTh: text(row.age_th),
    ageEn: text(row.age_en),
    qualificationsTh: text(row.qualifications_th),
    qualificationsEn: text(row.qualifications_en),
    experienceTh: text(row.experience_th),
    experienceEn: text(row.experience_en),
    sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
  };
}

/* ── ฝั่งเว็บสาธารณะ ───────────────────────────────────────────────────────── */

/** ประกาศที่ขึ้นเว็บแล้ว (เรียงตามลำดับ) — ไม่มี DB/พัง = `[]` */
export async function listJobPostings(): Promise<readonly JobPosting[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await readQuery<Record<string, unknown>>(
      `select ${JOB_COLUMNS} from job_posting
        where ${PUBLIC_JOB_CONDITION}
        order by sort_order, id`,
    );
    return sortJobPostings(result.rows.map(toJobPosting).filter((row): row is JobPosting => row !== null));
  } catch {
    return [];
  }
}

/* ── ฝั่งหลังบ้าน ─────────────────────────────────────────────────────────── */

export type AdminJobPosting = JobPosting & {
  readonly status: string;
  readonly deletedAt: string | null;
  readonly deletedBy: string | null;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
};

function toAdminJobPosting(row: Record<string, unknown>): AdminJobPosting | null {
  const base = toJobPosting(row);
  if (base === null) return null;
  const deletedAt = toIsoStamp(row.deleted_at);
  return {
    ...base,
    status: text(row.status) === "published" ? "published" : "draft",
    deletedAt: deletedAt === "" ? null : deletedAt,
    deletedBy: text(row.deleted_by) === "" ? null : text(row.deleted_by),
    createdAt: toIsoStamp(row.created_at),
    createdBy: text(row.created_by),
    updatedAt: toIsoStamp(row.updated_at),
    updatedBy: text(row.updated_by),
  };
}

/** ทุกประกาศ (รวมร่าง/ในถัง) — ใช้ที่หน้าจอหลังบ้าน */
export async function listJobPostingsForAdmin(): Promise<readonly AdminJobPosting[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await getPool().query<Record<string, unknown>>(
      `select ${JOB_COLUMNS}, status, deleted_at, deleted_by, created_at, created_by, updated_at, updated_by
         from job_posting order by sort_order, id`,
    );
    return sortJobPostings(result.rows.map(toAdminJobPosting).filter((row): row is AdminJobPosting => row !== null));
  } catch {
    return [];
  }
}

export type AdminJobCounts = {
  /** ใช้งานอยู่ (ยังไม่ถูกลบ) */
  readonly active: number;
  readonly draft: number;
  readonly published: number;
  readonly trash: number;
};

export async function adminJobCounts(): Promise<AdminJobCounts> {
  const empty: AdminJobCounts = { active: 0, draft: 0, published: 0, trash: 0 };
  if (!isDatabaseConfigured()) return empty;
  try {
    const { rows } = await getPool().query<{ active: number; draft: number; published: number; trash: number }>(
      `select
         count(*) filter (where deleted_at is null)::int as active,
         count(*) filter (where deleted_at is null and status = 'draft')::int as draft,
         count(*) filter (where deleted_at is null and status = 'published')::int as published,
         count(*) filter (where deleted_at is not null)::int as trash
       from job_posting`,
    );
    return rows[0] ?? empty;
  } catch {
    return empty;
  }
}

export async function loadJobPostingForAdmin(id: string): Promise<AdminJobPosting | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const { rows } = await getPool().query<Record<string, unknown>>(
      `select ${JOB_COLUMNS}, status, deleted_at, deleted_by, created_at, created_by, updated_at, updated_by
         from job_posting where id = $1`,
      [id],
    );
    const row = rows[0];
    return row === undefined ? null : toAdminJobPosting(row);
  } catch {
    return null;
  }
}

/** รหัสทั้งหมด (ใช้คำนวณลำดับของประกาศใหม่ + ตรวจรหัสซ้ำ) */
export async function listJobPostingIds(): Promise<readonly string[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const { rows } = await getPool().query<{ id: string }>("select id from job_posting order by id");
    return rows.map((row) => row.id);
  } catch {
    return [];
  }
}

/** ข้อมูลที่ฟอร์มหลังบ้าน/ตัวนำเข้าส่งลงตาราง */
export type JobWriteInput = {
  readonly id: string;
  readonly titleTh: string;
  readonly titleEn: string;
  readonly departmentTh: string;
  readonly departmentEn: string;
  readonly openings: number;
  readonly gender: string;
  readonly ageTh: string;
  readonly ageEn: string;
  readonly qualificationsTh: string;
  readonly qualificationsEn: string;
  readonly experienceTh: string;
  readonly experienceEn: string;
  readonly sortOrder: number;
  readonly status: string;
};

const JOB_COLUMN_LIST = `id, title_th, title_en, department_th, department_en, openings, gender,
       age_th, age_en, qualifications_th, qualifications_en, experience_th, experience_en, sort_order, status`;

function jobValues(input: JobWriteInput, actor: string): unknown[] {
  return [
    input.id.trim(),
    input.titleTh.trim(),
    input.titleEn.trim(),
    input.departmentTh.trim(),
    input.departmentEn.trim(),
    input.openings,
    input.gender,
    input.ageTh.trim(),
    input.ageEn.trim(),
    input.qualificationsTh.trim(),
    input.qualificationsEn.trim(),
    input.experienceTh.trim(),
    input.experienceEn.trim(),
    input.sortOrder,
    input.status,
    actor,
  ];
}

/** ชื่อคอลัมน์ที่โหมดป้องกันต้องคงค่าเดิมไว้เมื่อ "คนอื่นแก้ล่าสุด" */
const PROTECTED_COLUMNS = [
  "title_th",
  "title_en",
  "department_th",
  "department_en",
  "openings",
  "gender",
  "age_th",
  "age_en",
  "qualifications_th",
  "qualifications_en",
  "experience_th",
  "experience_en",
  "sort_order",
  "status",
] as const;

/**
 * โหมดเขียนทับเมื่อมีแถวเดิม (แม่แบบเดียวกับสินค้า/เมนู/ข่าว — รอบที่ 140/142)
 * - `replace` — หลังบ้านใช้: ผู้ดูแลกดบันทึก = ค่าที่กรอกต้องชนะ
 * - `protect-edited` — ตัวนำเข้าใช้: แถวที่ **คนอื่นแก้ล่าสุด** ไม่ถูกทับ (รันนำเข้าซ้ำปลอดภัย)
 * ⚠️ โหมดป้องกันต้องคง `updated_at`/`updated_by` เดิมด้วย ไม่งั้นการนำเข้าครั้งที่ 2 จะทับงานคน
 */
export type JobWriteMode = "replace" | "protect-edited";

const PROTECTED_EDIT_CONDITION = "job_posting.updated_by is distinct from excluded.updated_by";

function guarded(mode: JobWriteMode, column: string): string {
  if (mode !== "protect-edited") return `excluded.${column}`;
  return `case when ${PROTECTED_EDIT_CONDITION} then job_posting.${column} else excluded.${column} end`;
}

export type JobUpsertResult = {
  readonly created: boolean;
  readonly protectedEdit: boolean;
};

/** เพิ่ม/เขียนทับประกาศ (ตัวนำเข้าใช้โหมด `protect-edited` · หลังบ้านใช้ `replace`) */
export async function upsertJobPosting(
  input: JobWriteInput,
  actor: string,
  mode: JobWriteMode = "replace",
): Promise<JobUpsertResult> {
  const assignments = PROTECTED_COLUMNS.map((column) => `${column} = ${guarded(mode, column)}`).join(", ");
  const updatedAt = mode === "protect-edited" ? `case when ${PROTECTED_EDIT_CONDITION} then job_posting.updated_at else now() end` : "now()";
  const updatedBy = mode === "protect-edited" ? `case when ${PROTECTED_EDIT_CONDITION} then job_posting.updated_by else excluded.updated_by end` : "excluded.updated_by";

  const result = await getPool().query<{ previous_total: number; previous_actor: string | null }>(
    `with previous as (
       select count(*)::int as total, max(updated_by) as actor from job_posting where id = $1
     ),
     upserted as (
       insert into job_posting (${JOB_COLUMN_LIST}, created_by, updated_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
       on conflict (id) do update set ${assignments}, updated_at = ${updatedAt}, updated_by = ${updatedBy}
       returning id
     )
     select previous.total as previous_total, previous.actor as previous_actor
       from previous left join upserted on true`,
    jobValues(input, actor),
  );

  const total = result.rows[0]?.previous_total ?? 0;
  const previousActor = result.rows[0]?.previous_actor ?? null;
  const created = total === 0;
  return { created, protectedEdit: !created && mode === "protect-edited" && previousActor !== actor };
}

/** เพิ่มประกาศใหม่จากหลังบ้าน — รหัสซ้ำ = ไม่ทับของเดิม (คืน false) */
export async function createJobPosting(input: JobWriteInput, actor: string): Promise<boolean> {
  const result = await getPool().query(
    `insert into job_posting (${JOB_COLUMN_LIST}, created_by, updated_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
     on conflict (id) do nothing`,
    jobValues(input, actor),
  );
  return (result.rowCount ?? 0) > 0;
}

/** บันทึกการแก้ไขประกาศ — คืน false เมื่อไม่พบรหัสนั้น (หรืออยู่ในถัง: ต้องกู้คืนก่อน) */
export async function updateJobPosting(input: JobWriteInput, actor: string): Promise<boolean> {
  const result = await getPool().query(
    `update job_posting set
        title_th = $2, title_en = $3, department_th = $4, department_en = $5, openings = $6, gender = $7,
        age_th = $8, age_en = $9, qualifications_th = $10, qualifications_en = $11,
        experience_th = $12, experience_en = $13, sort_order = $14, status = $15,
        updated_at = now(), updated_by = $16
      where id = $1 and deleted_at is null`,
    jobValues(input, actor),
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * ย้ายเข้าถังขยะ / กู้คืน — **ประตูสองทางอยู่ที่ SQL**
 * · `deleted_at`/`deleted_by` เขียนคู่กันเสมอ (กู้คืน = ล้างทั้งคู่)
 * · ของที่ใช้งานอยู่กด "กู้คืน" = false · ของในถังกด "ย้ายเข้าถัง" ซ้ำ = false (เวลา/ชื่อคนลบเดิมไม่ถูกทับ)
 */
export async function setJobPostingTrashed(id: string, trashed: boolean, actor: string): Promise<boolean> {
  const guard = trashed ? "deleted_at is null" : "deleted_at is not null";
  const result = await getPool().query(
    `update job_posting
        set deleted_at = ${trashed ? "now()" : "null"},
            deleted_by = ${trashed ? "$2" : "null"},
            updated_at = now(), updated_by = $2
      where id = $1 and ${guard}`,
    [id.trim(), actor],
  );
  return (result.rowCount ?? 0) > 0;
}

/** ลบถาวร — ประตูอยู่ที่ SQL: ต้องอยู่ในถังเท่านั้น */
export async function deleteJobForever(id: string): Promise<boolean> {
  const result = await getPool().query("delete from job_posting where id = $1 and deleted_at is not null", [id.trim()]);
  return (result.rowCount ?? 0) > 0;
}



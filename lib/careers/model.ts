import type { LocalizedValue } from "@/lib/content/types";

/**
 * ตรรกะล้วนของ "ประกาศรับสมัครงาน" (`job_posting`) — รอบที่ 265 · มติเจ้าของ D26
 *
 * ไม่มี DB · ไม่มี Next · ไม่มี JSX ⇒ ทดสอบได้ตรง ๆ
 * ทำไมต้องย้ายเข้าฐานข้อมูล: เดิมข้อมูล 20 ตำแหน่งอยู่ในโค้ด (`features/careers/jobs.ts`) +
 * พจนานุกรม ⇒ ฝ่ายบุคคลแก้ประกาศเองไม่ได้ · ประกาศรับสมัคร **เปลี่ยนบ่อย** (ที่มาของงานรอบนี้)
 *
 * ภาพรวมการไหล: `job_posting` (ตาราง) → `lib/careers/repository.ts` → เลย์เอาต์หน้า /careers
 * + บล็อก `jobBoard` ที่ตั้ง `source = "database"` (ผ่าน `loadJobBoardData`)
 */

/** สถานะประกาศ — ตรงกับ check constraint ใน migration 0040 */
export const JOB_STATUSES = ["draft", "published"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

function isJobStatusValue(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

/**
 * คีย์เพศที่ยอมรับ — **ไม่เก็บข้อความ** ในฐานข้อมูล (ข้อความมาจากพจนานุกรม `careersPage.genders`)
 * `""` = ไม่ระบุ (มติ D26 ข้อ 4: ประกาศใหม่ไม่บังคับกรอกเพศ/อายุ)
 */
export const JOB_GENDERS = ["", "male", "female", "any"] as const;
export type JobGender = (typeof JOB_GENDERS)[number];

/** เพดานความยาว (กันข้อความยักษ์จากการวางผิดที่ — validator ใช้ตัวเลขเดียวกันกับ UI) */
export const MAX_JOB_TITLE_LENGTH = 200;
export const MAX_JOB_DEPARTMENT_LENGTH = 120;
export const MAX_JOB_AGE_LENGTH = 80;
export const MAX_JOB_TEXT_LENGTH = 2000;
export const MAX_JOB_OPENINGS = 999;

/** ลำดับที่ใช้กับประกาศใหม่ (ต่อท้ายของเดิม) */
export const JOB_SORT_STEP = 10;
export const NEW_JOB_SORT_BASE = 1000;

/** รหัสประกาศใหม่ = `j<เวลา>` (ไม่มี URL ผูกกับรหัส ⇒ ไม่ต้องมี slug/301) */
export function newJobId(now: number): string {
  return `j${String(Math.floor(now))}`;
}

/** แถวประกาศ (ฝั่งเว็บ) — ชนิดเดียวกับที่ชั้นข้อมูลคืน */
export type JobPosting = {
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
};

/** ข้อมูลที่ฟอร์มหลังบ้านส่งมา (ยังไม่ผ่านการตรวจ) */
export type JobInput = {
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

export type JobIssueCode =
  | "empty-title-th"
  | "title-too-long"
  | "department-too-long"
  | "age-too-long"
  | "text-too-long"
  | "openings-invalid"
  | "sort-order-invalid"
  | "status-invalid"
  | "gender-invalid";

export type JobIssue = {
  readonly code: JobIssueCode;
  /** ชื่อฟิลด์ที่ต้องแก้ (ใช้ชี้ช่องในฟอร์มหลังบ้าน) */
  readonly field: string;
};

function tooLong(value: string, max: number): boolean {
  return value.length > max;
}

/**
 * ตรวจข้อมูลประกาศ — คืน **รายการปัญหา** (ไม่โยน error)
 * กติกา: ชื่อไทยต้องมี (TH บังคับ — มติ D3) · EN/เพศ/อายุ/คุณสมบัติ/ประสบการณ์ ว่างได้
 */
export function validateJobInput(input: JobInput): readonly JobIssue[] {
  const issues: JobIssue[] = [];

  if (input.titleTh.trim() === "") issues.push({ code: "empty-title-th", field: "titleTh" });
  if (tooLong(input.titleTh, MAX_JOB_TITLE_LENGTH) || tooLong(input.titleEn, MAX_JOB_TITLE_LENGTH)) {
    issues.push({ code: "title-too-long", field: "titleTh" });
  }
  if (tooLong(input.departmentTh, MAX_JOB_DEPARTMENT_LENGTH) || tooLong(input.departmentEn, MAX_JOB_DEPARTMENT_LENGTH)) {
    issues.push({ code: "department-too-long", field: "departmentTh" });
  }
  if (tooLong(input.ageTh, MAX_JOB_AGE_LENGTH) || tooLong(input.ageEn, MAX_JOB_AGE_LENGTH)) {
    issues.push({ code: "age-too-long", field: "ageTh" });
  }
  const longText =
    tooLong(input.qualificationsTh, MAX_JOB_TEXT_LENGTH) ||
    tooLong(input.qualificationsEn, MAX_JOB_TEXT_LENGTH) ||
    tooLong(input.experienceTh, MAX_JOB_TEXT_LENGTH) ||
    tooLong(input.experienceEn, MAX_JOB_TEXT_LENGTH);
  if (longText) issues.push({ code: "text-too-long", field: "qualificationsTh" });

  if (!Number.isInteger(input.openings) || input.openings < 0 || input.openings > MAX_JOB_OPENINGS) {
    issues.push({ code: "openings-invalid", field: "openings" });
  }
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) {
    issues.push({ code: "sort-order-invalid", field: "sortOrder" });
  }
  if (!isJobStatusValue(input.status)) issues.push({ code: "status-invalid", field: "status" });
  if (!isJobGenderValue(input.gender)) issues.push({ code: "gender-invalid", field: "gender" });

  return issues;
}

export function isJobGenderValue(value: string): value is JobGender {
  return (JOB_GENDERS as readonly string[]).includes(value);
}

export function isJobStatus(value: string): value is JobStatus {
  return isJobStatusValue(value);
}

/* ── การเรียง/ตัวเลข ──────────────────────────────────────────────────────── */

type Sortable = { readonly id: string; readonly sortOrder: number };

/** เรียงตาม `sort_order` แล้วปิดท้ายด้วย id — **นิ่ง** (เรียกซ้ำได้ผลเดิมเสมอ) */
export function sortJobPostings<T extends Sortable>(rows: readonly T[]): readonly T[] {
  return [...rows].sort((a, b) => (a.sortOrder === b.sortOrder ? a.id.localeCompare(b.id) : a.sortOrder - b.sortOrder));
}

export function nextJobSortOrder(rows: readonly Sortable[]): number {
  if (rows.length === 0) return NEW_JOB_SORT_BASE;
  const max = Math.max(...rows.map((row) => row.sortOrder));
  return max + JOB_SORT_STEP;
}

/* ── ภาษา (TH บังคับ · EN ว่าง = ถอยไทย ตามมติ D3) ─────────────────────────── */

/** ภาษาที่หน้าเว็บรองรับ (ผู้เรียกส่ง `lang` ของ Next เข้ามาได้ตรง ๆ) */
export type Language = "th" | "en";

function pick(th: string, en: string, language: Language): string {
  if (language === "th") return th;
  return en.trim() === "" ? th : en;
}

export function jobTitle(posting: JobPosting, language: Language): string {
  return pick(posting.titleTh, posting.titleEn, language);
}

export function jobDepartment(posting: JobPosting, language: Language): string {
  return pick(posting.departmentTh, posting.departmentEn, language);
}

export function jobAge(posting: JobPosting, language: Language): string {
  return pick(posting.ageTh, posting.ageEn, language);
}

export function jobQualifications(posting: JobPosting, language: Language): string {
  return pick(posting.qualificationsTh, posting.qualificationsEn, language);
}

export function jobExperience(posting: JobPosting, language: Language): string {
  return pick(posting.experienceTh, posting.experienceEn, language);
}

/** ฝ่ายทั้งหมดที่มีประกาศ (เรียงตามลำดับที่พบครั้งแรก — ใช้ทำตัวกรอง/ตัวเลขสรุป) */
export function jobDepartments(postings: readonly JobPosting[], language: Language): readonly string[] {
  const seen: string[] = [];
  for (const posting of sortJobPostings(postings)) {
    const label = jobDepartment(posting, language).trim();
    if (label !== "" && !seen.includes(label)) seen.push(label);
  }
  return seen;
}

export type JobStats = {
  readonly positions: number;
  readonly openings: number;
  readonly departments: number;
};

/** ตัวเลข 3 ช่องบนส่วนหัวของหน้า /careers — คำนวณจากข้อมูลจริงเท่านั้น */
export function jobStats(postings: readonly JobPosting[]): JobStats {
  return {
    positions: postings.length,
    openings: postings.reduce((sum, posting) => sum + Math.max(0, posting.openings), 0),
    departments: new Set(postings.map((posting) => posting.departmentTh.trim()).filter((name) => name !== "")).size,
  };
}

/**
 * แปลงแถวฐานข้อมูล → `JobBoardItem` ของบล็อก `jobBoard` (ทั้งสองภาษา)
 * ⇒ บล็อกที่ตั้ง `source = "database"` เรนเดอร์ด้วยตัวเรนเดอร์เดิมได้ทันที (ไม่ต้องมีโค้ดแสดงผลชุดที่สอง)
 */
export function jobBoardItems(postings: readonly JobPosting[]): readonly {
  readonly id: string;
  readonly title: LocalizedValue;
  readonly department: LocalizedValue;
  readonly openings: number;
  readonly qualifications: LocalizedValue;
  readonly experience: LocalizedValue;
}[] {
  return sortJobPostings(postings).map((posting) => ({
    id: posting.id,
    title: { th: posting.titleTh, en: posting.titleEn },
    department: { th: posting.departmentTh, en: posting.departmentEn },
    openings: posting.openings,
    qualifications: { th: posting.qualificationsTh, en: posting.qualificationsEn },
    experience: { th: posting.experienceTh, en: posting.experienceEn },
  }));
}

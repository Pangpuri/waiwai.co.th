/**
 * ตรรกะล้วนของ "ประกาศรับสมัครงาน" (`job_posting`) — รอบที่ 265 · มติเจ้าของ D26
 *
 * ไม่มี DB · ไม่มี Next · ไม่มี JSX ⇒ ทดสอบได้ตรง ๆ
 * ทำไมต้องย้ายเข้าฐานข้อมูล: เดิมข้อมูล 20 ตำแหน่งอยู่ในโค้ด (`features/careers/jobs.ts`) +
 * พจนานุกรม ⇒ ฝ่ายบุคคลแก้ประกาศเองไม่ได้ · ประกาศรับสมัคร **เปลี่ยนบ่อย** (ที่มาของงานรอบนี้)
 *
 * ภาพรวมการไหล: `job_posting` (ตาราง) → `lib/careers/repository.ts` → เลย์เอาต์หน้า /careers
 * (+ จอหลังบ้าน `/admin/careers` · `/th/careers` ใช้เลย์เอาต์นี้เท่านั้น — ตัวสร้างหน้า/เทมเพลต
 *  และบล็อก `jobBoard` ถูกถอดออกแล้วในรอบที่ 266)
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

/** แปลง `datetime-local` (เวลาไทย) เป็น timestamp ที่บันทึกใน DB ได้ */
export function jobPostedAtInstantOf(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(trimmed);
  if (match === null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (![year, month, day, hour, minute].every(Number.isInteger)) return null;

  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, 0, 0);
  if (
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() !== month - 1 ||
    local.getUTCDate() !== day ||
    local.getUTCHours() !== hour ||
    local.getUTCMinutes() !== minute
  ) {
    return null;
  }

  return new Date(local.getTime() - 7 * 60 * 60 * 1000).toISOString();
}

/** แปลง timestamp จาก DB เป็นค่าที่ `datetime-local` แสดงในเวลาไทย */
export function jobPostedAtLocalOf(value: string | null): string {
  if (value === null || value.trim() === "") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const part = (type: string): string => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
  } catch {
    return "";
  }
}

/** แสดงวันที่ประกาศตามภาษา โดยยึดเวลาไทยเสมอ */
export function formatJobPostedAt(value: string | null, language: Language): string {
  if (value === null || value.trim() === "") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-GB", {
      timeZone: "Asia/Bangkok",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  } catch {
    return "";
  }
}

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
  readonly postedAt: string | null;
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
  readonly postedAtLocal: string;
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
  | "gender-invalid"
  | "posted-at-invalid";

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
  if (input.postedAtLocal.trim() !== "" && jobPostedAtInstantOf(input.postedAtLocal) === null) {
    issues.push({ code: "posted-at-invalid", field: "postedAtLocal" });
  }

  return issues;
}

/**
 * สถานะที่จะบันทึกจริง — **ฟอร์มไม่ส่ง/ส่งว่าง = คงสถานะเดิม** (รอบที่ 266)
 *
 * ทำไมต้องมี: ช่อง "สถานะ" เป็น `<select>` ⇒ ค่าที่เลือกไม่ได้อยู่ใน attribute `value`
 * ถ้าผู้เรียก (ฟอร์มที่ปิด JS / สคริปต์ / เครื่องมืออื่น) ไม่ส่งคีย์นี้มา แล้วเรา "ตีเป็น draft"
 * ประกาศที่เผยแพร่อยู่จะ **หลุดจากหน้าเว็บเงียบ ๆ** โดยไม่มีใครรู้ (เคสจริงจากสคริปต์พิสูจน์ CRUD)
 * ⇒ หลักเดียวกับบทเรียนรอบ 263: "ไม่มีคีย์ = ไม่เปลี่ยนข้อมูล" · ค่าที่ส่งมาแต่ไม่รู้จัก = validator ปฏิเสธ
 */
export function resolveJobStatus(submitted: string, current: string): string {
  if (submitted.trim() === "") return isJobStatus(current) ? current : "draft";
  return submitted;
}

export function isJobGenderValue(value: string): value is JobGender {
  return (JOB_GENDERS as readonly string[]).includes(value);
}

export function isJobStatus(value: string): value is JobStatus {
  return isJobStatusValue(value);
}

/* ── การเรียง/ตัวเลข ──────────────────────────────────────────────────────── */

type Sortable = {
  readonly id: string;
  readonly sortOrder: number;
  readonly postedAt?: string | null;
};

function postedAtTimestamp(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** วันที่ประกาศใหม่ก่อน; วันที่ว่าง/ไม่ถูกต้องอยู่ท้าย แล้วใช้ลำดับและ id เป็นตัวตัดสิน — **นิ่ง** */
export function sortJobPostings<T extends Sortable>(rows: readonly T[]): readonly T[] {
  return [...rows].sort((a, b) => {
    const aPostedAt = postedAtTimestamp(a.postedAt);
    const bPostedAt = postedAtTimestamp(b.postedAt);
    if (aPostedAt !== null || bPostedAt !== null) {
      if (aPostedAt === null) return 1;
      if (bPostedAt === null) return -1;
      if (aPostedAt !== bPostedAt) return bPostedAt - aPostedAt;
    }
    return a.sortOrder === b.sortOrder ? a.id.localeCompare(b.id) : a.sortOrder - b.sortOrder;
  });
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
 * ปิดหนี้ D-265-2 (รอบที่ 276): ค่า `topic` ของใบสมัครเคยเป็น **รหัสตำแหน่ง**
 * (`j<เวลา>` ของประกาศใหม่ หรือคีย์พจนานุกรมของ 20 ตำแหน่งเดิม) ⇒ HR อ่านไม่รู้เรื่อง
 *
 * - ใบสมัครใหม่: ฟอร์มส่ง **ชื่อตำแหน่ง** มาแล้ว ⇒ ฟังก์ชันนี้คืนค่าเดิม
 * - ใบสมัครเก่า: ถ้าค่าตรงกับ id ของประกาศที่ยังอยู่ในฐานข้อมูล ⇒ คืนชื่อ (ไทยก่อน ถ้าว่างใช้ EN)
 * - หาไม่เจอ/ว่าง: คืนค่าเดิม (ห้ามแต่งขึ้นเอง)
 */
export function jobTitleByTopic(
  topic: string,
  titleById: ReadonlyMap<string, string>,
): string {
  const value = topic.trim();
  if (value === "") return "";
  const title = titleById.get(value)?.trim() ?? "";
  return title === "" ? value : title;
}

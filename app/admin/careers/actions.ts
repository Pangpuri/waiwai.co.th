"use server";

import { revalidatePath } from "next/cache";

import { isDatabaseConfigured } from "@/db/pool";
import { revalidateAdminPath, refreshPublicSite } from "@/lib/cache/refresh";
import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/roles";
import { loadEntityRevision, recordEntityRevision } from "@/lib/revisions/repository";
import { jobRestoreOf, jobSnapshotOf } from "@/lib/revisions/model";
import {
  isJobGenderValue,
  isJobStatus,
  jobPostedAtInstantOf,
  newJobId,
  nextJobSortOrder,
  resolveJobStatus,
  validateJobInput,
  type JobInput,
} from "@/lib/careers/model";
import {
  createJobPosting,
  deleteJobForever,
  listJobPostingsForAdmin,
  loadJobPostingForAdmin,
  publishActiveJobDrafts,
  publishSelectedJobDrafts,
  setJobPostingTrashed,
  updateJobPosting,
  upsertJobPostings,
  type JobUpsertResult,
  type JobWriteInput,
} from "@/lib/careers/repository";
import { reorderRows } from "@/lib/admin/reorder";
import { parsePageCopy } from "@/lib/page-copy/model";
import { saveAndPublishCareersPageCopy } from "@/lib/careers/page-copy";
import type {
  CareersSpreadsheetImportState,
  CareersSpreadsheetPreviewState,
  JobBulkPublishState,
  JobDraftPublishState,
  JobFormState,
  JobReorderState,
} from "@/features/admin/careers-state";
import type { PageCopyState } from "@/features/admin/page-copy-state";
import {
  CareersWorkbookParseError,
  MAX_CAREERS_XLSX_BYTES,
  careersSpreadsheetWrites,
  parseCareersWorkbook,
  validateCareersSpreadsheetRows,
  type CareersSpreadsheetIssue,
} from "@/lib/careers/xlsx-import";

/**
 * Server Action ของหลังบ้าน "ประกาศรับสมัครงาน" (/admin/careers) — รอบที่ 265 · มติเจ้าของ D26
 *
 * กติกาโปรเจกต์ที่ต้องถือ (แบบเดียวกับจอข่าว/สินค้า/เมนู)
 * - **ตรวจสิทธิ์ทุก action** — จัดการประกาศและถังขยะของประกาศงานใช้ `careers`; แก้ส่วนอื่นใช้ `content`
 * - **ห้ามเชื่อข้อมูลจากเบราว์เซอร์**: ค่าทุกช่องผ่าน `validateJobInput()` (เพดานความยาว/จำนวนอัตรา/คีย์เพศ)
 * - เพศ/อายุ **ไม่บังคับ** (มติ D26 ข้อ 4) · รหัสประกาศ **ออกให้ที่เซิร์ฟเวอร์** (`newJobId`) ไม่รับจากฟอร์ม
 * - บันทึกแล้ว **บอกเว็บให้สร้างหน้าใหม่** (`refreshPublicSite("page")`)
 * - ทุกการเปลี่ยนแปลงเขียน audit log · ไม่ส่งข้อความกลับไปให้จอ (ส่งแค่รหัสเหตุผล)
 */

const LIST_PATH = "/admin/careers";

/** ข้อความหัวหน้า /careers — บันทึก + เผยแพร่ทันที (รอบ 342) */
export async function saveCareersPageCopyAction(
  _previous: PageCopyState,
  formData: FormData,
): Promise<PageCopyState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return { status: "error", reason: "database" };

  const copy = parsePageCopy({
    eyebrow: { th: field(formData, "eyebrowTh"), en: field(formData, "eyebrowEn") },
    title: { th: field(formData, "titleTh"), en: field(formData, "titleEn") },
    intro: { th: field(formData, "introTh"), en: field(formData, "introEn") },
  });
  if (copy === null) return { status: "error", reason: "invalid" };

  try {
    await saveAndPublishCareersPageCopy(copy, user.email);
  } catch {
    return { status: "error", reason: "database" };
  }

  await recordAudit({
    action: "careers-page-copy-save",
    actorEmail: user.email,
    target: "careers-page-copy",
    detail: "published",
  });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
  return { status: "saved", reason: "" };
}

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function intOf(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** อ่านค่าจากฟอร์ม → ข้อมูลที่ผ่านการตรวจแล้ว (หรือ null เมื่อไม่ผ่าน) */
function readJobInput(formData: FormData): JobInput | null {
  const status = field(formData, "status");
  const gender = field(formData, "gender");
  const input: JobInput = {
    titleTh: field(formData, "titleTh"),
    titleEn: field(formData, "titleEn"),
    departmentTh: field(formData, "departmentTh"),
    departmentEn: field(formData, "departmentEn"),
    openings: intOf(field(formData, "openings"), 0),
    gender: isJobGenderValue(gender) ? gender : "",
    ageTh: field(formData, "ageTh"),
    ageEn: field(formData, "ageEn"),
    qualificationsTh: field(formData, "qualificationsTh"),
    qualificationsEn: field(formData, "qualificationsEn"),
    experienceTh: field(formData, "experienceTh"),
    experienceEn: field(formData, "experienceEn"),
    postedAtLocal: field(formData, "postedAtLocal"),
    sortOrder: intOf(field(formData, "sortOrder"), 0),
    status: isJobStatus(status) ? status : "draft",
  };
  return validateJobInput(input).length === 0 ? input : null;
}

function auditTarget(id: string): string {
  return `job:${id}`;
}

/** บันทึกประกาศ (ฟอร์มแก้ไข) — ใช้ `useActionState` */
export async function saveJobAction(_previous: JobFormState, formData: FormData): Promise<JobFormState> {
  const user = await requireAdminUser("careers");
  if (!isDatabaseConfigured()) return { status: "error", reason: "database", createdId: "" };

  const id = field(formData, "id").trim();
  if (id === "") return { status: "error", reason: "missing", createdId: "" };

  const existing = await loadJobPostingForAdmin(id);
  if (existing === null || (existing.deletedAt !== null && !can(user.role, "content"))) {
    return { status: "error", reason: "missing", createdId: "" };
  }

  const input = readJobInput(formData);
  if (input === null) return { status: "error", reason: "invalid", createdId: "" };

  /*
    ⚠️ รอบที่ 266: ฟอร์มไม่ส่ง `status` มา (เช่นฟอร์มที่ปิด JS/เครื่องมือยิงฟอร์ม) = **คงสถานะเดิม**
    ไม่งั้นประกาศที่เผยแพร่อยู่จะกลายเป็นฉบับร่างและหลุดจากหน้าเว็บเงียบ ๆ (เคสจริงจากสคริปต์พิสูจน์ CRUD)
  */
  const status = resolveJobStatus(field(formData, "status"), existing.status);
  const sortOrder = can(user.role, "content") ? input.sortOrder : existing.sortOrder;

  const { postedAtLocal, ...fields } = input;
  const postedAt =
    jobPostedAtInstantOf(postedAtLocal) ??
    (status === "published" && existing.status !== "published" ? new Date().toISOString() : null);
  const saved = await updateJobPosting(
    { ...fields, postedAt, id, status, sortOrder },
    user.email,
  );
  if (!saved) return { status: "error", reason: "database", createdId: "" };

  await recordJobRevision(id, user.email);
  await recordAudit({
    actorEmail: user.email,
    action: "job-save",
    target: auditTarget(id),
    detail: `${status} · ${String(input.openings)} อัตรา`,
  });
  revalidateAdminPath(LIST_PATH);
  revalidateAdminPath(`${LIST_PATH}/${id}`);
  await refreshPublicSite("page");
  return { status: "saved", reason: "", createdId: id };
}

/**
 * เก็บ "รุ่น" ของประกาศ (รอบที่ 278 · ปิดหนี้ D-265-3)
 * ⚠️ เก็บรุ่นจากค่าที่ **บันทึกแล้ว** (อ่านกลับจากฐานข้อมูล) ไม่ใช่ค่าจากฟอร์ม — กันสแนปช็อตเพี้ยน
 */
async function recordJobRevision(id: string, actor: string, note = ""): Promise<void> {
  const saved = await loadJobPostingForAdmin(id);
  if (saved === null) return;
  await recordEntityRevision({ kind: "job", entityId: id, snapshot: jobSnapshotOf(saved), actor, note });
}

/**
 * กู้คืนประกาศจากรุ่นหนึ่ง — **บันทึกรุ่นปัจจุบันก่อนเสมอ** ⇒ ย้อนกลับได้แม้กดผิด
 * (ใช้แม่แบบเดียวกับสินค้า/เมนู/ข่าว รอบที่ 145)
 */
export async function restoreJobRevisionAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = field(formData, "id").trim();
  const revisionId = field(formData, "revisionId").trim();
  if (id === "" || revisionId === "") return;

  const snapshot = await loadEntityRevision({ kind: "job", entityId: id, revisionId });
  if (snapshot === null) return;

  const restore = jobRestoreOf(snapshot);
  const existing = await loadJobPostingForAdmin(id);
  if (existing === null) return;

  /* สถานะรุ่น: ถ้าเป็นฉบับร่างเดิม และปัจจุบันเผยแพร่แล้ว ⇒ ไม่ถอยสถานะให้หลุดจากเว็บโดยไม่ตั้งใจ */
  const status = existing.status;

  await recordJobRevision(id, user.email, "ก่อนกู้คืน");
  const saved = await updateJobPosting({ ...restore.values, id, status }, user.email);
  if (!saved) return;

  await recordJobRevision(id, user.email, `กู้คืนรุ่น #${revisionId}`);
  await recordAudit({
    actorEmail: user.email,
    action: "job-revision-restore",
    target: auditTarget(id),
    detail: `revision=${revisionId}`,
  });
  revalidateAdminPath(LIST_PATH);
  revalidateAdminPath(`${LIST_PATH}/${id}`);
  await refreshPublicSite("page");
}

/** สร้างประกาศใหม่ — รหัสออกที่เซิร์ฟเวอร์ (`j<เวลา>`) และ **ตั้งเป็นฉบับร่างเสมอ** (มติ D26 ข้อ 5) */
export async function createJobAction(_previous: JobFormState, formData: FormData): Promise<JobFormState> {
  const user = await requireAdminUser("careers");
  if (!isDatabaseConfigured()) return { status: "error", reason: "database", createdId: "" };

  const input = readJobInput(formData);
  if (input === null) return { status: "error", reason: "invalid", createdId: "" };

  const id = newJobId(Date.now());
  const sortOrder = can(user.role, "content")
    ? input.sortOrder
    : nextJobSortOrder(
        (await listJobPostingsForAdmin())
          .filter((posting) => posting.deletedAt === null)
          .map(({ id: postingId, sortOrder: postingSortOrder }) => ({
            id: postingId,
            sortOrder: postingSortOrder,
          })),
      );
  const { postedAtLocal, ...fields } = input;
  const write: JobWriteInput = {
    ...fields,
    postedAt: jobPostedAtInstantOf(postedAtLocal),
    id,
    sortOrder,
    /* ประกาศใหม่ = ร่างก่อนเสมอ (มติ D26 ข้อ 5) · ลำดับมาจากฟอร์ม (หน้าจอเติม "ต่อท้าย" ให้แล้ว) */
    status: "draft",
  };
  const created = await createJobPosting(write, user.email);
  if (!created) return { status: "error", reason: "duplicate", createdId: "" };

  await recordJobRevision(id, user.email, "สร้างใหม่");
  await recordAudit({ actorEmail: user.email, action: "job-save", target: auditTarget(id), detail: "draft · created" });
  revalidateAdminPath(LIST_PATH);
  return { status: "saved", reason: "", createdId: id };
}

async function finishJobDraftPublication(
  ids: readonly string[],
  actorEmail: string,
  bulk: boolean,
): Promise<void> {
  for (const id of ids) await recordJobRevision(id, actorEmail, bulk ? "เผยแพร่ฉบับร่างแบบกลุ่ม" : "เผยแพร่ฉบับร่าง");
  await recordAudit({
    actorEmail,
    action: bulk ? "job-publish-bulk" : "job-publish",
    target: bulk ? "job-postings" : auditTarget(ids[0] ?? ""),
    detail: bulk ? `count=${ids.length}` : "published",
  });
  revalidateAdminPath(LIST_PATH);
  if (!bulk && ids[0] !== undefined) revalidateAdminPath(`${LIST_PATH}/${ids[0]}`);
  await refreshPublicSite("page");
}

/** เผยแพร่ฉบับร่างรายการเดียว */
export async function publishOneJobDraftAction(
  _previous: JobDraftPublishState,
  formData: FormData,
): Promise<JobDraftPublishState> {
  const user = await requireAdminUser("careers");
  if (!isDatabaseConfigured()) return { status: "error", reason: "database" };
  const id = field(formData, "id").trim();
  if (id === "") return { status: "error", reason: "no-drafts" };

  let ids: readonly string[];
  try {
    ids = await publishSelectedJobDrafts(user.email, [id]);
  } catch {
    return { status: "error", reason: "database" };
  }
  if (ids.length === 0) return { status: "error", reason: "no-drafts" };

  await finishJobDraftPublication(ids, user.email, false);
  return { status: "published", reason: "" };
}

/** เผยแพร่ฉบับร่างที่เลือกหรือทั้งหมด หลังผู้ดูแลยืนยัน */
export async function publishSelectedJobDraftsAction(
  _previous: JobBulkPublishState,
  formData: FormData,
): Promise<JobBulkPublishState> {
  const user = await requireAdminUser("careers");
  if (field(formData, "confirmPublish") !== "yes") {
    return { status: "error", reason: "confirmation", count: 0 };
  }
  if (!isDatabaseConfigured()) return { status: "error", reason: "database", count: 0 };

  const publishAll = field(formData, "publishAll") === "yes";
  const selectedIds = [
    ...new Set(
      formData
        .getAll("ids")
        .filter((value): value is string => typeof value === "string")
        .map((id) => id.trim())
        .filter((id) => id !== ""),
    ),
  ];
  if (!publishAll && selectedIds.length === 0) return { status: "error", reason: "no-selection", count: 0 };
  if (!publishAll && selectedIds.length > 500) return { status: "error", reason: "too-many", count: 0 };

  let publishedIds: readonly string[];
  try {
    publishedIds = publishAll
      ? await publishActiveJobDrafts(user.email)
      : await publishSelectedJobDrafts(user.email, selectedIds);
  } catch {
    return { status: "error", reason: "database", count: 0 };
  }
  if (publishedIds.length === 0) return { status: "error", reason: "no-drafts", count: 0 };

  await finishJobDraftPublication(publishedIds, user.email, true);
  return { status: "published", reason: "", count: publishedIds.length };
}

function spreadsheetIssueState(
  issue: CareersSpreadsheetIssue,
): CareersSpreadsheetPreviewState {
  return { status: "error", issue, rows: [] };
}

/** อ่านและตรวจไฟล์ Excel ก่อนเขียน — ผู้ใช้ต้องยืนยันรายการที่พบ */
export async function previewCareersSpreadsheetAction(
  _previous: CareersSpreadsheetPreviewState,
  formData: FormData,
): Promise<CareersSpreadsheetPreviewState> {
  await requireAdminUser("careers");
  const value = formData.get("workbook");
  if (!(value instanceof File) || value.size === 0 || !value.name.toLowerCase().endsWith(".xlsx")) {
    return spreadsheetIssueState({ code: "invalid-file" });
  }
  if (value.size > MAX_CAREERS_XLSX_BYTES) {
    return spreadsheetIssueState({ code: "file-too-large" });
  }

  try {
    const rows = await parseCareersWorkbook(Buffer.from(await value.arrayBuffer()));
    return { status: "preview", issue: null, rows };
  } catch (error) {
    const issue: CareersSpreadsheetIssue =
      error instanceof CareersWorkbookParseError
        ? { code: error.code, row: error.row }
        : { code: "invalid-file" };
    return spreadsheetIssueState(issue);
  }
}

/** ยืนยันนำเข้ารายการที่ preview แล้วเป็นฉบับร่าง (วันที่ที่ไม่ทราบ = null) */
export async function applyCareersSpreadsheetAction(
  _previous: CareersSpreadsheetImportState,
  formData: FormData,
): Promise<CareersSpreadsheetImportState> {
  const user = await requireAdminUser("careers");
  if (!isDatabaseConfigured()) {
    return { status: "error", reason: "database", count: 0, created: 0, protected: 0 };
  }

  let rows: ReturnType<typeof validateCareersSpreadsheetRows>;
  try {
    const parsed: unknown = JSON.parse(field(formData, "rows"));
    rows = validateCareersSpreadsheetRows(parsed);
  } catch {
    rows = null;
  }
  if (rows === null) {
    return { status: "error", reason: "invalid-preview", count: 0, created: 0, protected: 0 };
  }

  const writes = careersSpreadsheetWrites(rows);
  let results: readonly JobUpsertResult[];
  try {
    results = await upsertJobPostings(writes, "careers-excel-import", "protect-edited");
  } catch {
    return { status: "error", reason: "database", count: 0, created: 0, protected: 0 };
  }

  const created = results.filter((result) => result.created).length;
  const protectedEdits = results.filter((result) => result.protectedEdit).length;
  await recordAudit({
    actorEmail: user.email,
    action: "careers-excel-import",
    target: "job-postings",
    detail: `count=${results.length} · created=${created} · protected=${protectedEdits}`,
  });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
  return {
    status: "saved",
    reason: "",
    count: results.length,
    created,
    protected: protectedEdits,
  };
}

/** ย้ายเข้าถังขยะ / กู้คืน — ประตูสองทางอยู่ที่ SQL (`setJobPostingTrashed`) */
export async function trashJobAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("careers");
  if (!isDatabaseConfigured()) return;

  const id = field(formData, "id").trim();
  const trashed = field(formData, "trashed") === "1";
  if (id === "") return;

  const changed = await setJobPostingTrashed(id, trashed, user.email);
  if (!changed) return;

  await recordAudit({
    actorEmail: user.email,
    action: trashed ? "job-trash" : "job-restore",
    target: auditTarget(id),
    detail: trashed ? "trashed" : "restored",
  });
  revalidatePath(LIST_PATH);
  await refreshPublicSite("page");
}

/** ลบถาวร — ทำได้เฉพาะของที่อยู่ในถัง (ประตูอยู่ที่ SQL) */
export async function deleteJobForeverAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("careers");
  if (!isDatabaseConfigured()) return;

  const id = field(formData, "id").trim();
  if (id === "") return;

  const deleted = await deleteJobForever(id);
  if (!deleted) return;

  await recordAudit({ actorEmail: user.email, action: "job-delete", target: auditTarget(id), detail: "permanent" });
  revalidatePath(LIST_PATH);
  await refreshPublicSite("page");
}

/** จัดลำดับประกาศ — ใช้เครื่องมือกลาง (`reorderRows("job", …)`) */
export async function reorderJobsAction(_previous: JobReorderState, formData: FormData): Promise<JobReorderState> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return { saved: 0, failed: true };

  const ids = field(formData, "order")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  if (ids.length === 0) return { saved: 0, failed: true };

  const saved = await reorderRows("job", ids, user.email);
  if (saved === 0) return { saved: 0, failed: true };

  await recordAudit({ actorEmail: user.email, action: "job-save", target: "job:order", detail: `reorder ${String(saved)}` });
  revalidateAdminPath(LIST_PATH);
  await refreshPublicSite("page");
  return { saved, failed: false };
}

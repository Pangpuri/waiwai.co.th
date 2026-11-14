import type {
  CareersSpreadsheetIssue,
  CareersSpreadsheetRow,
} from "@/lib/careers/xlsx-import";

/**
 * สถานะของฟอร์ม "ประกาศรับสมัครงาน" (รอบที่ 265 · มติ D26) — **ตรรกะล้วน ไม่มี Next/DB**
 *
 * แยกไฟล์แบบเดียวกับ `features/admin/{category,product,news}-state.ts`
 * เพื่อให้ client component import ได้โดยไม่ดึงโค้ด `"use server"` เข้ามาในบันเดิล
 */

/** เหตุผลที่บันทึกไม่สำเร็จ — จอแสดงข้อความจากพจนานุกรมตามรหัสนี้ (ไม่ส่งข้อความจากเซิร์ฟเวอร์) */
export type JobFormReason = "" | "database" | "invalid" | "missing" | "duplicate";

export type JobFormState = {
  readonly status: "idle" | "saved" | "error";
  readonly reason: JobFormReason;
  /** รหัสประกาศที่เพิ่งสร้าง (ใช้พาไปหน้าแก้ต่อ) — "" = ไม่มี */
  readonly createdId: string;
};

export const INITIAL_JOB_FORM_STATE: JobFormState = { status: "idle", reason: "", createdId: "" };

/** สถานะของปุ่มจัดลำดับ (ใช้ร่วมกับ `SortableList` ของเดิม) */
export type JobReorderState = { readonly saved: number; readonly failed: boolean };

export const INITIAL_JOB_REORDER_STATE: JobReorderState = { saved: 0, failed: false };

export type JobBulkPublishState = {
  readonly status: "idle" | "published" | "error";
  readonly reason: "" | "database" | "confirmation" | "no-drafts" | "no-selection" | "too-many";
  readonly count: number;
};

export const INITIAL_JOB_BULK_PUBLISH_STATE: JobBulkPublishState = {
  status: "idle",
  reason: "",
  count: 0,
};

export type JobDraftPublishState = {
  readonly status: "idle" | "published" | "error";
  readonly reason: "" | "database" | "no-drafts";
};

export const INITIAL_JOB_DRAFT_PUBLISH_STATE: JobDraftPublishState = {
  status: "idle",
  reason: "",
};

export type CareersSpreadsheetPreviewState = {
  readonly status: "idle" | "preview" | "error";
  readonly issue: CareersSpreadsheetIssue | null;
  readonly rows: readonly CareersSpreadsheetRow[];
};

export const INITIAL_CAREERS_SPREADSHEET_PREVIEW_STATE: CareersSpreadsheetPreviewState = {
  status: "idle",
  issue: null,
  rows: [],
};

export type CareersSpreadsheetImportState = {
  readonly status: "idle" | "saved" | "error";
  readonly reason: "" | "database" | "invalid-preview";
  readonly count: number;
  readonly created: number;
  readonly protected: number;
};

export const INITIAL_CAREERS_SPREADSHEET_IMPORT_STATE: CareersSpreadsheetImportState = {
  status: "idle",
  reason: "",
  count: 0,
  created: 0,
  protected: 0,
};

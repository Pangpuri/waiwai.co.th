/**
 * สถานะของฟอร์ม "หมวดสินค้า" (รอบที่ 264 · มติ D25) — **ตรรกะล้วน ไม่มี Next/DB**
 *
 * แยกไฟล์แบบเดียวกับ `features/admin/product-state.ts` เพื่อให้ client component
 * import ได้โดยไม่ดึงโค้ด `"use server"` เข้ามาในบันเดิล
 */

/** เหตุผลที่บันทึก/เพิ่มไม่สำเร็จ — จอแสดงข้อความจากพจนานุกรมตามรหัสนี้ */
export type CategoryFormReason = "" | "database" | "invalid" | "duplicate" | "limit" | "missing";

export type CategoryFormState = {
  readonly status: "idle" | "saved" | "error";
  readonly reason: CategoryFormReason;
  /** slug ที่เพิ่งสร้าง (ใช้บอกผู้ใช้ว่าได้ URL อะไร) — "" = ไม่มี */
  readonly createdSlug: string;
};

export const INITIAL_CATEGORY_FORM_STATE: CategoryFormState = { status: "idle", reason: "", createdSlug: "" };

export type CategoryPresetState = {
  readonly status: "idle" | "saved" | "applied" | "deleted" | "imported" | "error";
  /** จำนวนหมวดที่ได้ผลจริง (ใช้แสดงข้อความ "N หมวด") */
  readonly count: number;
  readonly reason: "" | "database" | "missing" | "invalid";
};

export const INITIAL_CATEGORY_PRESET_STATE: CategoryPresetState = {
  status: "idle",
  count: 0,
  reason: "",
};

/** สถานะของปุ่มจัดลำดับ (ใช้ร่วมกับ `SortableList` ของเดิม) */
export type CategoryReorderState = { readonly saved: number; readonly failed: boolean };

export const INITIAL_CATEGORY_REORDER_STATE: CategoryReorderState = { saved: 0, failed: false };

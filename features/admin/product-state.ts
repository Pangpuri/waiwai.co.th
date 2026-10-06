/**
 * สถานะของหน้าจอหลังบ้านสินค้า (รอบที่ 131–132)
 *
 * แบบเดียวกับ `news-state.ts`: Server Action ส่งกลับแค่ "รหัสเหตุผล" แล้วจอภาพแปลงเป็นข้อความจากพจนานุกรม
 * (แยกไฟล์เพราะไฟล์ `"use server"` ส่งออกได้เฉพาะ async function)
 */

export type ProductSaveReason = "title" | "id" | "ingredients" | "database" | "not-found" | null;

export type ProductSaveState = {
  readonly status: "idle" | "saved" | "error";
  readonly reason: ProductSaveReason;
  readonly createdId: string | null;
};

export const INITIAL_PRODUCT_SAVE_STATE: ProductSaveState = { status: "idle", reason: null, createdId: null };

/** สถานะการอัปโหลดภาพ (ใช้ทั้งภาพสินค้าและภาพหมวด) — รูปแบบเดียวกับข่าว */
export type AdminUploadState = {
  readonly status: "idle" | "ok" | "invalid" | "failed";
  readonly path: string;
  readonly reason: string;
};

export const INITIAL_ADMIN_UPLOAD_STATE: AdminUploadState = { status: "idle", path: "", reason: "" };

export type CategorySaveState = {
  readonly status: "idle" | "saved" | "error";
  readonly reason: "database" | "invalid" | null;
};

export const INITIAL_CATEGORY_SAVE_STATE: CategorySaveState = { status: "idle", reason: null };

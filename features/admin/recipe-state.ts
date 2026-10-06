/**
 * สถานะของหน้าจอหลังบ้านเมนูอาหาร (รอบที่ 135)
 *
 * แบบเดียวกับ `news-state.ts` / `product-state.ts`: Server Action ส่งกลับแค่ "รหัสเหตุผล"
 * แล้วจอภาพแปลงเป็นข้อความจากพจนานุกรม
 * (แยกไฟล์เพราะไฟล์ `"use server"` ส่งออกได้เฉพาะ async function)
 */

export type RecipeSaveReason = "title" | "video" | "date" | "database" | "not-found" | null;

export type RecipeSaveState = {
  readonly status: "idle" | "saved" | "draft" | "error";
  readonly reason: RecipeSaveReason;
  readonly createdId: string | null;
};

export const INITIAL_RECIPE_SAVE_STATE: RecipeSaveState = { status: "idle", reason: null, createdId: null };

/** สถานะการอัปโหลดภาพปก — รูปแบบเดียวกับข่าว/สินค้า */
export type RecipeUploadState = {
  readonly status: "idle" | "ok" | "invalid" | "failed";
  readonly path: string;
  readonly reason: string;
};

export const INITIAL_RECIPE_UPLOAD_STATE: RecipeUploadState = { status: "idle", path: "", reason: "" };

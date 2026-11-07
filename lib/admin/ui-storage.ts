/**
 * คีย์ localStorage ของหน้าจอหลังบ้าน — แยกไฟล์ pure เพื่อให้ Client Component
 * นำไปใช้ได้โดยไม่ดึงโมดูลฝั่งเซิร์ฟเวอร์ (เช่น `node:crypto` จาก session) เข้า bundle
 */
export const ADMIN_SIDEBAR_STORAGE_KEY = "waiwai_admin_sidebar_open";

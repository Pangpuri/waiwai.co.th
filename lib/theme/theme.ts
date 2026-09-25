/**
 * ตรรกะของโหมดการแสดงผล (สว่าง / มืด / ตามระบบ)
 *
 * ส่วนที่อยู่ในไฟล์นี้เป็น pure ทั้งหมด (ไม่แตะ DOM) จึงเขียน unit test คุมได้
 * การอ่าน/เขียน localStorage และการ toggle คลาสทำใน Client Component
 */

export const THEMES = ["light", "dark", "system"] as const;

export type Theme = (typeof THEMES)[number];

/** ค่าเริ่มต้น = ตามระบบ */
export const DEFAULT_THEME: Theme = "system";

/** คีย์ที่ใช้เก็บค่าที่ผู้ใช้เลือก — ใช้ทั้งในสคริปต์กันจอวาบและใน Client Component */
export const THEME_STORAGE_KEY = "waiwai-theme";

/** คลาสที่ใช้เปิดโหมดมืดบน <html> (ต้องตรงกับ @custom-variant ใน globals.css) */
export const DARK_CLASS = "dark";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * ค่าที่ควรใช้จริง เมื่อรู้ว่าผู้ใช้เลือกอะไร และเครื่องตั้งโหมดมืดไว้หรือไม่
 * "system" จะตามเครื่อง ที่เหลือบังคับตามที่เลือก
 */
export function resolveTheme(theme: Theme, prefersDark: boolean): "light" | "dark" {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}

/**
 * สคริปต์ที่ฝังใน <head> เพื่อตั้งคลาสก่อนเบราว์เซอร์ paint ครั้งแรก
 * ถ้าไม่ทำ ผู้ใช้โหมดมืดจะเห็นจอวาบสีขาวทุกครั้งที่โหลดหน้า
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var v=localStorage.getItem(k);var d=v==="dark"||((v===null||v==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle(${JSON.stringify(DARK_CLASS)},d);e.style.colorScheme=d?"dark":"light";}catch(_){}})();`;

import { DEFAULT_THEME, THEME_STORAGE_KEY, isTheme, type Theme } from "./theme";

/**
 * ที่เก็บค่าธีม (external store)
 *
 * อ่านค่าด้วย useSyncExternalStore แทนการ setState ใน useEffect
 * เพราะ React 19 ไม่แนะนำให้ setState ทันทีในเอฟเฟกต์ (cascading render)
 *
 * ตรรกะทั้งหมดเกี่ยวกับ localStorage อยู่ในไฟล์เดียว → จุดที่พังง่ายมีที่เดียว
 */

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** อ่านค่าที่ผู้ใช้เลือกไว้ — คืนค่าเริ่มต้นถ้าอ่านไม่ได้หรือค่าเพี้ยน */
export function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    // เบราว์เซอร์โหมดส่วนตัวบางตัวบล็อก localStorage
    return DEFAULT_THEME;
  }
}

/** ค่าที่ใช้ตอนเรนเดอร์ฝั่งเซิร์ฟเวอร์ (และตอน hydrate) */
export function readServerTheme(): Theme {
  return DEFAULT_THEME;
}

/**
 * บันทึกค่าที่ผู้ใช้เลือก
 * ต้อง emit เองเพราะ `storage` event ไม่ยิงในแท็บที่เขียนค่า
 */
export function writeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // เขียนไม่ได้ก็ยังต้องให้ธีมเปลี่ยนในหน้านี้
  }
  emit();
}

/** สมัครรับการเปลี่ยนแปลง — รวมการเปลี่ยนจากแท็บอื่นด้วย (storage event) */
export function subscribeTheme(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * ความยินยอมเรื่องคุกกี้
 *
 * เก็บเฉพาะ "คำตอบ" (all / essential) ไม่เก็บข้อมูลส่วนบุคคล
 * ใช้ attribute บน <html> ที่ตั้งโดยสคริปต์ก่อน paint เพื่อให้ซ่อนแถบได้ด้วย CSS
 * → ไม่ต้องใช้ state ใน React และผู้ใช้ที่ตอบแล้วจะไม่เห็นแถบวาบขึ้นมาอีก
 */

export const COOKIE_CONSENT_STORAGE_KEY = "waiwai-cookie-consent";

/** attribute ที่ติดบน <html> — ต้องตรงกับกฎ CSS ใน app/globals.css */
export const COOKIE_CONSENT_ATTRIBUTE = "data-cookie-consent";

export const COOKIE_CONSENT_VALUES = ["all", "essential"] as const;

export type CookieConsent = (typeof COOKIE_CONSENT_VALUES)[number];

export function isCookieConsent(value: unknown): value is CookieConsent {
  return typeof value === "string" && (COOKIE_CONSENT_VALUES as readonly string[]).includes(value);
}

/**
 * สคริปต์ก่อน paint: ถ้าผู้ใช้เคยตอบแล้ว ให้ติด attribute ไว้เลย
 * แถบจะถูกซ่อนด้วย CSS ตั้งแต่เฟรมแรก — ไม่มีอาการแถบวาบ
 */
export const COOKIE_CONSENT_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem(${JSON.stringify(COOKIE_CONSENT_STORAGE_KEY)});if(v==="all"||v==="essential"){document.documentElement.setAttribute(${JSON.stringify(COOKIE_CONSENT_ATTRIBUTE)},v);}}catch(_){}})();`;

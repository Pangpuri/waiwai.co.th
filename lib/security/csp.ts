/**
 * Content-Security-Policy ของเว็บนี้ (รอบที่ 170) — **ตรรกะล้วน ทดสอบได้ ไม่มี Next/DB/env**
 *
 * ⭐ ทำไม **ไม่ใช้ nonce** (ตัดสินใจโดยเจ้าของ 2026-10-07)
 *   เอกสาร Next ที่ติดตั้งจริง (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`)
 *   ระบุชัดว่า nonce ต้องเรนเดอร์ทุกหน้าแบบ **dynamic** ⇒ **ปิด ISR/static** และ CDN cache ไม่ได้
 *   ซึ่งขัดกับสัญญาหลักของเว็บนี้ (`export const revalidate = 300` · หน้าสาธารณะเป็น ● / ○)
 *   ⇒ เลือกแนวนโยบายที่ **ไม่บล็อกสคริปต์ inline ของ Next + สคริปต์ก่อน paint ของธีม/ป้ายประกาศ**
 *     แต่ยังล็อกสิ่งที่เสี่ยงจริง (ดูรายการด้านล่าง) · เก็บ "nonce" ไว้เป็นทางเลือกอนาคตถ้าเจ้าของรับเงื่อนไขได้
 *
 * สิ่งที่ได้จริงจากนโยบายนี้
 * - `object-src 'none'` — ปิดการฝัง object/embed (ช่องโหว่เก่า)
 * - `base-uri 'self'` — กัน `<base>` ถูกสลับให้ลิงก์ทั้งหน้าชี้ไปโดเมนอื่น
 * - `form-action 'self'` — กันฟอร์มถูกส่งออกนอกเว็บ (ฟอร์มจริง/Server Action เป็น same-origin อยู่แล้ว)
 * - `frame-ancestors 'self'` — กัน clickjacking จากเว็บอื่น **แต่ยังยอมให้ตัวสร้างหน้าเว็บฝังพรีวิวของตัวเอง**
 *   (⚠️ ห้ามใช้ `'none'` เด็ดขาด — จะบล็อก iframe พรีวิวใน `/admin/builder/*` แล้วหลังบ้านพัง)
 * - `frame-src 'self' <youtube-nocookie>` — ฝังได้เฉพาะพรีวิวของเรา + ผู้เล่นวิดีโอเมนูอาหาร (มติ D20)
 * - `connect-src 'self'` — กันการส่งข้อมูลออกไปโดเมนอื่น (ไม่มีการเรียก API ภายนอก)
 * - `img-src 'self' blob: data:` · `font-src 'self'` · `media-src 'self'`
 *
 * ⚠️ ข้อจำกัดที่รู้ตัว (ต้องพูดตรง ๆ)
 *   `script-src`/`style-src` ยังต้องมี `'unsafe-inline'` เพราะ Next ฝังสคริปต์ RSC ต่อคำขอ
 *   และเว็บมีสคริปต์ก่อน paint (`features/shell/ui/inline-script.tsx`) + inline style attribute
 *   ⇒ นโยบายนี้ **ไม่ได้กัน XSS ที่ฝัง inline script ได้** แต่กันการโหลดสคริปต์/เฟรม/ฟอร์มจากภายนอก
 *   ถ้าต้องการกัน inline จริงต้องใช้ nonce ⇒ แลกกับ ISR (ดูด้านบน)
 */

/** โดเมนผู้เล่นวิดีโอที่อนุญาตให้ฝัง (มติ D20 — ใช้ `youtube-nocookie` เท่านั้น) */
export const CSP_FRAME_SOURCES = ["https://www.youtube-nocookie.com"] as const;

/** directive ที่ต้องมีเสมอ — เขียนเป็นรายการเพื่อให้เทสต์ตรวจทีละตัวได้ */
export const CSP_REQUIRED_DIRECTIVES: Readonly<Record<string, string>> = {
  "default-src": "'self'",
  "object-src": "'none'",
  "base-uri": "'self'",
  "form-action": "'self'",
  /* ⚠️ ต้องเป็น 'self' ไม่ใช่ 'none' — iframe พรีวิวในหลังบ้านเป็น same-origin */
  "frame-ancestors": "'self'",
};

/**
 * สร้างค่า header `Content-Security-Policy`
 * - `isDev` = เพิ่ม `'unsafe-eval'` (React ใช้ eval เฉพาะ dev) และเปิด `ws:`/`wss:` ให้ HMR ทำงาน
 * - production = เพิ่ม `upgrade-insecure-requests`
 */
export function contentSecurityPolicy(options: { readonly isDev: boolean }): string {
  const isDev = options.isDev;

  const directives: string[] = [
    `default-src ${CSP_REQUIRED_DIRECTIVES["default-src"] ?? "'self'"}`,
    /* Next ฝังสคริปต์ RSC + สคริปต์ก่อน paint ⇒ ต้องมี unsafe-inline (ตั้งใจ — ดูเหตุผลด้านบน) */
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "media-src 'self'",
    `object-src ${CSP_REQUIRED_DIRECTIVES["object-src"] ?? "'none'"}`,
    `base-uri ${CSP_REQUIRED_DIRECTIVES["base-uri"] ?? "'self'"}`,
    `form-action ${CSP_REQUIRED_DIRECTIVES["form-action"] ?? "'self'"}`,
    `frame-ancestors ${CSP_REQUIRED_DIRECTIVES["frame-ancestors"] ?? "'self'"}`,
    `frame-src 'self' ${CSP_FRAME_SOURCES.join(" ")}`,
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  ];

  if (!isDev) directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}

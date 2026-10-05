/**
 * ตัวแมตช์กฎ `.vercelignore` (รอบที่ 119) — pure ล้วน
 *
 * ทำไมต้องแยกออกมา: บทเรียนจริง 2026-10-05 — กฎโฟลเดอร์ที่ไม่มี `/` นำหน้า
 * (`products/` · `contact/`) ไปตัด `features/products/` และ `features/contact/`
 * ⇒ build บน Vercel ล้มด้วย "Module not found" ทั้งบิลด์
 *
 * ⇒ ตรรกะนี้ถูกใช้ 2 ที่ เพื่อยืนยันว่า **ไฟล์ของแอปไม่ถูกตัด**
 *   1. `scripts/test-deploy-config-vercel.ts` — ตรวจกฎโดยตรง + ห้ามกฎที่ไม่ยึดราก
 *   2. `scripts/test-import-resolvability.ts` — ตรวจทุก import `@/…` ว่ายังขึ้น build จริง
 */

export type IgnoreRule = string;

export function parseIgnoreRules(text: string): readonly IgnoreRule[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

/**
 * จำลองการแมตช์ของ gitignore เท่าที่กฎของโปรเจกต์ใช้
 * - ไม่มี `/` นำหน้า = แมตช์ที่ชั้นใดก็ได้ (ต้นเหตุของบั๊กจริง)
 * - ลงท้ายด้วย `/` = โฟลเดอร์ (กันไฟล์ข้างในทั้งหมด)
 * - รองรับ `*` เดียวในชื่อไฟล์ (ไม่รองรับ `**`)
 */
export function matchesIgnoreRule(rule: string, path: string): boolean {
  const isDir = rule.endsWith("/");
  const body = isDir ? rule.slice(0, -1) : rule;
  const anchored = body.startsWith("/");
  const clean = body.replace(/^\//, "");

  const escaped = clean.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  const prefix = anchored ? "^" : "^(?:.*/)?";
  /* กฎที่ไม่ลงท้ายด้วย `/` ยังแมตช์โฟลเดอร์ชื่อนั้นด้วย (เช่น `.vercel` ต้องกัน `.vercel/project.json`) */
  return new RegExp(`${prefix}${escaped}(?:/.*)?$`).test(path);
}

/** กฎแรกที่ตัด path นี้ (null = ไม่ถูกตัด) */
export function ignoredRuleFor(path: string, rules: readonly IgnoreRule[]): IgnoreRule | null {
  for (const rule of rules) if (matchesIgnoreRule(rule, path)) return rule;
  return null;
}

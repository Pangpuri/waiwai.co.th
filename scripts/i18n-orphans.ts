/**
 * ตัวช่วยกลางของ "คีย์พจนานุกรมที่ไม่มีใครอ้าง" (หนี้ **D-252-1**)
 *
 * ## ที่มา
 * โมดูลที่ถูกถอดออกจากระบบ (เช่น การ์ดแคมเปญบนสไลด์ · บล็อก `jobBoard` · จอป้ายประกาศที่ซ้ำกับ
 * "ส่วนกลางของเว็บ") ทิ้ง **คีย์พจนานุกรม** ไว้เบื้องหลัง เพราะลบโค้ด/หน้าจอแล้วแต่ไม่ได้ลบคีย์
 * ⇒ ไฟล์พื้นที่โตขึ้นเรื่อย ๆ ด้วยข้อความที่ไม่มีวันถูกแสดง (และหลอกให้เข้าใจว่ายังมีฟีเจอร์นั้นอยู่)
 *
 * ## วิธีตัดสิน "ไม่มีใครอ้าง"
 * 1. คีย์ระดับรากของแต่ละไฟล์พื้นที่ (`^ {2}key:` — คีย์ที่ซ้อนใน object เช่น `issueLabels` **ไม่นับ**
 *    เพราะค่าของมันถูกอ่านผ่าน `strings.issueLabels[code]` ไม่ใช่ผ่านชื่อคีย์)
 * 2. สแกนไฟล์ซอร์สทั้งหมด (`app` · `features` · `lib` · `scripts` · `db` + ไฟล์ที่รากโปรเจกต์)
 *    **หลังตัดคอมเมนต์** ด้วย `stripComments()` — คีย์ที่ถูกพูดถึงแค่ในคอมเมนต์ = ไม่ถูกใช้จริง
 *    (บทเรียนเดียวกับ `scripts/source-scan.ts`: "คอมเมนต์ทำให้ผ่านด่าน = ด่านปลอม")
 * 3. จับด้วย **ขอบเขตที่ชัดเจน** ไม่ใช่ `\b` — เพราะ `$` เป็นอักขระที่ไม่ใช่ word char
 *    ใน JS regex (`\b` จะทำให้ `strings[key]` บางรูปแบบพลาด) และกันเคส "ชื่อขึ้นต้นเหมือนกัน"
 *    (`fieldEn` ต้องไม่ถูกนับเพราะมี `fieldEnOptional`)
 *
 * ⚠️ เป็นการตรวจแบบ **literal** — คีย์ที่ถูกประกอบชื่อขึ้นมาใหม่ (เช่น `` `heroCard${state}` ``)
 * จะถูกมองว่าไม่ถูกอ้าง · เจตนา: ให้เขียนชื่อคีย์ตรง ๆ (อ่านง่าย + ด่านจับได้) ถ้าจำเป็นต้องประกอบชื่อ
 * ให้เพิ่มคีย์นั้นเข้า `ALLOWED_ORPHAN_KEYS` พร้อมคอมเมนต์เหตุผล
 *
 * ⚠️ ไฟล์นี้ **ไม่ขึ้นต้นด้วย `test-`** โดยตั้งใจ (แบบเดียวกับ `scripts/source-scan.ts`)
 */

/** โฟลเดอร์ที่ต้องสแกนหาการใช้คีย์ (นอกจากไฟล์ `.ts`/`.mjs` ที่รากโปรเจกต์) */
export const ORPHAN_SCAN_ROOTS = ["app", "features", "lib", "scripts", "db"] as const;

/** นามสกุลไฟล์ที่ถือว่าเป็น "ซอร์สที่ใช้คีย์ได้" */
export const ORPHAN_SOURCE_FILE = /\.(ts|tsx|mjs|js)$/;

/** คีย์ระดับรากของไฟล์พื้นที่ = เยื้อง 2 ช่องแล้วลงท้ายด้วย `:` */
export const AREA_TOP_LEVEL_KEY = /^ {2}([A-Za-z0-9_]+):/;

/**
 * คีย์ที่ **ตั้งใจ** ให้ไม่มีใครอ้าง (เช่น เก็บไว้ใช้ในอนาคตที่ตกลงกันแล้ว)
 * ⚠️ ควรว่างเปล่า — เพิ่มได้เฉพาะเมื่อมีเหตุผลเขียนกำกับ
 */
export const ALLOWED_ORPHAN_KEYS: readonly string[] = [];

/** ดึงชื่อคีย์ระดับรากทั้งหมดจากไฟล์พื้นที่ (ไฟล์เดียวกันมีได้หลาย export) */
export function topLevelKeysOfArea(source: string): string[] {
  const keys: string[] = [];
  for (const line of source.replaceAll("\r\n", "\n").split("\n")) {
    const match = AREA_TOP_LEVEL_KEY.exec(line);
    if (match?.[1] !== undefined) keys.push(match[1]);
  }
  return keys;
}

/**
 * รูปแบบที่ถือว่า "มีการอ้างคีย์นี้"
 * ใช้ชุดอักขระที่ไม่ใช่ตัวระบุแทน `\b` โดยเจตนา (ดูเหตุผลในหัวไฟล์)
 */
export function keyUsagePattern(key: string): RegExp {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_$])${escaped}([^A-Za-z0-9_$]|$)`);
}

/** คีย์นี้ถูกอ้างในซอร์สที่ให้มาหรือไม่ (ต้องเป็นซอร์สที่ตัดคอมเมนต์แล้ว) */
export function isReferenced(key: string, sources: readonly string[]): boolean {
  const pattern = keyUsagePattern(key);
  return sources.some((source) => pattern.test(source));
}

/** คีย์ที่ไม่มีใครอ้าง (เรียงตามลำดับที่รับมา — ไม่เรียงใหม่ เพื่อให้รายงานตรงกับไฟล์) */
export function findOrphanKeys(keys: readonly string[], sources: readonly string[]): string[] {
  const allowed = new Set(ALLOWED_ORPHAN_KEYS);
  return keys.filter((key) => !allowed.has(key) && !isReferenced(key, sources));
}

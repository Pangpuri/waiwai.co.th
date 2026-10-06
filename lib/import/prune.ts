/**
 * วางแผน "ของที่หายไปจากต้นทาง" สำหรับสคริปต์นำเข้า (รอบที่ 142 · หนี้ A2)
 *
 * ที่มา: หนี้เดิม — นำเข้าจากเว็บเดิมแล้ว **ของที่ถอดออกจากเว็บเดิมยังค้างในฐานข้อมูล**
 * (ไม่มี `--prune`) ⇒ ตัวนี้คำนวณ "ควรย้ายเข้าถังขยะตัวไหน" ให้สคริปต์รายงาน/ลงมือ
 *
 * ⚠️ **ไม่ลบถาวรเด็ดขาด** — สคริปต์จะ "ย้ายเข้าถังขยะ" (`deleted_at`) เท่านั้น ⇒ กู้คืนได้จากหลังบ้าน
 *   (หลักเดียวกับรอบที่ 139/140: การลบต้องย้อนกลับได้เสมอ)
 *
 * ตรรกะล้วน (ทดสอบได้โดยไม่ต้องมี DB) · เรียงผลลัพธ์ให้อ่านง่าย/เทสต์นิ่ง
 */
export function prunePlan(databaseIds: readonly string[], importedIds: readonly string[]): readonly string[] {
  const imported = new Set(importedIds);
  const seen = new Set<string>();
  const missing: string[] = [];
  for (const id of databaseIds) {
    const key = id.trim();
    if (key === "" || imported.has(key) || seen.has(key)) continue;
    seen.add(key);
    missing.push(key);
  }
  return missing.sort();
}

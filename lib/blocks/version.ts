/**
 * ตัวช่วยเทียบ **optimistic concurrency token** ของ `page_document` (รอบที่ 323)
 *
 * token คือ epoch ไมโครวินาทีของ `updated_at` ที่เก็บเป็นสตริง
 * ⇒ ต้องเทียบด้วย BigInt ไม่ใช่ `>` ของสตริง/Number (Number อาจไม่แม่นที่หลัก 16)
 * ตรรกะทั้งหมดบริสุทธิ์ ⇒ เทสต์ได้โดยไม่ต้องมี DB
 */

export type VersionConflict = {
  readonly version: string | null;
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
};

/** แปลง token เป็น BigInt — ค่าที่ว่าง/รูปแบบผิด = null (ไม่โยน error) */
export function versionValueOf(value: string | null | undefined): bigint | null {
  if (typeof value !== "string" || value === "") return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/** เลือก token ล่าสุดจากหลายแหล่ง (autosave / schedule / publish / restore) */
export function latestVersionOf(candidates: readonly (string | null | undefined)[]): string | null {
  let best: string | null = null;
  let bestValue: bigint | null = null;

  for (const candidate of candidates) {
    const value = versionValueOf(candidate);
    if (value === null) continue;
    if (bestValue === null || value > bestValue) {
      best = candidate ?? null;
      bestValue = value;
    }
  }

  return best;
}

/**
 * conflict จาก action ยังต้องแสดงอยู่ไหม
 * - หลัง "บันทึกทับ" สำเร็จ token ในเครื่องจะใหม่กว่าฝั่งที่ชน ⇒ ถือว่าจบแล้ว
 * - เทียบไม่ได้ (token ว่าง/รูปแบบผิด) ⇒ แสดงไว้ก่อน (ปลอดภัยกว่า)
 */
export function isUnresolvedConflict(conflict: VersionConflict | null, currentVersion: string | null): boolean {
  if (conflict === null) return false;
  const current = versionValueOf(currentVersion);
  const remote = versionValueOf(conflict.version);
  if (current === null || remote === null) return true;
  return current <= remote;
}

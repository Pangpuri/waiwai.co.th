/**
 * วางแผนซิงก์คลังภาพระหว่างเครื่องกับปลายทาง (D-305-1)
 *
 * ตรรกะล้วน — ไม่แตะ DB/Next ⇒ เทสต์ได้ด้วย `node --test`
 *
 * กติกา:
 * - คัดลอกเฉพาะภาพที่ **ปลายทางยังไม่มี** (id หาย)
 * - **ไม่ทับ** ภาพที่มี id อยู่แล้ว (ภาพที่อัปโหลดบน Vercel ต้องไม่ถูกแทนที่)
 * - รายงานภาพที่ปลายทางมีเกิน (cloud-only) เพื่อให้รู้ว่าไม่ควรลบ
 */

export type MediaSyncRow = {
  readonly id: string;
  readonly sizeBytes: number;
};

export type MediaSyncPlan = {
  readonly missing: readonly MediaSyncRow[];
  readonly cloudOnly: readonly string[];
  readonly missingBytes: number;
};

export function planMediaSync(
  local: readonly MediaSyncRow[],
  target: readonly MediaSyncRow[],
): MediaSyncPlan {
  const targetIds = new Set(target.map((row) => row.id));
  const localIds = new Set(local.map((row) => row.id));
  const missing = local.filter((row) => !targetIds.has(row.id));
  const cloudOnly = target.filter((row) => !localIds.has(row.id)).map((row) => row.id);
  return {
    missing,
    cloudOnly,
    missingBytes: missing.reduce((sum, row) => sum + row.sizeBytes, 0),
  };
}

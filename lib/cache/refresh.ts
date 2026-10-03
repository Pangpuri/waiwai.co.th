import { revalidatePath } from "next/cache";

import { refreshPlan, shouldRunRebuild, type PublishKind } from "@/lib/cache/plan";
import { runRebuild, type RebuildResult } from "@/lib/rebuild";

/**
 * "ตัวลงมือ" ทำให้หน้าเว็บสดใหม่หลังแก้จากหลังบ้าน (X1.7)
 *
 * ⚠️ ไฟล์นี้มี `next/cache` ⇒ **เรียกได้เฉพาะใน Server Action / Route Handler** เท่านั้น
 *    (นโยบาย/การตัดสินใจทั้งหมดอยู่ใน `lib/cache/plan.ts` ซึ่งบริสุทธิ์และมีเทสต์)
 *
 * ลำดับที่ใช้ (เจตนา)
 *   1. `revalidatePath` — บอก Next ว่าเพจที่cache ไว้เก่าแล้ว (สร้างใหม่เมื่อมีคนเปิดครั้งถัดไป)
 *   2. สั่ง rebuild **เฉพาะเมื่อผู้ดูแลตั้ง env ไว้** (โฮสต์ที่ไม่มี ISR) — ถ้าไม่ตั้งคือ "ไม่ต้องทำอะไรเพิ่ม"
 *
 * ความปลอดภัย/ความทนทาน
 * - revalidate ล้มเหลว = โยน error ขึ้นไปให้ action ตัดสินใจ (แต่การเผยแพร่ลง DB สำเร็จไปแล้ว)
 * - rebuild ล้มเหลว **ไม่ทำให้การเผยแพร่ล้ม** (พฤติกรรมเดิมจาก S1)
 */

export type RefreshResult = {
  /** จำนวน path ที่สั่งให้สดใหม่ (จากแผน) */
  readonly revalidated: number;
  /** ผลของการสั่งสร้างเว็บใหม่ · `isr` = ไม่ต้องสั่ง เพราะ ISR จัดการเอง */
  readonly rebuild: RebuildResult | { readonly kind: "isr" };
};

/** ทำหน้าเว็บสาธารณะให้สดใหม่ตามชนิดของสิ่งที่เพิ่งเผยแพร่ */
export async function refreshPublicSite(kind: PublishKind): Promise<RefreshResult> {
  const plan = refreshPlan(kind);

  if (plan.revalidateAll) {
    /* สร้างใหม่ทั้งเว็บ — เปลือกเว็บ (หัวเว็บ/ท้ายเว็บ/ป้าย/ตั้งค่า) อยู่ทุกหน้า */
    revalidatePath("/", "layout");
  } else {
    for (const path of plan.paths) revalidatePath(path);
  }

  const rebuild = shouldRunRebuild(process.env) ? await runRebuild() : ({ kind: "isr" } as const);
  return { revalidated: plan.paths.length, rebuild };
}

/** เพจของหลังบ้านเอง (เช่นหน้าจอที่เพิ่งบันทึก) — ไม่เกี่ยวกับหน้าเว็บสาธารณะ */
export function revalidateAdminPath(path: string): void {
  revalidatePath(path);
}

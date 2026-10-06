"use server";

import { revalidatePath } from "next/cache";

import type { ReorderState } from "@/features/admin/ui/sortable-list";
import { isReorderKind, parseOrderCsv, reorderRows } from "@/lib/admin/reorder";
import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { revalidateAdminPath, refreshPublicSite } from "@/lib/cache/refresh";

/** หน้าจอจัดลำดับ (รอบที่ 153–154) — บันทึกลำดับของสินค้า/เมนูอาหาร/ข่าว */
const SORT_PATH = "/admin/sort";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * บันทึกลำดับ — **คืนสถานะให้หน้าจอ** (รอบที่ 154)
 *
 * เดิม action คืน `void` ผู้ใช้จึงไม่รู้ว่ากดติดหรือไม่ ⇒ ตอนนี้คืน `{ saved, failed }`
 * ให้ `useActionState` แสดง "บันทึกแล้ว N รายการ" และประกาศผ่าน `aria-live`
 */
export async function reorderAction(_previous: ReorderState, formData: FormData): Promise<ReorderState> {
  const user = await requireAdminUser("content");
  const kind = field(formData, "kind");
  if (!isReorderKind(kind)) return { saved: 0, failed: true };

  const ids = parseOrderCsv(field(formData, "order"));
  if (ids.length === 0) return { saved: 0, failed: true };

  const changed = await reorderRows(kind, ids, user.email);
  if (changed === 0) return { saved: 0, failed: true };

  await recordAudit({
    action: "content-reorder",
    actorEmail: user.email,
    target: `sort:${kind}`,
    detail: `rows=${String(changed)}`,
  });

  revalidateAdminPath(SORT_PATH);
  revalidateAdminPath("/admin");
  revalidatePath(SORT_PATH);
  await refreshPublicSite("page");

  return { saved: changed, failed: false };
}

"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit/log";
import { isReorderKind, parseOrderCsv, reorderRows } from "@/lib/admin/reorder";
import { requireAdminUser } from "@/lib/auth/dal";
import { revalidateAdminPath, refreshPublicSite } from "@/lib/cache/refresh";

/** หน้าจอจัดลำดับ (รอบที่ 153) — บันทึกลำดับของสินค้า/เมนูอาหาร/ข่าว */
const SORT_PATH = "/admin/sort";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function reorderAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const kind = field(formData, "kind");
  if (!isReorderKind(kind)) return;

  const ids = parseOrderCsv(field(formData, "order"));
  const changed = await reorderRows(kind, ids, user.email);
  if (changed === 0) return;

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
}

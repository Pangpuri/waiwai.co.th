"use server";

import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/auth/dal";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { normalizePresetName, saveBlockPreset } from "@/lib/blocks/presets";
import { documentErrorsOf, validateDocument } from "@/lib/blocks/validate";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { trashBlockPreset } from "@/lib/trash/repository";

/**
 * Server Actions ของ "พรีเซ็ตบล็อก" (ผู้ใช้สั่ง รอบที่ 52)
 *
 * เก็บเฉพาะ 2 อย่างที่ต้องแตะฐานข้อมูล: **บันทึกพรีเซ็ต** และ **ลบพรีเซ็ต**
 * ส่วน "วางในหน้า" / "ทับของเดิม" ทำในหน้าจอ (แก้ state) แล้วค่อยกดบันทึก/เผยแพร่ตามปกติ
 * ⇒ ไม่เขียนฐานข้อมูลก่อนผู้ใช้สั่ง และใช้กลไกฉบับร่าง/เผยแพร่เดิม
 */

const BUILDER_BASE = "/admin/builder";

function pathOf(page: string): string {
  return `${BUILDER_BASE}/${page}`;
}

/** บันทึกบล็อกที่เลือกเป็นพรีเซ็ต (รับเอกสารทั้งก้อนจากหน้าจอ + id ของบล็อก) */
export async function savePresetAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return;

  const page = String(formData.get("page") ?? "").trim();
  const blockId = String(formData.get("blockId") ?? "").trim();
  const name = normalizePresetName(String(formData.get("name") ?? ""));
  const payload = formData.get("payload");

  if (page === "" || blockId === "" || name === null) return;
  if (typeof payload !== "string" || payload.trim() === "") return;

  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return;
  }

  /* ไม่เชื่อข้อมูลจากเบราว์เซอร์ — ต้องผ่าน parse + validate เสมอ */
  const parsed = parseBlockDocument(page, raw);
  if (!parsed.ok) return;
  if (documentErrorsOf(validateDocument(parsed.document)).length > 0) return;

  const block = parsed.document.blocks.find((entry) => entry.id === blockId);
  if (block === undefined) return;

  await saveBlockPreset(name, block, user.email);
  revalidatePath(pathOf(page));
}

export async function deletePresetAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  if (!isDatabaseConfigured()) return;

  const id = String(formData.get("id") ?? "").trim();
  const page = String(formData.get("page") ?? "").trim();
  if (id === "") return;

  /* X2.4 — "ลบ" พรีเซ็ต = ย้ายเข้าถังขยะ (กู้คืนได้ 30 วัน) ไม่ใช่ลบถาวรทันที */
  await trashBlockPreset(id, user.email);
  if (page !== "") revalidatePath(pathOf(page));
}

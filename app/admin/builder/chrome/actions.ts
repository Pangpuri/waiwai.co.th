"use server";

import { revalidatePath } from "next/cache";
import { refreshPublicSite } from "@/lib/cache/refresh";

import { requireAdminUser } from "@/lib/auth/dal";
import { loadDocumentRow, publishDraft } from "@/lib/blocks/repository";
import { NAVBAR_PAGE_KEY } from "@/lib/chrome/navbar";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { MOURNING_PAGE_KEY } from "@/lib/mourning/config";

/**
 * การกระทำระดับ "ส่วนกลางของเว็บ" (ผู้ใช้สั่ง รอบที่ 55)
 *
 * ภาพรวม (แท็บที่ 3) ให้เลือก 2 ทาง: **เก็บไว้ก่อน** (บันทึกฉบับร่าง — แต่ละส่วนมีปุ่มของตัวเอง)
 * หรือ **ใช้กับเว็บจริงเลย** (อันนี้ = เผยแพร่ทุกส่วนที่มีฉบับร่างค้างอยู่)
 *
 * ⚠️ ผู้ใช้กดเองเสมอ · ตรวจสิทธิ์ทุกครั้ง · ไม่เผยแพร่ส่วนที่ไม่มีฉบับร่าง (ไม่สร้างแถวเปล่า)
 */

const CHROME_PATH = "/admin/builder/chrome";

const CHROME_KEYS: readonly string[] = [NAVBAR_PAGE_KEY, MOURNING_PAGE_KEY];

export async function publishChromeAction(): Promise<void> {
  await requireAdminUser("presets");
  if (!isDatabaseConfigured()) return;

  const user = await requireAdminUser("presets");

  for (const key of CHROME_KEYS) {
    const draft = await loadDocumentRow(key, "draft");
    if (draft === null) continue;
    await publishDraft(key, user.email, null);
  }

  revalidatePath(CHROME_PATH);
  revalidatePath("/admin/builder/home");
  /* แถบเมนู/ท้ายเว็บอยู่ทุกหน้า ⇒ ทำให้หน้าเว็บสาธารณะสดใหม่ทั้งเว็บ (X1.7) */
  await refreshPublicSite("chrome");
}

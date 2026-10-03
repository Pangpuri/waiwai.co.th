"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type SaveState } from "@/features/admin/save-state";
import { requireAdminUser } from "@/lib/auth/dal";
import { HOME_SEED } from "@/lib/content/home-seed";
import { HOME_PAGE_SPEC } from "@/lib/content/model";
import { parsePageContent } from "@/lib/content/parse";
import { importPageSeed, savePageContent } from "@/lib/content/repository";
import { errorsOf, validateContent, warningsOf } from "@/lib/content/validate";

/**
 * Server Actions ของหน้าจอแก้เนื้อหา
 *
 * ลำดับการทำงาน (เหมือนกันทั้งบันทึกและนำเข้า)
 *   1. **ตรวจสิทธิ์ก่อนเสมอ** (`requireAdminUser()`) — กติกา: ตรวจฝั่งเซิร์ฟเวอร์ทุกคำขอ
 *   2. แปลงข้อมูลที่ส่งมาแบบไม่เชื่อใจ (`parsePageContent`) — ไม่ใช่ `as` แล้วเชื่อ
 *   3. ตรวจเนื้อหาด้วย validator ตัวเดียวกับที่ด่าน `check:content` ใช้
 *   4. เขียนลง DB ในทรานแซกชัน (upsert + ลบรายการที่หายไป) พร้อมเก็บชื่อผู้แก้
 *   5. คืนสถานะให้หน้าจอแสดง (ไม่ redirect เพื่อไม่ให้ผู้ใช้เสียสิ่งที่พิมพ์ไว้)
 */

const CONTENT_PATH = "/admin/content/home";

export async function saveHomeAction(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const user = await requireAdminUser();

  const payload = formData.get("payload");
  if (typeof payload !== "string" || payload.trim() === "") {
    return { status: "failed", written: 0, deleted: 0, errors: [], warnings: 0, problems: ["ไม่พบข้อมูลที่ส่งมาจากฟอร์ม"] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return { status: "failed", written: 0, deleted: 0, errors: [], warnings: 0, problems: ["ข้อมูลที่ส่งมาไม่ใช่ JSON ที่อ่านได้"] };
  }

  const parsed = parsePageContent(HOME_PAGE_SPEC, raw);
  if (!parsed.ok) {
    return { status: "invalid", written: 0, deleted: 0, errors: [], warnings: 0, problems: parsed.problems };
  }

  const issues = validateContent(HOME_PAGE_SPEC, parsed.content);
  const errors = errorsOf(issues);
  const warnings = warningsOf(issues).length;

  if (errors.length > 0) {
    return {
      status: "invalid",
      written: 0,
      deleted: 0,
      errors: errors.map((issue) => ({ code: issue.code, path: issue.path })),
      warnings,
      problems: [],
    };
  }

  try {
    const result = await savePageContent(HOME_PAGE_SPEC, parsed.content, user.email);
    revalidatePath(CONTENT_PATH);
    return { status: "saved", written: result.written, deleted: result.deleted, errors: [], warnings, problems: [] };
  } catch {
    return {
      status: "failed",
      written: 0,
      deleted: 0,
      errors: [],
      warnings,
      problems: ["บันทึกลงฐานข้อมูลไม่สำเร็จ — ตรวจว่า DATABASE_URL ยังใช้ได้"],
    };
  }
}

/** นำเข้าข้อความชุดตั้งต้น (จากพจนานุกรมเดิม) — ใช้เมื่อฐานข้อมูลยังว่าง */
export async function importHomeSeedAction(): Promise<void> {
  const user = await requireAdminUser();
  await importPageSeed(HOME_PAGE_SPEC, HOME_SEED, user.email);
  revalidatePath(CONTENT_PATH);
  redirect(CONTENT_PATH);
}

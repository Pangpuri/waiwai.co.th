"use server";

import { revalidatePath } from "next/cache";

import type { ChromePresetActionState, ChromePresetImportState } from "@/features/admin/chrome-preset-state";
import { requireAdminUser } from "@/lib/auth/dal";
import { isChromePresetKind, parseChromePresetExport } from "@/lib/chrome/presets";
import {
  applyChromePreset,
  importChromePresets,
  saveChromePresetFromRow,
  undoChromePreset,
  type ApplyChromePresetResult,
  type SaveChromePresetResult,
} from "@/lib/chrome/preset-repository";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { trashChromePreset } from "@/lib/trash/repository";

/**
 * Server Actions ของ "พรีเซ็ตของส่วนกลาง" (W3b)
 *
 * กติกาความปลอดภัย/ความถูกต้อง
 * - ทุก action เริ่มด้วย `requireAdminUser("<permission>")` (ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ ไม่พึ่ง UI)
 * - `kind` ต้องเป็นส่วนที่รองรับ (`isChromePresetKind`) — ค่าจากฟอร์มไม่มีทางเลือกตาราง/พาธเอง
 * - "ใช้ชุดนี้" เขียนทับ **เฉพาะฉบับร่าง** (ผ่าน `applyChromePreset`) ⇒ เว็บจริงไม่เปลี่ยนจนกดเผยแพร่
 * - ลบ = ย้ายเข้าถังขยะกลางเท่านั้น (ไม่มีทางลบถาวรจากหน้าจอพรีเซ็ต)
 */

const CHROME_PATH = "/admin/builder/chrome";
const TRASH_PATH = "/admin/trash";

/** หน้าเว็บสาธารณะใช้แถบเมนู/ท้ายเว็บทุกหน้า — ทำให้พรีวิวหลังบ้านตรงกับของจริงเสมอ */
function revalidateChrome(): void {
  revalidatePath(CHROME_PATH);
  revalidatePath("/admin/builder/home");
  revalidatePath(TRASH_PATH);
}

function saveFailureReason(result: SaveChromePresetResult): ChromePresetActionState["code"] {
  return result.ok ? null : result.reason;
}

function applyFailureReason(result: ApplyChromePresetResult): ChromePresetActionState["code"] {
  return result.ok ? null : result.reason;
}

/** บันทึกชุดปัจจุบัน (ฉบับร่าง = ของใหม่ · ฉบับเผยแพร่ = ของเก่า) เป็นพรีเซ็ต */
export async function saveChromePresetAction(
  _previous: ChromePresetActionState,
  formData: FormData,
): Promise<ChromePresetActionState> {
  const user = await requireAdminUser("presets");
  if (!isDatabaseConfigured()) return { status: "failed", code: "no-database" };

  const kind = String(formData.get("kind") ?? "").trim();
  if (!isChromePresetKind(kind)) return { status: "failed", code: "invalid" };

  const source = formData.get("source") === "published" ? "published" : "draft";
  const messages = await getMessagesFor("th");

  const result = await saveChromePresetFromRow({
    kind,
    name: String(formData.get("name") ?? ""),
    source,
    actor: user.email,
    messages,
  });

  if (!result.ok) return { status: "failed", code: saveFailureReason(result) };

  revalidateChrome();
  /* `replaced` = เขียนทับชุดชื่อเดิม ⇒ ข้อความบอกผู้ใช้ต่างกัน (ไม่ให้เข้าใจว่าสร้างชุดใหม่) */
  return { status: "ok", code: result.replaced ? "overwritten" : "saved" };
}

/** ใช้ชุดนี้กับฉบับร่างของส่วนนั้น */
export async function applyChromePresetAction(
  _previous: ChromePresetActionState,
  formData: FormData,
): Promise<ChromePresetActionState> {
  const user = await requireAdminUser("presets");
  if (!isDatabaseConfigured()) return { status: "failed", code: "no-database" };

  const kind = String(formData.get("kind") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  if (!isChromePresetKind(kind) || id === "") return { status: "failed", code: "invalid" };

  const messages = await getMessagesFor("th");
  const result = await applyChromePreset({ kind, id, actor: user.email, messages });

  if (!result.ok) return { status: "failed", code: applyFailureReason(result) };

  revalidateChrome();
  return { status: "ok", code: "applied" };
}

/** ลบชุด = ย้ายเข้าถังขยะกลาง (กู้คืนได้จาก /admin/trash) */
export async function deleteChromePresetAction(
  _previous: ChromePresetActionState,
  formData: FormData,
): Promise<ChromePresetActionState> {
  const user = await requireAdminUser("presets");
  if (!isDatabaseConfigured()) return { status: "failed", code: "no-database" };

  const id = String(formData.get("id") ?? "").trim();
  if (id === "") return { status: "failed", code: "invalid" };

  const trashed = await trashChromePreset(id, user.email);
  if (!trashed) return { status: "failed", code: "not-found" };

  revalidateChrome();
  return { status: "ok", code: "deleted" };
}

/**
 * "ย้อนกลับ" ฉบับร่างก่อนใช้ชุด (รอบที่ 81)
 *
 * - ใช้ได้ครั้งเดียวต่อการกดใช้ชุดหนึ่งครั้ง (แถวข้อมูลย้อนกลับถูกลบเมื่อย้อนสำเร็จ)
 * - เขียนเฉพาะ **ฉบับร่าง** — ฉบับเผยแพร่ (เว็บจริง) ยังต้องกดเผยแพร่เองเสมอ
 */
export async function undoChromePresetAction(
  _previous: ChromePresetActionState,
  formData: FormData,
): Promise<ChromePresetActionState> {
  const user = await requireAdminUser("presets");
  if (!isDatabaseConfigured()) return { status: "failed", code: "no-database" };

  const kind = String(formData.get("kind") ?? "").trim();
  if (!isChromePresetKind(kind)) return { status: "failed", code: "invalid" };

  const messages = await getMessagesFor("th");
  const result = await undoChromePreset({ kind, actor: user.email, messages });

  if (!result.ok) {
    return { status: "failed", code: result.reason === "not-found" ? "undo-missing" : "invalid" };
  }

  revalidateChrome();
  return { status: "ok", code: "undo-done" };
}

/**
 * นำเข้าชุดของส่วนกลางจากไฟล์ JSON (W3b ต่อ · รอบที่ 91)
 *
 * ลำดับเดียวกับ action อื่น: ตรวจสิทธิ์ → ตรวจค่าที่ส่งมา → เรียก repository → revalidate
 * ⚠️ ไฟล์จากเบราว์เซอร์ = ข้อมูลที่ไม่เชื่อ ⇒ ผ่าน `parseChromePresetExport` เสมอ
 *    (ตรวจรูปแบบ/เวอร์ชัน/รูปทรงของทุกชุด · ชุดที่เสียถูกข้ามและรายงานจำนวน)
 */
export async function importChromePresetsAction(
  _previous: ChromePresetImportState,
  formData: FormData,
): Promise<ChromePresetImportState> {
  const user = await requireAdminUser("presets");
  if (!isDatabaseConfigured()) return { status: "failed", code: "no-database", imported: 0, skipped: 0 };

  const payload = String(formData.get("payload") ?? "");
  const messages = await getMessagesFor("th");

  const parsed = parseChromePresetExport(payload, messages);
  if (!parsed.ok) return { status: "failed", code: parsed.reason, imported: 0, skipped: 0 };

  const result = await importChromePresets({ presets: parsed.presets, actor: user.email, messages });
  if (!result.ok) {
    return {
      status: "failed",
      code: result.reason === "too-many" ? "too-many" : "no-database",
      imported: 0,
      skipped: 0,
    };
  }

  revalidateChrome();
  return { status: "ok", code: "imported", imported: result.imported, skipped: result.skipped + parsed.skipped };
}

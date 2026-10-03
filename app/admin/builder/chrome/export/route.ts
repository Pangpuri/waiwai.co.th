import { requireAdminUser } from "@/lib/auth/dal";
import { listChromePresets } from "@/lib/chrome/preset-repository";
import { serializeChromePresetExport } from "@/lib/chrome/presets";
import { getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * ดาวน์โหลดพรีเซ็ตของส่วนกลางทั้งหมด (W3b ต่อ · รอบที่ 91)
 *
 * ทำไมต้องมี (หนี้ที่ค้างจาก W3b)
 * - ชุดที่ผู้ใช้บันทึกไว้อยู่แต่ในฐานข้อมูลเครื่องเดียว ⇒ ย้ายเครื่อง/สำรองชุดได้แค่ backup ทั้งก้อน
 * - ไฟล์นี้เป็น JSON อ่านได้ ⇒ เก็บไว้เป็นสำเนาได้ และนำเข้ากลับผ่านหน้าจอได้
 *
 * ⚠️ ต้องล็อกอิน + มีสิทธิ์ `presets` เสมอ (`requireAdminUser` — ไม่มีเส้นทางสาธารณะ)
 * ⚠️ `no-store` + `noindex` และชื่อไฟล์เป็น ASCII (HTTP header ใส่ภาษาไทยตรง ๆ ไม่ได้ — บทเรียนรอบที่ 38)
 */

export async function GET(): Promise<Response> {
  await requireAdminUser("presets");

  const messages = await getMessagesFor("th");
  const presets = await listChromePresets(messages);
  const body = serializeChromePresetExport(presets, new Date().toISOString());
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="waiwai-chrome-presets-${stamp}.json"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
      "x-content-type-options": "nosniff",
    },
  });
}

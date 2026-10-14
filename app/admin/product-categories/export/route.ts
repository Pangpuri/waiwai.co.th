import { requireAdminUser } from "@/lib/auth/dal";
import { categoryPresetPayload, serializeCategoryPreset } from "@/lib/products/categories";
import { categorySnapshotOf, listAdminCategories } from "@/lib/products/categories-repository";

/**
 * ดาวน์โหลด **สถานะหมวดสินค้าปัจจุบัน** เป็นไฟล์ JSON (รอบที่ 264 · มติ D25 ข้อ 5)
 *
 * ทำไมต้องมี: ผู้ดูแลเก็บสำเนาชุดค่าหมวดไว้ได้ และนำเข้ากลับผ่านหน้าจอ (ปุ่ม "นำเข้า JSON")
 * รูปแบบไฟล์ = รูปแบบเดียวกับที่ `parseCategoryPreset()` ยอมรับ (เวอร์ชัน 1)
 *
 * ⚠️ ต้องล็อกอิน + มีสิทธิ์ `content` เสมอ (`requireAdminUser` — ไม่มีเส้นทางสาธารณะ)
 * ⚠️ `no-store` + `noindex` และชื่อไฟล์เป็น ASCII (HTTP header ใส่ภาษาไทยตรง ๆ ไม่ได้ — บทเรียนรอบที่ 38)
 */

export async function GET(): Promise<Response> {
  await requireAdminUser("content");

  const rows = await listAdminCategories();
  const body = serializeCategoryPreset(categoryPresetPayload(rows.map(categorySnapshotOf)));
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="waiwai-product-categories-${stamp}.json"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
      "x-content-type-options": "nosniff",
    },
  });
}

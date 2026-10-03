import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/roles";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { getTrashedMediaBinary } from "@/lib/media/repository";

/**
 * ตัวอย่างภาพของที่อยู่ในถังขยะ (ปิดหนี้ รอบที่ 81) — `/admin/trash/thumbnail/<id>`
 *
 * ทำไมต้องมี
 * - เดิมหน้า `/admin/trash` แสดงแค่ชื่อไฟล์ ⇒ ผู้ดูแลไม่รู้ว่าของในถังคือภาพไหน ต้องกดกู้คืนก่อนจึงเห็น
 * - ภาพในถัง **ต้องไม่ถูกเสิร์ฟบนเว็บ** (`/media/[id]` กรอง `deleted_at is null` ⇒ 404) — เจตนาเดิมยังอยู่
 *
 * กติกาความปลอดภัย
 * - **ผู้ดูแลที่มีสิทธิ์ถังขยะเท่านั้น**: ตรวจ `getSessionUser()` (คืน `null` เมื่อไม่ใช่) **และ** สิทธิ์ `trash` แล้วตอบ **404**
 *   ⇒ ไม่บอกใบ้ว่ามีภาพนี้อยู่ (ไม่เด้งไปหน้าล็อกอินให้รู้ว่ามีปลายทาง)
 * - **ไม่แคช**: `no-store` (ไฟล์ในถังเปลี่ยนสถานะได้ทุกเมื่อ — กู้คืน/ลบถาวร)
 * - `nosniff` + `content-type` จากหัวไฟล์จริงตอนอัปโหลด · ไม่ส่งชื่อไฟล์ (ลดข้อมูลรั่ว)
 * - id ต้องตรงรูปแบบก่อนแตะฐานข้อมูล
 */

const ID_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { readonly params: Promise<{ readonly id: string }> }) {
  const { id } = await context.params;

  /* ล็อกอินก่อนเสมอ — ไม่ล็อกอิน = 404 (ไม่เปิดเผยว่ามีของในถังหรือไม่) */
  /*
    ⚠️ ตรวจ **สิทธิ์** ไม่ใช่แค่ "ล็อกอินแล้ว" (X1.10 · RBAC)
    route handler ใช้ `redirect()` ของ DAL ไม่ได้ ⇒ ตอบ 404 เหมือนกรณีไม่มีเซสชัน
    (ไม่บอกว่ามีของอยู่ในถัง — เหมือนเดิม)
  */
  const user = await getSessionUser();
  if (user === null || !can(user.role, "trash")) return new NextResponse(null, { status: 404 });

  if (!ID_PATTERN.test(id) || !isDatabaseConfigured()) {
    return new NextResponse(null, { status: 404 });
  }

  const media = await getTrashedMediaBinary(id);
  if (media === null) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(media.data), {
    status: 200,
    headers: {
      "content-type": media.mime,
      "content-length": String(media.sizeBytes),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      /* ไม่ส่ง content-disposition/ชื่อไฟล์ — ตัวอย่างในหลังบ้านไม่ต้องใช้ */
    },
  });
}

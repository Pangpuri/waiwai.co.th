import { requireAdminUser } from "@/lib/auth/dal";
import { findAttachment } from "@/lib/forms/repository";

/**
 * ดาวน์โหลดเรซูเม่ของผู้สมัคร (X1.9 ส่วนที่ 2)
 *
 * ⚠️ ข้อมูลส่วนบุคคล ⇒ ต้องล็อกอินก่อนเสมอ (ไม่ใช่เส้นทางสาธารณะ)
 * ⚠️ HTTP header ใส่ภาษาไทยไม่ได้ (ByteString) ⇒ ใช้ RFC 5987 `filename*=UTF-8''…`
 *    + ชื่อสำรอง ASCII (บทเรียนรอบที่ 38 ตอนทำ /media/[id])
 * ⚠️ `nosniff` + `no-store` + ไม่ให้เบราว์เซอร์แสดงผลเป็นหน้าเว็บ (attachment เท่านั้น)
 */

export async function GET(_request: Request, context: { readonly params: Promise<{ readonly id: string }> }): Promise<Response> {
  await requireAdminUser();

  const { id } = await context.params;
  const attachmentId = Number.parseInt(id, 10);
  if (!Number.isFinite(attachmentId) || attachmentId <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const file = await findAttachment(attachmentId);
  if (file === null) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": file.mime,
      "content-length": String(file.sizeBytes),
      "content-disposition": `attachment; filename="cv.${file.filename.split(".").pop() ?? "dat"}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
      "x-content-type-options": "nosniff",
    },
  });
}

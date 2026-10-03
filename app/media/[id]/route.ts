import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/content/repository";
import { getMediaBinary } from "@/lib/media/repository";

/**
 * เสิร์ฟไฟล์ภาพจากคลังภาพ (อ่านจากฐานข้อมูล)
 *
 * - **อ่านเท่านั้น** (GET) — การอัปโหลดเป็น Server Action ที่ตรวจสิทธิ์แล้ว (ไม่ใช่เส้นทางนี้)
 * - id เป็น base64url ที่ตรวจรูปแบบก่อนแตะฐานข้อมูล (กันการยิงค่าขยะ)
 * - `immutable` ได้เพราะ id อ้างถึงเนื้อหาไฟล์เดียวตลอด (แก้ภาพ = ได้ id ใหม่)
 * - `nosniff` + `content-type` ที่อ่านจากหัวไฟล์จริงตอนอัปโหลด ⇒ เบราว์เซอร์ไม่ตีความเป็นอย่างอื่น
 */

const ID_PATTERN = /^[A-Za-z0-9_-]{8,32}$/;

export async function GET(_request: Request, context: { readonly params: Promise<{ readonly id: string }> }) {
  const { id } = await context.params;

  if (!ID_PATTERN.test(id) || !isDatabaseConfigured()) {
    return new NextResponse(null, { status: 404 });
  }

  const media = await getMediaBinary(id);
  if (media === null) {
    return new NextResponse(null, { status: 404 });
  }

  /*
    ⚠️ ชื่อไฟล์ต้องเป็น ASCII เท่านั้น (เจอจริง 2026-10-02)
    HTTP header รับได้เฉพาะ ByteString (latin1) → ชื่อไฟล์ภาษาไทยทำให้ Next โยน
    `TypeError: Cannot convert argument to a ByteString` แล้วตอบ 500
    ⇒ ใช้ `filename*` แบบ RFC 5987 (percent-encoded UTF-8) ซึ่งเป็น ASCII ตลอด
  */
  const encodedName = encodeURIComponent(media.filename).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return new NextResponse(new Uint8Array(media.data), {
    status: 200,
    headers: {
      "content-type": media.mime,
      "content-length": String(media.sizeBytes),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-disposition": `inline; filename="image"; filename*=UTF-8''${encodedName}`,
    },
  });
}

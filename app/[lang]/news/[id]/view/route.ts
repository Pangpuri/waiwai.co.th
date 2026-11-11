import { NextResponse, type NextRequest } from "next/server";

import { isLocale } from "@/lib/i18n/config";
import { incrementNewsView } from "@/lib/news/metrics";
import {
  NEWS_VIEW_COOKIE,
  NEWS_VIEW_DEDUPE_MS,
  parseNewsViewMarks,
  shouldCountNewsView,
  withNewsViewMark,
} from "@/lib/news/view-counter";

/**
 * ตัวนับวิวข่าว — route handler เล็ก ๆ ที่หน้า `/news/<id>` เรียกผ่าน `<img>` 1×1
 *
 * ทำไมไม่นับใน page component
 * - หน้ารายละเอียดเป็น static/ISR ⇒ render ไม่ได้ทุกคำขอ
 * - `<img>` ถูกขอทุกครั้งที่เปิดหน้า (แม้หน้า HTML มาจาก cache) ⇒ นับได้จริงโดยไม่เพิ่ม JS
 *
 * ความปลอดภัย/ความเป็นส่วนตัว
 * - ตรวจ id เป็นตัวเลขเท่านั้น · อัปเดตเฉพาะข่าวที่เผยแพร่และไม่อยู่ในถัง
 * - ใช้คุกกี้ `waiwai_news_view` กันนับซ้ำ 24 ชม. ต่อเครื่อง (ไม่เก็บ IP)
 * - คำขอ prefetch ไม่นับ · ตอบเป็น GIF โปร่งใสเสมอ (แม้ DB ล้ม)
 */

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

function pixelResponse(): NextResponse {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, max-age=0",
      "content-length": String(PIXEL.length),
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly lang: string; readonly id: string }> },
): Promise<NextResponse> {
  const { lang, id } = await context.params;
  if (!isLocale(lang) || !/^\d{3,}$/.test(id)) return pixelResponse();

  /* เบราว์เซอร์ที่ prefetch ลิงก์ไม่ควรถูกนับว่า "เปิดอ่าน" */
  const purpose = request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "";
  if (purpose.toLowerCase().includes("prefetch")) return pixelResponse();

  const now = Date.now();
  const cookieValue = request.cookies.get(NEWS_VIEW_COOKIE)?.value;
  const marks = parseNewsViewMarks(cookieValue, now);
  if (!shouldCountNewsView(marks, id, now)) return pixelResponse();

  const counted = await incrementNewsView(id);
  if (!counted) return pixelResponse();

  const response = pixelResponse();
  response.cookies.set({
    name: NEWS_VIEW_COOKIE,
    value: withNewsViewMark(marks, id, now),
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: Math.floor(NEWS_VIEW_DEDUPE_MS / 1000),
  });
  return response;
}

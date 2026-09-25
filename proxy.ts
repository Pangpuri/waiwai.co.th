import { NextResponse, type NextRequest } from "next/server";

import {
  isLocale,
  resolveLocale,
  shouldBypassLocaleRouting,
} from "@/lib/i18n/config";

/**
 * Proxy (ชื่อใหม่ของ middleware ใน Next.js 16)
 *
 * หน้าที่เดียว: เติม prefix ภาษานำหน้า path ที่ยังไม่มี
 *   /            → /th
 *   /products    → /th/products   (หรือ /en ถ้าเบราว์เซอร์ขออังกฤษ)
 *   /en/products → ผ่านไปเลย
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldBypassLocaleRouting(pathname)) {
    return NextResponse.next();
  }

  const [first] = pathname.split("/").filter(Boolean);
  if (isLocale(first)) {
    return NextResponse.next();
  }

  const locale = resolveLocale(request.headers.get("accept-language"));

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;

  return NextResponse.redirect(url);
}

export const config = {
  /*
    ทำงานกับทุก path ยกเว้นไฟล์ static ของ Next, API และไฟล์ที่มีนามสกุล
    (ไฟล์ใน public/ ต้องไม่ถูกเติม prefix ภาษา ไม่งั้นจะโหลดไม่เจอ)
  */
  matcher: ["/((?!_next|api|.*\\.[a-zA-Z0-9]+$).*)"],
};

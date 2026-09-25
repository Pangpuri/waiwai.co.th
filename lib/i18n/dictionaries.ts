import { notFound } from "next/navigation";

import { isLocale, type Locale } from "./config";
import type { Messages } from "./messages/th";

/**
 * โหลดพจนานุกรมแบบ lazy → เบราว์เซอร์ไม่ต้องโหลดทั้งสองภาษา
 * โมดูลนี้เป็น server-only (import next/navigation) ห้ามใช้ใน Client Component
 */
const loaders: Record<Locale, () => Promise<Messages>> = {
  th: () => import("./messages/th").then((module) => module.th),
  en: () => import("./messages/en").then((module) => module.en),
};

/**
 * โหลดพจนานุกรมของภาษาที่รับมา (ยังเป็น string จาก URL)
 * ถ้าไม่ใช่ภาษาที่รองรับ → notFound() เพื่อให้ได้หน้า 404 ไม่ใช่ error 500
 */
export async function getMessages(locale: string): Promise<Messages> {
  if (!isLocale(locale)) notFound();
  return loaders[locale]();
}

/** โหลดพจนานุกรมเมื่อรู้อยู่แล้วว่าเป็น Locale ที่ถูกต้อง */
export async function getMessagesFor(locale: Locale): Promise<Messages> {
  return loaders[locale]();
}

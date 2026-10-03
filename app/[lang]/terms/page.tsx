import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PendingPage, pendingPageMetadata } from "@/features/shell/ui/pending-page";
import { isLocale } from "@/lib/i18n/config";

/**
 * หน้า terms — **ยังไม่มีเนื้อหาจริง** แต่ต้องมีอยู่เพื่อไม่ให้ลิงก์ในท้ายเว็บเสีย (ปิดหนี้รอบที่ 81)
 * ⚠️ noindex + ไม่ขึ้น sitemap · พอได้ข้อความที่ยืนยันแล้วให้เปลี่ยนไฟล์นี้เป็นเนื้อหาจริง
 */
export async function generateMetadata({ params }: PageProps<"/[lang]/terms">): Promise<Metadata> {
  const { lang } = await params;
  return pendingPageMetadata(lang, "terms");
}

export default async function PendingRoute({ params }: PageProps<"/[lang]/terms">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return <PendingPage locale={lang} id="terms" />;
}

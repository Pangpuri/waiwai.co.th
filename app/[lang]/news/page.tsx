import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NewsListViewPage, newsViewMetadata } from "@/features/news/ui/news-list-page";
import { defaultNewsListView } from "@/lib/news/list-view";
import { isLocale } from "@/lib/i18n/config";

/*
  ต่ออายุเพจนี้เองทุก 5 นาที (ตาข่ายกันลืม) — กดเผยแพร่จากหลังบ้านจะสั่งให้สร้างใหม่ทันที (X1.7)
  ⚠️ ต้องเป็น **ค่าคงที่ literal** เท่านั้น · Next อ่านค่านี้จากซอร์สตอน build
     เทสต์ scripts/test-isr.ts บังคับให้ค่านี้ตรงกับ PAGE_REVALIDATE_SECONDS ใน lib/cache/window.ts
*/
export const revalidate = 300;

/**
 * หน้า `/news` (ข่าวสาร & กิจกรรม) — **ค่าเริ่มต้น: ล่าสุดก่อน · ทุกปี · หน้า 1**
 *
 * รอบที่ 271 (มติเจ้าของ D29): ผู้ใช้แจ้งว่า *"ไม่ได้เรียงตามวันที่ล่าสุดลงมาหาเก่าสุด"*
 * · ต้นเหตุ: คิวรีเดิมยก `sort_order` (ที่ตัวนำเข้าตั้งไว้ทุกแถว) มาก่อนวันที่
 * · แก้: เรียงตามวันที่เสมอ + เพิ่มแถวกรอง (ปี พ.ศ. · ล่าสุด/เก่าสุด) เป็นหน้า static
 *
 * มุมมองอื่นของรายการเดียวกัน (ไฟล์ละไม่กี่บรรทัด · ใช้หน้าจอรวมตัวเดียวกัน):
 * - `/news/page/<n>` · `/news/oldest` · `/news/oldest/page/<n>`
 * - `/news/year/<พ.ศ.>` · `/news/year/<พ.ศ.>/page/<n>` · `/news/year/<พ.ศ.>/oldest` (+ `/page/<n>`)
 *
 * ประวัติ: รอบที่ 15 การ์ดทดสอบ · รอบที่ 105 ข่าวจริง 151 ข่าว + แบ่งหน้า · รอบที่ 173 เปิด index
 */

export async function generateMetadata({ params }: PageProps<"/[lang]/news">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  /* มุมมองค่าเริ่มต้นมีแถว SEO ของตัวเองในฐานข้อมูล (`page = "news"`) — ตัวช่วยกลางอ่านให้ */
  return newsViewMetadata(lang, defaultNewsListView());
}

export default async function NewsPage({ params }: PageProps<"/[lang]/news">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <NewsListViewPage lang={lang} view={defaultNewsListView()} />;
}

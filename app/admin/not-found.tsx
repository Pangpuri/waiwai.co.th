import Link from "next/link";

import { getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * 404 ของหลังบ้าน (รอบที่ 293 · ปิดหนี้ D-291-2)
 *
 * เดิมเส้นทาง `/admin/<อะไรก็ตามที่ไม่รู้จัก>` ตอบ **404 ถูกต้อง** แต่ถูกเรนเดอร์ด้วย
 * **หน้าดีฟอลต์ของ Next** (`<html id="__next_error__">` + ข้อความอังกฤษ) ⇒ ผู้ดูแลเห็นหน้าแปลกปลอม
 * ทั้งที่ยังอยู่ในหลังบ้าน (มีแถบเมนูให้) · ตอนนี้เป็นหน้าของเราเองที่:
 * - บอกด้วยภาษาคนว่า **ไม่พบหน้า** + ทางกลับ (ไม่ใช่ "This page could not be found")
 * - **ไม่เปิดเผยว่ามีอะไรอยู่บ้าง** (ไม่ list เมนูที่เข้าไม่ได้ — กติกาเดียวกับหน้า `/admin/denied`)
 * - ข้อความมาจากพจนานุกรม (มีเทสต์กันข้อความไทยใน `.tsx` อยู่แล้ว)
 *
 * ⚠️ `not-found.tsx` ถูกเรนเดอร์ **ภายใน `app/admin/layout.tsx`** ⇒ ได้เปลือกหลังบ้าน (แถบเมนู/ธีม/ฟอนต์)
 *    และผู้ที่ยังไม่ล็อกอินจะยังถูก proxy พาไปหน้าล็อกอินก่อนถึงที่นี่ (เหมือนทุกจอใต้ /admin)
 */
export default async function AdminNotFound() {
  const strings = (await getMessagesFor("th")).admin;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-12">
      <section className="border-line bg-surface-raised flex flex-col gap-3 rounded-2xl border p-6">
        <h1 className="text-fg text-xl font-bold">{strings.pageNotFoundTitle}</h1>
        <p className="text-fg-muted text-sm">{strings.pageNotFoundBody}</p>
        <Link
          href="/admin"
          className="bg-brand-red text-on-brand focus-visible:ring-ring w-fit rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {strings.deniedBack}
        </Link>
      </section>
    </main>
  );
}

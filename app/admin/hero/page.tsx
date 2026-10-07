import Link from "next/link";

import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { listHeroPageSlidesForAdmin } from "@/lib/hero/repository";
import { fillTemplate } from "@/lib/i18n/template";

/**
 * หลังบ้าน "สไลด์ & แคมเปญ" (รอบที่ 184 · เฟส 3 ส่วนแรก)
 *
 * มติเจ้าของ 2026-10-07: แยกเป็น **โมดูลของตัวเอง** + เมนูในไซด์บาร์ต่อจาก "ส่วนกลางของเว็บ"
 * เพราะสไลด์หน้าแรกเป็นของระดับเว็บ + จะมีการ์ดวางบนสไลด์ + ช่วงเวลาแคมเปญ (ไม่ใช่เลย์เอาต์ของหน้าใดหน้าหนึ่ง)
 *
 * รอบนี้ = **จอแสดงรายการ** (อ่านอย่างเดียว) ⇒ เห็นว่าหน้าแรกกำลังใช้สไลด์อะไรอยู่ + ตรวจข้อมูลจริงได้
 * ⏭ เฟสถัดไป: เพิ่ม/ลบภาพ · ลากสลับลำดับ · เลือกจุดโฟกัส 3×3 · ซูม · เปิด/ปิด · ถังขยะ · ประวัติ · การ์ดแคมเปญ
 */
export default async function AdminHeroPage() {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const s = messages.admin;

  const slides = await listHeroPageSlidesForAdmin();
  const activeCount = slides.filter((slide) => slide.isActive).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-fg text-2xl font-semibold">{s.heroAdminTitle}</h1>
        <p className="text-fg-muted max-w-3xl text-sm">{s.heroAdminIntro}</p>
        <p className="text-fg text-sm font-medium">{fillTemplate(s.heroAdminCount, { n: activeCount })}</p>
        <p className="text-fg-muted text-xs">{s.heroAdminNextStep}</p>
        <p>
          <Link href="/th" className="text-brand-red text-sm underline underline-offset-2">
            {s.heroAdminSeeSite}
          </Link>
        </p>
      </header>

      {slides.length === 0 ? (
        <p className="border-line text-fg-muted rounded-xl border border-dashed p-6 text-sm">{s.heroAdminEmpty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {slides.map((slide) => (
            <li key={slide.id} className="border-line bg-surface flex flex-col overflow-hidden rounded-xl border">
              {/* ภาพตัวอย่าง — พาธมาจากคลัง/โปรเจกต์ จึงใช้ <img> ธรรมดา (แบบเดียวกับตัวเรนเดอร์บล็อก) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.mediaPath} alt={slide.altTh} className="bg-bg-subtle h-40 w-full object-cover" />
              <div className="flex flex-col gap-1 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-fg text-sm font-semibold">{slide.id}</p>
                  <span className="text-fg-muted text-xs">
                    {slide.isActive ? s.heroAdminActive : s.heroAdminInactive}
                  </span>
                </div>
                <p className="text-fg-muted text-xs break-all">{slide.mediaPath}</p>
                <p className="text-fg-muted text-xs">
                  {s.heroAdminFocus}: {slide.focusX}% {slide.focusY}% · {s.heroAdminZoom}: {slide.zoom}×
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";

import { BRAND_LOGO } from "@/lib/brand/assets";
import { localePath, type Locale } from "@/lib/i18n/config";

/**
 * ตราสัญลักษณ์แบรนด์ (navbar/footer) — **ไฟล์จริงจากเจ้าของ** ตั้งแต่รอบที่ 109
 *
 * ที่มา: เจ้าของส่งไฟล์ `logo/logo_navbar_footer.gif` (8192×1463 · พื้นหลังโปร่งใส · 1 เฟรม)
 * → เตรียมเป็นไฟล์เว็บที่ `public/brand/logo-navbar.png` (ตัดขอบโปร่งใส + ย่อเป็นกว้าง 800px = 60 KB)
 *   ⚠️ ห้ามใช้ GIF ต้นฉบับบนเว็บตรง ๆ (8192px · 211 KB และ `next/image` ปรับขนาด GIF ไม่ได้)
 *   ⚠️ ขั้นตอนเตรียมไฟล์ (Windows/System.Drawing) บันทึกไว้ใน PRODUCT_ROADMAP § 10 รอบที่ 109 — **ไม่เพิ่ม dependency**
 *
 * รายละเอียดการเข้าถึง (a11y):
 * - ลิงก์นี้มี `aria-label` (ข้อความที่แปลแล้ว) ⇒ รูปต้องเป็น **decorative** (`alt=""`) เพื่อไม่ให้อ่านซ้ำสองรอบ
 * - กำหนด `width`/`height` = ขนาดไฟล์จริง ⇒ เบราว์เซอร์กันที่ไว้ก่อนรูปมา (ไม่มี layout shift)
 */

/** ตัวอักษรแบรนด์ที่ยังใช้เป็น "ข้อความ" ในส่วนอื่น (เช่น เรื่องราวแบรนด์) — ไม่ใช่ภาพ */
export const WORDMARK = {
  /** ตัวอักษรย่อในตรา */
  mark: "ไว", // i18n-allow: ตราสัญลักษณ์แบรนด์ ไม่แปลตามภาษา
  thai: "ไวไว", // i18n-allow: ตราสัญลักษณ์แบรนด์ ไม่แปลตามภาษา
  latin: "WAI WAI", // i18n-allow: ตราสัญลักษณ์แบรนด์ ไม่แปลตามภาษา
} as const;


type BrandMarkProps = {
  readonly locale: Locale;
  /** ใช้เป็น accessible name — ส่งข้อความที่แปลแล้วเข้ามา */
  readonly label: string;
  readonly size?: "sm" | "md";
  /** true = รูปอยู่ในจอแรก (header) ⇒ โหลดก่อน ; footer ไม่ต้อง */
  readonly eager?: boolean;
};

export function BrandMark({ locale, label, size = "md", eager = false }: BrandMarkProps) {
  const isSmall = size === "sm";

  return (
    <Link
      href={localePath(locale)}
      aria-label={label}
      className="inline-flex shrink-0 items-center rounded-xl p-1 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Image
        src={BRAND_LOGO.path}
        alt=""
        width={BRAND_LOGO.width}
        height={BRAND_LOGO.height}
        sizes="(max-width: 640px) 180px, 250px"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        /*
          ⚠️ โลโก้จริง **กว้างกว่าตราตัวอักษรเดิมมาก** (สัดส่วน 5.52:1)
          · md (header) = สูง 32px บนมือถือ → กว้าง ~177px (เหลือที่ให้ปุ่มเมนู/ภาษา/ธีม) แล้วค่อยใหญ่ขึ้นตามจอ
          · sm (footer) = 36px คงที่
        */
        className={["w-auto", isSmall ? "h-9" : "h-8 sm:h-9 lg:h-11"].join(" ")}
      />
    </Link>
  );
}

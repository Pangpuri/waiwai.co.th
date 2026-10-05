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
  /** true = รูปอยู่ในจอแรก (header) ⇒ โหลดก่อน ; footer ไม่ต้อง */
  readonly eager?: boolean;
};

/**
 * ⚠️ รอบที่ 113: ตัด prop `size` ("sm" | "md") ออก — ไม่มีใครส่งค่านี้เลยหลังเปลี่ยนมาใช้ไฟล์โลโก้จริง
 * (header และ footer ใช้สเกลเดียวกัน) ⇒ เหลือสเกลเดียวที่คิดระยะจอมาแล้ว ลดความสับสน
 */
export function BrandMark({ locale, label, eager = false }: BrandMarkProps) {
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
          ⚠️ โลโก้จริง **กว้างกว่าตราตัวอักษรเดิมมาก** (สัดส่วน 800:145 = 5.52:1)
          ⇒ ความกว้าง = ความสูง × 5.52 (ต้องคิดเผื่อเสมอ ไม่ใช่ดูแค่ความสูง)

          รอบที่ 113 (เจ้าของแจ้งว่า "โลโก้ใน navbar ล้นจอบนมือถือ"):
          · navbar มือถือ = แถวเดียว: โลโก้ + ปุ่มธีม (40px) + ปุ่มเมนู (40px) + ช่องว่าง

          | ความสูง | ความกว้าง | ใช้ที่ |
          |---|---|---|
          | h-6 = 24px | 132px | (ไม่ใช้ — เล็กเกินไป) |
          | **h-7 = 28px** | **154px** | **มือถือ (< sm)** — จอ 320px: 154+8+12+88+40 = 302 ✓ อยู่ในจอ |
          | h-8 = 32px | 176px | จอ ≥ 640px — จอ 320px เดิมใช้ค่านี้ ⇒ 324px **ล้น 4px** (ต้นเหตุ) |
          | h-11 = 44px | 243px | จอ ≥ 1024px (มีที่พอ เพราะเมนูหลักย้ายไปแถวที่ 2) |

          + **ตัวกันล้นสำรอง**: \`max-w-[46vw]\` — ไม่ว่าไฟล์/จอจะกว้างเท่าไร โลโก้กินได้ไม่เกิน 46% ของจอ
            (จำเป็นจริงบนจอแคบมาก เช่น Galaxy Fold ปิดฝา = 280px ⇒ เหลือที่ราว 140px)
            ใช้คู่กับ \`object-contain object-left\` เพื่อ **ย่อทั้งรูปโดยไม่ตัด/ไม่ยืดสัดส่วน**
        */
        className="h-7 w-auto max-w-[46vw] object-contain object-left sm:h-8 lg:h-11"
      />
    </Link>
  );
}

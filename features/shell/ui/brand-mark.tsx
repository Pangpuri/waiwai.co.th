import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";

/**
 * ตราสัญลักษณ์แบบ wordmark
 *
 * ยังไม่มีไฟล์โลโก้จากเจ้าของแบรนด์ จึงใช้ตัวอักษรจัดวางแทน
 * เมื่อได้ไฟล์จริงให้เปลี่ยนเนื้อหาในลิงก์นี้เป็น <Image /> (next/image)
 * โดยคงขนาด/สัดส่วนและ aria-label เดิมไว้
 */
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
};

export function BrandMark({ locale, label, size = "md" }: BrandMarkProps) {
  const isSmall = size === "sm";

  return (
    <Link
      href={localePath(locale)}
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-2.5 rounded-xl p-1 transition-opacity hover:opacity-90"
    >
      <span
        aria-hidden="true"
        className={[
          "grid place-items-center rounded-xl bg-brand-yellow font-display font-extrabold text-accent-on-yellow shadow-sm",
          isSmall ? "h-9 w-9 text-lg leading-none" : "h-11 w-11 text-xl leading-none",
        ].join(" ")}
      >
        {WORDMARK.mark}
      </span>

      <span aria-hidden="true" className="flex flex-col leading-none">
        <span
          className={[
            "font-display font-extrabold tracking-tight text-fg",
            isSmall ? "text-base" : "text-lg",
          ].join(" ")}
        >
          {WORDMARK.thai}
        </span>
        <span className="mt-0.5 text-[0.6rem] font-semibold tracking-[0.22em] text-fg-muted">
          {WORDMARK.latin}
        </span>
      </span>
    </Link>
  );
}

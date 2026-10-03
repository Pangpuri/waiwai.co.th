import type { NavIconKey } from "@/lib/chrome/navbar";

/**
 * ไอคอนพื้นฐานสำหรับแถบเมนู/ปุ่ม (ผู้ใช้สั่ง รอบที่ 53: "มีไอคอนพื้นฐานให้ใช้ในปุ่มได้")
 *
 * ⚠️ **เขียน SVG เองทั้งหมด — ไม่เพิ่มไลบรารีไอคอน** (กฎโปรเจกต์)
 * - ใช้ `stroke="currentColor"` / `fill="currentColor"` ⇒ สีมาจากโทนของปุ่ม/แถบเมนู (ไม่ hardcode สี)
 * - ขนาดคงที่ 1em ⇒ รับขนาดตามตัวอักษรของที่ที่มันอยู่
 * - `aria-hidden` เสมอ เพราะมีข้อความกำกับอยู่แล้ว (ไม่ให้โปรแกรมอ่านหน้าจออ่านซ้ำ)
 * - กลุ่มแบรนด์ (LINE/Facebook/YouTube/Shopee/Lazada) วาดเป็นสัญลักษณ์อย่างง่าย ไม่ใช่ไฟล์โลโก้ทางการ
 *   (ถ้าต้องการไฟล์ทางการ ให้วางไฟล์ใน `public/` แล้วเพิ่มเป็นรูป — จะทำเมื่อผู้ใช้ขอ)
 */

type IconProps = {
  readonly className?: string;
};

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ children, className }: { readonly children: React.ReactNode; readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" className={className} {...STROKE}>
      {children}
    </svg>
  );
}

const ICONS: Readonly<Record<Exclude<NavIconKey, "none">, (props: IconProps) => React.ReactElement>> = {
  cart: ({ className }) => (
    <Svg className={className}>
      <path d="M3 4h2l2.4 10.4A2 2 0 0 0 9.35 16h8.3a2 2 0 0 0 1.95-1.55L21 8H6" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </Svg>
  ),
  phone: ({ className }) => (
    <Svg className={className}>
      <path d="M6.5 3h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5L16 12l4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 3.5 5.2 2 2 0 0 1 5.5 3Z" />
    </Svg>
  ),
  mail: ({ className }) => (
    <Svg className={className}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.8 7 8.2 6 8.2-6" />
    </Svg>
  ),
  pin: ({ className }) => (
    <Svg className={className}>
      <path d="M12 21s6.5-6.1 6.5-11a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21Z" />
      <circle cx="12" cy="10" r="2.4" />
    </Svg>
  ),
  user: ({ className }) => (
    <Svg className={className}>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20a7.4 7.4 0 0 1 14.4 0" />
    </Svg>
  ),
  search: ({ className }) => (
    <Svg className={className}>
      <circle cx="10.8" cy="10.8" r="6" />
      <path d="m15.3 15.3 4 4" />
    </Svg>
  ),
  tag: ({ className }) => (
    <Svg className={className}>
      <path d="M12.6 3.6H20V11l-9 9-8-8 9.6-9.4Z" />
      <circle cx="16.3" cy="7.7" r="1.3" fill="currentColor" stroke="none" />
    </Svg>
  ),
  star: ({ className }) => (
    <Svg className={className}>
      <path d="m12 3.6 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 17l-5.25 2.75 1-5.85L3.5 9.75l5.9-.85L12 3.6Z" />
    </Svg>
  ),
  arrow: ({ className }) => (
    <Svg className={className}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Svg>
  ),
  line: ({ className }) => (
    <Svg className={className}>
      <path d="M21 10.5c0-4-4-7-9-7s-9 3-9 7c0 3.4 2.9 6.3 6.9 6.9.3.05.7.2.8.45.1.25.1.6.05.9l-.15.85c-.05.3-.2.9.75.5s4.6-2.7 6.2-4.6c1.3-1.5 2.45-3.3 2.45-5Z" />
      <path d="M8 8.6v3.2h2" />
      <path d="M12.4 8.6v3.2" />
      <path d="m15.2 11.8 2-3.2v3.2" />
    </Svg>
  ),
  facebook: ({ className }) => (
    <Svg className={className}>
      <path d="M14.8 8.6h2.4V5.4h-2.6c-2.3 0-3.8 1.5-3.8 3.9v1.6H8.4v3.2h2.4V21h3.3v-6.9h2.5l.5-3.2h-3V9.5c0-.6.3-.9.7-.9Z" />
    </Svg>
  ),
  youtube: ({ className }) => (
    <Svg className={className}>
      <rect x="3" y="6" width="18" height="12" rx="3.2" />
      <path d="m11 9.5 4 2.5-4 2.5v-5Z" fill="currentColor" stroke="none" />
    </Svg>
  ),
  shopee: ({ className }) => (
    <Svg className={className}>
      <path d="M5 8h14l-1 11.5a1.5 1.5 0 0 1-1.5 1.35h-9A1.5 1.5 0 0 1 6 19.5L5 8Z" />
      <path d="M9 8V6.6a3 3 0 0 1 6 0V8" />
    </Svg>
  ),
  lazada: ({ className }) => (
    <Svg className={className}>
      <path d="M4 16.5 10 4h3.2l6 12.5h-3.4l-1.1-2.6H8.4l-1.1 2.6H4Z" />
      <path d="M9.6 11.8h4.6" />
    </Svg>
  ),
};

export function NavIcon({ name, className }: { readonly name: NavIconKey; readonly className?: string }) {
  if (name === "none") return null;
  const Icon = ICONS[name];
  return <Icon className={className} />;
}

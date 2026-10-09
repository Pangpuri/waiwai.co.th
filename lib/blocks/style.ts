import type {
  BlockAlign,
  BlockBackground,
  BlockColumnWidth,
  BlockSize,
  BlockSpacing,
  BlockStyle,
  BlockWidth,
  PageLayout,
} from "@/lib/blocks/types";

/**
 * แปลง "พรีเซ็ตของแบรนด์" → คลาสของธีม (token เท่านั้น)
 *
 * ⚠️ นี่คือจุดที่รับประกันคำตอบข้อ 2 ของผู้ใช้ (แบรนด์คุมหน้าตา)
 * - **ห้ามใส่คลาสสีดิบหรือ hex ที่นี่เด็ดขาด** (ด่าน `check:dark` สแกนไฟล์ .ts ด้วย)
 * - ทุกค่าที่เลือกได้มีจำนวนจำกัด ⇒ ผลลัพธ์เป็นคลาสที่ตรวจสอบได้ ไม่เกิด "หน้าใหม่ที่ไม่เหมือนแบรนด์"
 * - ถ้าจะเพิ่มสี/ระยะใหม่ ให้เพิ่ม "พรีเซ็ต" ที่นี่ + ใน `types.ts` (ไม่ใช่เปิดช่องให้พิมพ์ค่าเอง)
 */

const BACKGROUND: Record<BlockBackground, string> = {
  none: "",
  cream: "bg-bg-cream",
  subtle: "bg-bg-subtle",
  brand: "bg-surface-raised",
};

const SPACING: Record<BlockSpacing, string> = {
  none: "",
  sm: "py-6",
  md: "py-10",
  lg: "py-16",
};

const WIDTH: Record<BlockWidth, string> = {
  narrow: "max-w-2xl",
  normal: "max-w-4xl",
  wide: "max-w-6xl",
  full: "max-w-none",
};

const ALIGN: Record<BlockAlign, string> = {
  left: "text-left",
  center: "text-center",
};

/**
 * ความกว้างคอลัมน์ → คลาสบนกริด 12 (X1.1)
 * ⚠️ ต้องเขียนคลาสเต็ม ๆ ห้ามประกอบสตริง — Tailwind สแกนคลาสจากข้อความในโค้ด
 */
const COLUMN_SPAN: Record<BlockColumnWidth, string> = {
  half: "md:col-span-6",
  third: "md:col-span-4",
  twoThirds: "md:col-span-8",
  quarter: "md:col-span-3",
  threeQuarters: "md:col-span-9",
  full: "md:col-span-12",
};

const HEADING_SIZE: Record<BlockSize, string> = {
  sm: "text-xl",
  md: "text-2xl sm:text-3xl",
  lg: "text-3xl sm:text-4xl",
};

const HERO_HEIGHT: Record<BlockSize, string> = {
  sm: "min-h-40",
  md: "min-h-64",
  lg: "min-h-96",
};

/** คลาสของ "เปลือก" บล็อก (พื้นหลัง + ระยะห่างแนวตั้ง) */
export function shellClass(style: BlockStyle): string {
  return [BACKGROUND[style.background], SPACING[style.spacing]].filter((value) => value !== "").join(" ");
}

/**
 * คลาสของ "เนื้อหาใน" บล็อก (ความกว้าง + การจัดวาง)
 * `nested = true` (บล็อกที่อยู่ในคอลัมน์ของแถว) ⇒ ไม่ใส่ระยะขอบข้าง เพราะคอลัมน์มีระยะของตัวเองแล้ว
 */
export function containerClass(style: BlockStyle, nested = false): string {
  if (nested) return ["w-full", WIDTH[style.width]].join(" ");
  return ["mx-auto w-full px-4", WIDTH[style.width]].join(" ");
}

/**
 * กริดของบล็อก "แถว" (X1.1) — ใช้กริด 12 ช่องบนเดสก์ท็อป แล้วให้แต่ละคอลัมน์เลือกความกว้างของตัวเอง
 * ⚠️ มือถือ/แท็บเล็ต = เรียงลงมาทีละคอลัมน์เต็มความกว้าง (อ่านง่ายกว่าแบ่ง 4 คอลัมน์บนจอแคบ)
 * ⚠️ คลาสต้องเป็นข้อความคงที่ (Tailwind สแกนหาในโค้ด) ⇒ ห้ามประกอบชื่อคลาสจากตัวแปร
 */
export function rowGridClass(): string {
  return "mx-auto grid w-full grid-cols-1 gap-6 px-4 md:grid-cols-12";
}

/** คลาสความกว้างของคอลัมน์ (บนกริด 12) */
export function columnClass(width: BlockColumnWidth): string {
  return COLUMN_SPAN[width];
}

export function alignClass(style: BlockStyle): string {
  return ALIGN[style.align];
}

/**
 * ขนาดตัวอักษรของหัวข้อ (**ไม่มีสี**) — รอบที่ 244
 * ใช้เมื่อหัวข้ออยู่บนพื้นสีที่ต้องกำหนดสีเอง (เช่นกรอบเหลืองของแบรนด์) เพราะ `headingClass`
 * ฝัง `text-fg` มาด้วย ซึ่งจะอ่านไม่ออกบนพื้นเหลือง
 */
export function headingSizeClass(style: BlockStyle): string {
  return HEADING_SIZE[style.size];
}

export function headingClass(style: BlockStyle): string {
  return ["text-fg font-bold", HEADING_SIZE[style.size]].join(" ");
}

export function heroHeightClass(style: BlockStyle): string {
  return HERO_HEIGHT[style.size];
}

/** ตัวเลือกทั้งหมดที่หน้าจอหลังบ้านแสดง (ป้ายไทยอยู่ในไฟล์ .ts — ไม่ผิดกฎ i18n) */
export const STYLE_CHOICES = {
  align: [
    { value: "left", label: "ชิดซ้าย" },
    { value: "center", label: "กึ่งกลาง" },
  ],
  width: [
    { value: "narrow", label: "แคบ" },
    { value: "normal", label: "ปกติ" },
    { value: "wide", label: "กว้าง" },
    { value: "full", label: "เต็มความกว้าง" },
  ],
  spacing: [
    { value: "none", label: "ไม่มี" },
    { value: "sm", label: "น้อย" },
    { value: "md", label: "ปกติ" },
    { value: "lg", label: "มาก" },
  ],
  background: [
    { value: "none", label: "โปร่ง" },
    { value: "cream", label: "ครีม" },
    { value: "subtle", label: "เทาอ่อน" },
    { value: "brand", label: "สีแบรนด์อ่อน" },
  ],
  size: [
    { value: "sm", label: "เล็ก" },
    { value: "md", label: "กลาง" },
    { value: "lg", label: "ใหญ่" },
  ],
  /** ความกว้างคอลัมน์ในบล็อก "แถว" (X1.1) — แสดงเป็นสัดส่วนบนกริด 12 ช่อง */
  columnWidth: [
    { value: "half", label: "ครึ่ง (6/12)" },
    { value: "third", label: "หนึ่งในสาม (4/12)" },
    { value: "twoThirds", label: "สองในสาม (8/12)" },
    { value: "quarter", label: "หนึ่งในสี่ (3/12)" },
    { value: "threeQuarters", label: "สามในสี่ (9/12)" },
    { value: "full", label: "เต็มความกว้าง (12/12)" },
  ],
} as const;

/* ── เลย์เอาต์ของทั้งหน้า (X1.8) ─────────────────────────────────────────────
 * เหตุผลที่รวมไว้ที่นี่: คลาสทั้งหมดต้องเป็น "พรีเซ็ตของแบรนด์" ⇒ ตรวจสอบได้ (ด่าน check:dark)
 * และ Tailwind สแกนคลาสจากข้อความในโค้ด (ห้ามประกอบชื่อคลาสจากตัวแปร)
 */

const PAGE_LAYOUT_SHELL: Record<PageLayout, string> = {
  full: "",
  /* เดสก์ท็อป 4 คอลัมน์: สารบัญ 1 + เนื้อหา 3 · มือถือเรียงลงมา ⇒ เห็นสารบัญก่อนเนื้อหา */
  sidebar: "lg:grid lg:grid-cols-4 lg:items-start lg:gap-10",
  landing: "",
};

export function pageLayoutClass(layout: PageLayout): string {
  return PAGE_LAYOUT_SHELL[layout];
}

/** คอลัมน์สารบัญ (เลย์เอาต์ `sidebar`) — ติดหนึบใต้หัวเว็บบนเดสก์ท็อป */
export function sidebarAsideClass(): string {
  return "lg:col-span-1 lg:sticky lg:top-24";
}

/** คอลัมน์เนื้อหาหลัก (เลย์เอาต์ `sidebar`) — `min-w-0` กันตาราง/ภาพล้นคอลัมน์กริด */
export function sidebarMainClass(): string {
  return "min-w-0 lg:col-span-3";
}

/** บล็อกจากตัวที่สองเป็นต้นไปของหน้าแลนดิ้ง — กึ่งกลางแคบ (อ่านสบายกว่า strech เต็มจอ) */
export function landingTailClass(): string {
  return "mx-auto w-full max-w-3xl";
}

/** ลิงก์ในสารบัญ — ต้องกดง่ายและเห็นโฟกัสชัด */
export function tocLinkClass(): string {
  return "text-fg-muted hover:text-fg focus-visible:ring-ring block rounded-lg px-4 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
}

/** ป้ายของเลย์เอาต์ทั้งสาม (ใช้ในตัวเลือกของหลังบ้าน) */
export const LAYOUT_CHOICES = [
  { value: "full", label: "เต็มความกว้าง (ค่าเริ่มต้น)" },
  { value: "sidebar", label: "มีสารบัญด้านข้าง" },
  { value: "landing", label: "หน้าแลนดิ้ง" },
] as const;

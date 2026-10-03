import type { FieldSpec, PageSpec, SectionSpec, ValueKind } from "@/lib/content/types";

/**
 * โครงฟิลด์ของ **หน้าแรก** (ตาม BACKEND_DECISIONS.md ภาคผนวก ก)
 *
 * โมดูลนี้เป็น "แหล่งความจริง" ของ 3 อย่างพร้อมกัน
 * 1. รูปร่างของหลังบ้าน (จะสร้างฟอร์มจากลิสต์นี้ ไม่เขียนฟอร์มมือทีละช่อง)
 * 2. กติกาที่ด่าน `check:content` ใช้ตรวจ
 * 3. สัญญากับ DB — คีย์ในไฟล์นี้คือค่าในคอลัมน์ `field` (ดู db/schema.sql)
 *
 * ระดับฟิลด์ (มติ D3)
 * - `level: "section"` → EN บังคับ (หัวข้อ/คำโปรยของแต่ละส่วน)
 * - `level: "item"`    → EN เว้นว่างได้ (การ์ด/สไลด์ที่เพิ่มเอง)
 */

type TextOptions = {
  /** false = เว้นว่างได้ (เช่นป้าย "ตัวอย่าง รอการอนุมัติ" ที่จะลบตอนขึ้นจริง) */
  readonly required?: boolean;
  /** false = ค่าเดียวกันทั้งสองภาษา (ลิงก์ · โทนสี · วันที่ · ตัวเลข) */
  readonly localized?: boolean;
};

function spec(
  level: "section" | "item",
  kind: ValueKind,
  key: string,
  label: string,
  maxLength: number,
  options: TextOptions = {},
): FieldSpec {
  return {
    key,
    label,
    level,
    kind,
    localized: options.localized ?? kind === "text",
    required: options.required ?? true,
    maxLength,
    altRequired: kind === "media",
  };
}

/** ฟิลด์ข้อความระดับ section (EN บังคับ) */
function sectionField(key: string, label: string, maxLength: number, options: TextOptions = {}): FieldSpec {
  return spec("section", "text", key, label, maxLength, options);
}

/** ฟิลด์ระดับรายการ (EN เว้นว่างได้) */
function itemField(key: string, label: string, maxLength: number, options: TextOptions = {}): FieldSpec {
  return spec("item", "text", key, label, maxLength, options);
}

/** ฟิลด์ภาพระดับรายการ · เก็บพาธ ไม่เก็บ URL (D9) · ต้องมี alt ไทย */
function itemImage(key: string, label: string, options: TextOptions = {}): FieldSpec {
  return spec("item", "media", key, label, 300, options);
}

/** ฟิลด์ลิงก์ระดับรายการ (ค่าเดียวกันทั้งสองภาษา) */
function itemUrl(key: string, label: string): FieldSpec {
  return spec("item", "url", key, label, 300, { localized: false });
}

const HERO: SectionSpec = {
  key: "hero",
  label: "แถบเปิดหน้าแรก (Hero)",
  fields: [
    sectionField("eyebrow", "ข้อความเล็กเหนือหัวข้อ", 40),
    sectionField("title", "หัวข้อหลัก", 70),
    sectionField("titleAccent", "หัวข้อหลัก (ท่อนเน้นสี)", 60),
    sectionField("body", "คำโปรย", 400),
    sectionField("note", "ป้ายหมายเหตุ (เช่น ตัวอย่างรออนุมัติ)", 300, { required: false }),
  ],
  items: [
    {
      key: "slides",
      label: "สไลด์ภาพฉากหลัง",
      maxItems: 8,
      fields: [
        itemImage("image", "ภาพสไลด์"),
        itemField("focus", "จุดโฟกัสของภาพ (CSS object-position)", 40, { localized: false }),
      ],
    },
    {
      key: "card",
      label: "การ์ดประกาศมุมขวาล่าง",
      maxItems: 1,
      fields: [
        itemField("title", "หัวข้อการ์ด", 80),
        itemField("body", "คำโปรยการ์ด", 200),
        itemField("linkLabel", "ป้ายลิงก์", 30),
        itemUrl("href", "ปลายทางของลิงก์"),
        itemImage("image", "ภาพการ์ด"),
      ],
    },
  ],
};

const PRODUCTS: SectionSpec = {
  key: "products",
  label: "หมวดสินค้า + สินค้าแนะนำ",
  fields: [
    sectionField("eyebrow", "ข้อความเล็กเหนือหัวข้อ", 40),
    sectionField("title", "หัวข้อส่วน", 70),
    sectionField("body", "คำโปรย", 400),
    sectionField("categoriesTitle", "หัวข้อย่อย: หมวดสินค้า", 60),
    sectionField("featuredTitle", "หัวข้อย่อย: สินค้าแนะนำ", 60),
  ],
  items: [
    {
      key: "categories",
      label: "การ์ดหมวดสินค้า",
      maxItems: 12,
      fields: [
        itemField("name", "ชื่อหมวด", 60),
        itemField("description", "คำอธิบายหมวด", 200),
        itemField("tone", "โทนสีของการ์ด", 20, { localized: false }),
        itemUrl("href", "ปลายทางของหมวด"),
      ],
    },
    {
      key: "featured",
      label: "การ์ดสินค้าแนะนำ",
      maxItems: 12,
      fields: [
        itemField("name", "ชื่อสินค้า", 60),
        itemField("tagline", "คำโปรยสินค้า", 80),
        itemField("category", "หมวดที่สังกัด", 40, { localized: false }),
        itemField("tone", "โทนสีของซอง", 20, { localized: false }),
      ],
    },
  ],
};

const BRAND: SectionSpec = {
  key: "brand",
  label: "เรื่องราวแบรนด์",
  fields: [
    sectionField("eyebrow", "ข้อความเล็กเหนือหัวข้อ", 40),
    sectionField("title", "หัวข้อส่วน", 70),
    sectionField("body", "เนื้อความ", 400),
    sectionField("bodySecondary", "เนื้อความต่อ", 300),
    sectionField("ctaLabel", "ป้ายปุ่ม", 30),
  ],
  items: [
    {
      key: "stats",
      label: "ตัวเลขสถิติ",
      maxItems: 6,
      fields: [
        itemField("value", "ตัวเลข/ค่า", 12, { localized: false }),
        itemField("label", "คำอธิบายตัวเลข", 40),
      ],
    },
  ],
};

const SUSTAINABILITY: SectionSpec = {
  key: "sustainability",
  label: "ความยั่งยืน",
  fields: [
    sectionField("eyebrow", "ข้อความเล็กเหนือหัวข้อ", 40),
    sectionField("title", "หัวข้อส่วน", 70),
    sectionField("body", "คำโปรย", 400),
  ],
  items: [
    {
      key: "points",
      label: "หัวข้อย่อยความยั่งยืน",
      maxItems: 8,
      fields: [
        itemField("title", "หัวข้อย่อย", 60),
        itemField("description", "คำอธิบาย", 200),
      ],
    },
  ],
};

const RECIPES: SectionSpec = {
  key: "recipes",
  label: "เมนูอาหาร (หน้าแรก)",
  fields: [
    sectionField("eyebrow", "ข้อความเล็กเหนือหัวข้อ", 40),
    sectionField("title", "หัวข้อส่วน", 70),
    sectionField("body", "คำโปรย", 400),
  ],
  items: [
    {
      key: "recipes",
      label: "การ์ดเมนูอาหาร",
      maxItems: 12,
      fields: [
        itemField("name", "ชื่อเมนู", 60),
        itemField("description", "คำอธิบายเมนู", 200),
        itemField("minutes", "เวลา (นาที)", 12, { localized: false }),
        itemField("level", "ระดับความยาก", 20, { localized: false }),
        itemImage("image", "ภาพเมนู", { required: false }),
      ],
    },
  ],
};

const NEWS: SectionSpec = {
  key: "news",
  label: "ข่าว/กิจกรรม (หน้าแรก)",
  fields: [
    sectionField("eyebrow", "ข้อความเล็กเหนือหัวข้อ", 40),
    sectionField("title", "หัวข้อส่วน", 70),
    sectionField("body", "คำโปรย", 400),
  ],
  items: [
    {
      key: "news",
      label: "การ์ดข่าว",
      maxItems: 12,
      fields: [
        itemField("title", "หัวข้อข่าว", 90),
        itemField("excerpt", "คำโปรยข่าว", 160),
        itemField("tag", "ป้ายหมวดข่าว", 20),
        spec("item", "date", "date", "วันที่ประกาศ", 10, { localized: false }),
        itemImage("image", "ภาพข่าว", { required: false }),
      ],
    },
  ],
};

const WHERE_TO_BUY: SectionSpec = {
  key: "whereToBuy",
  label: "ที่ซื้อสินค้า",
  fields: [
    sectionField("eyebrow", "ข้อความเล็กเหนือหัวข้อ", 40),
    sectionField("title", "หัวข้อส่วน", 70),
    sectionField("body", "คำโปรย", 400),
    sectionField("retailNote", "หมายเหตุร้านค้าปลีก", 200),
  ],
  items: [
    {
      key: "marketplaces",
      label: "ช่องทางจำหน่าย",
      maxItems: 12,
      fields: [
        itemField("name", "ชื่อช่องทาง", 40),
        itemUrl("href", "ลิงก์ร้าน"),
        itemImage("logo", "โลโก้ช่องทาง", { required: false }),
      ],
    },
  ],
};

const NEWSLETTER: SectionSpec = {
  key: "newsletter",
  label: "สมัครรับข่าวสาร",
  fields: [
    sectionField("eyebrow", "ข้อความเล็กเหนือหัวข้อ", 40),
    sectionField("title", "หัวข้อส่วน", 70),
    sectionField("body", "คำโปรย", 400),
    sectionField("consent", "ข้อความยินยอม", 220),
    sectionField("successMessage", "ข้อความเมื่อส่งสำเร็จ", 220),
    sectionField("note", "หมายเหตุ (เช่น ช่องทางยังไม่เปิด)", 300, { required: false }),
  ],
  items: [],
};

const SEO: SectionSpec = {
  key: "seo",
  label: "ข้อมูลสำหรับเครื่องค้นหา (SEO)",
  fields: [
    sectionField("title", "หัวข้อหน้า (title)", 70),
    sectionField("description", "คำอธิบายหน้า (description)", 200),
  ],
  items: [],
};

/** ลำดับ section ต้องตรงกับลำดับที่แสดงบนหน้าเว็บจริง (app/[lang]/page.tsx) */
export const HOME_SECTIONS: readonly SectionSpec[] = [
  HERO,
  PRODUCTS,
  BRAND,
  SUSTAINABILITY,
  RECIPES,
  NEWS,
  WHERE_TO_BUY,
  NEWSLETTER,
  SEO,
];

export const HOME_PAGE_SPEC: PageSpec = {
  page: "home",
  sections: HOME_SECTIONS,
};

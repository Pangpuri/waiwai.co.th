import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ข้อมูลหน้า /contact — pure module (ไม่มี JSX, ไม่มีข้อความที่แสดงบนหน้า)
 *
 * ที่มา:
 *  - `contact/formcontact.txt` = รายการหัวข้อ (เรื่องที่ติดต่อ) และช่องในฟอร์ม
 *  - `contact/*.jpg` = แผนที่ที่ตั้งโรงงาน (ภาพที่บริษัททำเอง — illustrated map ไม่ใช่ screenshot)
 *
 * ⚠️ ฟอร์มนี้ **ยังไม่เปิดใช้งาน** (ไม่มีฝั่งรับข้อมูล) จึงเป็นตัวอย่างรออนุมัติ — ดู PRODUCT_ROADMAP.md § 9
 */

export type ContactTopicId = keyof Messages["contactPage"]["topics"];

/** หัวข้อ "เรื่องที่ติดต่อ" — เรียงตามลำดับในฟอร์มต้นฉบับ */
export const CONTACT_TOPICS: readonly ContactTopicId[] = [
  "productIssue",
  "orderDomestic",
  "orderInternational",
  "marketingSupport",
  "salesAndFleet",
  "supplierOffer",
  "quickTerrace",
];

export type ContactFieldId = "name" | "email" | "phone" | "subject" | "details";

/** ช่องกรอกในฟอร์ม (ตามต้นฉบับ ทุกช่องเป็นคำถามที่จำเป็น) */
export const CONTACT_FIELDS: readonly ContactFieldId[] = [
  "name",
  "email",
  "phone",
  "subject",
  "details",
];

/**
 * แผนที่ที่ตั้งโรงงาน — ย่อจากภาพต้นฉบับ 11222×6614 (6.0MB) เหลือ 2560px (291KB)
 * ด้วย `sharp` ที่ติดมากับ Next อยู่แล้ว (ไม่ได้เพิ่ม dependency)
 * ไฟล์ต้นฉบับยังอยู่ในโฟลเดอร์ `contact/` ที่ root (ไม่ commit / ไม่ลบ)
 */
export const MAP_IMAGE = {
  src: "/contact/om-yai-map.jpg",
  width: 2560,
  height: 1509,
} as const;

/**
 * เบอร์โทรตามที่พิมพ์อยู่บนแผนที่ของผู้ใช้: `0-2811-5101-6` และ `0-2811-6210-6`
 * (รูปแบบ "5101-6" คือช่วงเบอร์ 5101 ถึง 5106 → ลิงก์ `tel:` กดได้ทีละเบอร์ จึงใช้เบอร์แรกของช่วง)
 *
 * ⚠️ ต้นฉบับอีกไฟล์ (`Work with Wai Wai.txt`) พิมพ์ว่า `02-811-5101-5` — เลขท้ายไม่ตรงกัน
 *    ยังไม่แก้ให้ตรงกันเอง เพราะไม่รู้ว่าไฟล์ไหนถูก → ต้องให้บริษัท ยืนยัน (PRODUCT_ROADMAP.md § 9)
 */
export const CONTACT_PHONES: readonly { readonly display: string; readonly tel: string }[] = [
  { display: "02-811-5101-6", tel: "+6628115101" },
  { display: "02-811-6210-6", tel: "+6628116210" },
];

/**
 * ที่ตั้งโรงงาน — ใช้ถ้อยคำเดียวกับหน้า /about เพื่อไม่ให้ข้อมูลขัดกันเอง
 * (เลขไปรษณีย์ 73160 มาจากประกาศรับสมัครของฝ่ายบุคคล ส่วนโรงงาน 2 ไม่มีเลขไปรษณีย์ในข้อมูลที่มี)
 *
 * เก็บเป็น "คีย์ของพจนานุกรม" (literal type) ไม่ใช่ข้อความ → index ได้แบบ type-safe
 */
export type ContactPlant = {
  readonly id: "omYai" | "raiKhing";
  readonly nameKey: "plant1" | "plant2";
  readonly addressKey: "plant1Address" | "plant2Address";
};

export const CONTACT_PLANTS: readonly ContactPlant[] = [
  { id: "omYai", nameKey: "plant1", addressKey: "plant1Address" },
  { id: "raiKhing", nameKey: "plant2", addressKey: "plant2Address" },
];

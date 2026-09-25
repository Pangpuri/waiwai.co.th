/**
 * ข้อมูลระดับองค์กร/เว็บไซต์ ที่ไม่ใช่ข้อความแปล
 *
 * ⚠️ ช่องที่ยังไม่ได้ข้อมูลจริงให้เว้นเป็นสตริงว่างไว้ แล้วคอมโพเนนต์จะไม่แสดงช่องนั้น
 *    ห้ามใส่ข้อมูลติดต่อสมมติลงไป เพราะผู้ใช้อาจเข้าใจว่าเป็นข้อมูลจริง
 */

export const SITE = {
  /** โดเมนที่ใช้ทำ canonical / sitemap / JSON-LD */
  url: "https://www.waiwai.com",
  legalName: "ไวไว",

  contact: {
    /** TODO(การตลาด): ใส่ที่อยู่สำนักงานใหญ่ที่ยืนยันแล้ว */
    address: "",
    phone: "",
    email: "",
  },

  /** ช่องทางซื้อสินค้าอย่างเป็นทางการ (ตรวจจาก waiwai.co.th เมื่อ 2026-09-22) */
  marketplaces: [
    { id: "shopee", href: "https://shopee.co.th/waiwai_officialshop" },
    { id: "lazada", href: "https://www.lazada.co.th/shop/waiwaiofficial/" },
    { id: "lineShop", href: "https://shop.line.me/@waiwai" },
  ] as const,

  /** TODO(การตลาด): ใส่ลิงก์โซเชียลอย่างเป็นทางการเมื่อยืนยันแล้ว */
  social: [] as readonly { id: string; label: string; href: string }[],
} as const;

export type MarketplaceId = (typeof SITE.marketplaces)[number]["id"];

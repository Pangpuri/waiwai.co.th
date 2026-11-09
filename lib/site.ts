/**
 * ข้อมูลระดับองค์กร/เว็บไซต์ ที่ไม่ใช่ข้อความแปล
 *
 * ⚠️ ช่องที่ยังไม่ได้ข้อมูลจริงให้เว้นเป็นสตริงว่างไว้ แล้วคอมโพเนนต์จะไม่แสดงช่องนั้น
 *    ห้ามใส่ข้อมูลติดต่อสมมติลงไป เพราะผู้ใช้อาจเข้าใจว่าเป็นข้อมูลจริง
 */

export const SITE = {
  /**
   * โดเมนที่ใช้ทำ canonical / sitemap / JSON-LD / การ์ดตัวอย่าง SEO
   * ⚠️ เจ้าของยืนยัน 2026-11-09: โดเมนจริงคือ www.waiwai.co.th (ไม่ใช่ .com)
   */
  url: "https://www.waiwai.co.th",
  /** ชื่อนิติบุคคลตามที่ใช้ในเอกสารราชการ (จากนโยบายเดิมของบริษัท) */
  legalName: "บริษัท โรงงานผลิตภัณฑ์อาหารไทย จำกัด",
  /** ชื่อนิติบุคคลภาษาอังกฤษ — ใช้กับหน้า EN / JSON-LD */
  legalNameEn: "Thai Food Products Factory Co., Ltd.",

  contact: {
    /** ที่อยู่สำนักงานใหญ่/โรงงาน (จากนโยบายเดิมของบริษัท) */
    address: "42/1 ถนนเพชรเกษม ตำบลอ้อมใหญ่ อำเภอสามพราน นครปฐม 73160",
    addressEn: "42/1 Phetkasem Road, Om Yai, Sam Phran, Nakhon Pathom 73160, Thailand",
    phone: "02-811-5101-6",
    /** TODO(การตลาด): อีเมลกลาง/อีเมลสำหรับใช้สิทธิ์ยังไม่มีข้อมูลยืนยัน — เว้นว่างไว้ */
    email: "",
  },

  /**
   * ช่องทางซื้อสินค้าอย่างเป็นทางการ — 7 ปุ่มจาก 5 แพลตฟอร์ม
   *
   * Shopee/Lazada มีร้านแยกของ 2 แบรนด์ (Waiwai · Serda) ⇒ ต้องมีจุดสีแบรนด์ที่ปุ่ม
   * เพื่อไม่ให้ผู้ใช้สับสนว่ากำลังจะไปร้านของแบรนด์ไหน
   * · `logo` = โลโก้แพลตฟอร์ม (ใช้เป็นภาพหลักบนปุ่ม)
   * · `brand` = แบรนด์ของร้าน (waiwai/serda · null = ไม่มี)
   * ⚠️ LINE Shop ถูกถอดตามคำสั่งเจ้าของ (2026-11-06)
   */
  marketplaces: [
    {
      id: "shopee",
      platform: "shopee",
      href: "https://shopee.co.th/waiwai_officialshop",
      logo: "/shop-logos/shopee.png",
      brand: "waiwai",
    },
    {
      id: "shopee-serda",
      platform: "shopee",
      href: "https://shopee.co.th/serda_officialshop",
      logo: "/shop-logos/shopee.png",
      brand: "serda",
    },
    {
      id: "lazada",
      platform: "lazada",
      href: "https://www.lazada.co.th/shop/waiwai",
      logo: "/shop-logos/lazada.jpg",
      brand: "waiwai",
    },
    {
      id: "lazada-serda",
      platform: "lazada",
      href: "https://www.lazada.co.th/shop/serda",
      logo: "/shop-logos/lazada.jpg",
      brand: "serda",
    },
    {
      id: "tiktok",
      platform: "tiktok",
      href: "https://www.tiktok.com/@waiwai.channel",
      logo: "/shop-logos/tiktok.png",
      brand: null,
    },
    {
      id: "makro-pro",
      platform: "makroPro",
      href: "https://www.makro.pro/fp/wai-wai-official-shop",
      logo: "/shop-logos/makro-pro.jpg",
      brand: null,
    },
    {
      id: "thaimart",
      platform: "thaimart",
      href: "https://thaimart.com/sellers/%E0%B8%9A%E0%B8%A3%E0%B8%B4%E0%B8%A9%E0%B8%B1%E0%B8%97-%E0%B9%82%E0%B8%A3%E0%B8%87%E0%B8%87%E0%B8%B2%E0%B8%99%E0%B8%9C%E0%B8%A5%E0%B8%B4%E0%B8%95%E0%B8%A0%E0%B8%B1%E0%B8%93%E0%B8%91%E0%B9%8C%E0%B8%AD%E0%B8%B2%E0%B8%AB%E0%B8%B2%E0%B8%A3%E0%B9%84%E0%B8%97%E0%B8%A2-CNWk8s",
      logo: "/shop-logos/thaimart.jpg",
      brand: null,
    },
  ] as const,

  /** TODO(การตลาด): ใส่ลิงก์โซเชียลอย่างเป็นทางการเมื่อยืนยันแล้ว */
  social: [] as readonly { id: string; label: string; href: string }[],
} as const;

export type MarketplaceId = (typeof SITE.marketplaces)[number]["id"];
export type MarketplacePlatformId = (typeof SITE.marketplaces)[number]["platform"];

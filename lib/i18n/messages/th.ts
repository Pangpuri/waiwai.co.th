import { a11y, actions, cookie, footer, lang, meta, mourning, nav, notFound, theme, topbar } from "./areas/th/core.ts";
import { brand, hero, news, newsletter, products, recipes, sustainability, whereToBuy } from "./areas/th/home.ts";
import { about } from "./areas/th/about.ts";
import { productsPage } from "./areas/th/catalog.ts";
import { newsPage, recipesPage } from "./areas/th/contentPages.ts";
import { careersPage } from "./areas/th/careers.ts";
import { contactPage } from "./areas/th/contact.ts";

/**
 * พจนานุกรมภาษาไทย — เป็น "ต้นทางของ type"
 *
 * `Messages` ถูก derive จากไฟล์นี้ (ดูท้ายไฟล์)
 * ดังนั้นไฟล์ภาษาอังกฤษ (en.ts) จะต้องมีคีย์ชุดเดียวกันครบถ้วน
 * ถ้าลืมคีย์ หรือพิมพ์คีย์ผิด → TypeScript error ทันที ไม่ต้องรอ runtime
 *
 * ⚠️ ข้อความทั้งหมดในไฟล์นี้เป็น "ข้อความตั้งต้นสำหรับ Mockup"
 *    ต้องให้ฝ่ายการตลาดยืนยันก่อนขึ้นจริง (ดู PRODUCT_ROADMAP.md § 9)
 */

export const th = {
  meta,
  nav,
  actions,
  a11y,
  topbar,
  theme,
  lang,
  hero,
  about,
  products,
  productsPage,
  recipesPage,
  newsPage,
  careersPage,
  contactPage,
  brand,
  sustainability,
  recipes,
  news,
  whereToBuy,
  newsletter,
  footer,
  cookie,
  notFound,
  mourning,
};

/**
 * โครงสร้างพจนานุกรม — ทุกภาษาต้องตรงกับชุดคีย์นี้
 * ค่าถูก widen เป็น string เพื่อให้แต่ละภาษาใส่ข้อความของตัวเองได้
 */
export type Messages = typeof th;

import { a11y, actions, cookie, footer, lang, meta, mourning, nav, notFound, theme, topbar } from "./areas/th/core.ts";
import { hero, news, newsletter, products, recipes, whereToBuy } from "./areas/th/home.ts";
import { about } from "./areas/th/about.ts";
import { productsPage } from "./areas/th/catalog.ts";
import { newsPage, recipesPage } from "./areas/th/contentPages.ts";
import { careersPage } from "./areas/th/careers.ts";
import { contactPage } from "./areas/th/contact.ts";
import { blocks } from "./areas/th/blocks.ts";
import { admin } from "./areas/th/admin.ts";
import { adminMedia } from "./areas/th/adminMedia.ts";
import { adminSettings } from "./areas/th/adminSettings.ts";
import { adminDraft } from "./areas/th/adminDraft.ts";
import { adminNews } from "./areas/th/adminNews.ts";
import { adminProducts } from "./areas/th/adminProducts.ts";
import { thAdminSort } from "./areas/th/adminSort.ts";
import { thAdminRevisions } from "./areas/th/adminRevisions.ts";
import { adminRecipes } from "./areas/th/adminRecipes.ts";
import { adminRetention } from "./areas/th/adminRetention.ts";
import { privacyPage } from "./areas/th/privacy.ts";
import { maintenancePage } from "./areas/th/maintenance.ts";
import { adminMaintenance } from "./areas/th/adminMaintenance.ts";
import { adminErasure } from "./areas/th/adminErasure.ts";
import { adminTemplate } from "./areas/th/adminTemplate.ts";
import { adminTrash } from "./areas/th/adminTrash.ts";
import { adminChromePreset } from "./areas/th/adminChromePreset.ts";
import { adminBlockTypes } from "./areas/th/adminBlockTypes.ts";
import { adminSchedule } from "./areas/th/adminSchedule.ts";
import { adminRbac } from "./areas/th/adminRbac.ts";
import { adminPreviewLink } from "./areas/th/adminPreviewLink.ts";
import { previewLinkPage } from "./areas/th/previewLink.ts";
import { pendingPages } from "./areas/th/pendingPages.ts";

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
  recipes,
  news,
  whereToBuy,
  newsletter,
  footer,
  cookie,
  notFound,
  mourning,
  privacyPage,
  maintenancePage,
  previewLinkPage,
  pendingPages,
  blocks,
  admin: {
    ...admin,
    ...adminMedia,
    ...adminSettings,
    ...adminDraft,
    ...adminRetention,
    ...adminNews,
    ...adminProducts,
    ...thAdminSort,
    ...thAdminRevisions,
    ...adminRecipes,
    ...adminMaintenance,
    ...adminErasure,
    ...adminTrash,
    ...adminTemplate,
    ...adminPreviewLink,
    ...adminRbac,
    ...adminChromePreset,
    ...adminBlockTypes,
    ...adminSchedule,
  },
};

/**
 * โครงสร้างพจนานุกรม — ทุกภาษาต้องตรงกับชุดคีย์นี้
 * ค่าถูก widen เป็น string เพื่อให้แต่ละภาษาใส่ข้อความของตัวเองได้
 */
export type Messages = typeof th;

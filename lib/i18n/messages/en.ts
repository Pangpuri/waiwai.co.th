import { a11y, actions, cookie, footer, lang, meta, mourning, nav, notFound, theme, topbar } from "./areas/en/core.ts";
import { hero, news, newsletter, products, recipes, whereToBuy } from "./areas/en/home.ts";
import { about } from "./areas/en/about.ts";
import { productsPage } from "./areas/en/catalog.ts";
import { newsPage, recipesPage } from "./areas/en/contentPages.ts";
import { careersPage } from "./areas/en/careers.ts";
import { contactPage } from "./areas/en/contact.ts";
import { blocks } from "./areas/en/blocks.ts";
import { admin } from "./areas/en/admin.ts";
import { adminMedia } from "./areas/en/adminMedia.ts";
import { adminSettings } from "./areas/en/adminSettings.ts";
import { adminDraft } from "./areas/en/adminDraft.ts";
import { adminNews } from "./areas/en/adminNews.ts";
import { adminProducts } from "./areas/en/adminProducts.ts";
import { enAdminNav } from "./areas/en/adminNav.ts";
import { enAdminSort } from "./areas/en/adminSort.ts";
import { enAdminRevisions } from "./areas/en/adminRevisions.ts";
import { adminRecipes } from "./areas/en/adminRecipes.ts";
import { adminRetention } from "./areas/en/adminRetention.ts";
import { privacyPage } from "./areas/en/privacy.ts";
import { maintenancePage } from "./areas/en/maintenance.ts";
import { adminMaintenance } from "./areas/en/adminMaintenance.ts";
import { adminErasure } from "./areas/en/adminErasure.ts";
import { adminTemplate } from "./areas/en/adminTemplate.ts";
import { adminHero } from "./areas/en/adminHero.ts";
import { adminTrash } from "./areas/en/adminTrash.ts";
import { adminChromePreset } from "./areas/en/adminChromePreset.ts";
import { adminBlockTypes } from "./areas/en/adminBlockTypes.ts";
import { adminSchedule } from "./areas/en/adminSchedule.ts";
import { adminRbac } from "./areas/en/adminRbac.ts";
import { adminPreviewLink } from "./areas/en/adminPreviewLink.ts";
import { enAdminNotice } from "./areas/en/adminNotice.ts";
import { previewLinkPage } from "./areas/en/previewLink.ts";
import { pendingPages } from "./areas/en/pendingPages.ts";

import type { Messages } from "./th";

/**
 * English dictionary.
 *
 * Typed as `Messages` (derived from the Thai file), so a missing or misspelled
 * key is a compile-time error rather than a blank string at runtime.
 *
 * ⚠️ Copy marked "Test data" / "XX" is a placeholder — it must not be read as
 *    real product information (see PRODUCT_ROADMAP.md § 9).
 */

export const en: Messages = {
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
    ...enAdminNav,
    ...enAdminSort,
    ...enAdminRevisions,
    ...adminRecipes,
    ...adminMaintenance,
    ...adminErasure,
    ...adminTrash,
    ...adminHero,
    ...adminTemplate,
    ...adminPreviewLink,
    ...enAdminNotice,
    ...adminRbac,
    ...adminChromePreset,
    ...adminBlockTypes,
    ...adminSchedule,
  },
};

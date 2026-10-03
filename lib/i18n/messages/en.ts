import { a11y, actions, cookie, footer, lang, meta, mourning, nav, notFound, theme, topbar } from "./areas/en/core.ts";
import { brand, hero, news, newsletter, products, recipes, sustainability, whereToBuy } from "./areas/en/home.ts";
import { about } from "./areas/en/about.ts";
import { productsPage } from "./areas/en/catalog.ts";
import { newsPage, recipesPage } from "./areas/en/contentPages.ts";
import { careersPage } from "./areas/en/careers.ts";
import { contactPage } from "./areas/en/contact.ts";
import { admin } from "./areas/en/admin.ts";
import { adminMedia } from "./areas/en/adminMedia.ts";
import { adminSettings } from "./areas/en/adminSettings.ts";
import { adminDraft } from "./areas/en/adminDraft.ts";
import { adminRetention } from "./areas/en/adminRetention.ts";
import { privacyPage } from "./areas/en/privacy.ts";
import { maintenancePage } from "./areas/en/maintenance.ts";
import { adminMaintenance } from "./areas/en/adminMaintenance.ts";
import { adminErasure } from "./areas/en/adminErasure.ts";
import { adminTemplate } from "./areas/en/adminTemplate.ts";
import { adminTrash } from "./areas/en/adminTrash.ts";
import { adminChromePreset } from "./areas/en/adminChromePreset.ts";
import { adminPreviewLink } from "./areas/en/adminPreviewLink.ts";
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
  privacyPage,
  maintenancePage,
  previewLinkPage,
  pendingPages,
  admin: {
    ...admin,
    ...adminMedia,
    ...adminSettings,
    ...adminDraft,
    ...adminRetention,
    ...adminMaintenance,
    ...adminErasure,
    ...adminTrash,
    ...adminTemplate,
    ...adminPreviewLink,
    ...adminChromePreset,
  },
};

import { a11y, actions, cookie, footer, lang, meta, nav, notFound, theme, topbar } from "./areas/en/core.ts";
import { brand, hero, news, newsletter, products, recipes, sustainability, whereToBuy } from "./areas/en/home.ts";
import { about } from "./areas/en/about.ts";
import { productsPage } from "./areas/en/catalog.ts";
import { newsPage, recipesPage } from "./areas/en/contentPages.ts";
import { careersPage } from "./areas/en/careers.ts";
import { contactPage } from "./areas/en/contact.ts";

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
};

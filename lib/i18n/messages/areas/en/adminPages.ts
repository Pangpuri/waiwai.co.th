/**
 * Dictionary area: "builder page settings" (round 286 - closes D-281-1/D-281-2)
 *
 * Split into its own area because the main `admin` file is already at the 32KB cap.
 * Used by the page-settings panel for `product-<category>` pages, where the page name
 * comes from the product-categories screen and the main-menu switch is always off.
 */
export const adminPages = {
  pageNameLockedTitle: "This page's name comes from the “Product categories” screen",
  pageNameLockedLink: "Edit the name/description on the product categories screen",
  pageMenuLockedNote: "Category detail pages never appear in the main menu - visitors reach them from the products page",
};

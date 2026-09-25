/**
 * Core area — used by every page (nav / footer / a11y labels / system text)
 *
 * แยกจากพจนานุกรมก้อนเดียว (เดิมอยู่ lib/i18n/messages/en.ts) เพื่อให้
 * แต่ละพื้นที่มีไฟล์ของตัวเอง — ดูเพดานขนาดต่อพื้นที่ใน scripts/check-i18n.ts
 */

export const meta = {
    siteName: "Wai Wai",
    defaultTitle: "Wai Wai — Thai instant noodles and food for every meal",
    defaultDescription:
      "Wai Wai is a Thai food manufacturer with a range of instant noodle flavours and auditable production standards.",
    homeTitle: "Wai Wai — Thai instant noodles and food for every meal",
    homeDescription:
      "Meet Wai Wai as a Thai food manufacturer: our instant noodle range, easy recipes, company news, and the official channels where you can buy our products.",
};

export const nav = {
    home: "Home",
    about: "Company",
    certifications: "Certifications",
    executives: "Management team",
    products: "Products",
    recipes: "Recipes",
    news: "News & Activities",
    careers: "Careers",
    contact: "Contact us",
    shopOnline: "Shop online",
    whereToBuy: "Where to buy",
};

export const actions = {
    viewProducts: "Browse all products",
    viewAllProducts: "Browse all products",
    viewAllNews: "Read all news",
    viewAllRecipes: "See all recipes",
    readMore: "Read more",
    findStore: "Find a store nearby",
    shopOnline: "Shop online",
    learnMore: "About Wai Wai",
    subscribe: "Subscribe",
    backToTop: "Back to top",
};

export const a11y = {
    skipToContent: "Skip to main content",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    mainNavigation: "Main navigation",
    footerNavigation: "Footer navigation",
    breadcrumb: "Breadcrumb",
    newWindow: "(opens in a new tab)",
};

export const topbar = {
    announcement: "Follow Wai Wai news and activities through our official channels.",
    announcementLink: "See the news",
};

export const theme = {
    label: "Colour theme",
    light: "Light",
    dark: "Dark",
    system: "System",
};

export const lang = {
    switchLabel: "Change language",
};

export const footer = {
    about:
      "Wai Wai is a Thai food brand making instant noodles and food products accessible at a fair price.",
    companyColumn: "Company",
    productsColumn: "Products",
    supportColumn: "Support",
    followColumn: "Follow us",
    contactAddress: "Head office",
    contactPhone: "Phone",
    contactEmail: "Email",
    rights: "All rights reserved",
    links: {
      about: "About Wai Wai",
      executives: "Management team",
      certifications: "Certifications",
      sustainability: "Sustainability",
      careers: "Careers",
      recipes: "Recipes",
      news: "News & activities",
      allProducts: "All products",
      whereToBuy: "Where to buy",
      contact: "Contact us",
      faq: "FAQ",
      privacy: "Privacy policy",
      cookies: "Cookie policy",
      terms: "Terms of use",
    },
};

export const cookie = {
    title: "This site uses cookies",
    body: "We use cookies so the site works properly and to understand how it is used. You can accept all cookies or only the essential ones.",
    accept: "Accept all",
    essentialOnly: "Essential only",
    policyLink: "Read the cookie policy",
};

export const notFound = {
    title: "We could not find that page",
    body: "The link may have changed, or the address may be incomplete. Start again from the home page.",
    cta: "Back to home",
};

/**
 * Mourning notice — the dialog shown on every page load until the visitor
 * ticks "do not show again today" (see lib/mourning-notice.ts).
 *
 * The Thai text inside the image is not repeated here; `caption` is the
 * signature line taken from the artwork itself, which also gives
 * English readers the same information.
 */
export const mourning = {
    dialogLabel: "Mourning announcement",
    caption: "The management and staff of Thai Food Products Factory Co., Ltd.",
    close: "Close this window",
    muteToday: "Do not show again today",
    seeNext: "See the next image",
    prev: "Previous image",
    next: "Next image",
    gotoSlide: "Go to image",
    images: {
      banner: {
        alt: "A black-and-white mourning banner with a royal portrait in an ornate oval frame among beams of light and clouds, captioned in Thai: forever in our hearts.",
      },
      banner2: {
        alt: "A second black-and-white mourning banner: the royal portrait in a decorative sparkling frame on a plain black background, with the same Thai tribute text.",
      },
    },
};

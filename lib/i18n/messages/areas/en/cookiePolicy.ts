/**
 * Dictionary area: /cookie-policy (cookie policy)
 *
 * The list of cookies/localStorage keys comes from `lib/cookie-policy.ts`
 * (the real key constants). This file explains what each item is used for
 * and how long it is kept.
 */
import type { CookiePolicyItemId, CookiePolicyKindLabels, CookiePolicyScopeLabels } from "@/lib/cookie-policy";

const kindLabels: CookiePolicyKindLabels = {
  cookie: "Cookie",
  localStorage: "localStorage",
};

const scopeLabels: CookiePolicyScopeLabels = {
  public: "Site visitors",
  staff: "Admin staff",
};

export const cookiePolicyPage = {
  meta: {
    title: "Cookie policy",
    description:
      "How waiwai.com uses cookies and browser storage — what we use, why, how long it lasts, and how you can manage it.",
  },
  eyebrow: "Cookies",
  title: "Cookie policy",
  intro:
    "waiwai.com uses cookies and browser storage only as needed to operate the site and remember the choices you make. We do not use cookies for marketing, advertising, or behavioural tracking.",

  summaryTitle: "In short",
  summaryBody:
    "This site does not use analytics or advertising cookies. The cookies we set are only for administrator sessions. What most visitors store are preferences in localStorage — kept in your browser and not sent back to us.",

  whatTitle: "What cookies and localStorage are",
  whatBody:
    "A cookie is a small piece of data a website asks your browser to store and sends back when you visit again. localStorage is browser storage that remains after you close a tab, but is not sent to the server automatically. We use both only where needed, as listed below.",

  itemsTitle: "What we use",
  itemsIntro: "This table lists everything the site currently uses.",
  tableName: "Name / type",
  tablePurpose: "Purpose",
  tableDuration: "Kept for",
  tableScope: "Used by",
  kindLabels,
  scopeLabels,
  items: {
    adminSession: {
      purpose: "Authenticate and keep the administrator session active",
      duration: "Up to 8 hours",
    },
    maintenanceBypass: {
      purpose: "Let an authorised administrator view the site while maintenance mode is on",
      duration: "Up to 15 minutes",
    },
    theme: {
      purpose: "Remember the light/dark/system theme you chose",
      duration: "Until you clear your browser data",
    },
    cookieConsent: {
      purpose: "Remember whether you have answered the cookie banner",
      duration: "Until you clear your browser data",
    },
    mourningNotice: {
      purpose: "Remember that you chose not to see the memorial notice again that day",
      duration: "Until the end of that day in your local time",
    },
    heroCard: {
      purpose: "Remember that you dismissed the home-page announcement card that day",
      duration: "Until the end of that day in your local time",
    },
    adminSidebar: {
      purpose: "Store the open/closed state of the admin sidebar",
      duration: "Until you clear your browser data",
    },
  } satisfies Record<CookiePolicyItemId, { readonly purpose: string; readonly duration: string }>,

  notUsedTitle: "Cookies we do not use",
  notUsedBody:
    "We do not use analytics cookies (such as Google Analytics), advertising or remarketing cookies, or third-party cookies that track you across sites. We do not build marketing profiles.",

  thirdPartyTitle: "Service providers and third parties",
  thirdPartyBody:
    "The site is hosted on Vercel and uses a Neon database (Singapore), which may keep technical logs such as IP address and time for security and operation. We do not send localStorage data to third parties.",
  thirdPartyYouTube:
    "When you press play on a YouTube video on the recipes page, your browser connects to YouTube (youtube-nocookie), which may set cookies or collect data under Google's policies. Nothing is sent to YouTube before you press play.",
  thirdPartyYouTubeLink: "Google privacy policy",

  choicesTitle: "Your choices",
  choicesBody:
    "The cookie banner appears on your first visit (after closing the memorial notice, if one is shown). You can choose:",
  choicesAll: "Accept all — record that you consent",
  choicesEssential: "Essential only — record that you consent to essential items only",
  choicesSame:
    "Both choices currently use exactly the same items because the site has no analytics or marketing cookies. The two options exist so your decision is explicit, and they will become meaningfully different if optional cookies are added later.",
  choicesChange: "You can change your mind at any time by using the button below to clear your previous answer; the cookie banner will then appear again.",
  consentButton: "Change cookie settings",
  consentStatus: "Your previous answer was cleared — the cookie banner will appear at the bottom of the screen.",
  choicesBrowser:
    "You can also delete or block cookies and localStorage in your browser settings. If storage is blocked, the site still works, but it cannot remember your preferences and the cookie banner may appear again.",

  noConsentTitle: "What happens if you do not consent",
  noConsentBody:
    "You can still use the site normally. Administrator session cookies do not apply to general visitors. If you do not consent or block localStorage, we cannot remember your preferences and the cookie banner may appear again.",

  privacyTitle: "More information",
  privacyBody:
    "This cookie policy covers cookies and browser storage only. Personal data, retention periods, and your rights are described in the privacy policy.",
  privacyLink: "Open the privacy policy",

  contactTitle: "Contact us",
  contactBody:
    "If you have questions about cookies or browser settings, contact the company's data protection officer through the channels on our contact page.",
  contactLink: "Go to the contact page",

  updatedTitle: "Effective date and version",
  updatedBody: "Effective 7 November 2026 · Version 1.0 · Last updated 7 November 2026",
  backHome: "Back to home",
};

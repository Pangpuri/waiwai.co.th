/**
 * Dictionary area: maintenance notice page (X2.5) — English
 * ต้องมีคีย์ชุดเดียวกับ areas/th/maintenance.ts เป๊ะ (ถ้าขาด → typecheck แดง)
 *
 * ⚠️ Tone: **do not promise a time we do not know** — say we will be back as soon as possible
 *    and show contact channels that actually work (pulled from the site settings, never invented).
 */
export const maintenancePage = {
  meta: {
    title: "The site is temporarily unavailable",
    description: "Wai Wai is temporarily down for maintenance — sorry for the inconvenience.",
  },
  eyebrow: "Notice",
  title: "The site is temporarily unavailable",
  body: "We are upgrading our systems to serve you better. Sorry for the inconvenience — we will be back as soon as possible.",
  retryNote: "This message is shown temporarily — the page has not been removed.",
  contactTitle: "You can still reach us here",
  contactPhoneLabel: "Phone",
  contactEmailLabel: "Email",
  contactMissing: "Contact details will appear here once they are set in the admin area.",
  languageLabel: "Other language",
};

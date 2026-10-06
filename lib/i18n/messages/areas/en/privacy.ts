/**
 * Dictionary area: the /privacy page (privacy policy) — X2b
 *
 * ⚠️ This copy is a **draft** written from "what the system actually does" (the retention periods come from
 *    lib/retention/plan.ts). It must be reviewed by the site owner / legal adviser before it goes live — see
 *    PRODUCT_ROADMAP.md § 9.
 */
export const privacyPage = {
  meta: {
    title: "Privacy policy",
    description:
      "Wai Wai's privacy policy — what we collect, why we use it, how long we keep it, and how to exercise your rights.",
  },
  eyebrow: "Privacy",
  title: "Privacy policy",
  intro:
    "This policy explains what personal data the Wai Wai website collects from you, what we use it for, how long we keep it, and how you can exercise your rights.",
  draftNotice:
    "Draft — this page is written from what the system actually does (the retention periods below come from the same values the deletion job uses), but the wording still needs review by the site owner and a legal adviser before it is used with real visitors.",

  controllerTitle: "Data controller",
  controllerIntro: "The data controller under this policy is",
  controllerNameLabel: "Organisation",
  controllerAddressLabel: "Address",
  controllerPhoneLabel: "Phone",
  controllerEmailLabel: "Email",
  controllerMissing: "Not filled in under site settings yet — an administrator can add it on the settings screen.",

  collectTitle: "What we collect",
  collectIntro: "We collect only the information you enter in the forms on this website.",
  collectContactTitle: "Contact form",
  collectContactBody: "Your name, email, phone number (if provided), the topic you chose, and your message",
  collectNewsletterTitle: "Newsletter form",
  collectNewsletterBody: "Your email address",
  collectCareersTitle: "Job application form",
  collectCareersBody:
    "Your name, the position you applied for, email, phone number, a short introduction, and the résumé file you attach (if any)",

  purposeTitle: "What we use it for",
  purposeIntro: "We use your information only for the purposes below — nothing else",
  purposeReply: "To reply to your enquiry (contact form)",
  purposeNews: "To send you news and activities from Wai Wai — only with your consent, which you can withdraw at any time",
  purposeRecruit: "To consider your application and get in touch about recruitment",
  purposeSecurity: "To keep the system secure and to audit content changes (staff of the site operator only)",

  retentionTitle: "How long we keep it",
  retentionIntro:
    "We keep data only as long as needed, per the periods below. When a period ends, the system deletes the data automatically (the same values the deletion job uses).",
  retentionColData: "Data type",
  retentionColKeep: "Kept for",
  retentionLabelContact: "Contact form messages",
  retentionLabelNewsletter: "Newsletter subscribers",
  retentionLabelCareers: "Job applications and résumé files",
  retentionLabelBlockRevision: "Page content edit history (latest revision always kept)",
  retentionLabelContentRevision: "Field content edit history (latest revision always kept)",
  retentionLabelEntityRevision: "Product/recipe/news revision history",
  retentionLabelLoginAttempt: "Back-office sign-in attempts (staff only)",
  retentionLabelAuditLog: "Content change log (staff only)",
  /* Back-office sessions (round 95) */
  retentionLabelAdminSession: "Back-office sign-in sessions (staff only)",
  retentionNote:
    "Deletion is permanent and cannot be undone · résumé files are deleted together with the application · the latest revision of each page is always kept so mistakes can be restored · if you want your data deleted earlier, contact us using the details below",

  rightsTitle: "Your rights",
  rightsIntro: "Under personal data protection law you have the following rights",
  rightAccessTitle: "Access and copies",
  rightAccessBody: "Ask what data we hold about you and request a copy",
  rightCorrectTitle: "Correction",
  rightCorrectBody: "Ask us to correct data that is inaccurate or out of date",
  rightDeleteTitle: "Erasure",
  rightDeleteBody: "Ask us to delete your data where we no longer have a lawful reason to keep it",
  rightObjectTitle: "Object or restrict",
  rightObjectBody: "Object to our use of your data, or ask us to restrict it temporarily",
  rightWithdrawTitle: "Withdraw consent",
  rightWithdrawBody: "Withdraw consent at any time (for example, unsubscribe from news) without affecting earlier use",
  rightComplainTitle: "Complain",
  rightComplainBody:
    "Lodge a complaint with the Personal Data Protection Committee (PDPC) if you believe we have used your data unlawfully",

  sharingTitle: "Who we share it with",
  sharingBody:
    "We do not sell your data and do not give it to anyone else for marketing. Only our contracted website hosting and database providers process it, and only on our instructions. (The full processor list is still to be confirmed by the site owner.)",
  cookiesTitle: "Cookies",
  cookiesBody:
    "This website uses no marketing or analytics cookies and no third-party tracking scripts. It uses only the cookie required for back-office staff to sign in, which ordinary visitors never receive. Your choice to dismiss the cookie notice is stored in your own browser and is not sent back to us.",
  securityTitle: "Security",
  securityBody:
    "Staff passwords are stored as one-way hashes (never the password itself) · back-office access is limited to authorised people · sign-in attempts are rate limited and activity is logged for auditing",

  contactTitle: "Contacting us about your data",
  contactBody:
    "To exercise your rights or ask about your personal data, use the data controller details shown above.",
  updatedTitle: "Status of this policy",
  updatedBody: "Status: draft — no effective date yet (pending confirmation from the site owner before it applies to real visitors).",
  backHome: "Back to home",
};

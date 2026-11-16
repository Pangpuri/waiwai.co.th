/**
 * Dictionary area: the /privacy page (privacy policy) — X2b
 *
 * ⚠️ This version adapts the company's **previous policy** and checks it against what the system
 *    actually does (personal-data retention periods come from `lib/retention/plan.ts`; aggregate
 *    statistics are not linked to visitors and are retained continuously). It has an effective
 *    date and version, so there is no "draft" badge on the page.
 */
export const privacyPage = {
  meta: {
    title: "Privacy policy",
    description:
      "Thai Food Products Factory's personal data protection policy for the Wai Wai website — what we collect, why we use it, how long we keep it, who we share it with, and how to exercise your rights.",
  },
  eyebrow: "Privacy",
  title: "Privacy policy",
  intro:
    "Thai Food Products Factory Co., Ltd. (“the Company”) recognises the importance of personal data. This policy explains how the Wai Wai website (www.waiwai.co.th) collects, uses, discloses and retains personal data, and the rights of data subjects. This policy applies to personal data collected through this website.",

  controllerTitle: "Data controller",
  controllerIntro: "The data controller under this policy is",
  controllerNameLabel: "Organisation",
  controllerAddressLabel: "Address",
  controllerPhoneLabel: "Phone",
  controllerEmailLabel: "Email",
  controllerDpoLabel: "Personal data contact",
  controllerDpoValue: "Data Protection Officer",
  controllerMissing: "Not filled in under “Organisation & SEO” yet — an administrator can add it there in the back office.",

  definitionsTitle: "Definitions",
  definitionsIntro: "Key terms in this policy have the following meanings",
  definitionCompanyTitle: "The Company",
  definitionCompanyBody: "Thai Food Products Factory Co., Ltd.",
  definitionPersonalTitle: "Personal data",
  definitionPersonalBody:
    "Information relating to a person that enables that person to be identified, directly or indirectly, but excluding information about deceased persons specifically",
  definitionSensitiveTitle: "Sensitive personal data",
  definitionSensitiveBody:
    "Personal information of an inherently private and sensitive nature under Section 26 of the Personal Data Protection Act B.E. 2562 (2019), such as racial or ethnic origin, political opinions, religious or philosophical beliefs, sexual behaviour, criminal records, health data, disability, trade union membership, genetic data and biometric data",
  definitionCommitteeTitle: "Personal Data Protection Committee",
  definitionCommitteeBody:
    "The committee appointed under the Personal Data Protection Act B.E. 2562 (2019), responsible for supervising and issuing rules on personal data protection",

  collectTitle: "What we collect",
  collectIntro: "We collect information you enter in forms and record aggregate daily counts of public page views and selected link clicks.",
  collectContactTitle: "Contact form",
  collectContactBody: "Your name, email, phone number (if provided), the topic you chose, and your message",
  collectNewsletterTitle: "Newsletter form",
  collectNewsletterBody: "Your email address",
  collectCareersTitle: "Job application form",
  collectCareersBody:
    "Your name, the position you applied for, email, phone number, a short introduction, and the résumé file you attach (if any)",
  collectAnalyticsTitle: "Website engagement statistics",
  collectAnalyticsBody:
    "Each opening or navigation to a public page is counted, including direct visits from search results without first visiting the home page, along with marketplace, news, recipe, and job application clicks. Counts are daily aggregates, do not identify individuals, and are retained continuously without a scheduled deletion date",
  collectNote:
    "Page views count page openings, not unique visitors · These statistics do not record IP addresses, sessions, full URLs, names, or email addresses · We do not collect sensitive personal data through this website · Our hosting provider may separately keep technical access logs (such as IP address and time) for system security",

  purposeTitle: "What we use it for",
  purposeIntro: "We use your information only for the purposes below — nothing else",
  purposeReply: "To reply to your enquiry (contact form)",
  purposeNews: "To send you news and activities from Wai Wai — only with your consent, which you can withdraw at any time",
  purposeRecruit: "To consider your application and get in touch about recruitment",
  purposeSecurity: "To keep the system secure and to audit content changes (staff of the site operator only)",
  purposeAnalytics: "To understand aggregate public page views and interest in marketplaces, news, recipes, and job postings from daily counts that do not identify visitors",
  purposeBasis:
    "Legal bases: contact form — your consent when you submit the form, or the Company's legitimate interest in responding to your enquiry · newsletter — your consent (withdrawable at any time) · job application — your consent or steps taken before entering into an employment contract · system security — the Company's legitimate interest",

  retentionTitle: "How long we keep it",
  retentionIntro:
    "Personal data is kept for the periods below and deleted automatically when each period ends, using the same values as the deletion job. Aggregate engagement statistics are retained continuously as described in the note.",
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
  retentionLabelAdminSession: "Back-office sign-in sessions (staff only)",
  retentionNote:
    "Deletion is permanent and cannot be undone · résumé files are deleted together with the application · the latest revision of each page is always kept so mistakes can be restored · aggregate daily statistics are not linked to visitors and are retained continuously without a scheduled deletion date · if you want personal data deleted earlier, contact us using the details below",

  rightsTitle: "Your rights",
  rightsIntro: "Under the Personal Data Protection Act B.E. 2562 (2019) you have the following rights",
  rightAccessTitle: "Access and copies",
  rightAccessBody: "Ask what data we hold about you and request a copy",
  rightCorrectTitle: "Correction",
  rightCorrectBody: "Ask us to correct data that is inaccurate or out of date",
  rightDeleteTitle: "Erasure",
  rightDeleteBody: "Ask us to delete your data where we no longer have a lawful reason to keep it",
  rightRestrictTitle: "Restriction",
  rightRestrictBody:
    "Ask us to restrict the use of your data temporarily, for example while you ask us to verify its accuracy, or where we no longer need it but you need it to establish a legal claim",
  rightPortabilityTitle: "Data portability",
  rightPortabilityBody:
    "Receive the data you provided to us in a machine-readable format, or ask us to transfer it to another data controller, subject to the conditions set by law",
  rightObjectTitle: "Objection",
  rightObjectBody: "Object to the collection, use or disclosure of your personal data",
  rightWithdrawTitle: "Withdraw consent",
  rightWithdrawBody:
    "Withdraw consent at any time (for example, unsubscribe from news) without affecting earlier use",
  rightComplainTitle: "Complain",
  rightComplainBody:
    "Lodge a complaint with the Office of the Personal Data Protection Committee (PDPC) if you believe we have used your data unlawfully",
  rightsNote:
    "Your rights may be limited by law in some cases, for example where we must comply with a court order · We will act on your request within the period required by law",

  sharingTitle: "Who we share it with",
  sharingBody:
    "We do not sell your data or disclose it for marketing · We disclose it only as necessary to service providers engaged by the Company, who process it on our instructions: our website hosting provider (Vercel) and our database provider (Neon — the database is located in Singapore) · When you press play on a YouTube video on the recipes page, your browser connects directly to YouTube (no connection is made before you press play) · We may disclose data to government or regulatory authorities where required by law",
  cookiesTitle: "Cookies and similar technologies",
  cookiesBody:
    "This website uses no analytics cookies or third-party tracking scripts · Each public page opening is counted with selected clicks as first-party daily aggregates on the server, without cookies, full URLs, or links to individual visitors, and retained continuously without a scheduled deletion date · localStorage remembers your theme, cookie notice choice, announcement notice and PR card · A session cookie is used only by back-office staff to sign in",
  securityTitle: "Security measures",
  securityBody:
    "We apply security measures for personal data, including role-based access control · staff passwords stored as one-way hashes · sign-in rate limiting · activity logging for content changes · separate database credentials for the public site, public forms and the back office · data backups and restore testing",
  reviewTitle: "Review and changes to this policy",
  reviewBody:
    "The Company may update or amend this policy from time to time to reflect changes to its services, the law or its operations · Where a change is material, we will announce it on this page and state the effective date of the new version",

  contactTitle: "Contacting us about your data",
  contactBody:
    "To exercise your rights or ask about your personal data, contact the Data Protection Officer using the data controller details above, or send us a message through the contact form",
  contactFormLabel: "Go to the contact form",
  updatedTitle: "Effective date and version",
  updatedBody: "Effective 16 November 2026 · Version 1.1 · Last updated 16 November 2026",
  backHome: "Back to home",
};

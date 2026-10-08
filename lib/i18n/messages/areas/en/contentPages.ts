/**
 * Content pages area (/recipes and /news)
 *
 * แยกจากพจนานุกรมก้อนเดียว (เดิมอยู่ lib/i18n/messages/en.ts) เพื่อให้
 * แต่ละพื้นที่มีไฟล์ของตัวเอง — ดูเพดานขนาดต่อพื้นที่ใน scripts/check-i18n.ts
 */

  /*
    The /recipes and /news pages (round 15) — sample pages only.
    They contain just the layout and six test cards (3×2); there is no real content.
    ⚠️ Pending approval from the marketing team (see PRODUCT_ROADMAP.md § 9).
  */
export const recipesPage = {
    meta: {
      title: "Recipes — Wai Wai recipe videos",
      description:
        "Wai Wai recipe videos (the brand's own, imported from its previous site) — this page layout is still a sample pending approval.",
    },
    eyebrow: "Recipes",
    title: "Recipes from Wai Wai",
    intro:
      "A sample of how the recipe cards will be laid out, for the marketing team to review before the real content is written.",
    notice:
      "This page is a sample (mockup) pending approval — the test cards below are placeholder data.",
    /* The "recipe videos" section from the database (round 104) — imported from the brand's previous site */
    dbListTitle: "Recipe videos from Wai Wai",
    dbListCount: "{count} recipes",
    dbPlay: "Play video",
    dbPrivacyNote: "The video loads from YouTube after you press play",
    dbWatch: "Open in YouTube",
    dbPublished: "Published",
    dbNoCover: "No cover image yet",
    cardTitle: "Test recipe",
    cardMeta: "XX",
    figureCaption: "Placeholder image for recipe",
    figureBadge: "Placeholder image",
};

export const newsPage = {
  campaignStageLabel: "Campaign card from the admin",
    meta: {
      title: "News & Activities",
      description:
        "Wai Wai news and activities (the brand's own, imported from its previous site) — this page layout is still a sample pending approval.",
    },
    eyebrow: "News & Activities",
    title: "News & Activities",
    intro:
      "A sample of how the news cards will be laid out, for the marketing team to review before the real content is written.",
    notice:
      "This page is a sample (mockup) pending approval — the test cards below are placeholder data.",
    /* The real news section from the database (round 105) — imported from the brand's previous site */
    dbListTitle: "Wai Wai news and activities",
    dbListCount: "{count} news items",
    dbReadMore: "Read more",
    dbNoCover: "No cover image yet",
    dbPrevious: "Previous",
    dbNext: "Next",
    dbPageLabel: "Pagination",
    dbPublished: "Published",
    dbBackToNews: "Back to all news",
    cardTitle: "Test news headline",
    cardMeta: "XX",
    figureCaption: "Placeholder image for news item",
    figureBadge: "Placeholder image",
};

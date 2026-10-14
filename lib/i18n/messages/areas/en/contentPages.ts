/**
 * Content pages area (/recipes and /news)
 *
 * แยกจากพจนานุกรมก้อนเดียว (เดิมอยู่ lib/i18n/messages/en.ts) เพื่อให้
 * แต่ละพื้นที่มีไฟล์ของตัวเอง — ดูเพดานขนาดต่อพื้นที่ใน scripts/check-i18n.ts
 */

  /*
    The /recipes and /news pages — real content since rounds 104/105 (the "sample" notice was removed in round 272).
    They contain just the layout and six test cards (3×2); there is no real content.
    ⚠️ Pending approval from the marketing team (see PRODUCT_ROADMAP.md § 9).
  */
export const recipesPage = {
    meta: {
      title: "Recipes — Wai Wai recipe videos",
      description:
        "Wai Wai recipe videos (the brand's own, imported from its previous site).",
    },
    eyebrow: "Recipes",
    title: "Recipes from Wai Wai",
    intro: "Wai Wai recipe videos and cooking ideas, imported from the brand's previous site.",
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
    meta: {
      title: "News & Activities",
      description:
        "Wai Wai news and activities (the brand's own, imported from its previous site).",
    },
    eyebrow: "News & Activities",
    title: "News & Activities",
    intro: "Wai Wai news and activities, imported from the brand's previous site.",
    /* The real news section from the database (round 105) — imported from the brand's previous site */
    /* News list filter row (round 271 · owner decision D29) */
    dbFilterLabel: "Period",
    dbFilterAllYears: "All years",
    dbFilterYear: "{year}",
    dbSortLabel: "Sort by",
    dbSortNewest: "Newest first",
    dbSortOldest: "Oldest first",
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

/**
 * Content pages area (/recipes and /news)
 *
 * แยกจากพจนานุกรมก้อนเดียว (เดิมอยู่ lib/i18n/messages/en.ts) เพื่อให้
 * แต่ละพื้นที่มีไฟล์ของตัวเอง — ดูเพดานขนาดต่อพื้นที่ใน scripts/check-i18n.ts
 */

  /*
    The /recipes and /news pages — real content since rounds 104/105 (the "sample" notice was removed in round 272).
    🔴 Round 288 (owner decision 2026-10-15): **every reference to the brand's previous site was removed.**
    Once the new site goes live and the old one is shut down, this is the only site ⇒ visitors must not be
    pointed at a site that no longer exists.
    (Verified: the wording existed only in the dictionary — no copy in the local or cloud database.)
  */
export const recipesPage = {
    meta: {
      title: "Recipes — Wai Wai recipe videos",
      description:
        "Wai Wai recipe videos and cooking ideas.",
    },
    eyebrow: "Recipes",
    title: "Recipes from Wai Wai",
    intro: "Wai Wai recipe videos and cooking ideas.",
    /* The "recipe videos" section from the database (round 104) */
    dbListTitle: "Recipe videos from Wai Wai",
    dbListCount: "{count} recipes",
    dbPlay: "Play video",
    dbPrivacyNote: "The video loads from YouTube after you press play",
    dbWatch: "Open in YouTube",
    dbPublished: "Published",
    dbNoCover: "No cover image yet",
};

export const newsPage = {
    meta: {
      title: "News & Activities",
      description:
        "Wai Wai news and activities.",
    },
    eyebrow: "News & Activities",
    title: "News & Activities",
    intro: "Wai Wai news and activities.",
    /* The real news section from the database (round 105) */
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
};

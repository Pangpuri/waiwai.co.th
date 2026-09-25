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
      title: "Recipes — sample page",
      description: "A sample recipe layout for Wai Wai — pending approval, with no real content yet.",
    },
    eyebrow: "Recipes",
    title: "Recipes from Wai Wai",
    intro:
      "A sample of how the recipe cards will be laid out, for the marketing team to review before the real content is written.",
    notice:
      "This page is a sample (mockup) pending approval — every card is test data; there are no real recipes yet.",
    cardTitle: "Test recipe",
    cardMeta: "XX",
    figureCaption: "Placeholder image for recipe",
    figureBadge: "Placeholder image",
};

export const newsPage = {
    meta: {
      title: "News & Activities — sample page",
      description:
        "A sample news and activities layout for Wai Wai — pending approval, with no real content yet.",
    },
    eyebrow: "News & Activities",
    title: "News & Activities",
    intro:
      "A sample of how the news cards will be laid out, for the marketing team to review before the real content is written.",
    notice:
      "This page is a sample (mockup) pending approval — every card is test data; there is no real news yet.",
    cardTitle: "Test news headline",
    cardMeta: "XX",
    figureCaption: "Placeholder image for news item",
    figureBadge: "Placeholder image",
};

/**
 * Products page area (/products)
 *
 * แยกจากพจนานุกรมก้อนเดียว (เดิมอยู่ lib/i18n/messages/en.ts) เพื่อให้
 * แต่ละพื้นที่มีไฟล์ของตัวเอง — ดูเพดานขนาดต่อพื้นที่ใน scripts/check-i18n.ts
 */

  /*
    The /products page (product category catalogue).
    Kept separate from the `products` namespace above, which the home page uses for
    its featured-products section — different context.
    ⚠️ The whole page is a sample pending approval (see PRODUCT_ROADMAP.md § 9).
  */
export const productsPage = {
    meta: {
      title: "Products — Wai Wai product categories",
      description:
        "Wai Wai product categories, including instant noodles, dried rice vermicelli and the brands in the group — sample images pending approval.",
    },
    eyebrow: "Products",
    title: "Our product categories",
    intro: "Pick a category to see what is inside it.",
    notice:
      "A sample for the marketing team to review — the images and category names on this page are pending approval, and the product detail pages have not been built yet.",
    cardCta: "View details",
    items: {
      instantNoodles: {
        name: "Instant noodles",
        imageAlt:
          "Wai Wai instant noodle category logo with the Thai slogan meaning chewy and springy, never soggy",
      },
      driedVermicelli: {
        name: "Dried rice vermicelli",
        imageAlt: "Wai Wai dried rice vermicelli category logo",
      },
      serda: {
        name: "Serda",
        imageAlt:
          "Serda brand logo with the Thai slogan meaning delicious in every flavour, and a halal mark",
      },
      quickZabb: {
        name: "Quick Zabb",
        imageAlt: "Quick Zabb brand logo with the Thai slogan meaning spicy right into the strands",
      },
      noodie: {
        name: "Noodie",
        imageAlt: "Noodie brand logo marked as a registered trademark",
      },
      rodDed: {
        name: "Wai Wai Rod Ded (seasoning powder)",
        imageAlt:
          "Wai Wai Rod Ded seasoning powder logo with the Thai slogan meaning just Rod Ded and it is done",
      },
    },
    detailStub: {
      eyebrow: "Sample · pending approval",
      title: "This detail page is not live yet",
      body: "This page only demonstrates that the link from the products page works. The product detail content has not been written yet — it is waiting for information and approval from the marketing team.",
      back: "Back to products",
    },
};

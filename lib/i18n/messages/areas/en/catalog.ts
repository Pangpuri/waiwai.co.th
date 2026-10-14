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
    ⚠️ Round 272: the "sample / pending approval" notice was removed — this page has real data (54 products · 6 categories).
  */
export const productsPage = {
    meta: {
      title: "Products — Wai Wai product categories",
      description:
        "Wai Wai product categories, including instant noodles, dried rice vermicelli and the brands in the group.",
    },
    eyebrow: "Products",
    title: "Our product categories",
    intro: "Pick a category to see what is inside it.",
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
      title: "No products in this category yet",
      body: "This category does not have any products yet — once products are added, the list appears here automatically.",
      back: "Back to products",
    },
    /* Products in this category — imported from the old site (S4, round 103) */
    dbListTitle: "Products in this category",
    dbListCount: "{count} items",
    dbDetails: "Product details",
    dbIngredients: "Ingredients",
    dbIngredientName: "Ingredient name (Thai)",
    dbIngredientNameEn: "Ingredient name (English)",
    dbIngredientPercent: "Amount",
    dbAllergens: "Allergen information",
    dbNetWeight: "Net weight",
    dbFda: "FDA number",
    dbPackaging: "Packaging",
    dbNoImage: "No product image yet",
};

/**
 * Home page area — the sections of the home page
 *
 * แยกจากพจนานุกรมก้อนเดียว (เดิมอยู่ lib/i18n/messages/en.ts) เพื่อให้
 * แต่ละพื้นที่มีไฟล์ของตัวเอง — ดูเพดานขนาดต่อพื้นที่ใน scripts/check-i18n.ts
 */

export const hero = {
    eyebrow: "A Thai food manufacturer",
    title: "The taste Thai kitchens trust,",
    titleAccent: "in every meal of the day",
    body: "Wai Wai makes instant noodles that are easy, comforting and within reach for everyone.",
    note: "Imagery and copy on this page are placeholders used to test the design.",
    // ── Hero background slideshow (see features/home/slides.ts) ──
    galleryLabel: "Wai Wai promotional images",
    gotoSlide: "Go to image",
    sampleImageBadge: "Sample image · pending approval",
    watermarkedImageBadge: "Source watermark · pending replacement",
    pauseSlides: "Pause the slideshow",
    playSlides: "Resume the slideshow",
    slides: {
      flavours: {
        alt: "Wai Wai promotional banner showing the minced pork and minced pork tom yum flavours side by side, each with a bowl of noodles.",
      },
      event: {
        alt: "An executive in a suit holding three packets of WOW instant noodles in front of a 54th anniversary stage backdrop.",
      },
      promotion: {
        alt: "A WOW noodle launch banner on a yellow and orange background, with three packets and a bowl of noodles for each flavour.",
      },
    },
    /*
      ── Announcement card pinned to the bottom-right of the hero (see features/home/hero-card.ts) ──
      This card exists to show small, occasional announcements — edit the copy here, no code change.
      The link target lives in HERO_CARD_HREF in features/home/hero-card.ts
    */
    card: {
      title: "A campaign from Wai Wai",
      body: "Our latest campaigns and news live on the news page.",
      link: "See all news",
      close: "Close this card",
      muteToday: "Do not show again today",
      alt: "A Wai Wai campaign poster: a block of dry instant noodles on a wooden surface with a noodle packet, an empty bowl and a tiny figurine sitting on the chopsticks.",
    },
};

export const products = {
    eyebrow: "Products",
    title: "Pick what fits your meal",
    body: "A range of noodle and ready-to-eat categories, in the flavours Thai homes already know.",
    countLabel: "{count} items",
    categoriesTitle: "Categories",
    featuredTitle: "Featured products",
    categories: {
      packet: {
        name: "Packet noodles",
        description: "Test data",
      },
      cup: {
        name: "Cup noodles",
        description: "Test data",
      },
      semi: {
        name: "Ready-to-cook",
        description: "Test data",
      },
      sauce: {
        name: "Seasoning & sauces",
        description: "Test data",
      },
    },
    items: {
      tomYumGoong: { name: "Wai Wai XXX Flavour", tagline: "Test data" },
      mooSub: { name: "Wai Wai XXX Flavour", tagline: "Test data" },
      nuaSub: { name: "Wai Wai XXX Flavour", tagline: "Test data" },
      kai: { name: "Wai Wai XXX Flavour", tagline: "Test data" },
      boatNoodle: { name: "Wai Wai XXX Flavour", tagline: "Test data" },
      padThai: { name: "Wai Wai XXX Flavour", tagline: "Test data" },
    },
};

export const recipes = {
    eyebrow: "Recipes",
    title: "What to cook with Wai Wai",
    body: "It is not only for boiling. Try these simple ideas that turn a packet into something a little more special.",
    items: {
      dryTomYum: {
        name: "Test recipe 1",
        description: "Test data",
        minutes: "XX",
        level: "XX",
      },
      boatNoodleBowl: {
        name: "Test recipe 2",
        description: "Test data",
        minutes: "XX",
        level: "XX",
      },
      crispyNoodleSalad: {
        name: "Test recipe 3",
        description: "Test data",
        minutes: "XX",
        level: "XX",
      },
    },
};

export const news = {
    eyebrow: "News & activities",
    title: "What is happening right now",
    body: "Company activities, product news, and our work with the community.",
    items: {
      community: {
        title: "Test news headline 1",
        excerpt: "Test data",
        tag: "XX",
      },
      exhibition: {
        title: "Test news headline 2",
        excerpt: "Test data",
        tag: "XX",
      },
      certification: {
        title: "Test news headline 3",
        excerpt: "Test data",
        tag: "XX",
      },
    },
};

export const whereToBuy = {
    eyebrow: "Where to buy",
    title: "Where to find Wai Wai",
    body: "Order online through our official channels, or pick up our products at retailers and leading supermarkets nationwide.",
    marketplaces: {
      shopee: "Shopee",
      lazada: "Lazada",
      lineShop: "LINE Shop",
    },
    retailNote: "Available at retailers, supermarkets and convenience stores nationwide.",
};

export const newsletter = {
  consentRequired: "Please tick the consent box first.",
  unavailable: "Temporarily unavailable — please try again.",
  rateLimited: "Too many sign-ups — please wait a moment.",
  submitting: "Sending…",
    eyebrow: "Wai Wai newsletter",
    title: "Hear about products and activities first",
    body: "Leave your email and we will send occasional updates. We will not flood your inbox, and you can unsubscribe at any time.",
    emailLabel: "Email",
    emailPlaceholder: "name@example.com",
    invalidEmail: "Please enter a valid email address.",
    consent: "I agree that Wai Wai may store and use this information to send me updates, as described in the privacy policy.",
    successMessage: "You are subscribed. Thank you!",
    note: "Your email is stored for newsletters only · you can unsubscribe at any time.",
};

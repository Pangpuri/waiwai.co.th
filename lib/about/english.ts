import type { BlockDocument, RichTextBlock } from "@/lib/blocks/types";

/**
 * ข้อความ **ภาษาอังกฤษของหน้า "บริษัท" (/about)** — คัดจากหน้าต้นทางภาษาอังกฤษ
 * `https://waiwai.co.th/en/pages/11561-Company` (ตรวจ 2026-11-13)
 *
 * ## ทำไมต้องมี
 * หน้า `/about` บนคลาวด์ใช้ **เอกสารบล็อกที่นำเข้าจากหน้าต้นทางภาษาไทย**
 * (`npm run about:import`) ซึ่งเดิมมีแต่ `en: ""` ⇒ กดสลับภาษา EN แล้วหน้าเว็บ
 * ยังแสดงข้อความไทย (ตัวเรนเดอร์ถอยไปใช้ `th` เมื่อ `en` ว่าง — มติ D3)
 * ⇒ ไฟล์นี้คือ "ข้อมูล EN ที่วางตรงกับส่วนต่าง ๆ ของหน้าต้นทางไทย" ชุดเดียว
 *    ใช้ทั้งตอนนำเข้าใหม่ (`buildAboutDocument`) และตอนเติมของเดิม (`withAboutEnglish`)
 *
 * ## กติกาการคัดข้อความ
 * - **ยึดข้อความของต้นทาง** · แก้เฉพาะคำพิมพ์ผิดในตาราง `ABOUT_EN_TEXT_FIXES`
 *   (หลักเดียวกับ `lib/about/corrections.ts` ของภาษาไทย — ห้ามปรับสำนวน/เรียบเรียงใหม่)
 * - **คงตัวเลขที่ต้นทางขัดกันเองไว้ทั้งสองภาษา** เช่น ใบรับรอง ISO: ไทย "2000" · EN "2018"
 * - ส่วนที่ต้นทาง EN ไม่มีหัวข้อ (Policy) หรือไม่มีประโยคนำ (Mission) ใช้ถ้อยคำ EN
 *   ที่มีอยู่แล้วในพจนานุกรมของเว็บ (`lib/i18n/messages/areas/en/about.ts`) — ไม่แต่งใหม่
 * - **ห้ามใส่ URL รูปในไฟล์นี้** (มติ D9) · รูปยังมาจากคลังภาพเหมือนเดิม
 *
 * ⚠️ ไฟล์นี้เป็น **ข้อมูลเนื้อหา** ไม่ใช่ตรรกะหน้าเว็บ — แก้ข้อความได้ แต่ต้องอัปเดต
 *    วันที่ตรวจต้นทางด้านบนและบันทึกใน `PRODUCT_ROADMAP.md` ทุกครั้ง
 */

export const ABOUT_ENGLISH_SOURCE_URL = "https://waiwai.co.th/en/pages/11561-Company";
export const ABOUT_ENGLISH_SOURCE_CHECKED_AT = "2026-11-13";

/** ภาพประกอบของหน้าบริษัท — คำบรรยายภาษาอังกฤษแบบกลาง ๆ (ภาพเป็นภาพบรรยากาศของบริษัท) */
export const ABOUT_IMAGE_ALT_EN = "Company photo";

/* ── ตารางแก้คำพิมพ์ผิดภาษาอังกฤษ (เฉพาะคำผิดชัดเจน) ───────────────────────── */

export type AboutEnglishTextFix = {
  /** ข้อความในต้นทาง */
  readonly from: string;
  /** ข้อความที่แก้แล้ว */
  readonly to: string;
  /** เหตุผลสั้น ๆ (ตรวจย้อนหลังได้) */
  readonly reason: string;
};

export const ABOUT_EN_TEXT_FIXES: readonly AboutEnglishTextFix[] = [
  { from: "Nakornphthom", to: "Nakhon Pathom", reason: "ชื่อจังหวัดสะกดผิด (ต้นทางพิมพ์สลับ)" },
  { from: "Nakornpathom", to: "Nakhon Pathom", reason: "ชื่อจังหวัดสะกดผิด (อีกรูปในต้นทาง)" },
  { from: "employees's", to: "employees'", reason: "เจ้าของพหูพจน์เติม apostrophe ผิด" },
  { from: "Mr.Charn", to: "Mr. Charn", reason: "เว้นวรรคหลังคำนำหน้าชื่อ" },
  { from: "Mr.Pricha", to: "Mr. Pricha", reason: "เว้นวรรคหลังคำนำหน้าชื่อ" },
  { from: "porsonnel", to: "personnel", reason: "สะกดผิด" },
  { from: "thequality", to: "the quality", reason: "คำติดกัน (ขาดช่องว่าง)" },
  { from: "ot the outlets", to: "to the outlets", reason: "สะกดผิด (ot → to)" },
  { from: "Pround", to: "Proud", reason: "สะกดผิดในหัวข้อรางวัล" },
  { from: "Favour", to: "Flavour", reason: "สะกดผิด (ชื่อรสชาติ)" },
  { from: ". the company's", to: ". The company's", reason: "ขึ้นประโยคใหม่หลังมหัพภาค" },
  { from: "important of human resource", to: "importance of human resource", reason: "ใช้คำผิดชนิด (important → importance)" },
  {
    from: "Thai Preserved Foods Factory",
    to: "Thai Preserved Food Factory",
    reason: "ชื่อบริษัทเติมพหูพจน์เกินมา (ชื่อทางการในประโยคแรกคือ Food Factory)",
  },
];

/**
 * แก้คำผิดตามตาราง — ตรรกะล้วน ทดสอบได้
 * ⚠️ ตรวจจากคีย์ของตารางเท่านั้น (ไม่มีค่าจากผู้ใช้ ⇒ ไม่มีความเสี่ยงด้านความปลอดภัย)
 */
export function applyAboutEnglishTextFixes(text: string): string {
  let result = text;
  for (const fix of ABOUT_EN_TEXT_FIXES) {
    result = result.split(fix.from).join(fix.to);
  }
  return result;
}

/* ── ส่วนของหน้าบริษัท (เรียงตามลำดับเดียวกับหน้าต้นทางภาษาไทย) ───────────────── */

export const ABOUT_ENGLISH_ROLES = [
  "intro",
  "vision",
  "mission",
  "policy",
  "research",
  "products",
  "distribution",
  "people",
  "awards",
] as const;

export type AboutEnglishRole = (typeof ABOUT_ENGLISH_ROLES)[number];

export type AboutEnglishSection = {
  readonly role: AboutEnglishRole;
  /** หัวข้อ EN — ต้องมีเสมอ (บล็อก richText บังคับหัวข้อ TH; ฝั่ง EN ใช้คู่กัน) */
  readonly heading: string;
  /** ย่อหน้าตามต้นทาง EN (แก้คำผิดแล้ว) */
  readonly paragraphs: readonly string[];
};

type RawAboutEnglishSection = {
  readonly role: AboutEnglishRole;
  readonly heading: string;
  readonly paragraphs: readonly string[];
};

/**
 * ข้อความต้นทาง EN (ก่อนแก้คำผิด) — เก็บแยกเพื่อให้ `ABOUT_EN_TEXT_FIXES`
 * เป็นแหล่งความจริงเดียวของการแก้คำ และรันซ้ำได้ผลเท่าเดิม
 *
 * ลำดับ/บทบาทตรงกับหน้าต้นทางภาษาไทย:
 * intro → vision → mission → policy → research → products → distribution → people → awards
 */
const RAW_SECTIONS: readonly RawAboutEnglishSection[] = [
  {
    role: "intro",
    /* ชื่อทางการ EN ของบริษัท (ใช้รูปเดียวกับพจนานุกรม EN ของเว็บ) */
    heading: "Thai Preserved Food Factory Co., Ltd.",
    paragraphs: [
      `Thai Preserved Food Factory Company Limited was established in 1972 on the total land area of 99 rais. The company is located at 42/1 Moo 2, Phetchkasem Road, Om-Yai Sub-district, Sampran District, Nakornphthom Province and 3 Moo 14, Rai-Khing Sub-district, Sampran District, Nakornpathom Province. Out of the total area, about 10 rais is allocated for the employees's dormitory, 24 rais for the wastewater treatment and the rest of 57 rais for the office building and factory. The company run by Mr.Charn Tamkongka, the Chairman and Mr.Pricha Napapruekchat, the Managing Director, manufactures "Wai Wai and Quick" brand names of packaged instant noodle and dehydrated rice vermicelli.`,
      `“WAI WAI” has been the proprietary trademark of Thai Preserved Foods Factory Co., Ltd. since 1978. Today, products under such trademark have been accepted worldwide and the trademark has been registered in Thailand as well as in the US, European, Asian, Australian continents and South Africa.`,
    ],
  },
  {
    role: "vision",
    heading: "Vision Statement",
    paragraphs: [
      `To be leading manufacturer and distributor in food industry. Our products must be well known in team of best quality in both domestic and export markets. We always emphasize on human resource development and conduct our business by living up the concept of corporate social responsibility (CSR) and environmental care.`,
    ],
  },
  {
    role: "mission",
    heading: "Mission Statement",
    paragraphs: [
      /* ประโยคนำ: หน้าต้นทาง EN มีแต่ข้อ 1–11 · ใช้ถ้อยคำ EN เดิมของเว็บ (ไม่แต่งใหม่) */
      "To deliver on that vision, the company commits to the following:",
      `1. To produce our products under good manufacturing practice (GMP) and food safety program to meet customers' requirements.`,
      `2. To understand our customers' needs and requirements by conducting integrated marketing.`,
      `3. To conduct efficiency distribution of our goods to meet customers' satisfactory.`,
      `4. To promote firm's human resource development.`,
      `5. Always support research and development programs in our organization.`,
      `6. Boosting staffs' morale for company loyalty.`,
      `7. Living up the concept of corporate social responsibility (CSR) and environmental care in our organization.`,
      `8. To conduct cost management effectively.`,
      `9. To promote activities for porsonnel safety in our factory.`,
      `10. Good management in opportunity and risk factors.`,
      `11. Promote QCC activity to motivate staffs' learning.`,
    ],
  },
  {
    role: "policy",
    heading: "Policy",
    paragraphs: [
      /* หน้าต้นทาง EN ไม่มีหัวข้อ Policy — ข้อความนี้คือย่อหน้าที่ 3 ของส่วนเปิดเรื่อง */
      `To produce our products under good manufacturing practice (GMP) and food safety program to meet customers' most satisfactory. Focus on human resource development and conduct our business by living up the concept of corporate social responsibility (CSR) and environmental care`,
    ],
  },
  {
    role: "research",
    heading: "The R&D and Product Development",
    paragraphs: [
      `In order to satisfy the customers and offer them with the new variety of products on the continuous basis. the company's priority is the R&D and product development. Company's introduction of "Wai Wai" Minced Pork Tom Yum Flavour instant noodle and "Quick" Tom Klong Favour instant noodle, the first of its kind in the market, is the testimony to the leadership of the company on this regard.`,
      `The company is also keen on the quality control. The QC system is adopted on every steps of production from the selection of raw material, production, finishing to the delivery of product to end-user. The comprehensive QC system is to ensure that thequality standard of every package of "Wai Wai" and "Quick" products is consistent as well as the good taste and safety.`,
    ],
  },
  {
    role: "products",
    heading: "Product",
    paragraphs: [
      `The quality standard of all products manufactured by the company is under the supervision of the Ministry of Public Health and Ministry of Industry. The company meanwhile, established the R&D Department and Quality Control Department to control the standard of products and taste and develop the new variety of taste and flavours on the continuous basis.`,
      `The effort of the company has earned the trust from the customers in the local and foreign markets on the products under "Wai Wai and Quick" brand names for more than 35 years.`,
      `The products of the company can mainly be classified into two groupings as the following.`,
      `1. The products for the domestic market i.e. Instant Noodle ( In Pack and In Cup ) Instant Rice Vermicelli, Dehydrated Rice Vermicelli etc.`,
      `2. The products for exported market i.e. Instant Noodle, Quick Formula Noodle ( In Pack and In Cup ), Instant Rice vermicelli etc.`,
    ],
  },
  {
    role: "distribution",
    heading: "Distribution Channel",
    paragraphs: [
      `The company is widening its distribution network to cover all regions of the country to facilitate the distribution of products ot the outlets and consumers on the daily basis.`,
      `The company, through the export, also expands into the overseas markets including USA, Canada, Australia, Japan, Hong Kong, Malaysia, Singapore, Laos, Myanmar and Cambodia. The exported market shares 20% of total sale.`,
    ],
  },
  {
    role: "people",
    heading: "Human Resource Development ... Environment Protection",
    paragraphs: [
      `The company has been well aware of the important of human resource. The trainings for the upgrading of personnel's ability has been provided for the employees. The company also offers the employees with many fringe benefits i.e. living expenses, special allowance, bonus, cash incentives to raise the working efficiency and employee's incomes.`,
      `Apart from the human resource development, the company is also keen on the environmental protection and well-being of surrounding communities. With the allocation of 25% of total area for the wastewater treatment system, all the steps of production process are friendly to the environment and surrounding communities.`,
    ],
  },
  {
    role: "awards",
    heading: "The Company's Pround Awards and Certificates",
    paragraphs: [
      `With the modern environmental friendly production process and the continuous development of human resource on the working expertise and introduction of pre-market inspection system, the company has earned numerous awards and certificates as the followings.`,
      `-Prime Minister's Export Award 1999 on the category of exporter with own brand`,
      `-Best of 97 ( Media Asian Advertising Award )`,
      `-E.G.V. Cinema Ad Award`,
      `-Award from the Ministry of Science and Environment`,
      `-BAD Award-Certificate of Excellence 2001-2002 for the TV commercial Advertising spot of Quick instant noodle in Cup`,
      `-Bronze Award ( 2005 television advertising, confectionery snacks savory food & seasoning ) in the Admin AWARD & SYMPOSIUM contest`,
      `-GMP Certificate on the Standard Food Manufacturer Project by FDA, Ministry of Public Health`,
      `-GMP Codex and HACCP Certificate From Department of Agriculture`,
      `-ISO 9001 : 2018 Certificate from TUV NORD (Thailand) Ltd.`,
    ],
  },
];

/** ข้อความ EN ที่แก้คำผิดแล้ว — ลำดับเดียวกับ `ABOUT_ENGLISH_ROLES` */
export const ABOUT_ENGLISH_SECTIONS: readonly AboutEnglishSection[] = RAW_SECTIONS.map((section) => ({
  role: section.role,
  heading: applyAboutEnglishTextFixes(section.heading),
  paragraphs: section.paragraphs.map(applyAboutEnglishTextFixes),
}));

const BY_ROLE: Readonly<Record<AboutEnglishRole, AboutEnglishSection>> = Object.fromEntries(
  ABOUT_ENGLISH_SECTIONS.map((section) => [section.role, section]),
) as Record<AboutEnglishRole, AboutEnglishSection>;

/** เนื้อหา EN ทั้งส่วน (ย่อหน้าคั่นด้วยบรรทัดว่าง — รูปแบบเดียวกับตัวนำเข้าไทย) */
export function aboutEnglishBodyOf(section: AboutEnglishSection): string {
  return section.paragraphs.join("\n\n");
}

export function aboutEnglishSectionOfRole(role: AboutEnglishRole): AboutEnglishSection {
  return BY_ROLE[role];
}

function normalizeHeading(value: string): string {
  return value.replace(/[\s\u00A0]+/g, " ").trim();
}

/**
 * เดาหน้าที่ของบล็อก `richText` จาก **หัวข้อภาษาไทย**
 *
 * ใช้คีย์คำที่มีความหมายเฉพาะของแต่ละส่วน (ไม่ใช้ลำดับ) ⇒ ถ้าเจ้าของสลับบล็อก
 * หรือแทรกบล็อกใหม่ ข้อความ EN ยังไปถูกส่วน และบล็อกที่ไม่รู้จักจะถูกข้าม
 * (ไม่เขียนทับด้วยข้อความผิดส่วน)
 *
 * ⚠️ ต้องตรวจ `บริษัท` (ส่วนเปิดเรื่อง) ก่อน `ผลิตภัณฑ์` เพราะชื่อบริษัทมีคำว่า
 *    "ผลิตภัณฑ์" อยู่ด้วย · และต้องตรวจ `การวิจัย` ก่อน `ผลิตภัณฑ์` ด้วยเหตุผลเดียวกัน
 */
export function aboutEnglishRoleOfHeading(heading: string): AboutEnglishRole | null {
  const value = normalizeHeading(heading);
  if (value === "") return null;
  if (value.startsWith("บริษัท")) return "intro";
  if (value.includes("วิสัยทัศน์")) return "vision";
  if (value.includes("พันธกิจ")) return "mission";
  if (value.includes("นโยบาย")) return "policy";
  if (value.includes("การวิจัย")) return "research";
  if (value.includes("จัดจำหน่าย")) return "distribution";
  if (value.includes("พัฒนาบุคลากร")) return "people";
  if (value.includes("รางวัล")) return "awards";
  if (value.includes("ผลิตภัณฑ์")) return "products";
  return null;
}

/* ── เติม EN ให้เอกสารเดิม (ไม่แตะ TH/สไตล์/ภาพ) ────────────────────────────── */

export type AboutEnglishSkipReason = "already-filled" | "unknown-heading" | "duplicate-role";

export type AboutEnglishFillReport = {
  /** บล็อกที่เติม EN (หรือเขียนทับเมื่อ `overwrite`) */
  readonly filled: readonly { readonly blockId: string; readonly role: AboutEnglishRole }[];
  /** บล็อกที่ถูกข้ามพร้อมเหตุผล */
  readonly skipped: readonly {
    readonly blockId: string;
    readonly reason: AboutEnglishSkipReason;
    readonly headingTh: string;
  }[];
  /** จำนวนคำบรรยายภาพ EN ที่เติมให้ (`hero` + `gallery`) */
  readonly imageAltsFilled: number;
};

export type AboutEnglishApplyResult = {
  readonly document: BlockDocument;
  readonly report: AboutEnglishFillReport;
};

export type AboutEnglishApplyOptions = {
  /** true = เขียนทับ EN ที่มีอยู่แล้ว · ค่าเริ่มต้น false = เติมเฉพาะช่องที่ว่าง (กันงานคนหาย) */
  readonly overwrite?: boolean;
};

function fillRichText(
  block: RichTextBlock,
  section: AboutEnglishSection,
  overwrite: boolean,
): RichTextBlock | null {
  const headingEmpty = block.heading.en.trim() === "";
  const bodyEmpty = block.body.en.trim() === "";
  if (!overwrite && !headingEmpty && !bodyEmpty) return null;

  return {
    ...block,
    heading: {
      th: block.heading.th,
      en: overwrite || headingEmpty ? section.heading : block.heading.en,
    },
    body: {
      th: block.body.th,
      en: overwrite || bodyEmpty ? aboutEnglishBodyOf(section) : block.body.en,
    },
  };
}

/**
 * เติมข้อความ EN ให้ **เอกสาร `/about` ที่มีอยู่แล้ว** โดยไม่แตะข้อความไทย
 * สไตล์ รหัสบล็อก หรือรูปภาพเดิม
 *
 * - จับคู่ด้วยหัวข้อไทย (`aboutEnglishRoleOfHeading`) ไม่ใช่ลำดับ
 * - ค่าเริ่มต้น **ไม่ทับ EN ที่มีอยู่** (ถือว่าเป็นงานคน) · ใช้ `overwrite: true` เมื่อต้องการแทนที่
 * - บล็อกที่หัวข้อไม่รู้จัก/บทบาทซ้ำ = ข้าม + รายงาน (ไม่ทำให้เอกสารพัง)
 * - เติม `altEn` ให้ภาพ hero/gallery ที่ยังว่าง (a11y ฝั่ง EN)
 */
export function withAboutEnglish(
  document: BlockDocument,
  options: AboutEnglishApplyOptions = {},
): AboutEnglishApplyResult {
  const overwrite = options.overwrite === true;
  const filled: { blockId: string; role: AboutEnglishRole }[] = [];
  const skipped: { blockId: string; reason: AboutEnglishSkipReason; headingTh: string }[] = [];
  const usedRoles = new Set<AboutEnglishRole>();
  let imageAltsFilled = 0;

  const blocks = document.blocks.map((block) => {
    if (block.type === "richText") {
      const role = aboutEnglishRoleOfHeading(block.heading.th);
      if (role === null) {
        if (block.heading.th.trim() !== "") {
          skipped.push({ blockId: block.id, reason: "unknown-heading", headingTh: block.heading.th });
        }
        return block;
      }
      if (usedRoles.has(role)) {
        skipped.push({ blockId: block.id, reason: "duplicate-role", headingTh: block.heading.th });
        return block;
      }
      usedRoles.add(role);

      const updated = fillRichText(block, aboutEnglishSectionOfRole(role), overwrite);
      if (updated === null) {
        skipped.push({ blockId: block.id, reason: "already-filled", headingTh: block.heading.th });
        return block;
      }
      filled.push({ blockId: block.id, role });
      return updated;
    }

    if (block.type === "hero") {
      if (block.image === null || (!overwrite && block.image.altEn.trim() !== "")) return block;
      imageAltsFilled += 1;
      return { ...block, image: { ...block.image, altEn: ABOUT_IMAGE_ALT_EN } };
    }

    if (block.type === "gallery") {
      let changed = false;
      const items = block.items.map((item) => {
        if (item.image === null || (!overwrite && item.image.altEn.trim() !== "")) return item;
        changed = true;
        return { ...item, image: { ...item.image, altEn: ABOUT_IMAGE_ALT_EN } };
      });
      if (!changed) return block;
      imageAltsFilled += items.length;
      return { ...block, items };
    }

    return block;
  });

  return { document: { page: document.page, blocks }, report: { filled, skipped, imageAltsFilled } };
}

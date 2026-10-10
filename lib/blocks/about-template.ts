import { CERTIFICATIONS } from "@/features/about/certifications";
import {
  ABOUT_FACTS,
  DIRECTION_ORDER,
  EXPLORE_LINKS,
  MISSION_ITEM_IDS,
  SITES,
  TIMELINE_ENTRIES,
  visibleTimeline,
} from "@/features/about/content";
import { aboutImagePath, certificateMediaKey } from "@/lib/blocks/about-media";
import { PENDING_PAGE_PATHS } from "@/lib/pages/pending";
import {
  TEMPLATE_BLOCK_VERSION,
  templateBlockId,
  templateCards,
  templateMedia,
  templateStyle,
  templateValueCards,
} from "@/lib/blocks/template-kit";
import type { Block, BlockCard, BlockDocument, BlockGalleryItem } from "@/lib/blocks/types";
import type { Locale } from "@/lib/i18n/config";
import { formatYear } from "@/lib/format";
import { en } from "@/lib/i18n/messages/en";
import { th } from "@/lib/i18n/messages/th";

/*
  ⚠️⚠️ **เลิกใช้เป็นทางหลักตั้งแต่รอบที่ 255** (มติเจ้าของ 2026-10-09 เย็น · หนี้ D-253-1)
  เจ้าของเห็นว่าเทมเพลตชุดนี้ (20 บล็อกที่ประกอบจาก **พจนานุกรม**) "เยอะเกินไป/เสี่ยงข้อมูลเพี้ยน"
  ⇒ หน้า `/about` ตอนนี้สร้างจาก **หน้าต้นทางจริง** ผ่าน `npm run about:import`
     (ตัวแกะ: `lib/about/import-parse.ts` · ตัวประกอบบล็อก: `lib/about/document.ts`)
  ⇒ **อย่ากด "เริ่มจากเทมเพลต" กับหน้า about** — จะทับฉบับร่างที่นำเข้าจากต้นทาง
  หนี้ที่เหลือ: แทน/ถอดเทมเพลตชุดนี้ด้วยชุดที่ยึดต้นทาง (ดู PRODUCT_ROADMAP § 9 · D-255-1)
*/

/**
 * เทมเพลตตั้งต้นของหน้า **"เกี่ยวกับไวไว" (/about)** — S2 · **ขยายครบ 10 ส่วน (รอบที่ 253)**
 *
 * ## มติเจ้าของ 2026-10-09
 * *"เราต้องเอาข้อมูลบริษัทที่น่าจะเป็น hardcode ตอนนี้ เข้าไปเก็บไว้ในฐานข้อมูล แล้วก็ทำการแบ่งบล็อค
 *   ตามรูปแบบที่หน้าบ้านแสดง พร้อมเนื้อหา เพื่อแก้ไขได้ รวมถึงจุดที่อัปโหลดภาพเข้าไปได้ด้วย"*
 *
 * ## หลักการ
 * - **สะท้อนหน้าบ้านตามลำดับจริง** — hero → เรื่องราว(+ข้อเท็จจริง) → ไทม์ไลน์ → โรงงาน → ตัวเลข →
 *   ที่ตั้ง → แผนที่ → ทิศทาง → พันธกิจ → วิจัย → คุณภาพ → ผลิตภัณฑ์ → จัดจำหน่าย → ผู้บริหาร →
 *   รางวัล → ใบรับรอง(สรุป) → แกลเลอรีใบรับรอง 11 ใบ → ปุ่มดูทั้งหมด → ลิงก์ต่อ
 * - ข้อความทั้งหมดมาจาก **พจนานุกรมชุดเดียวกับหน้าที่ใช้งานอยู่** ⇒ เปิดมาเห็นของจริงทันที (ไม่แต่งขึ้นเอง)
 * - ภาพจริง (แผนที่โรงงาน · ผังผู้บริหาร · ใบรับรอง 11 ใบ) อ้างอิง **พาธจากคลังภาพ** ผ่าน `options.image`
 *   (ผู้เรียกส่งตัวช่วยที่อ่าน id จากคลัง · ยังไม่นำเข้า = ถอยไปใช้ไฟล์ใน `public/` ⇒ หน้าเว็บไม่พัง)
 * - ⚠️ **ไม่ใส่การ์ดที่ชี้ไปหน้า "กำลังจัดทำ"** — เจ้าของสั่งถอดลิงก์ทำนองนั้น (รอบที่ 111)
 *   ⇒ เทมเพลตกรองด้วย `PENDING_PAGE_PATHS` เอง (ปัจจุบันตัด `sustainability` ออก)
 * - ⚠️ **ไม่ใส่ลิงก์ "เปิดในแผนที่"** — หน้าบริษัทจริงไม่มีลิงก์นี้ และการใส่ `linkHref` โดยไม่มีข้อความบนปุ่ม
 *   = ลิงก์ที่มองไม่เห็น + validator เตือน (`map-link-without-label`) ⇒ เจ้าของเติมเองได้จากตัวสร้าง (ช่องมีอยู่แล้ว)
 * - ⚠️ เป็น **จุดเริ่มต้น** ไม่ใช่ตัวบังคับ — เจ้าของแก้/เพิ่ม/ลบ/อัปโหลดภาพทับได้จากตัวสร้างหน้าเว็บ
 */

export type AboutTemplateOptions = {
  /** หาพาธภาพจากคลังภาพ (`aboutImagePath(key, lookup)`) — ไม่ส่ง = ใช้ไฟล์ใน `public/` */
  readonly image?: (key: string) => string;
};

/** หน้าที่เป็น "กำลังจัดทำ" — เทมเพลตต้องไม่ลิงก์ไป (ค่ากลางเดียวกับที่ใช้สร้าง route) */
const PENDING_PATHS: ReadonlySet<string> = new Set(Object.values(PENDING_PAGE_PATHS));

export function buildAboutTemplate(options: AboutTemplateOptions = {}): BlockDocument {
  const about = th.about;
  const aboutEn = en.about;
  const imageOf = options.image ?? ((key: string) => aboutImagePath(key));
  const text = (value: string, valueEn: string) => ({ th: value, en: valueEn });
  const card = (title: string, titleEn: string, body: string, bodyEn: string, href = ""): BlockCard => ({
    title: { th: title, en: titleEn },
    body: { th: body, en: bodyEn },
    href,
    image: null,
  });

  /*
    ข้อเท็จจริง/ตัวเลข — ใช้ค่าจริงในพจนานุกรม (ไม่แต่งขึ้นเอง)
    ⚠️ บางข้อเท็จจริง (เช่น "ก่อตั้ง") มีแค่ป้าย + ปี ค.ศ. ⇒ แปลงเป็นปีของภาษานั้นด้วย formatYear
       (ไทย = พ.ศ. · อังกฤษ = ค.ศ.) — ไม่ hardcode สองชุด
    ⚠️ ประกาศชนิดของ `item` ตรง ๆ (แบบเดียวกับ `AboutHero`) — ไม่ใช้ type assertion
  */
  const factPairs = (source: typeof about | typeof aboutEn, locale: Locale) =>
    ABOUT_FACTS
      .map((fact) => {
        const item: { readonly label: string; readonly value?: string } = source.facts[fact.id];
        return { label: item.label, value: item.value ?? (fact.year === undefined ? "" : formatYear(fact.year, locale)) };
      })
      .filter((pair) => pair.value !== "");

  /*
    เส้นเวลาการเติบโต — ⚠️ ต้องพา **ปี** ไปด้วย ไม่งั้นการ์ดจะเหลือแต่ชื่อเหตุการณ์
    (หน้าจริงแสดงปีเป็นบรรทัดบนสุด ⇒ ใช้ `visibleTimeline` + `formatYear` ชุดเดียวกับหน้าเว็บ)
  */
  const timelineCards: readonly BlockCard[] = visibleTimeline(TIMELINE_ENTRIES).map((entry) => {
    const itemTh = about.story.timeline[entry.id];
    const itemEn = aboutEn.story.timeline[entry.id];
    return {
      title: text(`${formatYear(entry.year, "th")} · ${itemTh.title}`, `${formatYear(entry.year, "en")} · ${itemEn.title}`),
      body: text(itemTh.description, itemEn.description),
      href: "",
      image: null,
    };
  });
  const statsPairs = (source: typeof about | typeof aboutEn) =>
    (["factory", "dormitory", "treatment"] as const).map((id) => ({
      label: source.facilities.stats[id].label,
      value: source.facilities.stats[id].value,
    }));

  /* ใบรับรอง 11 ใบ — ภาพจริงจากคลังภาพ (คีย์เดียวกับไฟล์ใน public) */
  const certificates: readonly BlockGalleryItem[] = CERTIFICATIONS.map((certification, index) => {
    const key = certificateMediaKey(certification.image.src);
    const label = about.certifications.items[certification.id];
    const labelEn = aboutEn.certifications.items[certification.id];
    return {
      id: `cert-${index + 1}`,
      image: templateMedia(
        key === "" ? certification.image.src : imageOf(key),
        label?.title ?? about.certifications.title,
        labelEn?.title ?? aboutEn.certifications.title,
      ),
      caption: text(label?.title ?? "", labelEn?.title ?? ""),
    };
  });

  const blocks: Block[] = [
    /* ── 1) แถบเปิดหน้า (hero) ───────────────────────────────────────────── */
    {
      id: templateBlockId(0),
      version: TEMPLATE_BLOCK_VERSION,
      type: "hero",
      style: templateStyle({ size: "lg", align: "left" }),
      title: text(about.title, aboutEn.title),
      subtitle: text(about.intro, aboutEn.intro),
      note: text(about.note, aboutEn.note),
      image: null,
      ctaLabel: text("", ""),
      ctaHref: "",
    },

    /* ── 2) เรื่องราวของเรา + ข้อเท็จจริง ───────────────────────────────── */
    {
      id: templateBlockId(1),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle({ background: "cream" }),
      heading: text(about.story.title, aboutEn.story.title),
      body: text(about.story.body, aboutEn.story.body),
      columns: 2,
      items: templateValueCards(factPairs(about, "th"), factPairs(aboutEn, "en")),
    },
    {
      id: templateBlockId(2),
      version: TEMPLATE_BLOCK_VERSION,
      type: "richText",
      style: templateStyle(),
      heading: text(about.story.timelineTitle, aboutEn.story.timelineTitle),
      body: text(about.story.bodySecondary, aboutEn.story.bodySecondary),
      ctaLabel: text("", ""),
      ctaHref: "",
    },
    {
      id: templateBlockId(3),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle({ background: "subtle" }),
      heading: text(about.story.timelineTitle, aboutEn.story.timelineTitle),
      body: text(about.story.timelineNote, aboutEn.story.timelineNote),
      columns: 4,
      items: timelineCards,
    },

    /* ── 3) โรงงานและสิ่งอำนวยความสะดวก ────────────────────────────────── */
    {
      id: templateBlockId(4),
      version: TEMPLATE_BLOCK_VERSION,
      type: "richText",
      style: templateStyle({ background: "cream" }),
      heading: text(about.facilities.title, aboutEn.facilities.title),
      body: text(about.facilities.body, aboutEn.facilities.body),
      ctaLabel: text("", ""),
      ctaHref: "",
    },
    {
      id: templateBlockId(5),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle(),
      heading: text(about.facilities.statsTitle, aboutEn.facilities.statsTitle),
      body: text(about.facilities.statsNote, aboutEn.facilities.statsNote),
      columns: 3,
      items: templateValueCards(statsPairs(about), statsPairs(aboutEn)),
    },
    {
      id: templateBlockId(6),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle(),
      heading: text(about.facilities.sitesTitle, aboutEn.facilities.sitesTitle),
      body: text("", ""),
      columns: 2,
      items: SITES.map((site) =>
        card(
          about.facilities.sites[site].title,
          aboutEn.facilities.sites[site].title,
          about.facilities.sites[site].description,
          aboutEn.facilities.sites[site].description,
        ),
      ),
    },

    /* ── 4) แผนที่โรงงาน (ภาพจริงจากคลังภาพ) ───────────────────────────── */
    {
      id: templateBlockId(7),
      version: TEMPLATE_BLOCK_VERSION,
      type: "map",
      style: templateStyle({ background: "subtle" }),
      heading: text(about.facilities.sitesTitle, aboutEn.facilities.sitesTitle),
      caption: text(about.facilities.figures.site, aboutEn.facilities.figures.site),
      image: templateMedia(imageOf("map"), about.facilities.figures.site, aboutEn.facilities.figures.site),
      linkHref: "",
      linkLabel: text("", ""),
    },

    /* ── 5) ทิศทางขององค์กร (วิสัยทัศน์ · พันธกิจ · นโยบาย) ─────────────── */
    {
      id: templateBlockId(8),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle({ background: "cream" }),
      heading: text(about.direction.title, aboutEn.direction.title),
      body: text(about.direction.body, aboutEn.direction.body),
      columns: 3,
      items: DIRECTION_ORDER.map((id) =>
        card(
          about.direction[id].title,
          aboutEn.direction[id].title,
          about.direction[id].description,
          aboutEn.direction[id].description,
        ),
      ),
    },
    {
      id: templateBlockId(9),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle(),
      heading: text(about.direction.mission.title, aboutEn.direction.mission.title),
      body: text(about.direction.mission.description, aboutEn.direction.mission.description),
      columns: 3,
      items: MISSION_ITEM_IDS.map((id) =>
        card(about.direction.mission.items[id], aboutEn.direction.mission.items[id], "", ""),
      ),
    },

    /* ── 6) วิจัยและพัฒนา + การควบคุมคุณภาพ ────────────────────────────── */
    {
      id: templateBlockId(10),
      version: TEMPLATE_BLOCK_VERSION,
      type: "richText",
      style: templateStyle({ background: "cream" }),
      heading: text(about.research.title, aboutEn.research.title),
      body: text(
        `${about.research.body}\n\n${about.research.bodySecondary}`,
        `${aboutEn.research.body}\n\n${aboutEn.research.bodySecondary}`,
      ),
      ctaLabel: text("", ""),
      ctaHref: "",
    },
    {
      id: templateBlockId(11),
      version: TEMPLATE_BLOCK_VERSION,
      type: "richText",
      style: templateStyle(),
      heading: text(about.research.qualityTitle, aboutEn.research.qualityTitle),
      body: text(`${about.research.qualityBody}\n\n${about.research.figure}`, `${aboutEn.research.qualityBody}\n\n${aboutEn.research.figure}`),
      ctaLabel: text("", ""),
      ctaHref: "",
    },

    /* ── 7) ผลิตภัณฑ์ตามตลาด ────────────────────────────────────────────── */
    {
      id: templateBlockId(12),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle({ background: "subtle" }),
      heading: text(about.products.title, aboutEn.products.title),
      body: text(about.products.body, aboutEn.products.body),
      columns: 2,
      items: (["domestic", "export"] as const).map((market) =>
        card(
          about.products[market].title,
          aboutEn.products[market].title,
          `${about.products[market].description}\n${about.products[market].figure}`,
          `${aboutEn.products[market].description}\n${aboutEn.products[market].figure}`,
          "/products",
        ),
      ),
    },

    /* ── 8) การจัดจำหน่าย ──────────────────────────────────────────────── */
    {
      id: templateBlockId(13),
      version: TEMPLATE_BLOCK_VERSION,
      type: "richText",
      style: templateStyle({ background: "cream" }),
      heading: text(about.distribution.title, aboutEn.distribution.title),
      body: text(
        `${about.distribution.body}\n\n${about.distribution.figure}`,
        `${aboutEn.distribution.body}\n\n${aboutEn.distribution.figure}`,
      ),
      ctaLabel: text("", ""),
      ctaHref: "",
    },

    /* ── 9) คณะผู้บริหาร (ภาพจริงจากคลังภาพ) ─────────────────────────────── */
    {
      id: templateBlockId(14),
      version: TEMPLATE_BLOCK_VERSION,
      type: "imageText",
      style: templateStyle(),
      heading: text(about.people.title, aboutEn.people.title),
      body: text(
        `${about.people.body}\n\n${about.people.bodySecondary}\n\n${about.people.figure}`,
        `${aboutEn.people.body}\n\n${aboutEn.people.bodySecondary}\n\n${aboutEn.people.figure}`,
      ),
      image: templateMedia(imageOf("executives"), about.people.figure, aboutEn.people.figure),
      side: "right",
    },

    /* ── 10) รางวัลและเกียรติบัตร ───────────────────────────────────────── */
    {
      id: templateBlockId(15),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle({ background: "cream" }),
      heading: text(about.awards.title, aboutEn.awards.title),
      body: text(about.awards.body, aboutEn.awards.body),
      columns: 3,
      items: templateCards(about.awards.items, aboutEn.awards.items),
    },
    {
      id: templateBlockId(16),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle(),
      heading: text(about.awards.certificatesTitle, aboutEn.awards.certificatesTitle),
      body: text(about.awards.note, aboutEn.awards.note),
      columns: 3,
      items: templateCards(about.awards.certificates, aboutEn.awards.certificates),
    },
    {
      id: templateBlockId(17),
      version: TEMPLATE_BLOCK_VERSION,
      type: "gallery",
      style: templateStyle({ background: "subtle" }),
      heading: text(about.awards.certificatesTitle, aboutEn.awards.certificatesTitle),
      items: certificates,
      columns: 3,
    },
    {
      id: templateBlockId(18),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cta",
      style: templateStyle(),
      heading: text(about.awards.certificatesTitle, aboutEn.awards.certificatesTitle),
      body: text("", ""),
      label: text(about.awards.certificatesCta, aboutEn.awards.certificatesCta),
      href: "/about/certifications",
      tone: "neutral",
    },

    /* ── 11) ทำความรู้จักไวไวให้ครบขึ้น (ลิงก์ต่อ) ───────────────────────── */
    {
      id: templateBlockId(19),
      version: TEMPLATE_BLOCK_VERSION,
      type: "cards",
      style: templateStyle({ background: "cream" }),
      heading: text(about.explore.title, aboutEn.explore.title),
      body: text(about.explore.body, aboutEn.explore.body),
      columns: 3,
      items: EXPLORE_LINKS.filter((link) => !PENDING_PATHS.has(link.path)).map((link) =>
        card(
          about.explore[link.id].title,
          aboutEn.explore[link.id].title,
          about.explore[link.id].description,
          aboutEn.explore[link.id].description,
          link.path,
        ),
      ),
    },
  ];

  return { page: "about", blocks };
}

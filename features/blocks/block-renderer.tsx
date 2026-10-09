import type { CSSProperties } from "react";

import Image from "next/image";

import { productShowcaseView } from "@/lib/blocks/product-showcase";
import type { ProductShowcaseData } from "@/lib/blocks/product-showcase-data";
import { recipeShowcaseView } from "@/lib/blocks/recipe-showcase";
import type { RecipeShowcaseData } from "@/lib/blocks/recipe-showcase-data";
import { WHERE_TO_BUY_ANCHOR, marketplaceLinksView } from "@/lib/blocks/marketplace-links";
import { newsShowcaseView } from "@/lib/blocks/news-showcase";
import type { NewsShowcaseData } from "@/lib/blocks/news-showcase-data";

import { blockRenderStringsFor, type BlockRenderStrings } from "@/features/blocks/render-strings";
import { GalleryLightbox } from "@/features/blocks/ui/gallery-lightbox";
import { CareerFormFields, ContactFormFields } from "@/features/forms/ui/form-fields";
import { SubmitForm } from "@/features/forms/ui/submit-form";
import { NewsletterForm } from "@/features/home/ui/newsletter-form";
import { hiddenSizesOf, layoutOf, type Block, type BlockCard, type BlockDocument, type BlockMedia, type JobBoardItem } from "@/lib/blocks/types";
import { HERO_SLIDESHOW_CLASS, heroSlideVars, heroSlideshowClass } from "@/lib/blocks/hero-slides";
import { localizedBlockHref } from "@/lib/blocks/href";
import { pageOutline } from "@/lib/blocks/outline";
import {
  alignClass,
  columnClass,
  containerClass,
  headingClass,
  heroHeightClass,
  landingTailClass,
  pageLayoutClass,
  rowGridClass,
  headingSizeClass,
  shellClass,
  sidebarAsideClass,
  sidebarMainClass,
  tocLinkClass,
} from "@/lib/blocks/style";

/**
 * ตัวเรนเดอร์บล็อก → HTML จริง (ใช้ **ทั้งหน้าจอพรีวิวในหลังบ้านและหน้าเว็บสาธารณะ**)
 *
 * ⚠️ ไฟล์นี้คือ "สัญญา 1:1" ที่ผู้ใช้ขอ: พรีวิวกับหน้าเว็บจริงเป็นโค้ดชุดเดียวกัน ⇒ สิ่งที่เห็นในหลังบ้านคือสิ่งที่จะได้จริง
 * - ใช้ได้ทั้ง Server Component และ Client Component → **ห้ามใส่ "use server"/"use client"** และห้าม import ของฝั่งเซิร์ฟเวอร์
 * - สี/ระยะ มาจาก `lib/blocks/style.ts` (พรีเซ็ตแบรนด์) เท่านั้น — ไม่มีคลาสสีดิบในไฟล์นี้
 * - a11y: หัวเรื่องใช้ h2/h3 (h1 เป็นของหน้า) · ภาพต้องมี alt (validator บังคับก่อนบันทึก) · ลิงก์ที่ไม่มีปลายทางจะไม่ถูกเรนเดอร์
 *
 * `editable` = true (ใช้ในพรีวิวหลังบ้าน) จะติดป้ายกำกับ `data-block-id` · `data-field` · `data-card-index` · `data-media`
 * ให้หน้าจอรู้ว่า "ผู้ใช้คลิกที่ส่วนไหน" แล้วเปิดช่องแก้ของส่วนนั้นได้ทันที
 */

type Language = "th" | "en";

type EditAttrs = {
  readonly "data-field"?: string;
  readonly "data-card-index"?: number;
  readonly "data-media"?: string;
};

function editAttrs(editable: boolean, field: string, extra: { readonly cardIndex?: number; readonly media?: boolean } = {}): EditAttrs {
  if (!editable) return {};
  return {
    "data-field": field,
    ...(extra.cardIndex === undefined ? {} : { "data-card-index": extra.cardIndex }),
    ...(extra.media === true ? { "data-media": field } : {}),
  };
}

function text(value: { th: string; en: string }, language: Language): string {
  const primary = value[language];
  if (primary.trim() !== "") return primary;
  /* ยังไม่มีคำแปล → แสดงภาษาต้นทางแทนช่องว่าง (ผู้ใช้จะเห็นว่ายังต้องเติม) */
  return value.th.trim() !== "" ? value.th : value.en;
}

function hasText(value: { th: string; en: string }): boolean {
  return value.th.trim() !== "" || value.en.trim() !== "";
}

function image(media: BlockMedia | null, language: Language, className: string, sizes = "(min-width: 1024px) 640px, 100vw") {
  if (media === null || media.path === "") return null;
  const alt = language === "en" ? (media.altEn.trim() === "" ? media.altTh : media.altEn) : media.altTh;

  return (
    /* ใช้ <img> ธรรมดา (ไม่ใช่ next/image) เพราะพาธมาจากหลังบ้านและยังไม่มีข้อมูลขนาดทุกกรณี
       — เก็บ width/height ไว้ในคลังภาพแล้ว จึงเปลี่ยนเป็น next/image ได้เมื่อพร้อม */
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.path} alt={alt} className={className} loading="lazy" sizes={sizes} />
  );
}

/** ปุ่ม — ถ้าไม่มีปลายทางที่ปลอดภัย จะไม่เรนเดอร์ลิงก์ (กันปุ่มที่กดแล้วเงียบ) */
function actionLink(
  label: { th: string; en: string },
  href: string,
  language: Language,
  tone: "brand" | "outline" = "brand",
  editable = false,
  field = "ctaLabel",
) {
  if (!hasText(label) || href.trim() === "") return null;

  const className =
    tone === "brand"
      ? "bg-brand-red text-on-brand focus-visible:ring-ring inline-block rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      : "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring inline-block rounded-xl border px-5 py-2.5 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none";

  return (
    <a href={localizedBlockHref(href, language)} className={className} {...editAttrs(editable, field)}>
      {text(label, language)}
    </a>
  );
}

function CardView({
  card,
  index,
  language,
  editable,
}: {
  readonly card: BlockCard;
  readonly index: number;
  readonly language: Language;
  readonly editable: boolean;
}) {
  const body = (
    <>
      {card.image === null ? null : (
        <span {...editAttrs(editable, "image", { cardIndex: index, media: true })}>
          {image(card.image, language, "bg-bg-subtle aspect-[4/3] w-full rounded-xl object-cover")}
        </span>
      )}
      {hasText(card.title) ? (
        <h3 className="text-fg mt-3 text-base font-semibold" {...editAttrs(editable, "title", { cardIndex: index })}>
          {text(card.title, language)}
        </h3>
      ) : null}
      {hasText(card.body) ? (
        <p className="text-fg-muted mt-1 text-sm" {...editAttrs(editable, "body", { cardIndex: index })}>
          {text(card.body, language)}
        </p>
      ) : null}
    </>
  );

  const shellClass = "border-line bg-surface rounded-2xl border p-4";

  if (card.href.trim() === "") {
    return (
      <div className={shellClass} data-card-index={editable ? index : undefined}>
        {body}
      </div>
    );
  }

  return (
    <a
      href={localizedBlockHref(card.href, language)}
      className={`${shellClass} hover:bg-surface-raised focus-visible:ring-ring block focus-visible:ring-2 focus-visible:outline-none`}
      data-card-index={editable ? index : undefined}
    >
      {body}
    </a>
  );
}

function BlockView({
  block,
  language,
  editable,
  selectedBlockId,
  strings,
  nested = false,
  productData = null,
  recipeData = null,
  newsData = null,
}: {
  readonly block: Block;
  readonly language: Language;
  readonly editable: boolean;
  readonly selectedBlockId: string | null;
  /** ข้อความของบล็อกที่ต้องใช้พจนานุกรม (แกลเลอรี/ฟอร์ม) — เตรียมไว้ครั้งเดียวที่ BlockDocumentView */
  readonly strings: BlockRenderStrings;
  /** true = บล็อกนี้อยู่ในคอลัมน์ของ "แถว" (X1.1) ⇒ ไม่ใส่ระยะขอบข้างซ้ำ */
  readonly nested?: boolean;
  /**
   * ข้อมูลจริงของบล็อกไดนามิก (คีย์ = id ของบล็อก) — โหลดที่เซิร์ฟเวอร์ด้วย `loadProductShowcasesFor()`
   * · ว่าง/ไม่มีคีย์ = บล็อกนั้นไม่เรนเดอร์ (รอบที่ 213)
   */
  readonly productData?: ProductShowcaseData | null;
  /** ข้อมูลจริงของบล็อก "เมนูล่าสุด" (รอบที่ 222) */
  readonly recipeData?: RecipeShowcaseData | null;
  /** ข้อมูลจริงของบล็อก "ข่าวล่าสุด" (รอบที่ 223) */
  readonly newsData?: NewsShowcaseData | null;
}) {
  const shell = shellClass(block.style);
  const container = containerClass(block.style, nested);
  const align = alignClass(block.style);
  const heading = headingClass(block.style);

  const inner = (() => {
    switch (block.type) {
      case "hero": {
        const media = image(
          block.image,
          language,
          `bg-bg-subtle w-full rounded-2xl object-cover ${heroHeightClass(block.style)}`,
          "100vw",
        );
        /*
          สไลด์หลายภาพ (รอบที่ 183 · เฟส (ข)) — มีสไลด์ที่เลือกภาพแล้ว ≥1 ใบ ⇒ หมุนให้เองด้วย **CSS ล้วน ไม่มี JS**
          · ใบที่ 1 แสดงก่อน แล้วไล่ต่อตาม `--hero-delay` (แต่ละใบมีสล็อตของตัวเองในรอบเดียว)
          · จุดโฟกัส + ซูม ส่งผ่าน CSS variable ⇒ `globals.css` ใส่ `object-position`/`scale()` ให้ตัว <img>
            (ครอบ/จัดตำแหน่งได้โดยไม่ต้องตัดไฟล์ภาพ)
          · ไม่มีสไลด์/สไลด์ยังไม่เลือกภาพ ⇒ ถอยไปใช้ `image` เดี่ยว (พฤติกรรมเดิมเป๊ะ)
          ⚠️ ค่าที่เปลี่ยนตามใบอยู่ใน CSS variable (ไม่ใช่ inline style) เพื่อให้ keyframes/reduced-motion คุมได้จากที่เดียว
        */
        const slideMedia = (block.slides ?? []).filter((slide) => slide.image !== null);
        const visual =
          slideMedia.length === 0 ? (
            media === null ? null : <span {...editAttrs(editable, "image", { media: true })}>{media}</span>
          ) : (
            <span
              {...editAttrs(editable, "slides", { media: true })}
              className={`bg-bg-subtle ${HERO_SLIDESHOW_CLASS} ${heroSlideshowClass(slideMedia.length)} relative block w-full overflow-hidden rounded-2xl ${heroHeightClass(block.style)}`}
            >
              {slideMedia.map((slide, index) => (
                <span
                  key={slide.id}
                  className="hero-slide absolute inset-0 block"
                  /* ⚠️ CSS variable ไม่มีในชนิดของ React ⇒ cast เป็น CSSProperties (ไม่ใช่ `any`) */
                  style={heroSlideVars(index, slideMedia.length, slide) as CSSProperties}
                >
                  {image(slide.image, language, "h-full w-full object-cover", "100vw")}
                </span>
              ))}
            </span>
          );
        return (
          <div className={`${container} flex flex-col gap-5`}>
            {visual}
            <div className={`flex flex-col gap-3 ${align}`}>
              <h2 className={heading} {...editAttrs(editable, "title")}>
                {text(block.title, language)}
              </h2>
              {hasText(block.subtitle) ? (
                <p className="text-fg text-lg" {...editAttrs(editable, "subtitle")}>
                  {text(block.subtitle, language)}
                </p>
              ) : null}
              {actionLink(block.ctaLabel, block.ctaHref, language, "brand", editable, "ctaLabel")}
              {hasText(block.note) ? (
                <p className="text-fg-muted text-xs" {...editAttrs(editable, "note")}>
                  {text(block.note, language)}
                </p>
              ) : null}
            </div>
          </div>
        );
      }

      case "heading":
        return (
          <div className={container}>
            {block.level === 2 ? (
              <h2 className={heading} {...editAttrs(editable, "text")}>
                {text(block.text, language)}
              </h2>
            ) : (
              <h3 className={`${heading} text-xl sm:text-2xl`} {...editAttrs(editable, "text")}>
                {text(block.text, language)}
              </h3>
            )}
          </div>
        );

      case "richText":
        return (
          <div className={`${container} flex flex-col gap-3 ${align}`}>
            {hasText(block.heading) ? (
              <h2 className={heading} {...editAttrs(editable, "heading")}>
                {text(block.heading, language)}
              </h2>
            ) : null}
            {hasText(block.body) ? (
              <p className="text-fg-muted text-base whitespace-pre-line" {...editAttrs(editable, "body")}>
                {text(block.body, language)}
              </p>
            ) : null}
            {actionLink(block.ctaLabel, block.ctaHref, language, "outline", editable, "ctaLabel")}
          </div>
        );

      case "imageText": {
        const media = image(block.image, language, "bg-bg-subtle aspect-[4/3] w-full rounded-2xl object-cover");
        return (
          <div className={`${container} grid items-center gap-6 md:grid-cols-2`}>
            <div className={block.side === "left" ? "md:order-1" : "md:order-2"}>
              {media === null ? null : <span {...editAttrs(editable, "image", { media: true })}>{media}</span>}
            </div>
            <div className={`flex flex-col gap-3 ${block.side === "left" ? "md:order-2" : "md:order-1"} ${align}`}>
              {hasText(block.heading) ? (
                <h2 className={heading} {...editAttrs(editable, "heading")}>
                  {text(block.heading, language)}
                </h2>
              ) : null}
              {hasText(block.body) ? (
                <p className="text-fg-muted text-base whitespace-pre-line" {...editAttrs(editable, "body")}>
                  {text(block.body, language)}
                </p>
              ) : null}
            </div>
          </div>
        );
      }

      case "cards": {
        const gridClass =
          block.columns === 1
            ? "grid gap-4"
            : block.columns === 2
              ? "grid gap-4 sm:grid-cols-2"
              : block.columns === 3
                ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                : "grid gap-4 sm:grid-cols-2 lg:grid-cols-4";

        return (
          <div className={`${container} flex flex-col gap-5`}>
            <div className={`flex flex-col gap-2 ${align}`}>
              {hasText(block.heading) ? (
                <h2 className={heading} {...editAttrs(editable, "heading")}>
                  {text(block.heading, language)}
                </h2>
              ) : null}
              {hasText(block.body) ? (
                <p className="text-fg-muted text-base" {...editAttrs(editable, "body")}>
                  {text(block.body, language)}
                </p>
              ) : null}
            </div>
            <div className={gridClass}>
              {block.items.map((card, index) => (
                <CardView key={`${card.href}-${index}`} card={card} index={index} language={language} editable={editable} />
              ))}
            </div>
          </div>
        );
      }

      case "cta": {
        const tone = block.tone === "brand" ? "bg-surface-raised" : "bg-surface";
        return (
          <div className={container}>
            <div className={`border-line ${tone} flex flex-col items-center gap-4 rounded-2xl border p-6 text-center`}>
              {hasText(block.heading) ? (
                <h2 className={heading} {...editAttrs(editable, "heading")}>
                  {text(block.heading, language)}
                </h2>
              ) : null}
              {hasText(block.body) ? (
                <p className="text-fg-muted text-base" {...editAttrs(editable, "body")}>
                  {text(block.body, language)}
                </p>
              ) : null}
              {actionLink(block.label, block.href, language, "brand", editable, "label")}
            </div>
          </div>
        );
      }

      case "quote":
        return (
          <div className={`${container} flex flex-col gap-2 ${align}`}>
            <blockquote className="text-fg text-xl font-medium" {...editAttrs(editable, "text")}>
              “{text(block.text, language)}”
            </blockquote>
            {hasText(block.attribution) ? (
              <p className="text-fg-muted text-sm" {...editAttrs(editable, "attribution")}>
                — {text(block.attribution, language)}
              </p>
            ) : null}
          </div>
        );

      case "divider":
        return (
          <div className={container}>
            <hr className="border-line" />
          </div>
        );

      /* ── ตาราง (รอบที่ 86) — เลื่อนแนวนอนได้บนจอมือถือ ไม่บีบข้อความจนอ่านไม่ออก ── */
      case "table":
        return (
          <div className={`${container} flex flex-col gap-3`}>
            {hasText(block.heading) ? (
              <h2 className={heading} {...editAttrs(editable, "heading")}>
                {text(block.heading, language)}
              </h2>
            ) : null}

            <div className="border-line bg-surface overflow-x-auto rounded-2xl border">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-surface-raised">
                  <tr>
                    {block.columns.map((column, index) => (
                      <th
                        key={`col-${index}`}
                        scope="col"
                        className="text-fg border-line border-b px-4 py-3 font-semibold whitespace-nowrap"
                      >
                        {text(column, language)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row) => (
                    <tr key={row.id} className="border-line border-b last:border-0">
                      {row.cells.map((cell, cellIndex) =>
                        block.firstColumnHeader && cellIndex === 0 ? (
                          <th key={`cell-${cellIndex}`} scope="row" className="text-fg px-4 py-3 text-left align-top font-semibold">
                            {text(cell, language)}
                          </th>
                        ) : (
                          <td key={`cell-${cellIndex}`} className="text-fg-muted px-4 py-3 align-top">
                            {text(cell, language)}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasText(block.caption) ? (
              <p className="text-fg-muted text-xs" {...editAttrs(editable, "caption")}>
                {text(block.caption, language)}
              </p>
            ) : null}
          </div>
        );

      /* ── แผนที่ (รอบที่ 86) — ภาพแผนที่ + คำบรรยาย + ลิงก์เปิดแผนที่ (ไม่ฝัง iframe/พิกัด) ── */
      case "map": {
        const media = image(block.image, language, "border-line bg-bg-subtle w-full rounded-2xl border object-cover");
        return (
          <div className={`${container} flex flex-col gap-3`}>
            {hasText(block.heading) ? (
              <h2 className={heading} {...editAttrs(editable, "heading")}>
                {text(block.heading, language)}
              </h2>
            ) : null}

            {media === null ? null : (
              <figure className="flex flex-col gap-2">
                <span {...editAttrs(editable, "image", { media: true })}>{media}</span>
                {hasText(block.caption) ? (
                  <figcaption className="text-fg-muted text-xs" {...editAttrs(editable, "caption")}>
                    {text(block.caption, language)}
                  </figcaption>
                ) : null}
              </figure>
            )}

            {block.linkHref.trim() !== "" && hasText(block.linkLabel) ? (
              <a
                href={block.linkHref}
                target="_blank"
                rel="noreferrer"
                className="text-link focus-visible:ring-ring w-fit text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                {...editAttrs(editable, "linkLabel")}
              >
                {text(block.linkLabel, language)}
              </a>
            ) : null}
          </div>
        );
      }

      /* ── ฟอร์ม (รอบที่ 86) — ฝังฟอร์มจริงของเว็บ (ระบบเดิม: DB · กับดักบอต · PDPA) ── */
      case "form":
        return (
          <div className={`${container} flex flex-col gap-3`}>
            {hasText(block.heading) ? (
              <h2 className={heading} {...editAttrs(editable, "heading")}>
                {text(block.heading, language)}
              </h2>
            ) : null}
            {hasText(block.body) ? (
              <p className="text-fg-muted text-sm" {...editAttrs(editable, "body")}>
                {text(block.body, language)}
              </p>
            ) : null}

            {block.kind === "newsletter" ? (
              <div className="mt-2 max-w-3xl">
                <NewsletterForm labels={strings.form.newsletter} />
              </div>
            ) : block.kind === "contact" ? (
              <SubmitForm
                formKind="contact"
                className="mt-2 max-w-3xl"
                strings={strings.form.contact.submit}
                notice={
                  <p className="border-line bg-surface text-fg-muted rounded-2xl border px-4 py-3 text-xs leading-relaxed">
                    {strings.form.contact.notice}
                  </p>
                }
              >
                <ContactFormFields strings={strings.form.contact.fields} />
              </SubmitForm>
            ) : (
              <SubmitForm formKind="careers" className="mt-2 max-w-3xl" strings={strings.form.careers.submit}>
                <CareerFormFields strings={strings.form.careers.fields} />
              </SubmitForm>
            )}
          </div>
        );

      /* ── แกลเลอรี + lightbox (รอบที่ 86) — เขียนเอง ไม่เพิ่ม dependency ── */
      case "gallery": {
        const visible = block.items.flatMap((item) => {
          if (item.image === null || item.image.path === "") return [];
          const alt = language === "en" ? (item.image.altEn.trim() === "" ? item.image.altTh : item.image.altEn) : item.image.altTh;
          return [
            {
              id: item.id,
              path: item.image.path,
              alt,
              caption: hasText(item.caption) ? text(item.caption, language) : "",
            },
          ];
        });

        return (
          <div className={`${container} flex flex-col gap-4`}>
            {hasText(block.heading) ? (
              <h2 className={heading} {...editAttrs(editable, "heading")}>
                {text(block.heading, language)}
              </h2>
            ) : null}
            {visible.length === 0 ? null : (
              <GalleryLightbox items={visible} columns={block.columns} strings={strings.gallery} />
            )}
          </div>
        );
      }

      /* ── กระดานรับสมัครงาน (รอบที่ 88) — จัดกลุ่มตามฝ่าย · เห็นครบทุกตำแหน่งโดยไม่ต้องใช้ JS ── */
      case "jobBoard": {
        const groups: { readonly label: string; readonly items: JobBoardItem[] }[] = [];
        if (block.groupByDepartment) {
          for (const item of block.items) {
            const label = hasText(item.department) ? text(item.department, language) : "";
            const existing = groups.find((group) => group.label === label);
            if (existing === undefined) groups.push({ label, items: [item] });
            else existing.items.push(item);
          }
        } else {
          groups.push({ label: "", items: [...block.items] });
        }

        /* มีหัวกลุ่ม = ชื่อตำแหน่งเป็น h4 · ไม่มีหัวกลุ่ม = เป็น h3 (ลำดับหัวเรื่องยังถูกต้อง) */
        const ItemTitle = block.groupByDepartment ? "h4" : "h3";

        return (
          <div className={`${container} flex flex-col gap-4`}>
            {hasText(block.heading) ? (
              <h2 className={heading} {...editAttrs(editable, "heading")}>
                {text(block.heading, language)}
              </h2>
            ) : null}
            {hasText(block.body) ? (
              <p className="text-fg-muted text-sm" {...editAttrs(editable, "body")}>
                {text(block.body, language)}
              </p>
            ) : null}

            {block.items.length === 0 ? null : (
              <div className="flex flex-col gap-6">
                {groups.map((group, groupIndex) => (
                  <section key={`job-group-${groupIndex}`} className="flex flex-col gap-3">
                    {group.label.trim() === "" ? null : (
                      <h3 className="text-fg-muted text-xs font-semibold tracking-wide uppercase">{group.label}</h3>
                    )}
                    <ul className="grid gap-4 sm:grid-cols-2">
                      {group.items.map((item) => (
                        <li key={item.id} className="border-line bg-surface rounded-2xl border p-5">
                          <ItemTitle className="text-fg text-base font-semibold">{text(item.title, language)}</ItemTitle>
                          {item.openings > 0 ? (
                            <p className="text-fg-muted mt-1 text-sm">
                              {item.openings} {strings.jobBoard.openingsUnit}
                            </p>
                          ) : null}
                          {hasText(item.qualifications) ? (
                            <p className="text-fg mt-3 text-sm">
                              <span className="font-semibold">{strings.jobBoard.qualificationsLabel}: </span>
                              {text(item.qualifications, language)}
                            </p>
                          ) : null}
                          {hasText(item.experience) ? (
                            <p className="text-fg-muted mt-2 text-sm">
                              <span className="font-semibold">{strings.jobBoard.experienceLabel}: </span>
                              {text(item.experience, language)}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        );
      }

      /* ── รายชื่อคณะผู้บริหาร (รอบที่ 88) — ชื่อ/ตำแหน่งเป็นข้อความ (ค้นหา/คัดลอก/อ่านออกเสียงได้) ── */
      case "rosterText": {
        const cols =
          block.columns === 2
            ? "sm:grid-cols-2"
            : block.columns === 4
              ? "sm:grid-cols-2 lg:grid-cols-4"
              : "sm:grid-cols-2 lg:grid-cols-3";

        return (
          <div className={`${container} flex flex-col gap-4`}>
            {hasText(block.heading) ? (
              <h2 className={heading} {...editAttrs(editable, "heading")}>
                {text(block.heading, language)}
              </h2>
            ) : null}
            {hasText(block.body) ? (
              <p className="text-fg-muted text-sm" {...editAttrs(editable, "body")}>
                {text(block.body, language)}
              </p>
            ) : null}

            {block.members.length === 0 ? null : (
              <ul className={`grid gap-4 ${cols}`}>
                {block.members.map((member) => (
                  <li key={member.id} className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-4">
                    {member.image === null
                      ? null
                      : image(member.image, language, "bg-bg-subtle aspect-[3/4] w-full rounded-xl object-cover")}
                    <div>
                      <p className="text-fg text-base font-semibold">{text(member.name, language)}</p>
                      {hasText(member.role) ? (
                        <p className="text-fg-muted mt-1 text-sm">{text(member.role, language)}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }

      /* ── เมนูอาหาร (รอบที่ 101) — การ์ดเมนู + ส่วนผสม/วิธีทำแบบพับได้ (ไม่ต้องใช้ JS) ── */
      case "productShowcase": {
        /*
          บล็อกไดนามิก (รอบที่ 213) — ข้อมูลจริงโหลดจากเซิร์ฟเวอร์แล้วส่งลงมาเป็น props
          ⚠️ ตัวเรนเดอร์นี้ถูกใช้ใน "พรีวิวที่แก้ได้" (client) ⇒ **ห้ามยิงฐานข้อมูลเอง**
          · ไม่มีข้อมูล/ว่าง = ไม่เรนเดอร์ (ห้ามขึ้นกล่องเปล่าบนหน้าเว็บ)
        */
        if (productData === null) return null;
        const showcase = productShowcaseView(productData.categories, productData.highlights, block, language);
        if (showcase.isEmpty) return null;
        const showcaseGrid =
          block.columns === 1
            ? "grid gap-5"
            : block.columns === 2
              ? "grid gap-5 sm:grid-cols-2"
              : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";
        return (
          <div className={`${container} flex flex-col gap-6`}>
            <div className={`flex flex-col gap-2 ${align}`}>
              {block.heading[language].trim() === "" ? null : (
                <h2 className="text-fg text-2xl font-semibold">{block.heading[language]}</h2>
              )}
              {block.body[language].trim() === "" ? null : (
                <p className="text-fg-muted text-sm">{block.body[language]}</p>
              )}
            </div>
            <h3 className="text-fg text-xl font-semibold">{strings.showcase.categoriesTitle}</h3>
            <ul className={showcaseGrid}>
              {showcase.categories.map((category) => (
                /*
                  การ์ดหมวด — **ต้องมีภาพของหมวด** (รอบที่ 244 · 🐞 เคสจริงจากเจ้าของ: "โลโก้หมวดสินค้าหายหมด
                  เหลือแต่บล็อกข้อความ") · วิวส่ง `category.image` มาให้อยู่แล้ว แต่ตัวเรนเดอร์เคยไม่วาด
                  ⇒ ทำตามดีไซน์เดิม (`features/home/ui/products-showcase.tsx`): แผงภาพพื้นจาง + ลิงก์ทั้งการ์ด
                  · ไม่มีภาพ = ไม่มีแผงภาพ (การ์ดยังใช้ได้ ไม่มีกล่องเปล่า)

                  ⚠️ รอบที่ 247: ลิงก์ต้องผ่าน `localizedBlockHref()` เหมือนทุกบล็อก (บทเรียนรอบ 101)
                  ไม่งั้นหน้า `/en` กดการ์ดแล้วได้ 307 → หน้า **ไทย** (ผู้ชม EN หลุดภาษา)
                */
                <li key={category.id} className="border-line bg-surface flex overflow-hidden rounded-xl border">
                  <a href={localizedBlockHref(category.href, language)} className="group flex h-full w-full flex-col">
                    {category.image === null ? null : (
                      <span className="bg-bg-subtle flex h-40 items-center justify-center p-4">
                        <Image
                          src={category.image}
                          alt={category.title}
                          width={320}
                          height={160}
                          sizes="(max-width: 640px) 92vw, 320px"
                          className="h-auto max-h-32 w-auto object-contain transition-transform group-hover:scale-105"
                        />
                      </span>
                    )}
                    <span className="flex flex-1 flex-col gap-2 p-4">
                      <span className="text-fg text-sm font-semibold">{category.title}</span>
                      {category.description.trim() === "" ? null : (
                        <span className="text-fg-muted text-xs">{category.description}</span>
                      )}
                      {block.showCount ? <span className="text-fg-muted text-[11px]">({category.productCount})</span> : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {!block.showFeatured || showcase.featured.length === 0 ? null : (
              <>
                {/* สินค้าแนะนำ (รอบที่ 219) — เด่น 1 ตัวต่อหมวดตามจำนวนที่ตั้งไว้ · ลิงก์ไปหมวดของสินค้านั้น */}
                <h3 className="text-fg text-xl font-semibold">{strings.showcase.featuredTitle}</h3>
                <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
                  {showcase.featured.map((product) => (
                    <li key={product.id}>
                      {/* ⚠️ รอบที่ 247: ลิงก์สินค้าเด่นต้องผ่าน localizedBlockHref() ด้วย (หน้า /en ต้องไม่เด้งไปไทย) */}
                      <a href={localizedBlockHref(product.href, language)} className="group block">
                        {product.image === null ? null : (
                          <span className="bg-bg-subtle flex h-36 items-center justify-center rounded-xl p-3">
                            <Image src={product.image} alt={product.title} width={160} height={160} sizes="160px" className="h-auto max-h-32 w-auto object-contain" />
                          </span>
                        )}
                        <span className="text-fg-muted mt-3 block text-xs font-semibold tracking-wide uppercase">
                          {showcase.categories.find((category) => category.id === product.categoryId)?.title ?? ""}
                        </span>
                        <span className="text-fg mt-1 block text-sm font-semibold">{product.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {block.ctaLabel[language].trim() === "" || block.ctaHref.trim() === "" ? null : (
              /* ปุ่มท้ายส่วน (รอบที่ 220) — เก็บ "พาธกลาง" แล้วเติม /<ภาษา> ด้วยตัวช่วยเดียวกับบล็อกอื่น */
              <a
                href={localizedBlockHref(block.ctaHref, language)}
                className="border-line-strong text-fg hover:bg-bg-subtle inline-flex w-fit items-center gap-2 rounded-full border-2 px-5 py-3 text-sm font-bold"
              >
                {block.ctaLabel[language]}
              </a>
            )}
          </div>
        );
      }
      case "marketplaceLinks": {
        /*
          บล็อก "ที่ซื้อสินค้า" (รอบที่ 229) — ลิงก์ร้านจริงจากค่าคงที่ของโปรเจกต์ · ไม่มีข้อมูล = ไม่เรนเดอร์

          รอบที่ 244 (🐞 เคสจริงจากเจ้าของ): ตอนหน้าแรกหันมาใช้บล็อก (รอบ 241) ของ 2 อย่างของดีไซน์เดิมหลุดไป
          · `id={WHERE_TO_BUY_ANCHOR}` = ปลายทางของปุ่ม "สั่งซื้อสินค้าออนไลน์" บนหัวเว็บ (`HEADER_CTA`)
            ⇒ ถ้าไม่มี ปุ่มบนหัวเว็บ "กดแล้วไม่ไปไหนเลย" (เจ้าของเจอจริง)
          · **การ์ดกรอบเหลืองแบรนด์** (`bg-brand-yellow` + `text-accent-on-yellow`) ตามดีไซน์เดิม
            ⇒ ถ้าไม่มี จะเหลือแค่ปุ่มลอยบนพื้นจาง ๆ (เจ้าของทักว่า "กรอบสีเหลืองหายไป")
        */
        const market = marketplaceLinksView(language);
        if (market.isEmpty) return null;
        return (
          <div className={container}>
            <div
              id={WHERE_TO_BUY_ANCHOR}
              className="bg-brand-yellow text-accent-on-yellow scroll-mt-40 rounded-3xl px-6 py-12 sm:px-10 lg:px-14 lg:py-16"
            >
              <div className={`flex flex-col gap-2 ${align}`}>
                {block.heading[language].trim() === "" ? null : (
                  <h2 className={`font-bold ${headingSizeClass(block.style)}`}>{block.heading[language]}</h2>
                )}
                {block.body[language].trim() === "" ? null : (
                  <p className="text-accent-on-yellow/90 text-sm sm:text-base">{block.body[language]}</p>
                )}
              </div>
              <ul className="mt-9 flex flex-wrap gap-3">
                {market.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${item.label} (${market.newTabLabel})`}
                      className="bg-surface text-fg inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold shadow-sm"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-accent-on-yellow/80 mt-7 text-sm">{market.retailNote}</p>
            </div>
          </div>
        );
      }
      case "newsShowcase": {
        /* บล็อกไดนามิก "ข่าวล่าสุด" (รอบที่ 223) · ไม่มีข้อมูล = ไม่เรนเดอร์ · ลิงก์ไปหน้าข่าวรายชิ้น */
        if (newsData === null) return null;
        const newsView = newsShowcaseView(newsData.news, block, language);
        if (newsView.isEmpty) return null;
        const newsGrid =
          block.columns === 1
            ? "grid gap-5"
            : block.columns === 2
              ? "grid gap-5 sm:grid-cols-2"
              : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";
        return (
          <div className={`${container} flex flex-col gap-6`}>
            <div className={`flex flex-col gap-2 ${align}`}>
              {block.heading[language].trim() === "" ? null : (
                <h2 className="text-fg text-2xl font-semibold">{block.heading[language]}</h2>
              )}
              {block.body[language].trim() === "" ? null : <p className="text-fg-muted text-sm">{block.body[language]}</p>}
            </div>
            <ul className={newsGrid}>
              {newsView.items.map((item) => (
                <li key={item.id} className="border-line bg-surface rounded-xl border p-3">
                  <a href={localizedBlockHref(item.href, language)} className="flex flex-col gap-2">
                    {item.image === null ? null : (
                      <Image src={item.image} alt={item.title} width={640} height={360} sizes="(max-width: 640px) 100vw, 400px" className="h-auto w-full rounded-lg object-cover" />
                    )}
                    {item.dateLabel === "" ? null : <span className="text-fg-muted text-xs">{item.dateLabel}</span>}
                    <span className="text-fg text-sm font-semibold">{item.title}</span>
                    {item.excerpt === "" ? null : <span className="text-fg-muted text-xs">{item.excerpt}</span>}
                  </a>
                </li>
              ))}
            </ul>
            {block.ctaLabel[language].trim() === "" || block.ctaHref.trim() === "" ? null : (
              <a href={localizedBlockHref(block.ctaHref, language)} className="border-line-strong text-fg hover:bg-bg-subtle inline-flex w-fit items-center gap-2 rounded-full border-2 px-5 py-3 text-sm font-bold">
                {block.ctaLabel[language]}
              </a>
            )}
          </div>
        );
      }
      case "recipeShowcase": {
        /* บล็อกไดนามิก "เมนูล่าสุด" (รอบที่ 222) · ไม่มีข้อมูล = ไม่เรนเดอร์ · ไม่เล่นวิดีโอในบล็อก (มติ D20) */
        if (recipeData === null) return null;
        const recipeView = recipeShowcaseView(recipeData.recipes, block, language);
        if (recipeView.isEmpty) return null;
        const recipeHref = localizedBlockHref(block.ctaHref.trim() === "" ? "/recipes" : block.ctaHref, language);
        const recipeGrid =
          block.columns === 1
            ? "grid gap-5"
            : block.columns === 2
              ? "grid gap-5 sm:grid-cols-2"
              : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";
        return (
          <div className={`${container} flex flex-col gap-6`}>
            <div className={`flex flex-col gap-2 ${align}`}>
              {block.heading[language].trim() === "" ? null : (
                <h2 className="text-fg text-2xl font-semibold">{block.heading[language]}</h2>
              )}
              {block.body[language].trim() === "" ? null : <p className="text-fg-muted text-sm">{block.body[language]}</p>}
            </div>
            <ul className={recipeGrid}>
              {recipeView.items.map((recipe) => (
                <li key={recipe.id} className="border-line bg-surface rounded-xl border p-3">
                  <a href={recipeHref} className="flex flex-col gap-2">
                    {recipe.image === null ? null : (
                      <Image src={recipe.image} alt={recipe.title} width={640} height={360} sizes="(max-width: 640px) 100vw, 400px" className="h-auto w-full rounded-lg object-cover" />
                    )}
                    <span className="text-fg text-sm font-semibold">{recipe.title}</span>
                    {recipe.dateLabel === "" ? null : <span className="text-fg-muted text-xs">{recipe.dateLabel}</span>}
                  </a>
                </li>
              ))}
            </ul>
            {block.ctaLabel[language].trim() === "" ? null : (
              <a href={recipeHref} className="border-line-strong text-fg hover:bg-bg-subtle inline-flex w-fit items-center gap-2 rounded-full border-2 px-5 py-3 text-sm font-bold">
                {block.ctaLabel[language]}
              </a>
            )}
          </div>
        );
      }
      case "recipeCards": {
        const gridClass =
          block.columns === 1
            ? "grid gap-5"
            : block.columns === 2
              ? "grid gap-5 sm:grid-cols-2"
              : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";

        return (
          <div className={`${container} flex flex-col gap-5`}>
            <div className={`flex flex-col gap-2 ${align}`}>
              {hasText(block.heading) ? (
                <h2 className={heading} {...editAttrs(editable, "heading")}>
                  {text(block.heading, language)}
                </h2>
              ) : null}
              {hasText(block.body) ? (
                <p className="text-fg-muted text-base" {...editAttrs(editable, "body")}>
                  {text(block.body, language)}
                </p>
              ) : null}
            </div>

            <ul className={gridClass}>
              {block.items.map((item, index) => (
                <li
                  key={item.id}
                  /* data-card-index ใช้ทั้งคลิกเลือกในพรีวิว และลากภาพมาวางทับ (เหมือนบล็อกการ์ด) */
                  data-card-index={editable ? index : undefined}
                  className="border-line bg-surface flex flex-col rounded-2xl border p-4"
                >
                  {item.image === null ? null : (
                    <span {...editAttrs(editable, "image", { cardIndex: index, media: true })}>
                      {image(item.image, language, "bg-bg-subtle aspect-[4/3] w-full rounded-xl object-cover")}
                    </span>
                  )}

                  {hasText(item.title) ? (
                    <h3 className="text-fg mt-3 text-base font-semibold" {...editAttrs(editable, "title", { cardIndex: index })}>
                      {text(item.title, language)}
                    </h3>
                  ) : null}
                  {hasText(item.body) ? (
                    <p className="text-fg-muted mt-1 text-sm" {...editAttrs(editable, "body", { cardIndex: index })}>
                      {text(item.body, language)}
                    </p>
                  ) : null}

                  {hasText(item.ingredients) || hasText(item.steps) ? (
                    <details className="border-line mt-3 rounded-xl border px-3 py-2">
                      <summary className="text-fg focus-visible:ring-ring cursor-pointer text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none">
                        {strings.recipe.detailsLabel}
                      </summary>
                      <div className="mt-3 flex flex-col gap-3">
                        {hasText(item.ingredients) ? (
                          <div {...editAttrs(editable, "ingredients", { cardIndex: index })}>
                            <p className="text-fg-muted text-xs font-semibold">{strings.recipe.ingredientsLabel}</p>
                            <p className="text-fg mt-1 text-sm whitespace-pre-line">{text(item.ingredients, language)}</p>
                          </div>
                        ) : null}
                        {hasText(item.steps) ? (
                          <div {...editAttrs(editable, "steps", { cardIndex: index })}>
                            <p className="text-fg-muted text-xs font-semibold">{strings.recipe.stepsLabel}</p>
                            <p className="text-fg mt-1 text-sm whitespace-pre-line">{text(item.steps, language)}</p>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      }

      /*
        แถว (คอลัมน์) — X1.1
        - เดสก์ท็อป: กริด 12 ช่อง แต่ละคอลัมน์เลือกความกว้างจากพรีเซ็ตแบรนด์ได้
        - มือถือ/แท็บเล็ต: เรียงลงมาทีละคอลัมน์ (อ่านง่ายกว่าบีบ 4 คอลัมน์ในจอแคบ)
        - บล็อกลูกเรนเดอร์ด้วย `BlockView` ตัวเดียวกัน ⇒ พรีวิว = หน้าเว็บจริงเสมอ (สัญญา 1:1)
      */
      case "row":
        return (
          <div className={rowGridClass()}>
            {block.columns.map((column) => (
              <div
                key={column.id}
                /* ⚠️ ใส่เฉพาะโหมดแก้ไข — ถ้าใส่ `undefined` React จะยังส่งคีย์นี้ไปในเพย์โหลด RSC ของหน้าเว็บจริง */
                {...(editable ? { "data-column-id": column.id } : {})}
                className={`flex min-w-0 flex-col gap-4 ${columnClass(column.width)}`}
              >
                {column.blocks.map((child) => (
                  <BlockView
                    key={child.id}
                    block={child}
                    language={language}
                    editable={editable}
                    selectedBlockId={selectedBlockId}
        productData={productData}
        recipeData={recipeData}
        newsData={newsData}
                    strings={strings}
                    nested
                  />
                ))}
              </div>
            ))}
          </div>
        );

    }
  })();

  return (
    <section
      /* anchor สำหรับสารบัญของเลย์เอาต์ `sidebar` (X1.8) — id ของบล็อกไม่ซ้ำกันทั้งหน้า (validator บังคับ) */
      id={block.id}
      className={shell}
      data-block-id={block.id}
      data-block-type={block.type}
      /* ธงนี้มีเฉพาะ "โหมดแก้ไข" (พรีวิวหลังบ้าน) ⇒ CSS ตีกรอบตอนชี้ได้โดยไม่กระทบหน้าเว็บจริง */
      data-editable={editable ? "" : undefined}
      data-selected={selectedBlockId === block.id ? "" : undefined}
      /* ซ่อนตามขนาดจอ (X1.6) — แสดงทุกขนาด = ไม่มี attribute ⇒ DOM เหมือนเดิมเป๊ะ */
      data-hide-on={hiddenSizesOf(block.visibility).join(" ") || undefined}
    >
      {inner}
    </section>
  );
}

/**
 * เรนเดอร์ทั้งเอกสาร
 * `editable` = true → ติดป้าย `data-*` ให้หน้าจอหลังบ้าน "คลิกแก้ตรงส่วนนั้น" ได้ (หน้าเว็บจริงไม่ต้องใช้)
 */
export function BlockDocumentView({
  document,
  language = "th",
  editable = false,
  selectedBlockId = null,
  heading = "",
  productData,
  recipeData,
  newsData,
}: {
  readonly document: BlockDocument;
  readonly language?: Language;
  readonly editable?: boolean;
  /** บล็อกที่กำลังเลือกอยู่ในหลังบ้าน (ใช้ตีกรอบทึบในพรีวิว) */
  readonly selectedBlockId?: string | null;
  /** ชื่อหน้าสำหรับ <h1> (a11y · รอบที่ 149) — ว่าง = ไม่มี h1 */
  readonly heading?: string;
  /** ข้อมูลจริงของบล็อกไดนามิก (รอบที่ 213) — ผู้เรียก (หน้าเว็บ/พรีวิว) เป็นคนโหลดให้ */
  readonly productData?: ProductShowcaseData | null;
  readonly recipeData?: RecipeShowcaseData | null;
  readonly newsData?: NewsShowcaseData | null;
}) {
  if (document.blocks.length === 0) return null;

  const strings = blockRenderStringsFor(language);
  /* เลย์เอาต์อ่านตามภาษาของหน้านี้ (X1.8 ต่อ · รอบที่ 92) — หน้าอังกฤษแยกเลย์เอาต์ได้ */
  const layout = layoutOf(document, language);

  const renderBlocks = (blocks: readonly Block[]) =>
    blocks.map((block) => (
      <BlockView
        key={block.id}
        block={block}
        language={language}
        editable={editable}
        selectedBlockId={selectedBlockId}
        productData={productData}
        recipeData={recipeData}
        newsData={newsData}
        strings={strings}
      />
    ));

  /*
    เลย์เอาต์ "มีสารบัญด้านข้าง" (X1.8)
    - สารบัญสร้างจากหัวข้อในบล็อกอัตโนมัติ (`pageOutline`) — ไม่มีข้อมูลซ้ำที่หลุดจากเนื้อหา
    - วาง aside **ก่อน** เนื้อหาใน DOM ⇒ บนมือถือผู้ใช้เห็นสารบัญก่อน (ช่วยหน้าเนื้อหายาว)
    - น้อยกว่า 2 หัวข้อ = ไม่แสดงสารบัญ (validator เตือนไว้แล้ว) และเนื้อหายังเต็มความกว้างปกติ
  */
  if (layout === "sidebar") {
    const outline = pageOutline(document, language);

    return (
      <div className="bg-bg text-fg">
        {/* h1 ของหน้า (a11y · รอบที่ 149): หน้าที่เรนเดอร์จากบล็อกไม่มี h1 เลย ⇒ ใส่ให้ screen reader อ่านได้ โดยไม่กระทบดีไซน์ */}
        {heading === "" ? null : <h1 className="sr-only">{heading}</h1>}
        <div className={pageLayoutClass("sidebar")}>
          {outline.length < 2 ? null : (
            <nav aria-label={strings.layout.tocLabel} className={sidebarAsideClass()}>
              <p className="text-fg-muted px-4 text-xs font-semibold tracking-wide uppercase">{strings.layout.tocLabel}</p>
              <ul className="mt-2 flex flex-col">
                {outline.map((entry) => (
                  <li key={entry.id} className={entry.level === 2 ? "ps-4" : undefined}>
                    <a href={`#${entry.id}`} className={tocLinkClass()}>
                      {entry.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <div className={sidebarMainClass()}>{renderBlocks(document.blocks)}</div>
        </div>
      </div>
    );
  }

  /*
    เลย์เอาต์ "หน้าแลนดิ้ง" (X1.8) — บล็อกแรกเต็มตามที่ตั้งไว้ (ปกติคือ hero เต็มความกว้าง)
    ที่เหลือกึ่งกลางแคบ ⇒ สายตาจับจุดเริ่มแล้วอ่านยาวได้สบาย
  */
  if (layout === "landing") {
    const [first, ...rest] = document.blocks;

    return (
      <div className="bg-bg text-fg">
        {first === undefined ? null : renderBlocks([first])}
        {rest.length === 0 ? null : <div className={landingTailClass()}>{renderBlocks(rest)}</div>}
      </div>
    );
  }

  /* `full` = ค่าเริ่มต้น (ไม่ระบุเลย์เอาต์) — บล็อกเรียงลงมาที่ความกว้างของแต่ละบล็อก (พฤติกรรมเดิมเป๊ะ) */
  return <div className="bg-bg text-fg">{renderBlocks(document.blocks)}</div>;
}

export type { Language as BlockLanguage };

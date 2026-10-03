import { hiddenSizesOf, type Block, type BlockCard, type BlockDocument, type BlockMedia } from "@/lib/blocks/types";
import { alignClass, columnClass, containerClass, headingClass, heroHeightClass, rowGridClass, shellClass } from "@/lib/blocks/style";

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
    <a href={href} className={className} {...editAttrs(editable, field)}>
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
      href={card.href}
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
  nested = false,
}: {
  readonly block: Block;
  readonly language: Language;
  readonly editable: boolean;
  readonly selectedBlockId: string | null;
  /** true = บล็อกนี้อยู่ในคอลัมน์ของ "แถว" (X1.1) ⇒ ไม่ใส่ระยะขอบข้างซ้ำ */
  readonly nested?: boolean;
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
        return (
          <div className={`${container} flex flex-col gap-5`}>
            {media === null ? null : <span {...editAttrs(editable, "image", { media: true })}>{media}</span>}
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
}: {
  readonly document: BlockDocument;
  readonly language?: Language;
  readonly editable?: boolean;
  /** บล็อกที่กำลังเลือกอยู่ในหลังบ้าน (ใช้ตีกรอบทึบในพรีวิว) */
  readonly selectedBlockId?: string | null;
}) {
  if (document.blocks.length === 0) return null;

  return (
    <div className="bg-bg text-fg">
      {document.blocks.map((block) => (
        <BlockView key={block.id} block={block} language={language} editable={editable} selectedBlockId={selectedBlockId} />
      ))}
    </div>
  );
}

export type { Language as BlockLanguage };

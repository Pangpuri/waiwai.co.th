import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { BlockDocumentView } from "@/features/blocks/block-renderer";
import { HomeBlockPage } from "@/features/home/ui/home-block-page";
import { loadHomeHeroView } from "@/features/home/home-hero-view";
import { ProductListSection, productListStringsOf } from "@/features/products/ui/product-list";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { loadDocumentRow } from "@/lib/blocks/repository";
import { loadNewsShowcaseData } from "@/lib/blocks/news-showcase-data";
import { loadProductShowcaseData } from "@/lib/blocks/product-showcase-data";
import { productDetailCategoryIdOfPageId } from "@/lib/blocks/product-detail";
import { loadRecipeShowcaseData } from "@/lib/blocks/recipe-showcase-data";
import type { BlockDocument } from "@/lib/blocks/types";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { isLocale } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import type { Messages } from "@/lib/i18n/messages/th";
import { defaultPages } from "@/lib/pages/model";
import { isPreviewablePage } from "@/lib/pages/paths";
import { listPages } from "@/lib/pages/repository";
import { isPreviewTokenShape } from "@/lib/preview-link/plan";
import { resolvePreviewLink } from "@/lib/preview-link/repository";
import { listProductsByCategory } from "@/lib/products/repository";
import { loadSiteSettings } from "@/lib/site-settings/loader";
import { resolveNotice } from "@/lib/site-settings/model";

/**
 * ลิงก์พรีวิวชั่วคราว (X2.6) — `/th/preview/t/<token>`
 *
 * เปิดได้ **โดยไม่ต้องมีบัญชีหลังบ้าน** (นี่คือเหตุผลที่ทำ) ⇒ ต้องคุมเข้มเป็นพิเศษ
 * - โทเคน 32 ไบต์สุ่ม เก็บใน DB แค่ hash · ตรวจ **หมดอายุ + ยกเลิก** ที่เซิร์ฟเวอร์ทุกครั้ง
 * - ใช้ไม่ได้ทุกกรณี → `notFound()` (404) — **ไม่บอกว่าล้มเพราะอะไร** (ไม่ให้เป็นช่องเดาว่าโทเคนไหนเคยมี)
 * - `force-dynamic` **บังคับ**: ห้าม prerender/แคชหน้าโทเคนเด็ดขาด (แคชผิด = คนอื่นเปิดลิงก์ได้)
 * - `noindex` + `x-robots-tag` (ตั้งที่ `next.config.ts`) ⇒ เครื่องค้นหาไม่เก็บฉบับร่าง
 * - ใช้ **เปลือกจริงของ layout** (navbar/footer ที่เผยแพร่) + ตัวเรนเดอร์เดียวกับหน้าเว็บจริง
 *   ⇒ สิ่งที่ผู้จัดการเห็น = สิ่งที่จะขึ้นเว็บ (ไม่ใช่หน้าเปล่าที่ขาด hero/บล็อกไดนามิก)
 *
 * ⚠️ เส้นทางนี้อยู่ในรายการบายพาสโหมดปิดปรับปรุง (เหมือน `/preview` เดิม) โดยเจตนา —
 *    ลิงก์มีโทเคนกันอยู่แล้ว และการปิดปรับปรุงมักเกิดตอนกำลังซ่อม/ย้ายเว็บ ซึ่งผู้จัดการยังต้องดูงานได้
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

/**
 * ชื่อหน้าสำหรับ `<h1 class="sr-only">` ของหน้าที่เรนเดอร์จากบล็อก
 * - หน้าแรกไม่ต้องใช้ (Hero มี h1 อยู่แล้ว)
 * - หน้า detail ของหมวดใช้ชื่อจากตาราง `page` (sync มาจากชื่อหมวด)
 */
function headingOf(
  page: string,
  messages: Messages,
  lang: "th" | "en",
  pageName: { readonly th: string; readonly en: string } | null,
): string {
  switch (page) {
    case "home":
      return "";
    case "about":
      return messages.about.meta.title;
    case "certifications":
      return messages.about.certifications.meta.title;
    case "executives":
      return messages.about.executives.meta.title;
    case "contact":
      return messages.contactPage.title;
    default:
      return pageName === null ? "" : lang === "en" && pageName.en.trim() !== "" ? pageName.en : pageName.th;
  }
}

export default async function PreviewLinkPage({
  params,
}: {
  readonly params: Promise<{ readonly lang: string; readonly token: string }>;
}) {
  const { lang, token } = await params;

  if (!isLocale(lang)) notFound();
  /* ตรวจ "รูปทรง" โทเคนก่อนแตะฐานข้อมูล (ค่าขยะจาก URL ไม่ควรทำให้เกิดคิวรี) */
  if (!isPreviewTokenShape(token)) notFound();

  const resolution = await resolvePreviewLink(token);
  if (!resolution.ok || resolution.page === null) notFound();

  const page = resolution.page;
  if (!isPreviewablePage(page)) notFound();

  const messages = await getMessagesFor(lang);
  /* ข้อความใต้ฟอร์มติดต่อจาก site settings — ให้ลิงก์พรีวิวตรงกับหน้าเว็บจริง (รอบ 337) */
  const siteSettings = await loadSiteSettings(lang);
  const contactNotice = resolveNotice(siteSettings.notices.contactForm, lang, messages.contactPage.note);

  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-fg-muted text-sm">DATABASE_URL is not configured.</p>
      </div>
    );
  }

  const row = await loadDocumentRow(page, "draft");
  const parsed = row === null ? null : parseBlockDocument(page, row.raw);
  const document: BlockDocument = parsed !== null && parsed.ok ? parsed.document : { page, blocks: [] };

  /* ชื่อหน้าจากตาราง `page` — ใช้เป็น heading ของหน้า detail/หน้าที่ไม่มีชื่อในพจนานุกรม */
  const pageRecords = await listPages(defaultPages(messages));
  const pageRecord = pageRecords.find((entry) => entry.id === page) ?? null;
  const pageName =
    pageRecord === null
      ? null
      : { th: pageRecord.nameTh, en: pageRecord.nameEn.trim() === "" ? pageRecord.nameTh : pageRecord.nameEn };

  const productCategoryId = productDetailCategoryIdOfPageId(page);
  const products = productCategoryId === null ? [] : await listProductsByCategory(productCategoryId);

  let body: ReactNode;
  if (page === "home") {
    /* หน้าแรก = Hero (ไม่ใช่บล็อก) + บล็อกที่เหลือ — ใช้ตัวเดียวกับหน้าเว็บจริง */
    const homeHero = await loadHomeHeroView(lang, messages);
    body = (
      <>
        <HomeBlockPage locale={lang} messages={messages} document={document} view={homeHero} />
        {document.blocks.length === 0 ? (
          <p className="text-fg-muted px-4 py-20 text-center text-sm">{messages.previewLinkPage.noBlocks}</p>
        ) : null}
      </>
    );
  } else {
    const heading = headingOf(page, messages, lang, pageName);
    const [productData, recipeData, newsData] = await Promise.all([
      loadProductShowcaseData(document),
      loadRecipeShowcaseData(document),
      loadNewsShowcaseData(document),
    ]);
    body = (
      <>
        {document.blocks.length === 0 ? (
          <p className="text-fg-muted px-4 py-20 text-center text-sm">{messages.previewLinkPage.noBlocks}</p>
        ) : (
          <BlockDocumentView
            document={document}
            language={lang}
            heading={heading}
            contactNotice={contactNotice}
            productData={productData}
            recipeData={recipeData}
            newsData={newsData}
          />
        )}
        {productCategoryId === null ? null : (
          <ProductListSection products={products} language={lang} strings={productListStringsOf(messages.productsPage)} />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col">
      <p
        className="bg-surface-raised border-line text-fg-muted border-b px-4 py-2 text-center text-xs"
        data-preview-link-notice="draft"
      >
        {messages.previewLinkPage.notice}
      </p>

      <div data-preview-content="">{body}</div>

      {/* ผู้จัดการดูเสร็จแล้วกลับหน้าเว็บจริงได้ทันที (ไม่มีเมนูหลังบ้านให้กด) */}
      <p className="text-fg-muted px-4 py-8 text-center text-xs">
        <Link
          href={`/${lang}`}
          className="text-link focus-visible:ring-ring font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
        >
          {messages.previewLinkPage.backToSite}
        </Link>
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { BlockDocumentView } from "@/features/blocks/block-renderer";
import { catalogSlugs, findCatalogItem, type CatalogItem } from "@/features/products/catalog";
import { ProductListSection, productListStringsOf } from "@/features/products/ui/product-list";
import { Breadcrumb } from "@/features/shell/ui/breadcrumb";
import { loadLiveBlockDocument } from "@/lib/blocks/page-loader";
import { productDetailPageId } from "@/lib/blocks/product-detail";
import { buildAlternates, isLocale, localePath } from "@/lib/i18n/config";
import { getMessages, getMessagesFor } from "@/lib/i18n/dictionaries";
import type { Messages } from "@/lib/i18n/messages/th";
import { loadPageSeo } from "@/lib/pages/repository";
import {
  FALLBACK_CATEGORY_IMAGE_HEIGHT,
  FALLBACK_CATEGORY_IMAGE_WIDTH,
  categoryRedirectTarget,
  type CategoryRedirect,
} from "@/lib/products/categories";
import { categoryNameOf } from "@/lib/products/display";
import {
  findCategoryHistoryBySlug,
  listProductsByCategory,
  listPublicCategorySlugs,
  loadProductCategory,
  type ProductCategoryRecord,
} from "@/lib/products/repository";
import { withPageSeo } from "@/lib/seo/page-seo";

/**
 * หน้ารายละเอียดหมวดผลิตภัณฑ์
 *
 * เนื้อหามาจาก 2 ทาง (เหมือนหน้าอื่นที่แปลงเป็นบล็อกแล้ว — S2):
 * 1. หลังบ้าน **กดเผยแพร่ (มติ 2026-10-09: หน้าแรกขึ้นเว็บทันที · หน้าอื่นยังไม่ขึ้นเว็บ)** ⇒ เรนเดอร์เอกสารบล็อกของหมวดนั้น
 *    (id ของหน้า = `product-<slug>` · ตัวเรนเดอร์เดียวกับพรีวิว ⇒ "สิ่งที่เห็น = สิ่งที่ขึ้นเว็บ")
 * 2. ยังไม่เปิด ⇒ เลย์เอาต์ "ตัวอย่างรอการอนุมัติ" ด้านล่าง (เดิม) — ไม่มี DB ก็ยังเปิดหน้าได้
 *
 * ⚠️ **เปิดให้จัดทำดัชนีแล้ว (รอบที่ 170 · มติเจ้าของ 2026-10-07):** หน้านี้มีข้อมูลสินค้าจริงจากฐานข้อมูล
 *    (รอบที่ 103–104) และชื่อ/คำอธิบายหมวดไม่ใช่ข้อความ "ยังไม่เปิดใช้งาน" อีกแล้ว ⇒ ถอด `noindex` ออก
 *    · หลังบ้านยังสั่ง `noindex` กลับได้รายหน้าผ่านช่อง SEO (W2) — `withPageSeo` จะตั้ง `robots` ให้เอง
 *
 * 🆕 **รอบที่ 264 (มติ D25):** หน้านี้รับ **หมวดที่สร้างใหม่จากหลังบ้าน** ด้วย (ไม่อยู่ในทะเบียนโค้ด)
 *    · หมวดที่ถูก **"ซ่อนจากเว็บ"** (`is_hidden`) = **404** (ไม่ใช่ 200 ที่เนื้อหาว่าง)
 *    · ชื่อ/คำอธิบาย/ภาพ มาจากฐานข้อมูล · ถอยไปใช้พจนานุกรม (เฉพาะหมวดในโค้ด)
 */

/*
  ⚠️ **ห้ามปิด `dynamicParams` ที่หน้านี้** (บทเรียนจริง รอบที่ 139)
  เดิมที่นี่มี `export const dynamicParams = false` (= รู้จักเฉพาะ slug ที่ประกาศไว้)
  แต่ **ทุกครั้งที่หลังบ้านกดบันทึก/เผยแพร่/ลบ** ระบบเรียก `revalidatePath("/", "layout")`
  (`lib/cache/refresh.ts`) ⇒ รายการที่ prerender ไว้ถูกทำให้เก่าทั้งหมด
  ⇒ คำขอถัดไปเข้าเส้นทาง "fallback" ซึ่งถูกปิดไว้ → เซิร์ฟเวอร์โยน `NoFallbackError`
  ⇒ **หน้าหมวดทั้ง 6 ตอบ 404 จนกว่าจะ build ใหม่** (คือ กดบันทึกอะไรก็ได้ แล้วหน้าเว็บพังทันที)
  ⇒ ปล่อยเป็นค่าเริ่มต้น (true) แล้วพึ่ง `findCatalogItem()` / แถวในฐานข้อมูล + `notFound()` ด้านล่างกัน slug มั่ว
     (และเป็นทางที่ทำให้ **หมวดที่สร้างใหม่** เปิดได้ทันทีโดยไม่ต้อง build ใหม่ — รอบที่ 264)
  ❗ มีเทสต์กันถอยหลังใน `scripts/test-isr.ts`
*/

/*
  ต่ออายุเพจนี้เองทุก 5 นาที — หน้านี้อ่านฐานข้อมูล (เอกสารบล็อก/สินค้า/หมวด)
  ⚠️ ต้องเป็น **ค่าคงที่ literal** เท่านั้น · Next อ่านค่านี้จากซอร์สตอน build
     เทสต์ scripts/test-isr.ts บังคับให้ค่านี้ตรงกับ PAGE_REVALIDATE_SECONDS ใน lib/cache/window.ts
*/
export const revalidate = 300;

export async function generateStaticParams() {
  /*
    prerender ทุกหมวดที่มองเห็นตาม **ที่อยู่จริงในฐานข้อมูล** (รอบที่ 280)
    · หมวดที่สร้างใหม่/เปลี่ยน slug ⇒ prerender ที่อยู่ใหม่เองโดยไม่ต้องแก้โค้ด
    · ไม่มีฐานข้อมูล/อ่านไม่ได้ ⇒ ถอยไปใช้ 6 หมวดในโค้ด (หน้าเว็บยังเปิดได้)
    · ที่อยู่เก่า/ที่ยังไม่ prerender ถูกสร้างตอนขอครั้งแรก (`dynamicParams` = true — ห้ามปิด ที่นี่)
  */
  const slugs = await listPublicCategorySlugs();
  const list = slugs.length > 0 ? slugs : catalogSlugs();
  return list.map((slug) => ({ slug }));
}

/**
 * คำอธิบายหมวดที่จะแสดง — ใช้ข้อมูลที่นำเข้าจากเว็บเดิม (S3 ส่วนที่ 3)
 * - เว็บเดิมมีแต่ภาษาไทย ⇒ อังกฤษว่าง = ถอยไปใช้ไทย (ธรรมเนียมเดียวกับชื่อหน้า/ชื่อสินค้า)
 * - ไม่มีคำอธิบายเลย (ฐานข้อมูลว่าง/เก็บได้แต่ข้อมูลเก่า) ⇒ ใช้ข้อความ "ตัวอย่างรออนุมัติ" เดิม
 */
function introTextOf(messages: Messages, category: ProductCategoryRecord | null, language: "th" | "en"): string {
  const thai = category === null ? "" : category.descriptionTh.trim();
  const english = category === null ? "" : category.descriptionEn.trim();
  if (language === "en" && english !== "") return english;
  if (thai !== "") return thai;
  if (english !== "") return english;
  return messages.productsPage.detailStub.body;
}

/** ชื่อจากพจนานุกรมของหมวดในโค้ด — หมวดที่สร้างใหม่ไม่มีคีย์ ⇒ คืนรหัสภายใน (แต่ค่าจจาก DB ทับอยู่แล้ว) */
function dictionaryNameOf(item: CatalogItem | undefined, fallback: string, m: Messages["productsPage"]): string {
  return item === undefined ? fallback : m.items[item.id].name;
}

/**
 * ชื่อหมวดที่แสดงจริง: DB (ตามภาษา) → ถอยพจนานุกรม (หมวดในโค้ด) → ถอยรหัสภายใน
 * ⚠️ พจนานุกรมผูกกับ **`id` ภายใน** ไม่ใช่ slug (รอบที่ 280 — เจ้าของเปลี่ยน slug ได้)
 */
function displayNameOf(
  item: CatalogItem | undefined,
  category: ProductCategoryRecord | null,
  fallbackKey: string,
  language: "th" | "en",
  m: Messages["productsPage"],
): string {
  return categoryNameOf(category?.nameTh ?? "", category?.nameEn ?? "", dictionaryNameOf(item, fallbackKey, m), language);
}

/** ภาพที่แสดงในหน้ารายละเอียด: โลโก้จากคลัง → ภาพหัวหมวดจากคลัง → ไฟล์ใน `public/` (เฉพาะหมวดในโค้ด) */
function heroImageOf(
  item: CatalogItem | undefined,
  category: ProductCategoryRecord | null,
): { readonly src: string; readonly width: number; readonly height: number } | null {
  if (category !== null) {
    if (category.logoPath !== null) {
      return {
        src: category.logoPath,
        width: category.logoWidth ?? FALLBACK_CATEGORY_IMAGE_WIDTH,
        height: category.logoHeight ?? FALLBACK_CATEGORY_IMAGE_HEIGHT,
      };
    }
    if (category.imagePath !== null) {
      return {
        src: category.imagePath,
        width: category.imageWidth ?? FALLBACK_CATEGORY_IMAGE_WIDTH,
        height: category.imageHeight ?? FALLBACK_CATEGORY_IMAGE_HEIGHT,
      };
    }
  }
  if (item === undefined) return null;
  return { src: item.image.src, width: item.image.width, height: item.image.height };
}

/** หมวดนี้เปิดให้ดูได้ไหม (อยู่ในโค้ด หรือมีแถวในฐานข้อมูลที่ยังไม่ถูกซ่อน) — ไม่เปิด ⇒ 404 */
function isVisibleCategory(item: CatalogItem | undefined, category: ProductCategoryRecord | null): boolean {
  if (category !== null && category.isHidden) return false;
  return item !== undefined || category !== null;
}

/**
 * ผลลัพธ์ของการแก้ที่อยู่ `/products/<requested>` (รอบที่ 280 · ขยายรอบที่ 286)
 * - `category` = หมวดที่เจอด้วย **ที่อยู่ปัจจุบันหรือรหัสภายใน**
 * - `moved` = หมวดที่เจอจาก **ประวัติที่อยู่ (301)** — ไม่ใช่ที่อยู่ปัจจุบันแล้ว
 * - `key` = คีย์ที่ใช้หาพจนานุกรม/เอกสารบล็อก = **รหัสภายใน** ของหมวดที่แสดง
 * - `redirect` = ปลายทางที่ต้องเด้ง (`308`) · `null` = แสดงหน้านี้ต่อ/404
 */
async function resolveCategoryRequest(
  requested: string,
): Promise<{
  readonly category: ProductCategoryRecord | null;
  readonly moved: ProductCategoryRecord | null;
  readonly key: string;
  readonly redirect: CategoryRedirect | null;
}> {
  const category = await loadProductCategory(requested);
  /* ไม่เจอด้วยที่อยู่ปัจจุบัน/รหัสภายใน และไม่ใช่หมวดในโค้ด ⇒ ลองหาที่อยู่เก่า */
  let moved: ProductCategoryRecord | null = null;
  let retired = false;
  if (category === null && findCatalogItem(requested) === undefined) {
    const history = await findCategoryHistoryBySlug(requested);
    if (history !== null) {
      if (history.retired) {
        /* ที่อยู่นี้เคยเป็นของหมวดที่ **ถูกลบไปแล้ว** ⇒ พาไปหน้าเลือกหมวด (ไม่ 404 เงียบ ๆ) */
        retired = true;
      } else if (history.categoryId !== null) {
        moved = await loadProductCategory(history.categoryId);
      }
    }
  }

  const redirect = categoryRedirectTarget({
    requested,
    current: category === null ? null : { slug: category.slug, isHidden: category.isHidden },
    moved: moved === null ? null : { slug: moved.slug, isHidden: moved.isHidden },
    retired,
  });

  const key = (category ?? moved)?.id ?? requested;
  return { category, moved, key, redirect };
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/products/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};

  /*
    ⚠️ metadata **ห้ามสั่ง 301** (การเด้งเป็นหน้าที่ของหน้าจอ) — ที่นี่แค่ "รู้จักไหม"
    · ไม่เจอ ⇒ คืน {} ปล่อยให้หน้าจอตัดสิน (เด้ง/404 เอง)
  */
  const category = await loadProductCategory(slug);
  const item = findCatalogItem(category?.id ?? slug);
  if (!isVisibleCategory(item, category)) return {};

  const messages = await getMessagesFor(lang);
  const m = messages.productsPage;

  /* ชื่อหมวด: ค่าจากหลังบ้านมาก่อน → ถอยพจนานุกรม (หมวดในโค้ด — ผูกกับ id ภายใน) */
  const displayName = displayNameOf(item, category, category?.id ?? slug, lang, m);

  return withPageSeo(
    lang,
    `/products/${slug}`,
    {
      /*
        ชื่อหน้า = ชื่อหมวด + ชื่อหน้าหมวด — ไม่ใช้ข้อความ "ยังไม่เปิดใช้งาน" อีกแล้ว
        (ตั้งแต่รอบที่ 103 หน้านี้มีข้อมูลสินค้าจริงจากฐานข้อมูล ⇒ ข้อความเดิมทำให้เข้าใจผิดในผลค้นหา/แท็บเบราว์เซอร์)
      */
      title: { absolute: `${displayName} — ${m.title}` },
      description: introTextOf(messages, category, lang),
      /* รอบที่ 170: ไม่บังคับ noindex แล้ว — ถ้าหลังบ้านตั้ง noindex `applySeoToMetadata` จะใส่กลับให้ */
      alternates: buildAlternates(lang, `/products/${category?.slug ?? slug}`),
    },
    () => loadPageSeo(productDetailPageId(category?.id ?? slug)),
  );
}

export default async function ProductCategoryPage({
  params,
}: PageProps<"/[lang]/products/[slug]">) {
  const { lang, slug } = await params;

  if (!isLocale(lang)) notFound();

  /*
    ── ① แก้ที่อยู่ (รอบที่ 280 · มติ D30 · ขยายรอบที่ 286) ────────────────────────
    · ที่อยู่ที่ขอ = ที่อยู่ปัจจุบัน/รหัสภายในของหมวด ⇒ แสดงต่อ (แต่ถ้าขอด้วย **รหัสภายใน**
      ขณะที่เว็บใช้ที่อยู่ใหม่ ⇒ **308** ไปที่อยู่ปัจจุบัน เพื่อไม่ให้มี 2 URL ของหน้าเดียวกัน)
    · ที่อยู่ที่ขอ = **ที่อยู่เก่า** ที่อยู่ในประวัติ ⇒ **308** ไปที่อยู่ปัจจุบัน
    · ที่อยู่ที่ขอ = **ที่อยู่ของหมวดที่ถูกลบไปแล้ว** (ประวัติยังอยู่) ⇒ **308** ไปหน้า `/products`
      (มติเจ้าของ 2026-10-15 · ปิดหนี้ D-280-3 — ไม่ปล่อยให้ลิงก์เก่าตายทาง)
    · ไม่รู้จักเลย ⇒ 404 (ด้านล่าง)
  */
  const resolved = await resolveCategoryRequest(slug);
  if (resolved.redirect !== null) {
    permanentRedirect(
      resolved.redirect.kind === "index"
        ? localePath(lang, "/products")
        : localePath(lang, `/products/${resolved.redirect.slug}`),
    );
  }

  const category = resolved.category ?? resolved.moved;
  const item = findCatalogItem(resolved.key);
  /* หมวดที่ไม่รู้จัก หรือถูก "ซ่อนจากเว็บ" ⇒ 404 (ไม่ใช่ 200 ที่เนื้อหาว่าง) — มติ D25 ข้อ 3 */
  if (!isVisibleCategory(item, category) || (category !== null && category.isHidden)) notFound();

  /* ที่อยู่ปัจจุบัน (ใช้เป็นพาธ canonical/ลิงก์ภายใน) — ไม่มีแถวใน DB ⇒ ใช้ที่อยู่ที่ขอ */
  const canonicalSlug = category?.slug ?? slug;

  /*
    ── เนื้อหาของหน้านี้มาจาก 2 ทาง ──────────────────────────────────────────────
    1. หลังบ้านกดเผยแพร่ (มติ 2026-10-09: หน้าแรกขึ้นเว็บทันที · หน้าอื่นยังไม่ขึ้นเว็บ) (S3 ส่วนที่ 2 · รอบที่ 102) ⇒ เรนเดอร์บล็อกของหมวดนั้น
    2. ถ้าไม่ ⇒ เลย์เอาต์ "ตัวอย่างรอการอนุมัติ" ด้านล่าง
    **ทั้งสองทางต่อด้วยรายการสินค้าจากฐานข้อมูล** (S3 ส่วนที่ 3 · รอบที่ 103) — ข้อมูลที่นำเข้าจากเว็บเดิม
    หน้าเว็บยังเปิดได้เสมอ แม้ไม่มีฐานข้อมูล (เดโม) หรือฐานข้อมูลล่ม — ตัวโหลด/ตัวอ่านคืน null/[] ให้เอง
  */
  const messages = await getMessages(lang);
  const m = messages.productsPage;

  /* เอกสารบล็อก/สินค้า อ้างด้วย **รหัสภายใน** และ **ที่อยู่ปัจจุบัน** (ไม่ใช่ที่อยู่เก่าที่ขอมา) */
  const [liveDocument, products] = await Promise.all([
    loadLiveBlockDocument(productDetailPageId(resolved.key)),
    listProductsByCategory(canonicalSlug),
  ]);

  const listStrings = productListStringsOf(m);
  const hasProducts = products.length > 0;
  const intro = introTextOf(messages, category, lang);

  /* ชื่อ + ภาพหมวด: ค่าจากหลังบ้าน (migration 0037/0039) → ถอยค่าในโค้ด/พจนานุกรม */
  const displayName = displayNameOf(item, category, resolved.key, lang, m);
  const imageAlt = item === undefined ? displayName : m.items[item.id].imageAlt;
  const heroImage = heroImageOf(item, category);

  if (liveDocument !== null) {
    return (
      <>
        {/*
          ⚠️ ต้องส่ง `heading` (a11y · 1 h1 ต่อหน้า) — เอกสารบล็อกไม่มี h1 ในตัวเอง
          (เคสจริงแบบเดียวกับหน้า /contact รอบ 267) · ตารางสินค้ายังต่อท้ายเสมอ (ไม่ใช่บล็อก)
        */}
        <BlockDocumentView document={liveDocument} language={lang} heading={displayName} />
        <ProductListSection products={products} language={lang} strings={listStrings} />
      </>
    );
  }

  return (
    <>
      <section className="border-b border-line bg-bg-subtle">
        <div className="container-site py-12 lg:py-16">
          <Breadcrumb
            ariaLabel={messages.a11y.breadcrumb}
            items={[
              { label: messages.nav.home, href: localePath(lang, "/") },
              { label: messages.nav.products, href: localePath(lang, "/products") },
              { label: displayName },
            ]}
          />

          <p className="mt-8 inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
            {/* รอบที่ 272: ไม่มีสาขา "ตัวอย่าง/รอการอนุมัติ" อีก — ใช้ป้ายเดียวกับหน้าหมวด */}
            {m.eyebrow}
          </p>

          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.12] font-extrabold tracking-tight text-fg sm:text-5xl">
            {displayName}
          </h1>
        </div>
      </section>

      <section className="container-site py-16 lg:py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          {/* ไม่มีภาพเลย (หมวดที่สร้างใหม่และยังไม่ได้ใส่ภาพ) ⇒ ข้ามภาพ ไม่เรนเดอร์ `src=""` */}
          {heroImage === null ? null : (
            <Image
              src={heroImage.src}
              alt={imageAlt}
              width={heroImage.width}
              height={heroImage.height}
              sizes="300px"
              className="h-auto w-60 max-w-full"
            />
          )}

          {hasProducts ? null : (
            <h2 className="mt-8 font-display text-xl font-extrabold text-fg sm:text-2xl">{m.detailStub.title}</h2>
          )}

          <p className="mt-4 text-base leading-relaxed text-fg-muted">{intro}</p>

          <Link
            href={localePath(lang, "/products")}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-line-strong"
          >
            <span aria-hidden="true" className="text-accent">
              ←
            </span>
            {m.detailStub.back}
          </Link>
        </div>
      </section>

      <ProductListSection products={products} language={lang} strings={listStrings} />
    </>
  );
}

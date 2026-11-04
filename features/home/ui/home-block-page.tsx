import { BlockDocumentView } from "@/features/blocks/block-renderer";
import { Hero } from "@/features/home/ui/hero";
import { loadNewsShowcaseData } from "@/lib/blocks/news-showcase-data";
import { loadProductShowcaseData } from "@/lib/blocks/product-showcase-data";
import { loadRecipeShowcaseData } from "@/lib/blocks/recipe-showcase-data";
import type { BlockDocument } from "@/lib/blocks/types";
import type { HomeHeroView } from "@/features/home/home-hero-view";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * เนื้อหาหน้าแรก "โหมดบล็อก" — **แหล่งเดียว** ของหน้าแรกจริงและลิงก์พรีวิว
 *
 * ลำดับต้องเหมือนเว็บจริงเป๊ะ: `Hero` (ไม่ใช่บล็อก · เจ้าของคือ `/admin/hero`) → บล็อกที่เหลือ
 * และบล็อกไดนามิก (สินค้า/เมนู/ข่าว) ต้องได้ข้อมูลจริงจาก DB ไม่ใช่ `null`
 * (ถ้าไม่ส่ง ⇒ ตัวเรนเดอร์จะคืน `null` เงียบ ๆ = พรีวิวดูเหมือน "บล็อกหาย")
 *
 * ⚠️ ใช้จาก Server Component เท่านั้น (อ่าน DB)
 */
export async function HomeBlockPage({
  locale,
  messages,
  document,
  view,
}: {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly document: BlockDocument;
  readonly view: HomeHeroView;
}) {
  return (
    <>
      <Hero
        locale={locale}
        messages={messages}
        dbSlides={view.slides}
        heroSetting={view.heroSetting}
        heroCard={view.heroCard}
        texts={view.heroTexts}
      />
      <BlockDocumentView
        document={document}
        language={locale}
        productData={await loadProductShowcaseData(document)}
        recipeData={await loadRecipeShowcaseData(document)}
        newsData={await loadNewsShowcaseData(document)}
      />
    </>
  );
}

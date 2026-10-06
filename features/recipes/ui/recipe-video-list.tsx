import { fillTemplate } from "@/lib/i18n/template";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";
import { formatRecipeDate, recipeTitleOf, youTubeWatchUrlOf } from "@/lib/recipes/model";
import type { RecipeRecord } from "@/lib/recipes/repository";

import { VideoFacade } from "./video-facade";

/**
 * รายการเมนูอาหาร (วิดีโอ) — ส่วนที่แสดง **ข้อมูลที่นำเข้าจากเว็บเดิม** (S3 ส่วนที่ 4 · รอบที่ 104)
 *
 * ทำไมเป็น Server Component + facade เล็ก ๆ
 * - รายการ/การ์ดไม่ต้องใช้ JS เลย ⇒ เป็น Server Component ทั้งก้อน
 * - มี client component **ตัวเดียว** (`VideoFacade`) สำหรับ "กดแล้วค่อยโหลดวิดีโอ" ตามมติเจ้าของ
 *   (ไม่ฝัง iframe ไว้ล่วงหน้า ⇒ ยังไม่มีการต่อกับ YouTube ก่อนผู้ใช้กด — เรื่อง PDPA)
 *
 * ⚠️ ข้อมูลทั้งหมดมาจากฐานข้อมูล (นำเข้าจากเว็บเดิม) — **ห้ามแต่งเมนูเพิ่มในหน้าจอ**
 * ⚠️ ไม่มีชื่ออังกฤษ (เว็บเดิมมีแต่ไทย) ⇒ `recipeTitleOf` ถอยไปใช้ไทย
 */

export type RecipeVideoListStrings = {
  readonly title: string;
  readonly count: string;
  readonly play: string;
  readonly privacyNote: string;
  readonly watchOnYouTube: string;
  readonly published: string;
  readonly noCover: string;
};

export function recipeVideoListStringsOf(page: Messages["recipesPage"]): RecipeVideoListStrings {
  return {
    title: page.dbListTitle,
    count: page.dbListCount,
    play: page.dbPlay,
    privacyNote: page.dbPrivacyNote,
    watchOnYouTube: page.dbWatch,
    published: page.dbPublished,
    noCover: page.dbNoCover,
  };
}

export function RecipeVideoList({
  recipes,
  language,
  strings,
  titlePlaceholder,
}: {
  readonly recipes: readonly RecipeRecord[];
  readonly language: Locale;
  readonly strings: RecipeVideoListStrings;
  /**
   * ใช้เฉพาะ **พรีวิวหลังบ้าน** (รอบที่ 137) — ชื่อเมนูว่างแล้วโชว์ข้อความนี้แทน (แบบเดียวกับพรีวิวข่าว)
   * ⚠️ หน้าเว็บจริงไม่ส่งค่านี้ ⇒ พฤติกรรมหน้าเว็บไม่เปลี่ยน (ชื่อว่าง = ชื่อว่าง)
   */
  readonly titlePlaceholder?: string;
}) {
  if (recipes.length === 0) return null;

  return (
    <section className="border-line border-t bg-bg-subtle" aria-labelledby="recipe-videos-title">
      <div className="container-site py-12 lg:py-16">
        <h2 id="recipe-videos-title" className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
          {strings.title}
        </h2>
        <p className="mt-2 text-sm text-fg-muted">{fillTemplate(strings.count, { count: recipes.length })}</p>

        <ul className="recipe-card-grid mt-8 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => {
            const computedTitle = recipeTitleOf(recipe.titleTh, recipe.titleEn, language);
            const title = computedTitle === "" && titlePlaceholder !== undefined ? titlePlaceholder : computedTitle;
            const published = formatRecipeDate(recipe.publishedOn, language);
            return (
              <li key={recipe.id} className="flex flex-col rounded-2xl border border-line bg-bg p-4">
                <VideoFacade
                  videoId={recipe.videoId}
                  title={title}
                  coverSrc={recipe.coverPath}
                  coverWidth={recipe.coverWidth}
                  coverHeight={recipe.coverHeight}
                  coverAlt={title}
                  playLabel={strings.play}
                  unavailableLabel={strings.noCover}
                />

                <h3 className="mt-4 text-base leading-snug font-bold text-fg">{title}</h3>

                <p className="mt-1 text-xs text-fg-muted">{strings.privacyNote}</p>

                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  {published === "" ? null : <span className="text-fg-muted">{`${strings.published} ${published}`}</span>}
                  <a
                    href={youTubeWatchUrlOf(recipe.videoId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-accent hover:underline"
                  >
                    {strings.watchOnYouTube}
                  </a>
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

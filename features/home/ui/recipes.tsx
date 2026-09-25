import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/th";

import { SectionCurve } from "@/features/shell/ui/section-curve";
import { RECIPE_ORDER } from "../content";
import { SectionHeading } from "./section-heading";

type RecipesProps = {
  readonly locale: Locale;
  readonly messages: Messages;
};

export function Recipes({ locale, messages }: RecipesProps) {
  const m = messages.recipes;

  return (
    <section className="relative bg-bg-cream">
      {/* ขอบบนโค้งนุ่ม — เนินของแถบนี้ยื่นขึ้นไปในพื้นที่ว่างของ section ด้านบน */}
      <SectionCurve tone="bg-cream" edge="top" />

      <div className="container-site py-16 lg:py-24">
        <SectionHeading
          eyebrow={m.eyebrow}
          title={m.title}
          body={m.body}
          action={
            <Link
              href={localePath(locale, "/recipes")}
              className="inline-flex items-center gap-2 rounded-full border-2 border-line-strong px-5 py-3 text-sm font-bold text-fg transition-colors hover:bg-surface"
            >
              {messages.actions.viewAllRecipes}
            </Link>
          }
        />

        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {RECIPE_ORDER.map((id, index) => {
            const recipe = m.items[id];
            return (
              <li key={id}>
                <Link
                  href={localePath(locale, "/recipes")}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  {/* ภาพประกอบแทนภาพถ่ายจริง — สลับเป็น <Image /> เมื่อได้ไฟล์ */}
                  <div
                    aria-hidden="true"
                    className={[
                      "relative flex h-40 items-end p-5",
                      index % 2 === 0 ? "bg-brand-yellow" : "bg-brand-red",
                    ].join(" ")}
                  >
                    <div className="absolute inset-y-0 right-0 w-2/5 bg-stripes-brand opacity-45 [mask-image:linear-gradient(to_right,transparent,black)]" />
                    <span
                      className={[
                        "relative font-display text-4xl leading-none font-extrabold",
                        index % 2 === 0 ? "text-accent-on-yellow" : "text-on-brand",
                      ].join(" ")}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-fg-muted">
                      <span>{recipe.minutes}</span>
                      <span aria-hidden="true">·</span>
                      <span>{recipe.level}</span>
                    </div>

                    <h3 className="mt-2 font-display text-lg leading-snug font-bold text-fg group-hover:text-accent">
                      {recipe.name}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-fg-muted">
                      {recipe.description}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ขอบล่างโค้งนุ่ม — สีพื้นของ section ถัดไป */}
      <SectionCurve tone="bg" edge="bottom" />
    </section>
  );
}

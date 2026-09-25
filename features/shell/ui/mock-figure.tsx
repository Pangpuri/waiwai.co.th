import type { ReactNode } from "react";

/**
 * ช่องภาพตัวอย่าง (mock) — คอมโพเนนต์กลางของ shell
 *
 * เดิมอยู่ใน `features/about/ui/` แต่ตอนนี้ทั้ง /about, /recipes และ /news ต้องใช้
 * จึงย้ายมาไว้ที่ shell ตามกฎ "ไม่ให้ feature หนึ่งพึ่ง ui ของอีก feature"
 *
 * เหตุผลที่ยังไม่ใช้ next/image ในหน้าที่ยังไม่มีภาพจริง: การใส่ภาพปลอมจะทำให้
 * ผู้ชมเข้าใจผิดว่าเป็นภาพจริง → วาดเป็น "ช่องภาพ" ที่ดูออกทันทีว่าเป็นภาพตัวอย่าง
 *
 * หน้าที่มีภาพจริงแล้ว (certifications · executives · products) ใช้ `next/image` + `alt` แทน
 *
 * สีทั้งหมดใช้ design token → โหมดมืดทำงานเองและผ่าน `npm run check:dark`
 */

export type MockFigureIcon =
  | "site"
  | "dormitory"
  | "water"
  | "quality"
  | "truck"
  | "team"
  | "product"
  | "recipe"
  | "news";

type MockFigureRatio = "video" | "standard" | "square";
type MockFigureTone = "yellow" | "cream" | "subtle";

const RATIO: Record<MockFigureRatio, string> = {
  video: "aspect-video",
  standard: "aspect-4/3",
  square: "aspect-square",
};

const TONE: Record<MockFigureTone, string> = {
  yellow: "from-brand-yellow/30 via-bg-subtle to-bg-subtle",
  cream: "from-bg-cream via-bg-cream to-bg-subtle",
  subtle: "from-bg-subtle via-surface to-bg-subtle",
};

const ICONS: Record<MockFigureIcon, ReactNode> = {
  site: (
    <>
      <path d="M8 42h32" />
      <rect x="12" y="14" width="18" height="28" rx="2" />
      <path d="M30 22h6a2 2 0 0 1 2 2v18" />
      <path d="M17 22h2M25 22h2M17 29h2M25 29h2M17 36h2M25 36h2" />
    </>
  ),
  dormitory: (
    <>
      <path d="M8 42h32" />
      <path d="M12 22 24 12l12 10" />
      <path d="M15 22v20h18V22" />
      <path d="M21 42v-9h6v9" />
    </>
  ),
  water: (
    <>
      <path d="M24 9c6 8 10 12 10 17a10 10 0 0 1-20 0c0-5 4-9 10-17Z" />
      <path d="M10 40c3 0 3-2 6-2s3 2 6 2 3-2 6-2 3 2 6 2" />
    </>
  ),
  quality: (
    <>
      <circle cx="22" cy="22" r="10" />
      <path d="M29 29l9 9" />
      <path d="M18 22l3 3 6-6" />
    </>
  ),
  truck: (
    <>
      <path d="M4 34V14h20v20" />
      <path d="M24 20h8l6 6v8h-2" />
      <circle cx="14" cy="36" r="3.5" />
      <circle cx="32" cy="36" r="3.5" />
      <path d="M4 34h6M18 34h10M25 34h3" />
    </>
  ),
  team: (
    <>
      <circle cx="18" cy="18" r="6" />
      <path d="M7 40c0-6 5-10 11-10s11 4 11 10" />
      <circle cx="34" cy="20" r="4.5" />
      <path d="M30 40c0-5 4-8 8-8s7 3 7 8" />
    </>
  ),
  product: (
    <>
      <rect x="12" y="10" width="24" height="30" rx="3" />
      <path d="M12 20h24" />
      <path d="M18 28h12M18 34h8" />
    </>
  ),
  /* ชามบะหมี่พร้อมไอ — ใช้กับการ์ดเมนูอาหาร */
  recipe: (
    <>
      <path d="M9 25h30" />
      <path d="M12 25c0 8 5 13 12 13s12-5 12-13" />
      <path d="M19 18c0-3 2-3 2-6M27 18c0-3 2-3 2-6" />
    </>
  ),
  /* หนังสือพิมพ์ — ใช้กับการ์ดข่าวสาร */
  news: (
    <>
      <rect x="9" y="11" width="30" height="26" rx="2" />
      <path d="M14 17h10v8H14z" />
      <path d="M28 18h6M28 23h6M14 30h20" />
    </>
  ),
};

type MockFigureProps = {
  /** ป้ายที่บอกผู้ใช้ว่านี่คือภาพตัวอย่าง — มาจากพจนานุกรม (ไม่ hardcode ข้อความ) */
  readonly badge: string;
  /** คำบรรยายใต้ภาพ */
  readonly caption: string;
  readonly icon?: MockFigureIcon;
  readonly ratio?: MockFigureRatio;
  readonly tone?: MockFigureTone;
  readonly className?: string;
};

export function MockFigure({
  badge,
  caption,
  icon = "site",
  ratio = "standard",
  tone = "yellow",
  className,
}: MockFigureProps) {
  return (
    <figure className={["flex h-full flex-col", className ?? ""].join(" ")}>
      <div
        role="img"
        aria-label={`${badge}: ${caption}`}
        className={[
          "relative overflow-hidden rounded-[1.25rem] border border-line",
          "bg-gradient-to-br",
          TONE[tone],
          RATIO[ratio],
        ].join(" ")}
      >
        {/* ลายเส้นเฉียงแบบเดียวกับซองบะหมี่ — ใช้เป็นของประดับมุม */}
        <div
          aria-hidden="true"
          className="bg-stripes-brand absolute -top-12 -left-12 h-36 w-36 rotate-12 rounded-[2rem] opacity-25"
        />
        <div
          aria-hidden="true"
          className="bg-stripes-brand absolute -right-14 -bottom-14 h-44 w-44 rotate-12 rounded-[2rem] opacity-15"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center p-8 text-line-strong"
        >
          <span className="h-16 w-16 sm:h-20 sm:w-20">
            <svg
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-full w-full"
            >
              {ICONS[icon]}
            </svg>
          </span>
        </div>

        <span className="absolute top-3 left-3 rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-semibold text-fg-muted">
          {badge}
        </span>
      </div>

      <figcaption className="mt-3 text-xs leading-relaxed text-fg-muted">{caption}</figcaption>
    </figure>
  );
}

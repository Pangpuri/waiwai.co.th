import { WORDMARK } from "@/features/shell/ui/brand-mark";
import type { PackTone } from "@/features/home/content";

/**
 * ภาพสินค้าแบบวาดด้วย CSS
 *
 * เหตุผลที่ยังไม่ใช้ next/image: ยังไม่มีไฟล์ภาพสินค้าจริงจากเจ้าของแบรนด์
 * การใส่ภาพปลอมจะทำให้ผู้ใช้เข้าใจผิดว่าเป็นบรรจุภัณฑ์จริง
 * เมื่อได้ไฟล์จริง ให้แทนที่ด้วย <Image /> โดยคงสัดส่วน 3:4 และ alt เดิม
 */

const TONE: Record<
  PackTone,
  { readonly surface: string; readonly band: string; readonly name: string; readonly tagline: string }
> = {
  yellow: {
    surface: "bg-gradient-to-br from-brand-yellow to-brand-yellow-deep",
    band: "bg-brand-red",
    name: "text-accent-on-yellow",
    tagline: "text-accent-on-yellow/80",
  },
  red: {
    surface: "bg-gradient-to-br from-brand-red to-brand-red/75",
    band: "bg-brand-yellow",
    name: "text-on-brand",
    tagline: "text-on-brand/85",
  },
  cream: {
    surface: "bg-gradient-to-br from-bg-cream to-bg-subtle",
    band: "bg-brand-red",
    name: "text-fg",
    tagline: "text-fg-muted",
  },
};

type PackShotProps = {
  readonly name: string;
  readonly tagline: string;
  readonly tone: PackTone;
  readonly className?: string;
};

export function PackShot({ name, tagline, tone, className }: PackShotProps) {
  const palette = TONE[tone];

  return (
    <div
      className={[
        "relative aspect-3/4 overflow-hidden rounded-[1.25rem] shadow-lg",
        "ring-1 ring-line ring-inset",
        palette.surface,
        className ?? "",
      ].join(" ")}
    >
      {/* แถบหัวซอง + ตราแบรนด์ */}
      <div
        className={[
          "absolute inset-x-0 top-0 flex h-[26%] items-center justify-center",
          palette.band,
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className="font-display text-2xl leading-none font-extrabold text-on-brand sm:text-3xl"
        >
          {WORDMARK.thai}
        </span>
      </div>

      {/* ชื่อสินค้าและคำโปรย */}
      <div className="absolute inset-x-0 top-[26%] bottom-[32%] flex flex-col justify-center px-4 text-center">
        <p
          className={[
            "font-display text-base leading-tight font-extrabold text-balance sm:text-lg",
            palette.name,
          ].join(" ")}
        >
          {name}
        </p>
        <p className={["mt-2 text-xs leading-snug font-medium", palette.tagline].join(" ")}>
          {tagline}
        </p>
      </div>

      {/* ชามบะหมี่วาดด้วย CSS — ใช้สีคงที่เพื่อให้เห็นชัดทั้งสองโหมด */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[32%]">
        <div className="relative mx-auto h-full w-[78%]">
          <div className="absolute inset-x-0 bottom-0 h-[62%] rounded-b-full bg-on-brand/90" />
          <div className="absolute inset-x-[-7%] bottom-[54%] h-2.5 rounded-full bg-on-brand" />
          <div className="absolute bottom-[46%] left-1/2 h-5 w-14 -translate-x-1/2 rounded-full border-4 border-dashed border-brand-red/60" />
          <div className="absolute bottom-[62%] left-[18%] h-1.5 w-1.5 rounded-full bg-brand-red/70" />
          <div className="absolute bottom-[70%] right-[22%] h-2 w-2 rounded-full bg-brand-yellow" />
        </div>
      </div>
    </div>
  );
}

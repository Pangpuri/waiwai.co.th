"use client";

import Image from "next/image";
import { useState } from "react";

import { NewsBody } from "@/features/news/ui/news-body";
import type { Messages } from "@/lib/i18n/messages/th";
import type { MediaSize } from "@/lib/media/repository";
import type { NewsBlock } from "@/lib/news/body";
import { formatNewsDate } from "@/lib/news/model";

/**
 * พรีวิวข่าวแบบ "เห็นเหมือนหน้าเว็บจริง" (รอบที่ 128)
 *
 * ที่มา: เจ้าของทดลองใช้หลังบ้านแล้วอยากเห็นว่าข่าวจะออกมาหน้าตาอย่างไรก่อนกดเผยแพร่
 * และเป็นวิธีลดความผิดพลาดของคนไม่สายเว็บได้ดีที่สุด
 *
 * หลักการสำคัญ (กัน "พรีวิวโกหก")
 * - ใช้ **ตัวเรนเดอร์ตัวเดียวกับหน้าเว็บจริง** (`NewsBody` ตัวที่หน้า `/news/<id>` ใช้)
 *   ไม่เขียนตัวเรนเดอร์ใหม่ ⇒ สิ่งที่เห็นในพรีวิว = สิ่งที่คนอ่านเห็น (มีเทสต์สแกนกันการเขียนซ้ำ)
 * - ขนาดรูปส่งเข้ามาเป็น **รายการธรรมดา** (ไม่ส่ง `Map` ข้าม RSC boundary) แล้วประกอบเป็น Map ที่นี่
 * - สลับ ไทย/อังกฤษ ได้ เพื่อดูว่าผู้อ่านภาษาอังกฤษเห็นอะไร (EN ว่าง = ถอยไปใช้ไทย ตามมติ D3)
 * - ไม่มี JS ของหน้าเว็บถูกโหลดเพิ่ม: ใช้ `<Image unoptimized>` ในพรีวิวเท่านั้น
 */

export type NewsPreviewSize = { readonly id: string; readonly width: number | null; readonly height: number | null };

type NewsPreviewProps = {
  readonly strings: Messages["admin"];
  readonly titleTh: string;
  readonly titleEn: string;
  readonly excerptTh: string;
  readonly excerptEn: string;
  readonly coverPath: string;
  readonly publishedLocal: string;
  readonly blocks: readonly NewsBlock[];
  readonly sizes: readonly NewsPreviewSize[];
  readonly defaultLanguage: "th" | "en";
};

function firstNonEmpty(primary: string, fallback: string): string {
  return primary.trim() === "" ? fallback : primary;
}

export function NewsPreview(props: NewsPreviewProps) {
  const [language, setLanguage] = useState<"th" | "en">(props.defaultLanguage);
  const m = props.strings;

  const title = language === "th" ? props.titleTh : firstNonEmpty(props.titleEn, props.titleTh);
  const excerpt = language === "th" ? props.excerptTh : firstNonEmpty(props.excerptEn, props.excerptTh);
  const dateLabel = formatNewsDate(props.publishedLocal === "" ? null : props.publishedLocal, language, false);

  const sizes = new Map<string, MediaSize>();
  for (const item of props.sizes) {
    if (item.width === null || item.height === null) continue;
    sizes.set(item.id, { id: item.id, width: item.width, height: item.height });
  }

  return (
    <section aria-label={m.newsAdminPreview} className="border-line bg-bg-subtle rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-fg-muted text-xs font-semibold uppercase">{m.newsAdminPreview}</h2>
        <span className="flex items-center gap-1" role="group" aria-label={m.newsAdminPreview}>
          {(["th", "en"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLanguage(item)}
              aria-pressed={language === item}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                language === item ? "border-line bg-surface text-fg" : "border-line text-fg-muted"
              }`}
            >
              {item === "th" ? m.newsAdminPreviewTh : m.newsAdminPreviewEn}
            </button>
          ))}
        </span>
      </div>

      <div className="border-line bg-surface mt-3 overflow-hidden rounded-xl border">
        {props.coverPath === "" ? null : (
          <span className="bg-bg-subtle block">
            <Image
              src={props.coverPath}
              alt={m.newsAdminCoverAlt}
              width={1200}
              height={800}
              className="h-auto w-full object-cover"
              unoptimized
            />
          </span>
        )}

        <div className="p-5">
          {dateLabel === "" ? null : (
            <p className="text-fg-muted text-xs font-medium">{dateLabel}</p>
          )}
          <h3 className="font-display mt-2 text-xl font-semibold tracking-tight">
            {title === "" ? m.newsAdminPreviewUntitled : title}
          </h3>
          {excerpt === "" ? null : <p className="text-fg-muted mt-3 text-sm">{excerpt}</p>}

          <div className="mt-5">
            {props.blocks.length === 0 ? (
              <p className="text-fg-muted text-sm">{m.newsAdminPreviewEmpty}</p>
            ) : (
              <NewsBody blocks={props.blocks} sizes={sizes} />
            )}
          </div>
        </div>
      </div>

      <p className="text-fg-muted mt-2 text-xs">{m.newsAdminPreviewHint}</p>
    </section>
  );
}

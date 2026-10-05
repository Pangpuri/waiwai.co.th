"use client";

import Image from "next/image";
import { useState } from "react";

import { youTubeEmbedUrlOf } from "@/lib/recipes/model";

/**
 * ผู้เล่นวิดีโอแบบ **คลิกแล้วค่อยโหลด** (facade) — S3 ส่วนที่ 4 · รอบที่ 104
 *
 * ทำไมต้องเป็นแบบนี้ (มติเจ้าของ 2026-10-05)
 * - ฝัง `<iframe>` ตรง ๆ จะส่ง IP/ข้อมูลผู้ใช้ไป Google **ทุกครั้งที่เปิดหน้า** แม้ผู้ใช้ไม่ดู
 * - แบบนี้: โชว์ภาพปกก่อน → **โหลดผู้เล่นจาก `youtube-nocookie.com` เมื่อผู้ใช้กดปุ่มเท่านั้น**
 *   (โดเมนปลอดคุกกี้ ไม่ตั้งคุกกี้โฆษณา) — สอดคล้องกับแนวเดิมของโปรเจกต์ที่เลี่ยงการฝังของบุคคลที่สาม
 *   (บล็อกแผนที่ใช้ "ภาพ + ลิงก์" ไม่ใช้ iframe)
 * - ⚠️ ต้องระบุเรื่องนี้ในนโยบายความเป็นส่วนตัว (หนี้ PDPA — ดู PRODUCT_ROADMAP.md § 9)
 *
 * หมายเหตุ: เป็น client component **เล็กที่สุดเท่าที่จำเป็น** (สถานะเดียว) · ข้อความทั้งหมดรับเป็น prop
 * ⇒ ไม่ลากพจนานุกรมทั้งก้อนไปเบราว์เซอร์
 */

export function VideoFacade({
  videoId,
  title,
  coverSrc,
  coverWidth,
  coverHeight,
  coverAlt,
  playLabel,
  unavailableLabel,
}: {
  readonly videoId: string;
  readonly title: string;
  readonly coverSrc: string | null;
  readonly coverWidth: number | null;
  readonly coverHeight: number | null;
  readonly coverAlt: string;
  readonly playLabel: string;
  readonly unavailableLabel: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    /* สีต้องเป็น token เท่านั้น (ด่าน check:dark) — พื้นหลังเห็นแค่เสี้ยววินาทีระหว่างโหลดผู้เล่น */
    return (
      <div className="border-line bg-surface aspect-video w-full overflow-hidden rounded-xl border">
        <iframe
          src={youTubeEmbedUrlOf(videoId)}
          title={title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`${playLabel}: ${title}`}
      className="group border-line focus-visible:ring-ring relative block aspect-video w-full overflow-hidden rounded-xl border focus-visible:ring-2 focus-visible:outline-none"
    >
      {coverSrc === null ? (
        <span className="bg-bg-subtle text-fg-muted absolute inset-0 flex items-center justify-center px-3 text-center text-xs">
          {unavailableLabel}
        </span>
      ) : (
        <Image
          src={coverSrc}
          alt={coverAlt}
          width={coverWidth ?? 400}
          height={coverHeight ?? 300}
          sizes="(max-width: 640px) 90vw, 360px"
          className="h-full w-full object-cover"
        />
      )}

      <span
        aria-hidden="true"
        className="bg-brand-red text-on-brand absolute top-1/2 left-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
          <path d="M8 5.14v13.72L19 12 8 5.14Z" />
        </svg>
      </span>
    </button>
  );
}

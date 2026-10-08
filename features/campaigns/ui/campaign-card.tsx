import Image from "next/image";
import type { CSSProperties } from "react";

import type { CampaignCardImage } from "@/lib/campaigns/model";

/**
 * ตัวเรนเดอร์ "การ์ดแคมเปญ" ตัวเดียวของทั้งเว็บ (รอบที่ 198)
 *
 * ทำไมต้องแยกเป็นคอมโพเนนต์กลาง
 * - การ์ดใบเดียวแสดงได้หลายหน้า (หน้าแรกผ่าน `HeroSlider` · หน้าข่าวสารผ่านเวทีการ์ด)
 *   ⇒ ถ้าต่างที่ต่างเขียนมาร์กอัปเอง หน้าตาจะเพี้ยนกันแบบเงียบ ๆ (บทเรียนเดิมของโปรเจกต์: "พรีวิวต้องใช้ตัวเดียวกับหน้าเว็บ")
 * - ไม่มี state/ไม่มี hook ⇒ ใช้ได้ทั้งใน client component (สไลด์) และ server component (หน้าข่าวสาร)
 *
 * ⚠️ ภาพ: ใช้ `next/image` แบบ `fill` ⇒ ต้องมีกล่อง `relative` ครอบ
 * ⚠️ ไม่มีภาพ = **ไม่สร้างองค์ประกอบภาพเลย** (ห้ามปล่อย `src` ว่าง — มีเทสต์กันไว้ตั้งแต่รอบที่ 194)
 */
export type CampaignCardData = {
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly ctaHref: string;
  readonly image?: CampaignCardImage;
};

export function CampaignCard({ card }: { readonly card: CampaignCardData }) {
  return (
    <div className="flex flex-col gap-1">
      {card.image === undefined ? null : (
        <span className="relative mb-1 block h-24 w-full overflow-hidden rounded-lg sm:h-28">
          <Image
            src={card.image.path}
            alt={card.image.alt}
            fill
            sizes="(min-width: 640px) 448px, 100vw"
            className="object-cover"
          />
        </span>
      )}
      <p className="text-fg text-base font-bold sm:text-lg">{card.title}</p>
      {card.body.trim() === "" ? null : <p className="text-fg-muted text-xs sm:text-sm">{card.body}</p>}
      {card.ctaLabel.trim() === "" || card.ctaHref.trim() === "" ? null : (
        <a href={card.ctaHref} className="text-brand-red text-sm font-semibold underline underline-offset-2">
          {card.ctaLabel}
        </a>
      )}
    </div>
  );
}

/**
 * สูตรวางการ์ด: `left`/`top` เป็นเปอร์เซ็นต์ของพื้นที่ + เลื่อนกลับครึ่งหนึ่งของตัวเอง
 * ⇒ จุดยึด (0/50/100) หมายถึง "ขอบซ้าย/กลาง/ขอบขวา" ของการ์ดตรงกับตำแหน่งนั้นของพื้นที่
 * ใช้ร่วมกันทั้งหน้าเว็บ (สไลด์/หน้าข่าวสาร) และพรีวิวในหลังบ้าน — ห้ามเขียนสูตรซ้ำ
 */
export function campaignAnchorStyle(anchorX: number, anchorY: number): CSSProperties {
  return {
    left: anchorX + "%",
    top: anchorY + "%",
    transform: "translate(-" + anchorX + "%, -" + anchorY + "%)",
  };
}

/** กรอบการ์ดมาตรฐาน (พื้นหลัง/เงา/ความกว้าง) — ให้ทุกหน้าใช้ค่าเดียวกัน */
export function campaignCardBoxClass(): string {
  return "pointer-events-auto absolute flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 rounded-2xl bg-surface/95 p-4 text-fg shadow-lg sm:max-w-md";
}

import Image from "next/image";

import type { WhereToBuyView } from "@/lib/content/home-section";
import type { Messages } from "@/lib/i18n/messages/th";

import { WHERE_TO_BUY_ANCHOR } from "@/lib/blocks/marketplace-links";

import { SectionHeading } from "./section-heading";

/**
 * ส่วน "ที่ซื้อสินค้า" บนหน้าแรก — แสดง **ช่องทางซื้อออนไลน์** เท่านั้น
 *
 * ⚠️ รอบที่ 112 (เจ้าของสั่ง): **ถอดปุ่ม "ค้นหาร้านใกล้บ้าน" ออก** พร้อมลบหน้า `/where-to-buy` ทิ้ง
 * เหตุผล (คำเจ้าของ): สินค้าขายตามร้านค้าทั่วไปอยู่แล้ว · ถ้าคงปุ่มไว้จะต้องปักพิกัด/ดูแลข้อมูลทุกร้านต่อเนื่อง
 * ⇒ ที่เหลือคือปุ่มของช่องทางออนไลน์ + ข้อความบอกว่าหาซื้อได้ที่ร้านทั่วไป
 * รอบที่ 209: รายการช่องทาง/ข้อความทั้งหมดมาจาก **วิวที่ชั้นข้อมูลประกอบให้** (ค่าหลังบ้านทับค่าเริ่มต้น)
 *
 * ⚠️ `id="where-to-buy"` เป็นปลายทางของปุ่ม "สั่งซื้อสินค้าออนไลน์" บนหัวเว็บ
 * (`features/shell/nav.ts` → `HEADER_CTA.anchor`) — **ห้ามลบ id นี้** ไม่งั้นปุ่มบนหัวเว็บจะพาไปที่ว่าง
 */
type WhereToBuyProps = {
  readonly messages: Messages;
  /**
   * เนื้อหาที่รวมแล้ว (รอบที่ 209): ค่าที่ตั้งในหลังบ้านทับค่าเริ่มต้น
   * ประกอบที่ชั้นข้อมูลด้วย `whereToBuyViewOf()` ที่เดียว — คอมโพเนนต์นี้ไม่ถือค่าคงที่ของตัวเองอีก
   */
  readonly view: WhereToBuyView;
};

export function WhereToBuy({ messages, view }: WhereToBuyProps) {

  return (
    <section id={WHERE_TO_BUY_ANCHOR} className="container-site scroll-mt-40 py-16 lg:py-24">
      <div className="rounded-3xl bg-brand-yellow px-6 py-12 text-accent-on-yellow sm:px-10 lg:px-14 lg:py-16">
        <SectionHeading eyebrow={view.eyebrow} title={view.title} body={view.body} />

        <ul className="mt-9 flex flex-wrap justify-center gap-4">
          {view.marketplaces.map((marketplace) => (
            <li key={marketplace.id} className="w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)]">
              <a
                href={marketplace.href}
                target="_blank"
                rel="noreferrer noopener"
                className="group bg-surface text-fg border-line hover:border-line-strong focus-visible:ring-ring relative flex h-full min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border px-4 py-5 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none"
              >
                {marketplace.logo === "" ? null : (
                  <span className="bg-on-brand flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm sm:size-16">
                    <Image
                      src={marketplace.logo}
                      alt=""
                      width={160}
                      height={160}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      unoptimized
                    />
                  </span>
                )}
                <span className="text-sm font-bold leading-tight">
                  {marketplace.label}
                </span>
                <span className="sr-only"> {messages.a11y.newWindow}</span>
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-7 text-sm text-accent-on-yellow/80">{view.retailNote}</p>
      </div>
    </section>
  );
}

import type { Messages } from "@/lib/i18n/messages/th";
import { SITE } from "@/lib/site";

import { SectionHeading } from "./section-heading";

/**
 * ส่วน "ที่ซื้อสินค้า" บนหน้าแรก — แสดง **ช่องทางซื้อออนไลน์** เท่านั้น
 *
 * ⚠️ รอบที่ 112 (เจ้าของสั่ง): **ถอดปุ่ม "ค้นหาร้านใกล้บ้าน" ออก** พร้อมลบหน้า `/where-to-buy` ทิ้ง
 * เหตุผล (คำเจ้าของ): สินค้าขายตามร้านค้าทั่วไปอยู่แล้ว · ถ้าคงปุ่มไว้จะต้องปักพิกัด/ดูแลข้อมูลทุกร้านต่อเนื่อง
 * ⇒ ที่เหลือคือปุ่มของช่องทางออนไลน์ (จาก `SITE.marketplaces`) + ข้อความบอกว่าหาซื้อได้ที่ร้านทั่วไป
 *
 * ⚠️ `id="where-to-buy"` เป็นปลายทางของปุ่ม "สั่งซื้อสินค้าออนไลน์" บนหัวเว็บ
 * (`features/shell/nav.ts` → `HEADER_CTA.anchor`) — **ห้ามลบ id นี้** ไม่งั้นปุ่มบนหัวเว็บจะพาไปที่ว่าง
 */
type WhereToBuyProps = {
  readonly messages: Messages;
};

export function WhereToBuy({ messages }: WhereToBuyProps) {
  const m = messages.whereToBuy;

  return (
    <section id="where-to-buy" className="container-site scroll-mt-40 py-16 lg:py-24">
      <div className="rounded-3xl bg-brand-yellow px-6 py-12 text-accent-on-yellow sm:px-10 lg:px-14 lg:py-16">
        <SectionHeading eyebrow={m.eyebrow} title={m.title} body={m.body} />

        <ul className="mt-9 flex flex-wrap gap-3">
          {SITE.marketplaces.map((marketplace) => (
            <li key={marketplace.id}>
              <a
                href={marketplace.href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-full bg-surface px-6 py-3.5 text-sm font-bold text-fg shadow-sm transition-transform hover:-translate-y-0.5"
              >
                {m.marketplaces[marketplace.id]}
                <span className="sr-only"> {messages.a11y.newWindow}</span>
                <span aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-7 text-sm text-accent-on-yellow/80">{m.retailNote}</p>
      </div>
    </section>
  );
}

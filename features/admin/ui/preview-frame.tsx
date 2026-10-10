"use client";

import { useEffect, useRef, useState } from "react";

/**
 * กรอบพรีวิว "สัดส่วนเท่าหน้าเว็บจริง" + ย่อพอดีช่อง (รอบที่ 147 · ฟีดแบ็กเจ้าของ)
 *
 * ปัญหาที่แก้ต่อกัน 2 รอบ
 *   1. พรีวิวเรนเดอร์การ์ดในคอลัมน์แคบ ⇒ การ์ด/บล็อคขาวรายละเอียดถูกบีบ
 *      (breakpoint `sm:`/`lg:` อ้าง **viewport** ไม่ใช่กล่องแม่)
 *   2. รอบที่ 146 แก้ด้วย "ความกว้างจริง + เลื่อนแนวนอน" ⇒ **ผู้ใช้ต้องสกอลข้าง** ✗
 *
 * รอบนี้: เรนเดอร์ที่ความกว้างเนื้อหาจริงของเว็บ แล้ว **ย่อทั้งภาพด้วย `transform: scale()`**
 *   (วิธีเดียวกับตัวสร้างหน้าเว็บ) ⇒ เห็นเลย์เอาต์/ความกว้างการ์ดเท่าหน้าเว็บจริง และ **ไม่ต้องเลื่อน**
 *
 * 📏 ตัวเลขอ้างอิงวัดจากของจริง (`app/globals.css` · `@utility container-site`)
 *   `max-width: 80rem` (1280px) − `padding-inline: 2rem × 2` (เดสก์ท็อป) = **1216px**
 *   ⇒ การ์ด 3 คอลัมน์ + `gap-4` = (1216 − 32) / 3 ≈ **395px** (เท่าที่ผู้ชมเห็นบนเว็บ)
 *
 * ⚠️ กัน feedback loop (บทเรียนตัวสร้างหน้าเว็บ): วัด "ความกว้างกล่องแม่" ไปตั้ง `scale` และ
 *    วัด "ความสูงของเนื้อหาข้างใน × scale" ไปตั้งความสูงกล่องนอก — เนื้อหาข้างในมีความกว้างคงที่
 *    ความสูงจึงไม่ขึ้นกับกล่องนอก ⇒ ไม่วนกลับ
 */

/** ความกว้างเนื้อหาเว็บจริงบนเดสก์ท็อป (container-site 80rem − padding 2×2rem) */
export const SITE_PREVIEW_WIDTH = 1216;

/**
 * ความกว้าง **การ์ดสินค้า 1 ใบ** เท่าหน้าเว็บจริง — ตัวเลขที่ต้องใช้กับ "พรีวิวการ์ด"
 *
 * คำนวณจากของจริง (ไม่เดา): เนื้อหาเว็บ 1216px ÷ 3 คอลัมน์ หักช่องว่างระหว่างการ์ด
 *   (1216 − 2 × 16px) / 3 = 394.67px ⇒ ปัดเป็น **395px**
 *
 * ⚠️ บทเรียนรอบที่ 147→148: ถ้าเรนเดอร์ทั้งหน้า 1216px แล้วย่อทั้งภาพ ตัวอักษรจะเล็กอ่านไม่ออก
 *    ⇒ พรีวิวการ์ดต้องเรนเดอร์ **การ์ดที่ 395px แบบ 1:1** (บังคับกริดเป็น 1 คอลัมน์ด้วยคลาส
 *    `preview-single-card`) · ถ้าช่องหลังบ้านแคบกว่า 395px จึงค่อยย่อ (ไม่เกิน 1:1)
 */
export const SITE_CARD_WIDTH = 395;

/**
 * ความกว้าง **การ์ดเมนูอาหาร 1 ใบ** เท่าหน้าเว็บจริง
 *
 * หน้า  ใช้ 3 คอลัมน์ +  (24px): (1216 − 2 × 24) / 3 = 389.33px ⇒ ปัดเป็น **389px**
 */
export const SITE_RECIPE_CARD_WIDTH = 389;

/**
 * ความกว้าง **การ์ดหมวดสินค้า (`/products`) 1 ใบ** เท่าหน้าเว็บจริง (รอบที่ 254)
 * หน้าสินค้าใช้กริด 3 คอลัมน์ + `gap-6` (24px) เหมือนการ์ดเมนู ⇒ ความกว้างเท่ากันเป๊ะ
 */
export const SITE_CATEGORY_CARD_WIDTH = SITE_RECIPE_CARD_WIDTH;

export function PreviewFrame({
  label,
  width = SITE_PREVIEW_WIDTH,
  singleCard = false,
  children,
}: {
  readonly label: string;
  readonly width?: number;
  /** แสดง "การ์ดเดียว" ที่ความกว้างจริงของการ์ด (ใช้กับพรีวิวสินค้า) */
  readonly singleCard?: boolean;
  readonly children: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerHeight, setInnerHeight] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    const inner = innerRef.current;
    if (host === null || inner === null) return;

    const update = () => {
      const available = host.clientWidth;
      setScale(available === 0 ? 1 : Math.min(1, available / width));
      setInnerHeight(inner.scrollHeight);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div>
      <p className="text-fg-muted mb-1 text-xs">{label}</p>
      <div
        ref={hostRef}
        className="border-line overflow-hidden rounded-xl border"
        style={{ height: innerHeight === 0 ? undefined : innerHeight * scale }}
      >
        <div
          ref={innerRef}
          style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}
          className={singleCard ? "preview-single-card bg-bg p-4" : "bg-bg p-4"}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

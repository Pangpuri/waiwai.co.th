import Image from "next/image";
import Link from "next/link";

/**
 * การ์ดหมวดสินค้า — **ตัวเรนเดอร์เดียว** ที่ใช้ทั้งหน้าเว็บและพรีวิวหลังบ้าน (รอบที่ 254)
 *
 * ใช้ 2 ที่
 * 1. หน้า `/products` — ส่ง `href` = ลิงก์ไปหน้ารายละเอียดหมวด (ทั้งใบเป็นลิงก์)
 * 2. พรีวิวในฟอร์ม `/admin/products` — ส่ง `href={null}` = เรนเดอร์เป็น `div` (ไม่ใช่ลิงก์)
 * ⇒ "สิ่งที่เห็นตอนแก้ = สิ่งที่ขึ้นเว็บ" โดยไม่มีตัวเรนเดอร์ซ้ำ (บทเรียนเดียวกับพรีวิวสินค้า/ข่าว)
 *
 * ⚠️ **ไม่มีข้อความ CTA ใต้การ์ด** (มติเจ้าของ 2026-10-10): การ์ดทั้งใบเป็นลิงก์อยู่แล้ว
 *    ⇒ เคอร์เซอร์/โฟกัสคีย์บอร์ดบอกได้ว่าคลิกได้ ไม่ต้องมีข้อความ "ดูรายละเอียด →" ซ้ำ
 */
export type ProductCategoryCardProps = {
  readonly name: string;
  /** พาธภาพ: `/media/<id>` (จากคลัง) หรือ `/products/<slug>.png` (ไฟล์เดิมใน public) */
  readonly imageSrc: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly imageAlt: string;
  /** `null` = ไม่เป็นลิงก์ (ใช้ในพรีวิวหลังบ้าน) */
  readonly href: string | null;
};

/** ขนาดภาพการ์ด 3 คอลัมน์ — ใช้ค่าเดียวกับหน้าเว็บจริง */
const IMAGE_SIZES = "(min-width: 1024px) 320px, (min-width: 640px) 45vw, 80vw";

export function ProductCategoryCard(props: ProductCategoryCardProps) {
  const inner = (
    <>
      {/* ภาพโลโก้หมวดความกว้างคงที่ — ใช้ object-contain ไม่ครอปภาพ */}
      <span className="flex h-44 items-center justify-center rounded-xl border border-line bg-bg-subtle p-4">
        <Image
          src={props.imageSrc}
          alt={props.imageAlt}
          width={props.imageWidth}
          height={props.imageHeight}
          sizes={IMAGE_SIZES}
          className="h-full w-auto object-contain"
        />
      </span>

      <span className="mt-4 font-display text-base font-extrabold text-fg">{props.name}</span>
    </>
  );

  const cardClass =
    "group flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong";

  if (props.href === null) {
    return <div className={cardClass}>{inner}</div>;
  }

  return (
    <Link href={props.href} className={cardClass}>
      {inner}
    </Link>
  );
}

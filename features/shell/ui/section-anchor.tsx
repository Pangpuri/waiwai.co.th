"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { splitSectionHref } from "@/features/shell/section-href";

/**
 * ลิงก์ที่ **อาจชี้ไปยังส่วนในหน้าเดียวกัน** (เช่นปุ่ม "สั่งซื้อสินค้าออนไลน์" → `#where-to-buy`)
 *
 * ## ทำไมไม่ใช้ `<Link>` ตรง ๆ (รอบที่ 248 · 🐞 เคสจริงจากเจ้าของ)
 * *"หน้าแรกพัง 1 จุด ปุ่มสั่งซื้อสินค้าออนไลน์ ไม่วิ่งไปหาบล็อกสั่งซื้อสินค้า"*
 * `<Link>` = การนำทางฝั่งไคลเอนต์ ⇒ เมื่อปลายทางเป็น **หน้าเดิม** Next จะไม่ทำอะไรเลย
 * (ยิ่งถ้า URL มี `#where-to-buy` อยู่แล้วจากการกดครั้งก่อน ⇒ กดซ้ำไม่มีการนำทาง ⇒ **ไม่เลื่อน**)
 *
 * ⇒ ถ้าลิงก์นั้นชี้ไปส่วนของหน้าเดียวกัน ให้ใช้ `<a>` + `scrollIntoView()` เอง: เลื่อนแน่นอนทุกครั้ง
 *   (รวมกดซ้ำ) โดยไม่โหลดหน้าใหม่ · ถ้าเป็นคนละหน้า ปล่อยให้ `<Link>` นำทางตามปกติ (เร็ว + มี prefetch)
 *
 * ⚠️ เคารพ `prefers-reduced-motion` (ผู้ใช้ที่ปิดอนิเมชันต้องไม่โดนเลื่อนแบบนุ่ม)
 * ⚠️ `scroll-margin-top` ของปลายทางมีผลกับ `scrollIntoView()` (ใช้ `scroll-mt-40` ที่บล็อกนั้น)
 * ⚠️ ถ้าหาปลายทางไม่เจอ **ไม่กลืนคลิก** — ปล่อยให้เบราว์เซอร์ทำตาม `href` ตามเดิม
 */
export type SectionAnchorProps = {
  readonly href: string;
  readonly className?: string;
  /** ป้ายกำกับสำหรับ screen reader (ถ้าไม่ส่ง จะใช้ข้อความข้างใน) */
  readonly "aria-label"?: string;
  /** เรียกเมื่อกด (ใช้ปิดเมนูมือถือ) */
  readonly onNavigate?: (() => void) | undefined;
  readonly children: ReactNode;
};

export function SectionAnchor({ href, className, onNavigate, children, ...rest }: SectionAnchorProps) {
  const pathname = usePathname();
  const { path, hash } = splitSectionHref(href);
  const samePage = hash !== null && (path === "" || path === pathname);

  if (!samePage) {
    return (
      <Link href={href} className={className} onClick={onNavigate} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      className={className}
      {...rest}
      onClick={(event) => {
        const target = typeof document === "undefined" ? null : document.getElementById(hash);
        /* ไม่มีปลายทาง = ไม่แทรกแซง (เบราว์เซอร์จัดการตาม href) */
        if (target === null) {
          onNavigate?.();
          return;
        }
        event.preventDefault();
        const reduceMotion =
          typeof window !== "undefined" && typeof window.matchMedia === "function"
            ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
            : false;
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        /* เก็บ hash ไว้ใน URL โดยไม่ให้เบราว์เซอร์กระโดดซ้ำ */
        window.history.replaceState(null, "", href);
        onNavigate?.();
      }}
    >
      {children}
    </a>
  );
}

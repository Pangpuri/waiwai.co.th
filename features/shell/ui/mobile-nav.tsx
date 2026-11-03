"use client";

import Link from "next/link";

import { SectionAnchor } from "@/features/shell/ui/section-anchor";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { activeNavId, type NavLink } from "@/features/shell/nav";
import type { NavbarButtonView } from "@/lib/chrome/navbar-view";

import { NavIcon } from "./nav-icon";

type MobileNavProps = {
  readonly links: readonly NavLink[];
  readonly cta: NavLink;
  /** label ของแต่ละเมนู แปลแล้ว — ส่งมาจาก server */
  readonly labels: Readonly<Record<string, string>>;
  readonly toggleLabel: { readonly open: string; readonly close: string };
  /** ปุ่มจากหลังบ้าน (ถ้าไม่ส่งมา = ใช้ cta เดิม) */
  readonly buttons?: readonly NavbarButtonView[];
  /** true = หัวเว็บอยู่บนพื้นเข้ม/พื้นแดง (ปุ่มเปิดเมนูต้องเป็น on-brand) — รอบที่ 313 */
  readonly onDark?: boolean;
};

export function MobileNav({ links, cta, labels, toggleLabel, buttons, onDark = false }: MobileNavProps) {
  const actionButtons: readonly { readonly id: string; readonly href: string; readonly label: string; readonly className: string; readonly icon: NavbarButtonView["icon"] }[] =
    buttons === undefined || buttons.length === 0
      ? [{ id: cta.id, href: cta.href, label: labels[cta.id] ?? cta.id, className: "bg-brand-red text-on-brand", icon: "none" }]
      : buttons.map((button) => ({
          id: button.id,
          href: button.href,
          label: button.label,
          className: button.className,
          icon: button.icon,
        }));
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();
  const activeId = activeNavId(pathname, links);

  /*
    ปิดเมนูด้วย Escape + ล็อกการเลื่อนพื้นหลังขณะเปิด
    (เอฟเฟกต์นี้แตะ DOM จริง จึงไม่ผิดกฎ react-hooks/set-state-in-effect)
  */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      /* คืนโฟกัสที่ปุ่มเสมอ — ไม่งั้นโฟกัสค้างในแผงที่กำลังปิด (รอบที่ 321) */
      toggleRef.current?.focus();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className={[
          "grid h-10 w-10 place-items-center rounded-lg border transition-colors lg:hidden",
          onDark
            ? "border-on-brand/50 text-on-brand hover:bg-on-brand/10"
            : "border-line text-fg hover:bg-bg-subtle",
        ].join(" ")}
      >
        <span className="sr-only">{open ? toggleLabel.close : toggleLabel.open}</span>
        {/*
          ไอคอนสองชั้น (hamburger ↔ X) ไขว้กันด้วย rotate/scale/opacity
          — เดิมสลับ path ทันที ทำให้ดูกระตุกเวลาเปิด/ปิด (รอบที่ 321)
        */}
        <span aria-hidden="true" className="relative block h-5 w-5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={[
              "absolute inset-0 h-5 w-5 transition-[rotate,scale,opacity] duration-200 ease-out",
              open ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100",
            ].join(" ")}
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={[
              "absolute inset-0 h-5 w-5 transition-[rotate,scale,opacity] duration-200 ease-out",
              open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0",
            ].join(" ")}
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </span>
      </button>

      {/*
        เมนูตามเว็บเดิมมี 9 รายการ + ปุ่ม CTA จึงสูงกว่าจอเล็กได้
        · **อยู่ใน DOM ตลอด** เพื่อให้เปิด/ปิดด้วย transition ได้ (ไม่ unmount แล้วกระพริบ)
        · ปิด = opacity 0 + เลื่อนขึ้นเล็กน้อย + pointer-events-none + inert (โฟกัสไม่เข้า)
        · ตัว panel เลื่อนเองได้ เพราะระหว่างเปิดเมนูเราล็อกการเลื่อนของ body ไว้
      */}
      <div
        id="mobile-nav-panel"
        data-state={open ? "open" : "closed"}
        aria-hidden={!open}
        inert={!open}
        className={[
          "absolute inset-x-0 top-full max-h-[80dvh] origin-top overflow-y-auto border-b border-line bg-surface shadow-lg lg:hidden",
          "transition-[opacity,translate] duration-200 ease-out",
          open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
        ].join(" ")}
      >
        <ul className="container-site flex flex-col gap-1 py-4">
          {links.map((link) => {
            const active = link.id === activeId;
            return (
              <li key={link.id}>
                <Link
                  href={link.href}
                  // ปิดเมนูตอนกด แทนการเฝ้าดู pathname ด้วยเอฟเฟกต์
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "block rounded-xl px-4 py-3 text-base font-medium transition-colors",
                    active ? "bg-bg-subtle text-accent" : "text-fg hover:bg-bg-subtle",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <NavIcon name={link.icon ?? "none"} />
                    {labels[link.id] ?? link.id}
                  </span>
                </Link>
              </li>
            );
          })}
          {actionButtons.map((button) => (
            <li key={button.id} className="pt-2">
              {/* ⚠️ ปุ่ม CTA อาจชี้ไปส่วนในหน้าเดียวกัน (#where-to-buy) — ต้องใช้ SectionAnchor (รอบที่ 248) */}
              <SectionAnchor
                href={button.href}
                onNavigate={() => setOpen(false)}
                className={`flex items-center justify-center gap-2 rounded-full px-4 py-3 text-center text-base font-semibold ${button.className}`}
              >
                <NavIcon name={button.icon} />
                {button.label}
              </SectionAnchor>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

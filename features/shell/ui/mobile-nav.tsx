"use client";

import Link from "next/link";

import { SectionAnchor } from "@/features/shell/ui/section-anchor";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
};

export function MobileNav({ links, cta, labels, toggleLabel, buttons }: MobileNavProps) {
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
  const pathname = usePathname();
  const activeId = activeNavId(pathname, links);

  /*
    ปิดเมนูด้วย Escape + ล็อกการเลื่อนพื้นหลังขณะเปิด
    (เอฟเฟกต์นี้แตะ DOM จริง จึงไม่ผิดกฎ react-hooks/set-state-in-effect)
  */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
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
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="grid h-10 w-10 place-items-center rounded-lg border border-line text-fg transition-colors hover:bg-bg-subtle lg:hidden"
      >
        <span className="sr-only">{open ? toggleLabel.close : toggleLabel.open}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-5 w-5"
        >
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open ? (
        // เมนูตามเว็บเดิมมี 9 รายการ + ปุ่ม CTA จึงสูงกว่าจอเล็กได้
        // ตัว panel ต้องเลื่อนเองได้ เพราะระหว่างเปิดเมนูเราล็อกการเลื่อนของ body ไว้
        <div
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-full max-h-[80dvh] overflow-y-auto border-b border-line bg-surface shadow-lg lg:hidden"
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
      ) : null}
    </>
  );
}

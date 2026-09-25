"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { activeNavId, type NavLink } from "@/features/shell/nav";

type MobileNavProps = {
  readonly links: readonly NavLink[];
  readonly cta: NavLink;
  /** label ของแต่ละเมนู แปลแล้ว — ส่งมาจาก server */
  readonly labels: Readonly<Record<string, string>>;
  readonly toggleLabel: { readonly open: string; readonly close: string };
};

export function MobileNav({ links, cta, labels, toggleLabel }: MobileNavProps) {
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
                    {labels[link.id] ?? link.id}
                  </Link>
                </li>
              );
            })}
            <li className="pt-2">
              <Link
                href={cta.href}
                onClick={() => setOpen(false)}
                className="block rounded-full bg-brand-red px-4 py-3 text-center text-base font-semibold text-on-brand"
              >
                {labels[cta.id] ?? cta.id}
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </>
  );
}

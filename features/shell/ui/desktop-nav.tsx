"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { activeNavId, type NavLink } from "@/features/shell/nav";

type DesktopNavProps = {
  readonly links: readonly NavLink[];
  readonly labels: Readonly<Record<string, string>>;
  readonly ariaLabel: string;
};

/**
 * เมนูแนวนอนสำหรับจอใหญ่ — เป็น client เพราะต้องรู้ path ปัจจุบันเพื่อทำ active state
 *
 * เมนูตามเว็บเดิมมี 9 รายการ จึงใช้ `flex-wrap` ให้ตกรอบเป็นบรรทัดใหม่ได้
 * แทนที่จะดันล้นจอแนวนอน (ตรวจด้วยการวัด `scrollWidth == clientWidth`)
 * และเลือก active ด้วย `activeNavId` ให้ได้เมนูเดียว ไม่ซ้ำกับเมนูแม่
 */
export function DesktopNav({ links, labels, ariaLabel }: DesktopNavProps) {
  const pathname = usePathname();
  const activeId = activeNavId(pathname, links);

  return (
    <nav aria-label={ariaLabel} className="hidden lg:block">
      <ul className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {links.map((link) => {
          const active = link.id === activeId;
          return (
            <li key={link.id}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative block whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-accent" : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
                ].join(" ")}
              >
                {labels[link.id] ?? link.id}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-red"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

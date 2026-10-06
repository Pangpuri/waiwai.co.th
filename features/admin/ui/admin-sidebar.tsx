"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * เมนูด้านข้างของหลังบ้าน (รอบที่ 156) — จัดกลุ่ม + เปิด/ปิดได้
 *
 * เหตุผล (คำสั่งเจ้าของ): เมนูเดิมเป็นแถวเดียว 16 ลิงก์ ⇒ ผู้ดูแลหาไม่เจอ
 *   ⇒ ย้ายมาเป็น Sidebar ด้านซ้าย จัดกลุ่ม "เนื้อหาเว็บไซต์ → จัดการข้อมูล → ระบบ"
 *   ⚠️ **navbar ด้านบนยังอยู่** (เจ้าของสั่งให้เก็บไว้ก่อน แล้วค่อยประเมินทีหลังว่าอันไหนซ้ำ/ตัดได้)
 *
 * รายการที่เห็นถูกกรองด้วยสิทธิ์แล้วจากฝั่งเซิร์ฟเวอร์ (layout) — ที่นี่แค่แสดงผล
 * ปุ่มเปิด/ปิดใช้ `aria-expanded` · จำสถานะไว้ใน localStorage (อ่านหลัง mount เท่านั้น จึงไม่มีปัญหา hydration)
 */

export type AdminNavItem = { readonly href: string; readonly label: string };
export type AdminNavGroup = { readonly id: string; readonly label: string; readonly items: readonly AdminNavItem[] };
export type AdminSidebarStrings = {
  readonly toggleOpen: string;
  readonly toggleClose: string;
  readonly navLabel: string;
  readonly roleHint: string;
};

const STORAGE_KEY = "waiwai_admin_sidebar_open";

export function AdminSidebar({ groups, strings }: { readonly groups: readonly AdminNavGroup[]; readonly strings: AdminSidebarStrings }) {
  /* ค่าเริ่มต้น = เปิด (ฝั่งเซิร์ฟเวอร์/ไคลเอนต์ตรงกัน ⇒ ไม่มี hydration mismatch) */
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  const toggle = (): void => {
    setOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* โหมดส่วนตัว/ปิด localStorage — ไม่เป็นไร แค่จำสถานะไม่ได้ */
      }
      return next;
    });
  };

  const isActive = (href: string): boolean => pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));

  return (
    <aside
      aria-label={strings.navLabel}
      className={
        open
          ? "border-line bg-surface w-full shrink-0 border-b px-3 py-3 lg:sticky lg:top-0 lg:h-dvh lg:w-72 lg:overflow-y-auto lg:border-r lg:border-b-0"
          : "border-line bg-surface w-full shrink-0 border-b px-3 py-2 lg:sticky lg:top-0 lg:h-dvh lg:w-14 lg:overflow-y-auto lg:border-r lg:border-b-0"
      }
    >
      <div className="flex items-center justify-between gap-2">
        {open ? <span className="text-fg-muted text-xs font-semibold uppercase">{strings.navLabel}</span> : null}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? strings.toggleClose : strings.toggleOpen}
          title={open ? strings.toggleClose : strings.toggleOpen}
          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring ms-auto rounded-lg border px-2 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {open ? "«" : "»"}
        </button>
      </div>

      {open ? (
        <nav className="mt-3 flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="text-fg-muted px-1 text-xs font-semibold tracking-wide uppercase">{group.label}</p>
              <ul className="mt-1 flex flex-col">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className={
                        isActive(item.href)
                          ? "bg-brand-red text-on-brand block rounded-lg px-2 py-1.5 text-sm font-semibold"
                          : "text-fg hover:bg-surface-raised block rounded-lg px-2 py-1.5 text-sm"
                      }
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-fg-muted px-1 text-xs">{strings.roleHint}</p>
        </nav>
      ) : null}
    </aside>
  );
}

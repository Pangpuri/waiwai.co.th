"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * เมนูด้านข้างของหลังบ้าน (รอบที่ 156–157)
 *
 * รอบที่ 157 (ฟีดแบ็กเจ้าของ): "เปิดปิดไม่สมูท อย่าเลียนแบบ PHP" + "เอาไอค่อนมาช่วย"
 *   · **พับเก็บแล้วยังมีไอคอน** ⇒ รู้ว่าเป็นเมนูอะไร และรู้ว่ากดเปิดได้
 *   · **ลื่น**: ปรับความกว้างด้วย `transition-[width]` · ป้ายชื่อค่อย ๆ จาง (`opacity`)
 *     · ไม่ unmount เมนู (เดิมใช้ `{open ? <nav/> : null}` ⇒ กระพริบ/กระโดด)
 *   · ปุ่มลูกศรหมุน (`rotate-180`) + `aria-expanded` · มี `title` ทุกไอคอนตอนพับ
 *   · จำสถานะไว้ใน localStorage แบบอ่านฝั่งไคลเอนต์อย่างเดียว (ค่าเริ่มต้น = เปิด ⇒ ไม่มี hydration mismatch)
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

/** ไอคอนเส้น (stroke) 24×24 — ใช้ `currentColor` จึงเปลี่ยนสีตามธีม/token ได้ */
const ICONS: Readonly<Record<string, string>> = {
  chrome: "M3 5h18v4H3zM3 11h8v8H3zM13 11h8v8h-8z",
  home: "M4 11 12 4l8 7v9H4zM9 20v-6h6v6",
  about: "M4 21V6l7-3v18M11 21h9V10l-4-2M7 9v0M7 13v0M7 17v0",
  executives: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 20c0-3 2.2-5 5-5s5 2 5 5M14 20c0-2.2 1.4-3.8 3.5-3.8S21 17.8 21 20",
  products: "M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9",
  recipes: "M4 3v8a3 3 0 0 0 6 0V3M7 11v10M17 3c-1.7 1.2-2.5 3-2.5 5.2 0 1.6.8 2.8 2.5 3.3V21",
  news: "M4 5h11v14H4zM15 9h5v10h-5M7 9h5M7 13h5M7 17h3",
  careers: "M3 8h18v12H3zM9 8V5h6v3M3 13h18",
  contact: "M3 6h18v12H3zM3 7l9 6 9-6",
  media: "M3 5h18v14H3zM3 15l5-4 4 3 3-3 6 5M8.5 9.5v0",
  inbox: "M3 13h5l1 2h6l1-2h5M3 13 5 5h14l2 8v6H3z",
  sort: "M8 4v16M8 20l-3-3M8 4l3 3M16 20V4M16 4l3 3M16 20l-3-3",
  preview: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6",
  fields: "M4 7h16M4 12h16M4 17h10",
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  activity: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 12h2M19 12h2M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4",
  users: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-3.3 3.6-5.5 8-5.5s8 2.2 8 5.5",
  chevron: "M9 6l6 6-6 6",
};

function iconFor(href: string): string {
  const key = href.replace("/admin", "").replace(/^\//, "");
  if (key === "" || key === "login") return ICONS.dashboard ?? "";
  const first = key.split("/")[0] ?? "";
  if (first === "builder" || first === "content") {
    const page = key.split("/")[1] ?? "";
    if (page === "chrome" || page === "mourning" || page === "navbar" || page === "footer") return ICONS.chrome ?? "";
    if (page === "home") return ICONS.home ?? "";
    if (page === "about") return ICONS.about ?? "";
    if (page === "executives") return ICONS.executives ?? "";
    if (page === "careers") return ICONS.careers ?? "";
    if (page === "contact") return ICONS.contact ?? "";
    return ICONS.fields ?? "";
  }
  return ICONS[first] ?? ICONS.fields ?? "";
}

function Icon({ path, className }: { readonly path: string; readonly className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-4 w-4 shrink-0"}
    >
      <path d={path} />
    </svg>
  );
}

export function AdminSidebar({ groups, strings }: { readonly groups: readonly AdminNavGroup[]; readonly strings: AdminSidebarStrings }) {
  /* ค่าเริ่มต้น = เปิดทั้งสองฝั่ง (เซิร์ฟเวอร์/ไคลเอนต์ตรงกัน) แล้วอ่านค่าที่จำไว้หลังผู้ใช้กดเอง */
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  const toggle = (): void => {
    setOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* โหมดส่วนตัว/ปิด localStorage — แค่จำสถานะไม่ได้ ไม่กระทบการใช้งาน */
      }
      return next;
    });
  };

  const isActive = (href: string): boolean => pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));

  return (
    <aside
      aria-label={strings.navLabel}
      className={[
        "border-line bg-surface shrink-0 border-b lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0 lg:overflow-x-hidden lg:overflow-y-auto",
        /* ลื่น: ปรับความกว้างด้วย transition (ไม่ unmount เมนู ⇒ ไม่กระพริบแบบรีโหลดทั้งหน้า) */
        "transition-[width] duration-300 ease-in-out",
        open ? "w-full lg:w-72" : "w-full lg:w-16",
      ].join(" ")}
    >
      <div className={open ? "flex items-center justify-between gap-2 px-3 py-3" : "flex items-center justify-center px-2 py-3"}>
        <span
          className={[
            "text-fg-muted text-xs font-semibold whitespace-nowrap uppercase transition-opacity duration-200",
            open ? "opacity-100" : "pointer-events-none hidden opacity-0",
          ].join(" ")}
        >
          {strings.navLabel}
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? strings.toggleClose : strings.toggleOpen}
          title={open ? strings.toggleClose : strings.toggleOpen}
          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border p-1.5 focus-visible:ring-2 focus-visible:outline-none"
        >
          {/* ลูกศรหมุนตามสถานะ (สื่อว่าเปิด/ปิดได้) */}
          <Icon path={ICONS.chevron ?? ""} className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      <nav className={open ? "flex flex-col gap-4 px-3 pb-4" : "flex flex-col gap-3 px-2 pb-4"}>
        {groups.map((group) => (
          <div key={group.id}>
            <p
              className={[
                "text-fg-muted px-1 text-[0.65rem] font-semibold tracking-wide whitespace-nowrap uppercase transition-opacity duration-200",
                open ? "opacity-100" : "hidden",
              ].join(" ")}
            >
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "flex items-center rounded-lg transition-colors duration-150",
                        open ? "gap-2.5 px-2 py-1.5" : "justify-center px-0 py-2",
                        active ? "bg-brand-red text-on-brand font-semibold" : "text-fg hover:bg-surface-raised",
                      ].join(" ")}
                    >
                      <Icon path={iconFor(item.href)} />
                      <span
                        className={[
                          "truncate text-sm whitespace-nowrap transition-opacity duration-200",
                          open ? "opacity-100" : "hidden",
                        ].join(" ")}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {open ? <p className="text-fg-muted px-1 text-xs">{strings.roleHint}</p> : null}
      </nav>
    </aside>
  );
}

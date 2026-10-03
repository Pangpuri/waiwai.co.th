import Link from "next/link";

import { pageLabel, type PageRecord } from "@/lib/pages/model";

/**
 * แถบแท็บ "หน้า" ของหลังบ้าน (W1 — แบบ WordPress: เลือกหน้าแล้วแก้หน้านั้น)
 *
 * ผู้ใช้สั่ง รอบที่ 61: *"ทำแบบแท็บก็ได้ครับ แยกส่วนของแต่ละหน้าเป็นส่วน ๆ"*
 * - เป็น Server Component (แค่ `<Link>`) ⇒ ไม่เพิ่ม JS ให้หลังบ้าน
 * - ชื่อบนแท็บมาจากฐานข้อมูล ⇒ เปลี่ยนชื่อหน้าแล้วเห็นทันที
 */

export function PageTabs({
  pages,
  activeId,
  label,
  strings,
}: {
  readonly pages: readonly PageRecord[];
  readonly activeId: string | null;
  readonly label: string;
  readonly strings: {
    readonly pageHiddenFromMenu: string;
  };
}) {
  return (
    <nav aria-label={label} className="flex flex-col gap-2">
      <p className="text-fg-muted text-xs font-semibold uppercase">{label}</p>
      <ul className="flex flex-wrap gap-1.5">
        {pages.map((page) => {
          const active = page.id === activeId;
          return (
            <li key={page.id}>
              <Link
                href={`/admin/builder/${page.id}`}
                aria-current={active ? "page" : undefined}
                title={page.inMenu ? pageLabel(page, "th") : `${pageLabel(page, "th")} · ${strings.pageHiddenFromMenu}`}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none ${
                  active ? "bg-brand-red text-on-brand" : "border-line text-fg border hover:bg-surface-raised"
                }`}
              >
                {pageLabel(page, "th")}
                {page.inMenu ? null : (
                  <span aria-hidden="true" className={active ? "text-on-brand/70" : "text-fg-muted"}>
                    ⌀
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "../globals.css";

import { getSessionUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * Layout ของหลังบ้าน — เป็น layout ชั้นนอกสุดของเส้นทาง `/admin`
 *
 * จุดที่ตั้งใจให้ต่างจากหน้าเว็บสาธารณะ
 * - **ไม่ใช้ header/footer/ป๊อปอัพของเว็บสาธารณะ** (หลังบ้านเป็นเครื่องมือ ไม่ใช่หน้าบ้าน)
 * - **ตั้ง `robots: noindex`** — เครื่องค้นหาไม่ต้องรู้ว่ามีหน้าล็อกอินอยู่ (กติกาใน DoD ข้อ "ตรวจมือ")
 * - **ไม่เติม prefix ภาษาใน URL** — `lib/i18n/config.ts` มี `/admin` อยู่ใน `PROXY_BYPASS_PREFIXES` แล้ว
 * - ใช้พจนานุกรมชุดไทย (ผู้ใช้หลังบ้านเป็นทีมพนักงานไทย) · `areas/en/admin.ts` เตรียมไว้เมื่อต้องการสลับภาษา
 *
 * แถบเมนูด้านบน (เพิ่มรอบที่ 37 ตามคำถามผู้ใช้ "คลิกที่ในหน้าตั้งค่าได้เลยไหม")
 * - ให้ **คลิกจากทุกหน้าจอหลังบ้าน** ไปยังหน้าจอแก้ไขต่าง ๆ ได้ ไม่ต้องพิมพ์ URL เอง
 * - แสดงเฉพาะเมื่อ **ล็อกอินแล้ว** ⇒ หน้า `/admin/login` ไม่มีเมนู (ไม่ชวนสับสน)
 */
export async function generateMetadata(): Promise<Metadata> {
  const messages = await getMessagesFor("th");
  return {
    title: messages.admin.brand,
    description: messages.admin.loginTitle,
    robots: { index: false, follow: false },
  };
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const messages = await getMessagesFor("th");
  const user = await getSessionUser();

  const links = [
    { href: "/admin", label: messages.admin.dashboardTitle },
    { href: "/admin/builder/chrome", label: messages.admin.chromeTitle },
    { href: "/admin/builder/home", label: messages.admin.builderTitle },
    { href: "/admin/builder/mourning", label: messages.admin.mourningTitle },
    { href: "/admin/content/home", label: messages.admin.contentTitle },
    { href: "/admin/inbox", label: messages.admin.inboxTitle },
    { href: "/admin/media", label: messages.admin.mediaTitle },
    { href: "/admin/trash", label: messages.admin.trashTitle },
    { href: "/admin/preview-links", label: messages.admin.previewLinkTitle },
    { href: "/admin/settings", label: messages.admin.settingsTitle },
  ];

  return (
    <html lang="th">
      <body className="bg-bg-cream text-fg min-h-dvh antialiased">
        {user === null ? null : (
          <nav aria-label={messages.admin.dashboardTitle} className="border-line bg-surface border-b">
            <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-2 px-4 py-2">
              <span className="text-fg-muted mr-1 text-xs font-semibold uppercase">{messages.admin.brand}</span>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  {link.label}
                </Link>
              ))}
              <span className="text-fg-muted ml-auto text-xs">{user.email}</span>
            </div>
          </nav>
        )}
        {children}
      </body>
    </html>
  );
}

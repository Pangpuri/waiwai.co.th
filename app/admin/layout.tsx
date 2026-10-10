import type { Metadata } from "next";
import type { ReactNode } from "react";

import "../globals.css";

import { roleLabelOf } from "@/features/admin/rbac-labels";
import { AdminSidebar, type AdminNavGroup } from "@/features/admin/ui/admin-sidebar";
import { MaintenanceBypassPing } from "@/features/admin/ui/maintenance-bypass-ping";
import { getSessionUser } from "@/lib/auth/dal";
import { can, type AdminPermission } from "@/lib/auth/roles";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { isMaintenanceEnabled } from "@/lib/maintenance/plan";

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

  /*
    เมนูด้านข้าง (รอบที่ 156 · คำสั่งเจ้าของ) — จัดกลุ่มตามลำดับ: เนื้อหาเว็บไซต์ → จัดการข้อมูล → ระบบ
    ⚠️ navbar ด้านบนยังอยู่ (เจ้าของสั่งเก็บไว้ก่อน แล้วค่อยประเมินว่าส่วนไหนซ้ำ/ตัดได้)
    ⚠️ ที่นี่ลิสต์ครบ — ตัวกรองสิทธิ์ทำด้านล่าง (`can`) เหมือนเมนูบน
  */
  const sidebarGroups: readonly AdminNavGroup[] = [
    {
      id: "content",
      label: messages.admin.navGroupContent,
      items: [
        { href: "/admin/builder/chrome", label: messages.admin.navChrome },
        { href: "/admin/builder/mourning", label: messages.admin.navMourning },
        { href: "/admin/hero", label: messages.admin.navHero },
        { href: "/admin/builder/home", label: messages.admin.navHome },
        { href: "/admin/builder/about", label: messages.admin.navAbout },
        { href: "/admin/builder/executives", label: messages.admin.navExecutives },
        { href: "/admin/products", label: messages.admin.navProducts },
        { href: "/admin/recipes", label: messages.admin.navRecipes },
        { href: "/admin/news", label: messages.admin.navNews },
        { href: "/admin/builder/careers", label: messages.admin.navCareers },
        { href: "/admin/builder/contact", label: messages.admin.navContact },
        /* รอบที่ 260 (จัดระเบียบเมนู): จอนี้แก้เนื้อหาหน้าแรกแบบฟิลด์ (เลย์เอาต์เดิม) ⇒ อยู่กลุ่ม "เนื้อหาเว็บไซต์" ไม่ใช่ "จัดการข้อมูล" */
        { href: "/admin/content/home", label: messages.admin.navStructured },
      ],
    },
    {
      id: "data",
      label: messages.admin.navGroupData,
      items: [
        { href: "/admin/media", label: messages.admin.mediaTitle },
        { href: "/admin/inbox", label: messages.admin.inboxTitle },
        { href: "/admin/sort", label: messages.admin.sortNavLabel },
        { href: "/admin/preview-links", label: messages.admin.previewLinkTitle },
        { href: "/admin/trash", label: messages.admin.trashTitle },
      ],
    },
    {
      id: "system",
      label: messages.admin.navGroupSystem,
      items: [
        { href: "/admin", label: messages.admin.dashboardTitle },
        { href: "/admin/activity", label: messages.admin.activityTitle },
        { href: "/admin/settings", label: messages.admin.settingsTitle },
        { href: "/admin/users", label: messages.admin.rbacUsersTitle },
      ],
    },
  ];

  /* สิทธิ์ของแต่ละลิงก์ในเมนูด้านข้าง (ให้ตรงกับเมนูด้านบน — ซ่อนเฉพาะที่ไม่ควรกด ไม่ใช่มาตรการความปลอดภัย) */
  const sidebarPermission: Readonly<Record<string, AdminPermission>> = {
    "/admin/builder/chrome": "presets",
    "/admin/builder/mourning": "presets",
    "/admin/media": "media",
    "/admin/inbox": "inbox",
    "/admin/preview-links": "preview",
    "/admin/trash": "trash",
    "/admin/settings": "settings",
    "/admin/users": "users",
    "/admin/sort": "content",
  };

  const visibleGroups: readonly AdminNavGroup[] = sidebarGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => user !== null && can(user.role, sidebarPermission[item.href] ?? "content")),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <html lang="th">
      <body className="bg-bg-cream text-fg min-h-dvh antialiased">
        {/* ต่ออายุ "บัตรผ่านดูเว็บระหว่างปิดปรับปรุง" — ทำงานเฉพาะเมื่อเปิดโหมด (รอบที่ 96) */}
        <MaintenanceBypassPing enabled={user !== null && isMaintenanceEnabled(process.env)} />
        {user === null ? (
          children
        ) : (
          /* Sidebar ด้านซ้าย (รอบที่ 156) + เนื้อหาด้านขวา — หน้าล็อกอิน (user = null) ไม่มีเมนู */
          <div className="flex flex-col lg:flex-row lg:items-start">
            <AdminSidebar
              groups={visibleGroups}
              strings={{
                toggleOpen: messages.admin.navToggleOpen,
                toggleClose: messages.admin.navToggleClose,
                navLabel: messages.admin.navLabel,
                roleHint: messages.admin.navRoleHint,
                /* รอบที่ 242: ย้ายจากแถบด้านบนที่ถูกถอดออก (กันข้อมูลบัญชีหาย) */
                brand: messages.admin.brand,
                account: `${user.email} · ${roleLabelOf(user.role, messages.admin)}`,
              }}
            />
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        )}
      </body>
    </html>
  );
}

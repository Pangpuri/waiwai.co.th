import Link from "next/link";

import { roleLabelOf } from "@/features/admin/rbac-labels";
import { requireAdminUser } from "@/lib/auth/dal";
import { can, permissionsOf, type AdminPermission } from "@/lib/auth/roles";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";

/**
 * หน้าคู่มือการใช้งานระบบหลังบ้าน (Backend User Manual & RBAC Guide)
 * ข้อความทั้งหมดมาจากพจนานุกรม (TH/EN) — ห้ามฝังข้อความไทยในไฟล์นี้
 */

/* สีของป้ายบทบาท — ใช้ token เท่านั้นเพื่อให้โหมดมืดทำงาน */
const ROLE_BADGE_CLASSES = [
  "bg-accent/10 text-accent",
  "bg-brand-yellow/20 text-accent-on-yellow",
  "bg-fg/10 text-fg",
  "bg-bg-muted text-fg",
] as const;

export default async function AdminManualPage() {
  const user = await requireAdminUser("manual");
  const messages = await getMessagesFor("th");
  const strings = messages.admin;
  const m = messages.adminManual.manualPage;

  const userRoleLabel = roleLabelOf(user.role, strings);
  const userPermissions = permissionsOf(user.role);
  const accessCount = fillTemplate(m.accessCount, { count: userPermissions.length });

  const quickLinks: readonly {
    readonly label: string;
    readonly href: string;
    readonly perm: AdminPermission;
  }[] = [
    { label: m.links.dashboard, href: "/admin", perm: "content" },
    { label: m.links.home, href: "/admin/builder/home", perm: "presets" },
    { label: m.links.products, href: "/admin/products", perm: "content" },
    { label: m.links.media, href: "/admin/media", perm: "media" },
    { label: m.links.inbox, href: "/admin/inbox", perm: "inbox" },
    { label: m.links.trash, href: "/admin/trash", perm: "trash" },
    { label: m.links.careers, href: "/admin/careers", perm: "careers" },
    { label: m.links.settings, href: "/admin/settings", perm: "settings" },
    { label: m.links.users, href: "/admin/users", perm: "users" },
  ];

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
              {strings.brand} · {m.brandSuffix}
            </p>
            <h1 className="text-fg text-2xl font-bold sm:text-3xl">{m.title}</h1>
          </div>
          <Link
            href="/admin"
            className="border-line bg-surface-hover text-fg rounded-xl border px-4 py-2 text-sm font-medium transition"
          >
            ← {m.back}
          </Link>
        </div>
        <p className="text-fg-muted text-sm leading-relaxed">{m.intro}</p>

        <div className="border-line bg-bg-muted mt-2 flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-fg-muted text-xs">{m.accountLabel}</span>
            <span className="text-fg text-sm font-semibold">{user.email}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-fg-muted text-xs">{m.roleLabel}</span>
            <span className="text-accent text-sm font-bold">{userRoleLabel}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-fg-muted text-xs">{m.accessLabel}</span>
            <span className="text-fg text-sm font-medium">{accessCount}</span>
          </div>
        </div>
      </header>

      <section className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-6 shadow-sm">
        <h2 className="text-fg flex items-center gap-2 text-xl font-bold">
          <span className="bg-accent/10 text-accent flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">1</span>
          {m.architectureTitle}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {m.concepts.map((concept) => (
            <div key={concept.title} className="border-line bg-bg-muted/50 rounded-xl border p-4">
              <h3 className="text-fg mb-1 font-semibold">{concept.title}</h3>
              <p className="text-fg-muted text-xs leading-relaxed">{concept.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-line bg-surface flex flex-col gap-6 rounded-2xl border p-6 shadow-sm">
        <h2 className="text-fg flex items-center gap-2 text-xl font-bold">
          <span className="bg-accent/10 text-accent flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">2</span>
          {m.rolesTitle}
        </h2>
        <p className="text-fg-muted text-sm">{m.rolesIntro}</p>

        <div className="flex flex-col gap-6">
          {m.roles.map((role, index) => (
            <div key={role.name} className="border-line bg-bg-muted/30 rounded-xl border p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`${ROLE_BADGE_CLASSES[index] ?? ROLE_BADGE_CLASSES[0]} rounded-md px-2.5 py-1 text-xs font-bold uppercase`}
                  >
                    {role.name}
                  </span>
                  <span className="text-fg-muted text-xs">{role.scope}</span>
                </div>
                <span className="bg-surface border-line rounded border px-2.5 py-1 text-xs font-semibold">
                  {role.permissions}
                </span>
              </div>
              <p className="text-fg mb-3 text-sm">
                <b>{m.scopeLabel}</b> {role.body}
              </p>
              <div className="text-fg-muted grid gap-2 text-xs sm:grid-cols-2">
                {role.can.map((item) => (
                  <div key={item} className="bg-surface border-line rounded-lg border p-2.5">
                    ✓ {item}
                  </div>
                ))}
                {role.cannot.map((item) => (
                  <div key={item} className="bg-surface border-line rounded-lg border p-2.5">
                    ✗ {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-line bg-surface flex flex-col gap-4 rounded-2xl border p-6 shadow-sm">
        <h2 className="text-fg flex items-center gap-2 text-xl font-bold">
          <span className="bg-accent/10 text-accent flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">3</span>
          {m.quickLinksTitle}
        </h2>
        <p className="text-fg-muted text-sm">{m.quickLinksIntro}</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-line text-fg-muted border-b text-xs tracking-wider uppercase">
              <tr>
                <th className="px-3 py-3">{m.tableModule}</th>
                <th className="px-3 py-3">{m.tablePath}</th>
                <th className="px-3 py-3">{m.tablePermission}</th>
                <th className="px-3 py-3 text-right">{m.tableAction}</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y text-xs sm:text-sm">
              {quickLinks
                .filter((item) => can(user.role, item.perm))
                .map((item) => (
                  <tr key={item.href}>
                    <td className="px-3 py-3 font-semibold">{item.label}</td>
                    <td className="text-fg-muted px-3 py-3 font-mono">{item.href}</td>
                    <td className="px-3 py-3">{item.perm}</td>
                    <td className="px-3 py-3 text-right">
                      <Link href={item.href} className="text-accent font-medium hover:underline">
                        {m.open} →
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

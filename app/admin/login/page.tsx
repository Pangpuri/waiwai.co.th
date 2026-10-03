import { redirect } from "next/navigation";

import { LoginForm } from "@/features/admin/ui/login-form";
import { getSessionUser, isAdminConfigured } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * หน้าล็อกอินหลังบ้าน — Server Component
 *
 * - ล็อกอินอยู่แล้ว → เด้งไป `/admin` (ไม่ต้องเห็นฟอร์มอีก)
 * - ยังตั้งค่า env ไม่ครบ → แสดงวิธีตั้งค่า (ไม่ใช่ฟอร์มที่กดแล้วเงียบ)
 * - ข้อความทั้งหมดมาจากพจนานุกรม (`th`) จึงไม่มีข้อความไทยในไฟล์นี้
 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser();
  if (user !== null) redirect("/admin");

  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  const params = await searchParams;
  const emailParam = params.email;
  const defaultEmail = typeof emailParam === "string" ? emailParam : "";
  const configured = isAdminConfigured();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-fg-muted text-xs font-medium tracking-wide uppercase">{strings.brand}</p>
        <h1 className="text-fg text-2xl font-bold">{strings.loginTitle}</h1>
        <p className="text-fg-muted text-sm">{strings.loginIntro}</p>
      </header>

      {configured ? (
        <section className="border-line bg-surface rounded-2xl border p-5 sm:p-6">
          <LoginForm strings={strings} defaultEmail={defaultEmail} />
        </section>
      ) : (
        <section className="border-line bg-surface-raised flex flex-col gap-3 rounded-2xl border p-5 sm:p-6">
          <h2 className="text-fg text-lg font-semibold">{strings.setupTitle}</h2>
          <p className="text-fg-muted text-sm">{strings.setupBody}</p>
          <code className="border-line bg-bg-subtle text-fg block overflow-x-auto rounded-xl border px-3 py-2 text-xs">
            {strings.setupCommand}
          </code>
        </section>
      )}
    </main>
  );
}

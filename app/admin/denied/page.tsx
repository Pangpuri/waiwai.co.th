import Link from "next/link";

import { requireAdminUser } from "@/lib/auth/dal";
import { roleLabelOf } from "@/features/admin/rbac-labels";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";

/**
 * หน้า "บัญชีนี้ไม่มีสิทธิ์" (X1.10 · RBAC)
 *
 * ทำไมต้องมีหน้าแยก (ไม่ใช่เด้งกลับหน้าภาพรวมเงียบ ๆ)
 * - ผู้ใช้ต้องรู้ว่า **ระบบทำงานถูกต้อง** (บทบาทไม่พอ) ไม่ใช่ระบบพัง/ล็อกอินหลุด
 *   ⇒ บอกบทบาทปัจจุบัน + ทางกลับ + ช่องทางขอสิทธิ์
 * - และไม่เปิดเผยว่ามีอะไรอยู่ในส่วนที่ไม่มีสิทธิ์ (ไม่ list เมนูที่เข้าไม่ได้)
 *
 * หมายเหตุ: ใช้สิทธิ์ `content` เป็น "ประตูขั้นต่ำ" — ทุกบทบาทมีสิทธิ์นี้ ⇒ เข้าหน้านี้ได้เสมอเมื่อล็อกอินแล้ว
 */
export default async function AdminDeniedPage() {
  const user = await requireAdminUser("content");
  const strings = (await getMessagesFor("th")).admin;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-12">
      <section className="border-line bg-surface-raised flex flex-col gap-3 rounded-2xl border p-6">
        <h1 className="text-fg text-xl font-bold">{strings.deniedTitle}</h1>
        <p className="text-fg-muted text-sm">{strings.deniedBody}</p>
        <p className="text-fg-muted text-sm">
          {fillTemplate(strings.deniedYourRole, { role: roleLabelOf(user.role, strings) })}
        </p>
        <Link
          href="/admin"
          className="bg-brand-red text-on-brand focus-visible:ring-ring w-fit rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {strings.deniedBack}
        </Link>
      </section>
    </main>
  );
}

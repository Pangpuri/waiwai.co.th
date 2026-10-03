import Link from "next/link";

import { auditActionLabel, auditStamp } from "@/features/admin/audit-labels";
import { listAuditForActor } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";

/**
 * หน้า **"กิจกรรมของฉัน"** (B3 · รอบที่ 90)
 *
 * ทำไมต้องมี
 * - เดิมตาราง `audit_log` ถูกเขียนจริงทุกครั้งที่ล็อกอิน/เผยแพร่/ลบ แต่ **ดูได้แค่ 8 บรรทัดล่าสุดของทั้งระบบ**
 * - เจ้าหน้าที่ควรตรวจสอบ "ตัวเองทำอะไรไปบ้าง" ได้ (โดยเฉพาะหลังกดเผยแพร่/ลบข้อมูล) โดยไม่ต้องรบกวนผู้ดูแลระบบ
 *
 * หลักการ
 * - เห็นเฉพาะร่องรอยที่ **ตัวเองเป็นผู้กระทำ** (`listAuditForActor` เทียบอีเมลแบบ normalize)
 * - ไม่มีตารางใหม่/ไม่มี migration — อ่านจาก `audit_log` ที่มีอยู่ (ระยะเก็บ 90 วันตามมติ Q16)
 * - ทุกบทบาทเข้าหน้านี้ได้ (`content` = สิทธิ์พื้นฐานสุดที่ทุกบทบาทมี) เพราะเป็นข้อมูลของตัวเอง
 */

/** จำนวนรายการที่แสดง (เพดานอ่านของ `lib/audit/log.ts` คือ 200) */
const ACTIVITY_LIMIT = 50;

export default async function AdminActivityPage() {
  const user = await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  const entries = await listAuditForActor(user.email, ACTIVITY_LIMIT);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-fg text-xl font-semibold">{strings.activityTitle}</h1>
          <p className="text-fg-muted text-sm">{strings.activityHint}</p>
        </div>
        <Link
          href="/admin"
          className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          {strings.deniedBack}
        </Link>
      </header>

      <section className="border-line bg-surface-raised flex flex-col gap-3 rounded-2xl border p-5">
        <p className="text-fg-muted font-mono text-xs">{user.email}</p>

        {entries.length === 0 ? (
          <p className="text-fg-muted text-sm">{strings.activityEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-xs">
            {entries.map((entry, index) => (
              <li
                key={`${entry.createdAt}-${index}`}
                className="border-line flex flex-wrap items-baseline gap-2 border-b pb-1.5 last:border-0"
              >
                <span className="text-fg font-semibold">{auditActionLabel(strings, entry.action)}</span>
                {entry.target === null || entry.target === "" ? null : (
                  <span className="text-fg-muted font-mono">
                    {strings.activityTarget}: {entry.target}
                  </span>
                )}
                {entry.detail === null || entry.detail === "" ? null : <span className="text-fg-muted">{entry.detail}</span>}
                <span className="text-fg-muted ml-auto">{auditStamp(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

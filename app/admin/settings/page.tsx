import { SettingsForm } from "@/features/admin/ui/settings-form";
import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadSiteSettingsForEditing } from "@/lib/site-settings/loader";

/**
 * ตั้งค่าเว็บ (X1.3 + X1.4) — ชื่อเว็บ · ไอคอน · รูปแชร์ · ข้อมูลองค์กร · โซเชียล
 *
 * ⚠️ ต้องล็อกอินก่อนเสมอ (ข้อมูลระดับองค์กร + ค่าที่มีผลทั้งเว็บ)
 * ⚠️ ค่าที่ใช้จริงบนหน้าเว็บคือ **ฉบับเผยแพร่** (loader อ่านเฉพาะ published) — ไม่ตั้งค่า = ของเดิม
 */
export default async function AdminSettingsPage() {
  await requireAdminUser();
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  /* ใช้ฉบับร่างถ้ามี (ผู้แก้เห็นงานค้างของตัวเอง) — ไม่มีก็ฉบับเผยแพร่/ค่าเริ่มต้น */
  const { settings, draftUpdatedAt, publishedAt } = await loadSiteSettingsForEditing();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fg text-2xl font-bold">{strings.settingsTitle}</h1>
        <p className="text-fg-muted text-sm">{strings.settingsHint}</p>
      </header>

      <SettingsForm
        initial={settings}
        messages={messages}
        exampleTitle={messages.meta.homeTitle}
        exampleDescription={messages.meta.homeDescription}
      />

      <p className="text-fg-muted text-xs">
        {publishedAt === null ? "" : `${strings.publishedBadge} ${publishedAt.slice(0, 16).replace("T", " ")}`}
        {draftUpdatedAt === null ? "" : ` · ${strings.draftPrefix} ${draftUpdatedAt.slice(0, 16).replace("T", " ")}`}
      </p>
    </main>
  );
}

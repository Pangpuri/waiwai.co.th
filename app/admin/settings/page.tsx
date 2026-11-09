import { SettingsForm } from "@/features/admin/ui/settings-form";
import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { loadPageSeo } from "@/lib/pages/repository";
import { resolveSeo } from "@/lib/seo/page-seo";
import { loadSiteSettingsForEditing } from "@/lib/site-settings/loader";

/**
 * ข้อมูลองค์กร & SEO (X1.3 + X1.4) — ชื่อเว็บ · ไอคอน · รูปแชร์ · ข้อมูลนิติบุคคล · โซเชียล
 *
 * ⚠️ ต้องล็อกอินก่อนเสมอ (ข้อมูลระดับองค์กร + ค่าที่มีผลทั้งเว็บ)
 * ⚠️ ค่าที่ใช้จริงบนหน้าเว็บคือ **ฉบับเผยแพร่** (loader อ่านเฉพาะ published) — ไม่ตั้งค่า = ของเดิม
 * ⚠️ รอบ 326: ถอดช่อง "เวลาทำการ" / "ลิงก์แผนที่" ที่ไม่มีโค้ดฝั่งเว็บอ่านค่าออกแล้ว
 */
export default async function AdminSettingsPage() {
  await requireAdminUser("settings");
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  /* ใช้ฉบับร่างถ้ามี (ผู้แก้เห็นงานค้างของตัวเอง) — ไม่มีก็ฉบับเผยแพร่/ค่าเริ่มต้น */
  const [{ settings, draftUpdatedAt, publishedAt }, homeSeo] = await Promise.all([
    loadSiteSettingsForEditing(),
    /* ค่าจริงของหน้าแรก: SEO ที่ตั้งจาก /admin/builder/home (ถ้ามี) → ไม่มีใช้ค่าเริ่มต้นจากพจนานุกรม */
    loadPageSeo("home"),
  ]);
  const resolvedHomeSeo = homeSeo === null ? null : resolveSeo(homeSeo, "th");

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fg text-2xl font-bold">{strings.settingsTitle}</h1>
        <p className="text-fg-muted text-sm">{strings.settingsHint}</p>
      </header>

      <SettingsForm
        initial={settings}
        messages={messages}
        exampleTitle={resolvedHomeSeo?.title ?? messages.meta.homeTitle}
        exampleDescription={resolvedHomeSeo?.description ?? messages.meta.homeDescription}
        exampleOgImage={resolvedHomeSeo?.ogImagePath ?? settings.defaultOgImage}
      />

      <p className="text-fg-muted text-xs">
        {publishedAt === null ? "" : `${strings.publishedBadge} ${publishedAt.slice(0, 16).replace("T", " ")}`}
        {draftUpdatedAt === null ? "" : ` · ${strings.draftPrefix} ${draftUpdatedAt.slice(0, 16).replace("T", " ")}`}
      </p>
    </main>
  );
}

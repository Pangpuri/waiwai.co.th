import { MourningEditor } from "@/features/admin/ui/mourning-editor";
import { requireAdminUser } from "@/lib/auth/dal";
import { listRevisions, loadDocumentRow } from "@/lib/blocks/repository";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { MOURNING_PAGE_KEY, defaultMourningConfig, parseMourningConfig } from "@/lib/mourning/config";

/**
 * หน้าจอแก้ "ป๊อปอัพประกาศไว้อาลัย" — Server Component
 *
 * ผู้ใช้สั่ง (รอบที่ 35) ให้ป๊อปอัพไว้อาลัยแก้ได้จากหลังบ้าน (เดิมค่าอยู่ในโค้ด + โฟลเดอร์ `/rip/`)
 *
 * ค่าตั้งต้นที่ส่งให้หน้าจอ = **ฉบับร่าง** ถ้ามี · ถ้าไม่มี = ค่าเริ่มต้นจากโค้ด/พจนานุกรม (ยังไม่เขียนลง DB จนกว่าจะกดบันทึก)
 */
export default async function AdminMourningPage() {
  await requireAdminUser("presets");
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  const heading = (
    <header className="flex flex-col gap-1">
      <p className="text-fg-muted text-xs font-medium tracking-wide uppercase">{strings.brand}</p>
      <h1 className="text-fg text-2xl font-bold">{strings.mourningTitle}</h1>
    </header>
  );

  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10">
        {heading}
        <section className="border-line bg-surface-raised rounded-2xl border p-5">
          <p className="text-fg-muted text-sm">{strings.dbMissingShort}</p>
        </section>
      </main>
    );
  }

  const draftRow = await loadDocumentRow(MOURNING_PAGE_KEY, "draft");
  const publishedRow = await loadDocumentRow(MOURNING_PAGE_KEY, "published");
  const revisions = await listRevisions(MOURNING_PAGE_KEY);

  /* ข้อมูลจาก DB ต้องผ่าน parse เสมอ — เสียหายก็เริ่มจากค่าเริ่มต้น (ไม่ทำให้หน้าจอพัง) */
  const parsed = draftRow === null ? null : parseMourningConfig(draftRow.raw, messages);
  const initial = parsed !== null && parsed.ok ? parsed.config : defaultMourningConfig(messages);

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 py-10">
      {heading}
      <MourningEditor
        initial={initial}
        draftUpdatedAt={draftRow?.updatedAt ?? null}
        publishedAt={publishedRow?.publishedAt ?? null}
        revisions={revisions}
        strings={strings}
      />
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";

import { NewsEditorForm, type NewsEditorLibraryItem } from "@/features/admin/ui/news-editor-form";
import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { listMedia } from "@/lib/media/repository";
import { loadNewsForAdmin } from "@/lib/news/repository";

/**
 * หลังบ้าน — หน้าจอแก้ข่าว/กิจกรรม (รอบที่ 123 · ฟอร์มง่ายแบบ WP classic editor)
 *
 * - พาธ `/admin/news/new` = สร้างใหม่ · `/admin/news/<id>` = แก้ของเดิม
 * - เนื้อหาโชว์เป็น **ข้อความในช่องเดียว** (แปลงจากบล็อกด้วย `newsBlocksToText()`) แล้วแปลงกลับตอนบันทึก
 * - รายการภาพให้เลือกมาจากคลังภาพ (`listMedia`) — เก็บเป็น **พาธ** `/media/<id>` (มติ D9)
 */

export default async function AdminNewsEditorPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.admin;

  const { id } = await params;
  const isNew = id === "new";

  const [existing, media] = await Promise.all([isNew ? Promise.resolve(null) : loadNewsForAdmin(id), listMedia(60)]);
  if (!isNew && existing === null) notFound();

  const library: readonly NewsEditorLibraryItem[] = media.map((item) => ({
    id: item.id,
    filename: item.filename,
    path: `/media/${item.id}`,
  }));

  return (
    <main className="container-site py-10">
      <p className="text-sm">
        <Link href="/admin/news" className="text-link underline underline-offset-4">
          ← {m.newsAdminBackToList}
        </Link>
      </p>

      <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight">
        {isNew ? m.newsAdminHeadingNew : m.newsAdminHeadingEdit}
      </h1>

      <div className="mx-auto mt-8 max-w-4xl">
        <NewsEditorForm
          strings={m}
          id={existing?.id ?? ""}
          titleTh={existing?.titleTh ?? ""}
          titleEn={existing?.titleEn ?? ""}
          excerptTh={existing?.excerptTh ?? ""}
          excerptEn={existing?.excerptEn ?? ""}
          coverPath={existing?.coverPath ?? ""}
          publishedLocal={existing?.publishedLocal ?? ""}
          status={existing?.status ?? "draft"}
          initialBody={existing?.body ?? []}
          library={library}
          trashed={existing?.trashed ?? false}
        />
      </div>
    </main>
  );
}

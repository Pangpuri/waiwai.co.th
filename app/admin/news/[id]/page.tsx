import { loadEntityRevision, listEntityRevisions } from "@/lib/revisions/repository";
import { revisionDiff, newsSnapshotOf } from "@/lib/revisions/model";
import { RevisionHistoryPanel } from "@/features/admin/ui/revision-history";
import { restoreNewsRevisionAction } from "@/app/admin/news/actions";
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
  searchParams,
}: {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<{ readonly revision?: string }>;
}) {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const m = messages.admin;

  const { id } = await params;
  const selectedRevisionId = (await searchParams).revision ?? '';
  const isNew = id === "new";

  const [existing, media] = await Promise.all([isNew ? Promise.resolve(null) : loadNewsForAdmin(id), listMedia(60)]);
  if (!isNew && existing === null) notFound();

  const library: readonly NewsEditorLibraryItem[] = media.map((item) => ({
    id: item.id,
    filename: item.filename,
    path: `/media/${item.id}`,
  }));

  /* ขนาดรูปสำหรับพรีวิว — ใช้ข้อมูลจากคลังที่ดึงมาแล้ว (ไม่ต้องยิง DB เพิ่ม) */
  const previewSizes = media.map((item) => ({ id: item.id, width: item.width, height: item.height }));


  /* ── ประวัติรุ่น (B1 ส่วนที่ 2 · รอบที่ 145) ─────────────────────────── */
  const currentSnapshot = existing === null ? {} : newsSnapshotOf(existing);
  const revisions = existing === null ? [] : await listEntityRevisions({ kind: "news", entityId: id, current: currentSnapshot });
  const selectedSnapshot = existing === null || selectedRevisionId === "" ? null : await loadEntityRevision({ kind: "news", entityId: id, revisionId: selectedRevisionId });
  const selectedRevision = selectedSnapshot === null ? null : (revisions.find((item) => item.id === selectedRevisionId) ?? null);
  const revisionChanges = selectedSnapshot === null ? [] : revisionDiff(selectedSnapshot, currentSnapshot);
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
          previewSizes={previewSizes}
          trashed={existing?.trashed ?? false}
        />
      </div>

      <RevisionHistoryPanel
        strings={m}
        revisions={revisions.map((item) => ({ id: item.id, revision: item.revision, note: item.note, createdBy: item.createdBy, createdLocal: item.createdLocal, changeCount: item.changeCount, isCurrent: item.isCurrent }))}
        selected={selectedRevision}
        changes={revisionChanges}
        restoreAction={restoreNewsRevisionAction}
        entityId={id}
        basePath={`/admin/news/${id}`}
      />
    </main>
  );
}

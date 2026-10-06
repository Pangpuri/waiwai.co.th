import { loadEntityRevision, listEntityRevisions } from "@/lib/revisions/repository";
import { revisionDiff, recipeSnapshotOf } from "@/lib/revisions/model";
import { RevisionHistoryPanel } from "@/features/admin/ui/revision-history";
import { restoreRecipeRevisionAction } from "@/app/admin/recipes/actions";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RecipeEditorForm, type RecipeEditorLibraryItem } from "@/features/admin/ui/recipe-editor-form";
import { recipeVideoListStringsOf } from "@/features/recipes/ui/recipe-video-list";
import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { listMedia } from "@/lib/media/repository";
import { loadRecipeForAdmin } from "@/lib/recipes/repository";

/**
 * หลังบ้าน — หน้าจอแก้เมนูอาหาร (รอบที่ 135 · ฟอร์มง่ายแบบ WP classic editor)
 *
 * - พาธ `/admin/recipes/new` = สร้างใหม่ · `/admin/recipes/<id>` = แก้ของเดิม
 * - พรีวิวใช้ `RecipeVideoList` ตัวเดียวกับหน้า `/recipes` (กันพรีวิวโกหก)
 * - รายการภาพให้เลือกมาจากคลังภาพ (`listMedia`) — เก็บเป็น **พาธ** `/media/<id>` (มติ D9)
 */

export default async function AdminRecipeEditorPage({
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

  const [existing, media] = await Promise.all([isNew ? Promise.resolve(null) : loadRecipeForAdmin(id), listMedia(60)]);
  if (!isNew && existing === null) notFound();

  const library: readonly RecipeEditorLibraryItem[] = media.map((item) => ({
    id: item.id,
    filename: item.filename,
    path: `/media/${item.id}`,
  }));


  /* ── ประวัติรุ่น (B1 ส่วนที่ 2 · รอบที่ 145) ─────────────────────────── */
  const currentSnapshot = existing === null ? {} : recipeSnapshotOf(existing);
  const revisions = existing === null ? [] : await listEntityRevisions({ kind: "recipe", entityId: id, current: currentSnapshot });
  const selectedSnapshot = existing === null || selectedRevisionId === "" ? null : await loadEntityRevision({ kind: "recipe", entityId: id, revisionId: selectedRevisionId });
  const selectedRevision = selectedSnapshot === null ? null : (revisions.find((item) => item.id === selectedRevisionId) ?? null);
  const revisionChanges = selectedSnapshot === null ? [] : revisionDiff(selectedSnapshot, currentSnapshot);
  return (
    <main className="container-site py-10">
      <p className="text-sm">
        <Link href="/admin/recipes" className="text-link underline underline-offset-4">
          ← {m.recipesAdminBackToList}
        </Link>
      </p>

      <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight">
        {isNew ? m.recipesAdminHeadingNew : m.recipesAdminHeadingEdit}
      </h1>

      <div className="mt-8">
        <RecipeEditorForm
          strings={m}
          publicStrings={recipeVideoListStringsOf(messages.recipesPage)}
          trashed={existing?.trashed ?? false}
          library={library}
          initial={{
            id: existing?.id ?? "",
            titleTh: existing?.titleTh ?? "",
            titleEn: existing?.titleEn ?? "",
            videoId: existing?.videoId ?? "",
            publishedOn: existing?.publishedOn ?? "",
            sortOrder: existing?.sortOrder ?? 0,
            coverPath: existing?.coverPath ?? "",
            status: existing?.status ?? "draft",
          }}
        />
      </div>

      <RevisionHistoryPanel
        strings={m}
        revisions={revisions.map((item) => ({ id: item.id, revision: item.revision, note: item.note, createdBy: item.createdBy, createdLocal: item.createdLocal, changeCount: item.changeCount, isCurrent: item.isCurrent }))}
        selected={selectedRevision}
        changes={revisionChanges}
        restoreAction={restoreRecipeRevisionAction}
        entityId={id}
        basePath={`/admin/recipes/${id}`}
      />
    </main>
  );
}

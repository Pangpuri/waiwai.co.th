import { notFound } from "next/navigation";

import { startFromTemplateAction } from "@/app/admin/builder/actions";
import { BlockBuilder } from "@/features/admin/ui/block-builder";
import { PageSeoSettings } from "@/features/admin/ui/page-seo-settings";
import { PageSettings } from "@/features/admin/ui/page-settings";
import { PageTabs } from "@/features/admin/ui/page-tabs";
import { TemplateCoverageNote } from "@/features/admin/ui/template-coverage-note";
import { requireAdminUser } from "@/lib/auth/dal";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { blockCoverageGaps, hasBlockTemplate, type BlockCoveragePartId } from "@/lib/blocks/templates";
import { listBlockPresets } from "@/lib/blocks/presets";
import { defaultPages } from "@/lib/pages/model";
import { pathForPage } from "@/lib/pages/paths";
import { listPages } from "@/lib/pages/repository";
import { isPageLive, listRevisions, loadDocumentRow, readStoredVersions } from "@/lib/blocks/repository";
import type { BlockDocument } from "@/lib/blocks/types";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { localePath } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * หน้าจอสร้างหน้าเว็บ (บล็อกอิสระ) — Server Component
 *
 * ขั้นตอน
 *   1. `requireAdminUser()` — ต้องล็อกอิน
 *   2. รองรับเฉพาะหน้าที่ประกาศไว้ (`home`) — หน้าที่อื่น 404 (กันเปิดหน้าจอที่ยังไม่มีเทมเพลต)
 *   3. อ่าน **ฉบับร่าง** จาก DB → ถ้าไม่มี แสดงปุ่ม "เริ่มจากเนื้อหาปัจจุบัน"
 *   4. ส่งฉบับร่าง + เวลาที่เผยแพร่ + ประวัติ ให้หน้าจอแก้ไข (client)
 *
 * ทำไมอ่าน "ฉบับร่าง" เป็นค่าตั้งต้น: ผู้แก้ต้องเห็นงานที่ค้างไว้ของตัวเอง ไม่ใช่ของที่เผยแพร่อยู่
 */

/*
  หน้าที่เปิดในหน้าจอสร้างหน้าเว็บได้ (W1/W2)
  ⚠️ บทเรียน รอบที่ 62: เดิมล็อกไว้ `["home"]` แต่แท็บรายหน้ามี 9 หน้า ⇒ กดแท็บอื่นแล้ว **404**
  แก้: ยอมรับ id ที่มีอยู่จริงในตาราง `page` (หรือรายการหน้าในโค้ด) · ที่เหลือ 404 ตามเดิม
*/

/**
 * รหัสส่วนที่เทมเพลตไม่ครอบคลุม → ข้อความจากพจนานุกรม (S2 รอบที่ 83)
 * ⚠️ `switch` แบบ exhaustive ⇒ เพิ่มรหัสใหม่ในทะเบียนแล้วลืมแปล จะ compile ไม่ผ่าน
 */
function coveragePartLabel(
  part: BlockCoveragePartId,
  strings: Messages["admin"],
): string {
  switch (part) {
    case "gallery":
      return strings.coverageGallery;
    case "lightbox":
      return strings.coverageLightbox;
    case "form":
      return strings.coverageForm;
    case "map":
      return strings.coverageMap;
    case "jobBoard":
      return strings.coverageJobBoard;
    case "sampleData":
      return strings.coverageSampleData;
    case "rosterText":
      return strings.coverageRosterText;
  }
}

export default async function AdminBuilderPage({ params }: { readonly params: Promise<{ readonly page: string }> }) {
  await requireAdminUser("content");
  const { page } = await params;

  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  const knownPages = await listPages(defaultPages(messages));
  if (!knownPages.some((entry) => entry.id === page)) notFound();


  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10">
        <section className="border-line bg-surface-raised rounded-2xl border p-5">
          <p className="text-fg-muted text-sm">{strings.dbMissingShort}</p>
        </section>
      </main>
    );
  }

  const draftRow = await loadDocumentRow(page, "draft");
  const publishedRow = await loadDocumentRow(page, "published");
  const revisions = await listRevisions(page);
  /* รุ่นรูปทรงของข้อมูลที่เก็บไว้ (X1.1) — หน้าจอเตือน + มีปุ่มย้ายเป็นรุ่นปัจจุบัน */
  const storedVersions = await readStoredVersions(page);

  const parsedDraft = draftRow === null ? null : parseBlockDocument(page, draftRow.raw);
  const emptyDocument: BlockDocument = { page, blocks: [] };

  /* เอกสารที่อ่านจาก DB ต้องผ่าน parse ก่อนใช้ — ถ้าเสียหายให้เริ่มจากหน้าว่าง (ไม่ทำให้หน้าจอพัง) */
  const initialDraft = parsedDraft !== null && parsedDraft.ok ? parsedDraft.document : emptyDocument;

  /*
    การ์ด "ป้ายประกาศเข้าเว็บ" (ผู้ใช้สั่ง รอบที่ 38: ควบคุม/โยนภาพจากหน้านี้ได้เลย)
    อ่านค่าล่าสุดของป้าย (ฉบับร่างก่อน ถ้าไม่มี = ค่าเริ่มต้น) — เสียหายก็ใช้ค่าเริ่มต้น ไม่ทำให้หน้าจอพัง
  */


  /* คำเตือน "ส่วนที่เทมเพลตไม่ครอบคลุม" — ใช้ทั้งตอนยังไม่มีฉบับร่าง และตอนจะเปิดสวิตช์เว็บจริง */
  const coverage = {
    title: strings.templateCoverageTitle,
    note: strings.templateCoverageNote,
    noneLabel: strings.templateCoverageNone,
    parts: blockCoverageGaps(page).map((part) => coveragePartLabel(part, strings)),
  };

  /* ── หน้าเป็นวัตถุ (W1): แท็บรายหน้า + ชื่อหน้า = ชื่อเมนู ── */
  const pages = knownPages;
  const currentPage = pages.find((entry) => entry.id === page) ?? null;

  return (
    <main className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-6">
      <PageTabs pages={pages} activeId={page} label={strings.pagesTabsLabel} strings={{ pageHiddenFromMenu: strings.pageHiddenFromMenu }} />

      {currentPage === null ? null : (
        <div className="grid gap-4 md:grid-cols-2">
          <PageSettings page={currentPage} strings={strings} />
          <PageSeoSettings page={currentPage} strings={strings} />
        </div>
      )}


      {draftRow === null ? (
        <section className="border-line bg-surface-raised flex flex-col gap-3 rounded-2xl border p-5">
          <h2 className="text-fg text-lg font-semibold">{strings.emptyPage}</h2>
          {/*
            S2 (รอบที่ 82): ปุ่มเทมเพลตแสดงเฉพาะหน้าที่มีเทมเพลตจริง (ทะเบียนกลาง `lib/blocks/templates.ts`)
            หน้าที่ไม่มี = บอกตรง ๆ ว่ายังไม่มีเทมเพลต + ให้ใช้หน้าจอเนื้อหาแบบฟิลด์เดิม (ไม่ปล่อยให้กดแล้วเงียบ)
          */}
          {hasBlockTemplate(page) ? (
            <>
              <p className="text-fg-muted text-sm">{strings.startFromTemplateHint}</p>
              <TemplateCoverageNote {...coverage} />
              <form action={startFromTemplateAction}>
                <input type="hidden" name="page" value={page} />
                <button
                  type="submit"
                  className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {strings.startFromTemplate}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-fg-muted text-sm">{strings.templateMissingBody}</p>
              <p className="text-fg-muted text-xs">{strings.templateMissingList}</p>
            </>
          )}
        </section>
      ) : (
        <BlockBuilder
          presets={await listBlockPresets()}
          page={page}
          isLive={await isPageLive(page)}
          initialDraft={initialDraft}
          draftUpdatedAt={draftRow?.updatedAt ?? null}
          publishedAt={publishedRow?.publishedAt ?? null}
          revisions={revisions}
          storedVersions={storedVersions}
          previewLiveSrc={localePath("th", pathForPage(currentPage?.id ?? page))}
          coverage={coverage}
          strings={strings}
        />
      )}
    </main>
  );
}

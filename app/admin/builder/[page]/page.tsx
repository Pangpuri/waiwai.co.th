import { notFound } from "next/navigation";

import { startFromTemplateAction } from "@/app/admin/builder/actions";
import { BlockBuilder } from "@/features/admin/ui/block-builder";
import { ImageLibraryProvider, type ImageLibraryItem } from "@/features/admin/ui/image-library";
import { PageSeoSettings } from "@/features/admin/ui/page-seo-settings";
import { PageSettings } from "@/features/admin/ui/page-settings";
import { PageTabs } from "@/features/admin/ui/page-tabs";
import { TemplateCoverageNote } from "@/features/admin/ui/template-coverage-note";
import { requireAdminUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/roles";
import { parseBlockDocument } from "@/lib/blocks/parse";
import { documentsEqual } from "@/lib/blocks/diff";
import { blockCoverageGaps, hasBlockTemplate, type BlockCoveragePartId } from "@/lib/blocks/templates";
import { listBlockPresets } from "@/lib/blocks/presets";
import { defaultPages } from "@/lib/pages/model";
import { pathForPage } from "@/lib/pages/paths";
import { listPages } from "@/lib/pages/repository";
import { isPageLive, listRevisions, loadDocumentRow, readPublishSchedule, readStoredVersions } from "@/lib/blocks/repository";
import { listMedia } from "@/lib/media/repository";
import type { BlockDocument } from "@/lib/blocks/types";
import { isDatabaseConfigured } from "@/db/pool";
import { localePath } from "@/lib/i18n/config";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * หน้าจอสร้างหน้าเว็บ (บล็อกอิสระ) — Server Component
 *
 * ขั้นตอน
 *   1. `requireAdminUser("content")` — ต้องมีสิทธิ์จัดเนื้อหา (ไม่ล็อกอิน = ไปหน้าล็อกอิน · สิทธิ์ไม่พอ = ไป `/admin/denied`)
 *   2. **ตรวจว่าเป็นหน้าที่รู้จัก** (`listPages` = ตาราง `page` หรือรายการหน้าในโค้ด) — ที่เหลือ 404
 *      ⚠️ บทเรียน รอบที่ 62: เดิมล็อกไว้ `["home"]` แต่แท็บรายหน้ามี 9 หน้า ⇒ กดแท็บอื่นแล้ว **404**
 *   3. อ่าน **ฉบับร่าง** จาก DB → ถ้าไม่มี: หน้าที่มีเทมเพลตแสดงปุ่ม "เริ่มจากเนื้อหาปัจจุบัน" + คำเตือนส่วนที่ไม่ครอบคลุม
 *      (หน้าที่ไม่มีเทมเพลต: บอกตรง ๆ ให้ใช้หน้าจอเนื้อหาแบบฟิลด์ไปก่อน — ไม่ปล่อยให้กดแล้วเงียบ)
 *   4. ส่งฉบับร่าง + เวลาที่เผยแพร่ + ประวัติ ให้หน้าจอแก้ไข (client)
 *
 * ทำไมอ่าน "ฉบับร่าง" เป็นค่าตั้งต้น: ผู้แก้ต้องเห็นงานที่ค้างไว้ของตัวเอง ไม่ใช่ของที่เผยแพร่อยู่
 * ⚠️ เอกสารที่อ่านจาก DB ต้องผ่าน `parseBlockDocument` ก่อนใช้เสมอ (ข้อมูลเสียหาย = เริ่มจากหน้าว่าง ไม่ทำให้หน้าจอพัง)
 * ⚠️ การ์ด SEO รายหน้าแสดงเฉพาะบทบาทที่มีสิทธิ์ `seo` (ผู้เผยแพร่ขึ้นไป) — การบันทึกก็ถูกกันที่ action ด้วยสิทธิ์เดียวกัน
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
    case "whereToBuy":
      return strings.coverageWhereToBuy;
    case "sampleData":
      return strings.coverageSampleData;
    case "rosterText":
      return strings.coverageRosterText;
  }
}

export default async function AdminBuilderPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly page: string }>;
  /* รอบที่ 227: ใช้บอกผู้ใช้ว่า "กดใช้เทมเพลตแล้วแต่ยังไม่ติ๊กยืนยัน" (Server Action ปฏิเสธเงียบ ๆ) */
  /* รอบที่ 238: `live` = เหตุผลที่ Server Action ปฏิเสธการเปิดสวิตช์ "ใช้กับหน้าเว็บจริง" */
  readonly searchParams: Promise<{ readonly template?: string; readonly live?: string }>;
}) {
  const user = await requireAdminUser("content");
  const { page } = await params;
  const query = await searchParams;
  const templateNotice = query.template === "confirm";

  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  /*
    หน้าที่รู้จัก = ตาราง `page` (ถ้าอ่านไม่ได้/ว่าง ใช้รายการในโค้ด) — ตรวจครั้งเดียวแล้วใช้ค่าที่ได้เลย
    ⇒ ไม่มีสาขา "หาไม่เจอ" ที่ไม่มีทางเป็นจริงอยู่ข้างล่างให้สับสน
  */
  const pages = await listPages(defaultPages(messages));
  const currentPage = pages.find((entry) => entry.id === page);
  if (currentPage === undefined) notFound();

  /*
    คลังภาพสำหรับ "เลือกจากคลัง" ในช่องภาพ (รอบที่ 93)
    ⚠️ ส่งรายการให้เฉพาะผู้ที่มีสิทธิ์ `media` — ผู้ที่ไม่มีสิทธิ์จะไม่เห็นภาพในคลังเลย
    (การอัปโหลด/แก้คลังยังถูกบังคับที่ Server Action ของคลังอีกชั้นเสมอ)
  */
  const imageLibrary: readonly ImageLibraryItem[] = can(user.role, "media")
    ? (await listMedia(48)).map((item) => ({
        id: item.id,
        filename: item.filename,
        altTh: item.altTh,
        altEn: item.altEn,
      }))
    : [];


  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10">
        <section className="border-line bg-surface-raised rounded-2xl border p-5">
          <p className="text-fg-muted text-sm">{strings.dbMissingShort}</p>
        </section>
      </main>
    );
  }

  /*
    อ่านข้อมูลของหน้าแบบขนาน (4 คำสั่งไม่ขึ้นแก่กัน) + แถวที่เหลืออีกชุด
    ⚠️ ยังต้องมี DB จริง (ตรวจ `isDatabaseConfigured` ด้านบนแล้ว) — ถ้าไม่มี จะออกก่อนถึงบรรทัดนี้
  */
  const [draftRow, publishedRow, revisions, storedVersions, isLive, presets, schedule] = await Promise.all([
    loadDocumentRow(page, "draft"),
    loadDocumentRow(page, "published"),
    listRevisions(page),
    /* รุ่นรูปทรงของข้อมูลที่เก็บไว้ (X1.1) — หน้าจอเตือน + มีปุ่มย้ายเป็นรุ่นปัจจุบัน */
    readStoredVersions(page),
    isPageLive(page),
    listBlockPresets(),
    /* กำหนดเวลาเผยแพร่ที่ตั้งไว้ (X2.7) — ยังไม่มีฉบับร่าง/ยังไม่ตั้ง = null */
    readPublishSchedule(page),
  ]);

  const parsedDraft = draftRow === null ? null : parseBlockDocument(page, draftRow.raw);
  const emptyDocument: BlockDocument = { page, blocks: [] };

  /* เอกสารที่อ่านจาก DB ต้องผ่าน parse ก่อนใช้ — ถ้าเสียหายให้เริ่มจากหน้าว่าง (ไม่ทำให้หน้าจอพัง) */
  const initialDraft = parsedDraft !== null && parsedDraft.ok ? parsedDraft.document : emptyDocument;

  /*
    ── สถานะ "ฉบับที่เผยแพร่ ตรงกับ ฉบับร่าง ไหม" (รอบที่ 238 — 🐞 เคสจริงจากเจ้าของ) ──────────
    หน้าเว็บจริงอ่าน **ฉบับที่เผยแพร่** ไม่ใช่ฉบับร่างที่กำลังแก้ ⇒ ต้องบอกให้ตรง ๆ ว่าตอนนี้เว็บ
    กำลังแสดงชุดไหน และถ้ายังไม่ตรง ห้ามเปิดสวิตช์ (ผู้ใช้เคยเปิดแล้วเว็บกลายเป็นบล็อกเก่า)
    ⚠️ ค่าที่คำนวณนี้เป็นของ "ตอนโหลดหน้า" — ถ้าแก้ฉบับร่างต่อ ตัวสร้างจะเทียบสด ๆ เองอีกชั้น
  */
  const parsedPublished = publishedRow === null ? null : parseBlockDocument(page, publishedRow.raw);
  const publishedDocument = parsedPublished !== null && parsedPublished.ok ? parsedPublished.document : null;
  const liveGuard = {
    hasPublished: publishedDocument !== null,
    inSync: publishedDocument !== null && documentsEqual(publishedDocument, initialDraft),
  };
  const liveBlockedNotice =
    query.live === "no-published"
      ? strings.liveBlockedNoPublished
      : query.live === "draft-not-published"
        ? strings.liveBlockedStale
        : null;

  /* คำเตือน "ส่วนที่เทมเพลตไม่ครอบคลุม" — ใช้ทั้งตอนยังไม่มีฉบับร่าง และตอนจะเปิดสวิตช์เว็บจริง */
  const coverage = {
    title: strings.templateCoverageTitle,
    note: strings.templateCoverageNote,
    noneLabel: strings.templateCoverageNone,
    parts: blockCoverageGaps(page).map((part) => coveragePartLabel(part, strings)),
  };

  return (
    <main className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-6">
      <PageTabs pages={pages} activeId={page} label={strings.pagesTabsLabel} strings={{ pageHiddenFromMenu: strings.pageHiddenFromMenu }} />

      {/* หน้าเป็นวัตถุ (W1): ตั้งค่าหน้า/เมนู + SEO รายหน้า (SEO แสดงเฉพาะบทบาทที่มีสิทธิ์ seo) */}
      <div className="grid gap-4 md:grid-cols-2">
        <PageSettings page={currentPage} strings={strings} />
        {can(user.role, "seo") ? <PageSeoSettings page={currentPage} strings={strings} /> : null}
      </div>


      {/*
        รอบที่ 225 (เคลียร์หนี้ UX): แผง "เริ่มจากเนื้อหาปัจจุบัน" แสดง**เสมอ** สำหรับหน้าที่มีเทมเพลต
        · ยังไม่มีฉบับร่าง ⇒ กดได้เลย · มีฉบับร่างแล้ว ⇒ ต้องติ๊กยืนยันก่อนทับ
        · ด่านจริงอยู่ที่ Server Action (`decideTemplateApply` — ไม่ติ๊ก = ไม่ทำอะไรเลย)
      */}
      {hasBlockTemplate(page) ? (
        <section className="border-line bg-surface-raised flex flex-col gap-3 rounded-2xl border p-5">
          <h2 className="text-fg text-lg font-semibold">
            {draftRow === null ? strings.emptyPage : strings.startFromTemplateReplace}
          </h2>
          <p className="text-fg-muted text-sm">{strings.startFromTemplateHint}</p>
          <TemplateCoverageNote {...coverage} />
          {templateNotice ? (
            <p className="text-brand-red text-sm" data-template-notice="">
              {strings.startFromTemplateNeedsConfirm}
            </p>
          ) : null}
          <form action={startFromTemplateAction} className="flex flex-col gap-3" data-template-form="">
            <input type="hidden" name="page" value={page} />
            {draftRow === null ? null : (
              <label className="text-fg-muted flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  name="confirm"
                  value="overwrite"
                  required
                  className="border-line accent-brand-red size-4 rounded border"
                />
                {strings.startFromTemplateOverwrite}
              </label>
            )}
            <button
              type="submit"
              className="bg-brand-red text-on-brand focus-visible:ring-ring w-fit rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {strings.startFromTemplate}
            </button>
          </form>
        </section>
      ) : draftRow === null ? (
        <section className="border-line bg-surface-raised flex flex-col gap-3 rounded-2xl border p-5">
          <h2 className="text-fg text-lg font-semibold">{strings.emptyPage}</h2>
          <p className="text-fg-muted text-sm">{strings.templateMissingBody}</p>
          <p className="text-fg-muted text-xs">{strings.templateMissingList}</p>
        </section>
      ) : null}

      {draftRow === null ? null : (

        <ImageLibraryProvider items={imageLibrary}>
          <BlockBuilder
            presets={presets}
            page={page}
            isLive={isLive}
            schedule={schedule}
            initialDraft={initialDraft}
            draftUpdatedAt={draftRow?.updatedAt ?? null}
            publishedAt={publishedRow?.publishedAt ?? null}
            revisions={revisions}
            storedVersions={storedVersions}
            previewLiveSrc={localePath("th", pathForPage(currentPage.id))}
            coverage={coverage}
            liveGuard={liveGuard}
            publishedBlocks={publishedDocument === null ? null : publishedDocument.blocks.length}
            liveBlockedNotice={liveBlockedNotice}
            strings={strings}
          />
        </ImageLibraryProvider>
      )}
    </main>
  );
}

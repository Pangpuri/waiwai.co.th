import Link from "next/link";

import { EmptyTrashForm, PurgeTrashForm, TrashTable, type TrashRow, type TrashStrings } from "@/features/admin/ui/trash-list";
import { requireAdminUser } from "@/lib/auth/dal";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { formatBytes } from "@/lib/format/bytes";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";
import { describeRetention } from "@/lib/retention/format";
import { TRASH_RETENTION_DAYS } from "@/lib/retention/plan";
import { contentTrashStats, listContentTrash } from "@/lib/trash/content";
import { heroTrashStats, listHeroTrash } from "@/lib/trash/hero";
import {
  CONTENT_TRASH_KINDS,
  CONTENT_TRASH_SCREENS,
  HERO_TRASH_KINDS,
  HERO_TRASH_SCREENS,
  daysLeftInTrash,
  mergeTrashEntries,
  type ContentTrashKind,
  type HeroTrashKind,
} from "@/lib/trash/plan";
import { listTrash, trashStats } from "@/lib/trash/repository";

/**
 * ถังขยะ (X2.4 · รอบที่ 78 · ขยายรอบที่ 175/176) — ที่พักของสิ่งที่ "ลบ"
 *
 * ทำไมต้องมี
 * - ก่อนหน้านี้การลบทุกจุดเป็น **ลบถาวรทันที** ⇒ ผู้ใช้ที่ไม่ได้เป็นช่างเทคนิคเผลอกดลบ = ข้อมูลหายถาวร
 * - หน้านี้ให้ "กู้คืน" และ "ลบถาวร" ด้วยการกดครั้งเดียว พร้อมบอกว่าเหลือเวลาอีกกี่วันก่อนระบบลบให้เอง
 *
 * รอบที่ 175: เพิ่ม **ดัชนีของถังขยะเนื้อหา** (ตัวนับ + ลิงก์ไปแท็บของจอนั้น)
 * รอบที่ 176 (มติเจ้าของ "เห็นและจัดการจากที่เดียว"): **ตารางรวมทุกชนิด** (เริ่ม 6 ชนิด)
 * รอบที่ 237: เพิ่ม **สไลด์หน้าแรก** เป็นชนิดที่ 7 (เดิมตกหล่นเพราะสไลด์มีถังขยะทีหลังรอบที่ 176)
 * - แถวเนื้อหา (สินค้า/เมนู/ข่าว) ถูกเรนเดอร์ในตารางเดียวกับภาพ/พรีเซ็ต ⇒ กดกู้คืน/ลบถาวรได้จากที่นี่
 *   (ไม่ต้องสลับไป 3 จอ) · บล็อกดัชนีด้านบนยังอยู่เพื่อ **กระโดดไปแก้ที่จอของชนิดนั้น** เมื่อต้องดูบริบท
 * - ยังไม่ย้ายการแก้ไข/เผยแพร่มาที่นี่ — ทำเฉพาะ "กู้คืน/ลบถาวร" ตามเจตนาของถัง
 * - ⚠️ ตัวเลขระยะเก็บของทุกชนิดใช้ค่าเดียวกัน (`TRASH_RETENTION_DAYS`) ⇒ 30 วันเท่ากันหมด
 *
 * ⚠️ ต้องล็อกอินก่อนเสมอ (`requireAdminUser("<permission>")`) — ของในถังยังเป็นข้อมูลของบริษัท
 * ⚠️ ตัวเลขระยะเก็บดึงจาก `lib/retention/plan.ts` (ห้ามพิมพ์จำนวนวันในหน้านี้)
 */
export default async function AdminTrashPage() {
  await requireAdminUser("trash");
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  const configured = isDatabaseConfigured();
  /*
    ตารางรวม: ภาพ/พรีเซ็ต (ถังเดิม) + สไลด์ (รอบที่ 237) + เนื้อหา (รอบที่ 176)
    — แต่ละฝ่ายคืน [] เมื่อไม่มี DB
  */
  const entries = mergeTrashEntries([
    ...(configured ? await listTrash() : []),
    ...(await listHeroTrash()),
    ...(await listContentTrash()),
  ]);
  const stats = configured ? await trashStats() : { media: 0, preset: 0, chromePreset: 0, total: 0 };
  /* เนื้อหาในถัง — ไม่มี DB = 0 ทุกชนิด (หน้าจอต้องไม่พัง) */
  const contentTrash = await contentTrashStats();
  /* สไลด์ในถัง (รอบที่ 237) — เหตุผลเดียวกัน */
  const heroTrash = await heroTrashStats();
  const totalAll = stats.total + contentTrash.total + heroTrash.total;

  /* ป้ายชื่อของแต่ละชนิดเนื้อหา — เพิ่มชนิดใหม่แล้ว type ฟ้องที่นี่ทันที */
  const contentTrashLabels: Readonly<Record<ContentTrashKind, string>> = {
    product: strings.trashContentProduct,
    recipe: strings.trashContentRecipe,
    news: strings.trashContentNews,
  };

  /* ป้ายชื่อของแต่ละชนิดสไลด์ (รอบที่ 237) */
  const heroTrashLabels: Readonly<Record<HeroTrashKind, string>> = {
    slide: strings.trashKindSlide,
  };

  const now = new Date();
  const rows: TrashRow[] = entries.map((entry) => ({
    kind: entry.kind,
    id: entry.id,
    label: entry.label,
    detail: entry.detail,
    sizeLabel: entry.sizeBytes === null ? null : formatBytes(entry.sizeBytes),
    deletedAt: entry.deletedAt,
    deletedBy: entry.deletedBy,
    daysLeft: daysLeftInTrash(entry.deletedAt, now),
  }));

  const trashStrings: TrashStrings = {
    trashColItem: strings.trashColItem,
    trashColKind: strings.trashColKind,
    trashColDeletedAt: strings.trashColDeletedAt,
    trashColDeletedBy: strings.trashColDeletedBy,
    trashColExpiry: strings.trashColExpiry,
    trashColActions: strings.trashColActions,
    trashKindMedia: strings.trashKindMedia,
    trashKindPreset: strings.trashKindPreset,
    trashKindChromePreset: strings.trashKindChromePreset,
    trashKindProduct: strings.trashKindProduct,
    trashKindRecipe: strings.trashKindRecipe,
    trashKindNews: strings.trashKindNews,
    trashKindSlide: strings.trashKindSlide,
    trashDaysLeft: strings.trashDaysLeft,
    trashDueNow: strings.trashDueNow,
    trashRestore: strings.trashRestore,
    trashRestoreDone: strings.trashRestoreDone,
    trashDeleteForever: strings.trashDeleteForever,
    trashDeleteForeverDone: strings.trashDeleteForeverDone,
    trashDeleteForeverWarning: strings.trashDeleteForeverWarning,
    trashEmptyAction: strings.trashEmptyAction,
    trashConfirmEmpty: strings.trashConfirmEmpty,
    trashEmptyIncludesContent: strings.trashEmptyIncludesContent,
    trashEmptyDone: strings.trashEmptyDone,
    trashNotFound: strings.trashNotFound,
    trashNoPreview: strings.trashNoPreview,
    trashPurgeNow: strings.trashPurgeNow,
    trashDbMissing: strings.trashDbMissing,
  };

  /* วันที่อ่านง่ายจากค่ากลาง: "30 วัน" — เอกสารกับของจริงหลุดจากกันไม่ได้ */
  const retentionLabel = describeRetention(TRASH_RETENTION_DAYS, "th");

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fg text-2xl font-bold">{strings.trashTitle}</h1>
        <p className="text-fg-muted text-sm">{strings.trashHint}</p>
        <p className="text-fg-muted text-xs">{fillTemplate(strings.trashRetentionNote, { days: retentionLabel })}</p>
      </header>

      {configured ? null : (
        <p className="border-line bg-surface text-brand-red rounded-2xl border p-5 text-sm">{strings.trashDbMissing}</p>
      )}

      {configured ? (
        <>
          <p className="text-fg text-sm font-semibold">
            {totalAll === 0 ? strings.trashEmpty : fillTemplate(strings.trashCardCount, { count: totalAll })}
          </p>
          <p className="text-fg-muted text-xs">
            {fillTemplate(strings.trashStats, {
              media: stats.media,
              preset: stats.preset,
              chrome: stats.chromePreset,
            })}
          </p>

          {/* ดัชนีถังขยะเนื้อหา (รอบที่ 175 · ยังมีประโยชน์หลังรอบ 176) — กระโดดไปจอของชนิดนั้นเมื่อต้องดูบริบท */}
          <section className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-fg text-sm font-semibold">{strings.trashContentTitle}</h2>
              <p className="text-fg-muted text-xs">
                {fillTemplate(strings.trashContentStats, {
                  product: contentTrash.product,
                  recipe: contentTrash.recipe,
                  news: contentTrash.news,
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {CONTENT_TRASH_KINDS.map((kind) => (
                <Link
                  key={kind}
                  href={CONTENT_TRASH_SCREENS[kind]}
                  className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  {contentTrashLabels[kind]}
                </Link>
              ))}
            </div>
            <p className="text-fg-muted text-[11px]">{strings.trashContentHint}</p>
          </section>

          {/* ดัชนีถังขยะสไลด์ (รอบที่ 237) — สไลด์มีเจ้าของอยู่หน้า `/admin/hero` (เป็นทางที่สอง) */}
          <section className="border-line bg-surface flex flex-col gap-2 rounded-2xl border p-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-fg text-sm font-semibold">{strings.trashHeroTitle}</h2>
              <p className="text-fg-muted text-xs">
                {fillTemplate(strings.trashHeroStats, { slide: heroTrash.slide })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {HERO_TRASH_KINDS.map((kind) => (
                <Link
                  key={kind}
                  href={HERO_TRASH_SCREENS[kind]}
                  className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  {heroTrashLabels[kind]}
                </Link>
              ))}
            </div>
            <p className="text-fg-muted text-[11px]">{strings.trashHeroHint}</p>
          </section>

          {rows.length === 0 ? (
            <p className="border-line bg-surface text-fg-muted rounded-2xl border p-5 text-sm">{strings.trashEmpty}</p>
          ) : (
            <section className="border-line bg-surface flex flex-col gap-3 rounded-2xl border p-4">
              <p className="text-fg-muted text-xs">{strings.trashTableHint}</p>
              <TrashTable rows={rows} strings={trashStrings} label={strings.trashListLabel} />
              <div className="border-line flex flex-col gap-2 border-t pt-3">
                <EmptyTrashForm strings={trashStrings} />
                <PurgeTrashForm strings={trashStrings} />
                <p className="text-fg-muted text-[11px]">{strings.trashPurgeHint}</p>
              </div>
            </section>
          )}

          <Link
            href="/admin/media"
            className="text-link focus-visible:ring-ring w-fit text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
          >
            {strings.trashBackToMedia}
          </Link>
        </>
      ) : null}
    </main>
  );
}

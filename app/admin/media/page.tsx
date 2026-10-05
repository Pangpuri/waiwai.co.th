import Link from "next/link";

import { updateMediaAltAction } from "@/app/admin/media/library-actions";
import { MediaItemActions, MediaUpload } from "@/features/admin/ui/media-library";
import { requireAdminUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/roles";
import { formatBytes } from "@/lib/format/bytes";
import { findMediaUsage, mediaStats, searchMedia, type MediaUsageKind } from "@/lib/media/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * คลังภาพ (X1.2) — ที่รวมภาพทั้งหมดที่อัปโหลดเข้าฐานข้อมูล
 *
 * ผู้ใช้สั่ง (จากเช็กลิสต์ที่อนุมัติ รอบที่ 64): "คลังภาพ (ค้นหา/แทนไฟล์/ใช้ซ้ำ) + ห้ามลบภาพที่ยังใช้"
 * - ค้นหาจากชื่อไฟล์/คำอธิบายภาพ · แสดงว่าภาพไหนถูกใช้ที่ไหน
 * - ลบเฉพาะภาพที่ไม่ถูกใช้ (เซิร์ฟเวอร์เป็นคนตัดสิน) · แทนไฟล์โดยพาธไม่เปลี่ยน
 * - ⚠️ ต้องล็อกอินก่อนเสมอ (ภาพเป็นข้อมูลของบริษัท)
 */

const CARD = "border-line bg-surface flex flex-col gap-2 rounded-2xl border p-3";
const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const BUTTON_CLASS =
  "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2.5 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none";

/** ป้ายชื่อชนิดของการใช้งาน (ใช้ `switch` ครอบทุกชนิด ⇒ เพิ่มชนิดใหม่แล้ว type ฟ้องที่นี่ทันที) */
function usageKindLabel(kind: MediaUsageKind, strings: Messages["admin"]): string {
  switch (kind) {
    case "document":
      return strings.mediaUsage;
    case "og-image":
    case "favicon":
      /* ทั้งคู่คือคอลัมน์ SEO ของหน้า/ตั้งค่าส่วนกลาง — ใช้ป้ายเดียวกันพอ (detail บอกว่าเป็นอะไร) */
      return strings.mediaUsageSeo;
    case "block-preset":
      return strings.mediaUsageBlockPreset;
    case "chrome-preset":
      return strings.mediaUsageChromePreset;
    case "product":
      return strings.mediaUsageProduct;
    case "recipe":
      return strings.mediaUsageRecipe;
    case "news":
      return strings.mediaUsageNews;
  }
}

export default async function AdminMediaPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string }>;
}) {
  const user = await requireAdminUser("media");
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  const query = await searchParams;
  const search = typeof query.q === "string" ? query.q.slice(0, 80) : "";

  const [items, stats] = await Promise.all([searchMedia(search), mediaStats()]);

  /* ตรวจการใช้งานทีละภาพ (คลังมีขนาดเล็ก — ตรวจสดทุกครั้งเพื่อความถูกต้อง) */
  const usageByItem = new Map<string, Awaited<ReturnType<typeof findMediaUsage>>>();
  for (const item of items) {
    usageByItem.set(item.id, await findMediaUsage(item.id));
  }
  const unused = items.filter((item) => (usageByItem.get(item.id) ?? []).length === 0).length;

  const actionStrings = {
    mediaUploadTitle: strings.mediaUploadTitle,
    mediaUploadAction: strings.mediaUploadAction,
    mediaReplace: strings.mediaReplace,
    mediaReplaceAction: strings.mediaReplaceAction,
    mediaDelete: strings.mediaDelete,
    mediaDeleteBlocked: strings.mediaDeleteBlocked,
    mediaDeleted: strings.mediaDeleted,
    mediaUsage: strings.mediaUsage,
    imageShrinkNote: strings.imageShrinkNote,
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fg text-2xl font-bold">{strings.mediaTitle}</h1>
        <p className="text-fg-muted text-sm">{strings.mediaHint}</p>
        <p className="text-fg-muted text-xs">
          {fillTemplate(strings.mediaStats, { count: stats.count, size: formatBytes(stats.totalBytes), unused })}
        </p>
        {/* X2.4 — บอกให้ชัดว่า "ลบ" = ย้ายเข้าถังขยะ + ทางไปกู้คืน (ลิงก์แสดงเฉพาะผู้มีสิทธิ์ถังขยะ — X1.10 รอบที่ 85) */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-fg-muted text-xs">{strings.mediaTrashHint}</span>
          {can(user.role, "trash") ? (
            <Link
              href="/admin/trash"
              className="text-link focus-visible:ring-ring w-fit text-xs font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
            >
              {strings.mediaTrashLink}
            </Link>
          ) : null}
        </div>
      </header>

      <MediaUpload strings={actionStrings} />

      {/* ค้นหา (ฟอร์มธรรมดา — ใช้ได้แม้ปิด JS) */}
      <form action="/admin/media" className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-fg-muted text-xs">{strings.mediaSearch}</span>
          <input type="search" name="q" defaultValue={search} className={FIELD_CLASS} />
        </label>
        <button type="submit" className={BUTTON_CLASS}>
          {strings.mediaSearchAction}
        </button>
        {search === "" ? null : (
          <Link href="/admin/media" className={BUTTON_CLASS}>
            {strings.mediaClear}
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <p className="border-line bg-surface text-fg-muted rounded-2xl border p-5 text-sm">{strings.mediaNoResults}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const usage = usageByItem.get(item.id) ?? [];
            const used = usage.length > 0;
            const path = `/media/${item.id}`;

            return (
              <li key={item.id} className={CARD}>
                <div className="bg-bg-subtle flex items-center justify-center overflow-hidden rounded-xl p-2">
                  {/* ภาพในคลังหลังบ้าน — ใช้ <img> ตรง ๆ (ไม่ต้องผ่านตัวย่อของ Next) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={path} alt={item.altTh} className="max-h-40 w-auto rounded-lg" loading="lazy" />
                </div>

                <div className="flex flex-col gap-0.5 text-xs">
                  <span className="text-fg truncate font-semibold">{item.filename}</span>
                  <span className="text-fg-muted">
                    {formatBytes(item.sizeBytes)}
                    {item.width === null || item.height === null ? "" : ` · ${item.width}×${item.height}`}
                    {` · ${item.createdAt.slice(0, 10)}`}
                  </span>
                  <span className="text-fg-muted">
                    {strings.mediaPath}: <code className="font-mono">{path}</code>
                  </span>
                </div>

                <div className={`rounded-lg p-2 text-[11px] ${used ? "bg-surface-raised text-fg" : "bg-surface-raised text-fg-muted"}`}>
                  {used ? (
                    <>
                      <span className="font-semibold">
                        {strings.mediaUsage}: {usage.length}
                      </span>
                      <ul className="mt-0.5 flex flex-col">
                        {usage.slice(0, 5).map((entry) => (
                          <li key={`${entry.kind}-${entry.target}`} className="font-mono">
                            {usageKindLabel(entry.kind, strings)} · {entry.target}
                            {entry.detail === null ? "" : ` · ${entry.detail}`}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    strings.mediaUnused
                  )}
                </div>

                {/* แก้คำอธิบายภาพ (a11y) — ฟอร์มธรรมดา ใช้ได้แม้ปิด JS */}
                <form action={updateMediaAltAction} className="flex flex-col gap-1">
                  <input type="hidden" name="id" value={item.id} />
                  <label className="flex flex-col gap-0.5">
                    <span className="text-fg-muted text-[11px]">{strings.mediaAltTh}</span>
                    <input type="text" name="altTh" defaultValue={item.altTh} maxLength={300} className={FIELD_CLASS} />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-fg-muted text-[11px]">{strings.mediaAltEn}</span>
                    <input type="text" name="altEn" defaultValue={item.altEn} maxLength={300} className={FIELD_CLASS} />
                  </label>
                  <button type="submit" className={`${BUTTON_CLASS} self-start`}>
                    {strings.mediaSaveAlt}
                  </button>
                </form>

                <MediaItemActions id={item.id} strings={actionStrings} used={used} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

import {
  PreviewLinkCreateForm,
  PreviewLinkTable,
  type PreviewLinkRow,
  type PreviewLinkStrings,
} from "@/features/admin/ui/preview-link-manager";
import { requireAdminUser } from "@/lib/auth/dal";
import { isDatabaseConfigured } from "@/lib/content/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { fillTemplate } from "@/lib/i18n/template";
import { PREVIEWABLE_PAGE_IDS } from "@/lib/pages/paths";
import { defaultPages } from "@/lib/pages/model";
import { listPages } from "@/lib/pages/repository";
import {
  PREVIEW_LINK_MAX_ACTIVE,
  PREVIEW_LINK_TTL_HOURS,
  hoursLeftInPreviewLink,
  previewLinkStatus,
} from "@/lib/preview-link/plan";
import { listPreviewLinks } from "@/lib/preview-link/repository";

/**
 * ลิงก์พรีวิวชั่วคราว (X2.6 · รอบที่ 79) — ให้ผู้จัดการดูฉบับร่าง **โดยไม่ต้องมีบัญชี**
 *
 * ทำไมต้องมี
 * - กติกาเดิมคือ "พรีวิวต้องล็อกอิน" ⇒ ฝ่ายการตลาด/ผู้จัดการต้องมีบัญชี ทั้งที่เขาไม่ควรแก้ข้อมูลได้
 * - หน้านี้ให้ผู้ดูแลสร้าง **ลิงก์อายุสั้น** ส่งเป็นการรายครั้ง แล้วยกเลิกได้ทุกเมื่อ
 *
 * ⚠️ ต้องล็อกอินเสมอ (`requireAdminUser("<permission>")`) — หน้านี้เป็นเครื่องมือของเจ้าหน้าที่
 * ⚠️ ตัวเลขทั้งหมด (อายุ/เพดาน) ดึงจาก `lib/preview-link/plan.ts` (ห้ามพิมพ์ในหน้านี้)
 */

const STAMP_LENGTH = 16;

function stamp(iso: string): string {
  return iso.slice(0, STAMP_LENGTH).replace("T", " ");
}

export default async function AdminPreviewLinksPage() {
  await requireAdminUser("preview");
  const messages = await getMessagesFor("th");
  const strings = messages.admin;

  const configured = isDatabaseConfigured();
  const links = configured ? await listPreviewLinks() : [];
  const now = new Date();

  /*
    ตัวเลือก "หน้า" ของลิงก์พรีวิว (S2 · รอบที่ 82)
    ⚠️ เดิมมีตัวเลือกเดียวคือหน้าแรก ⇒ หน้าอื่นพรีวิวผ่านลิงก์ไม่ได้ ทั้งที่มีเทมเพลตแล้ว
    ⇒ ใช้ชื่อหน้าจากตาราง `page` (W1) ของหน้าที่พรีวิวได้เท่านั้น
  */
  const pageRecords = await listPages(defaultPages(messages));
  const previewablePages = PREVIEWABLE_PAGE_IDS.map((id) => {
    const record = pageRecords.find((entry) => entry.id === id);
    return { id, label: record?.nameTh ?? id };
  });
  const pageLabelOf = (id: string): string => previewablePages.find((entry) => entry.id === id)?.label ?? id;

  const rows: PreviewLinkRow[] = links.map((link) => {
    const status = previewLinkStatus(link, now);
    const hoursLeft = hoursLeftInPreviewLink(link.expiresAt, now);

    return {
      id: link.id,
      pageLabel: pageLabelOf(link.page),
      createdLabel: stamp(link.createdAt),
      createdBy: link.createdBy,
      expiresLabel: stamp(link.expiresAt),
      status,
      statusLabel:
        status === "active"
          ? `${strings.previewLinkStatusActive} · ${fillTemplate(strings.previewLinkHoursLeft, { hours: hoursLeft })}`
          : status === "expired"
            ? strings.previewLinkStatusExpired
            : strings.previewLinkStatusRevoked,
      usageLabel:
        link.useCount === 0
          ? strings.previewLinkNeverUsed
          : `${fillTemplate(strings.previewLinkUsedCount, { count: link.useCount })}${
              link.lastUsedAt === null ? "" : ` · ${stamp(link.lastUsedAt)}`
            }`,
    };
  });

  const managerStrings: PreviewLinkStrings = {
    previewLinkCreate: strings.previewLinkCreate,
    previewLinkCreateAction: strings.previewLinkCreateAction,
    previewLinkCreated: strings.previewLinkCreated,
    previewLinkCreatedLabel: strings.previewLinkCreatedLabel,
    previewLinkPageLabel: strings.previewLinkPageLabel,
    previewLinkLocaleLabel: strings.previewLinkLocaleLabel,
    previewLinkLocaleTh: strings.previewLinkLocaleTh,
    previewLinkLocaleEn: strings.previewLinkLocaleEn,
    previewLinkListTitle: strings.previewLinkListTitle,
    previewLinkEmpty: strings.previewLinkEmpty,
    previewLinkColPage: strings.previewLinkColPage,
    previewLinkColCreated: strings.previewLinkColCreated,
    previewLinkColCreatedBy: strings.previewLinkColCreatedBy,
    previewLinkColExpires: strings.previewLinkColExpires,
    previewLinkColStatus: strings.previewLinkColStatus,
    previewLinkColUsed: strings.previewLinkColUsed,
    previewLinkColActions: strings.previewLinkColActions,
    previewLinkStatusActive: strings.previewLinkStatusActive,
    previewLinkStatusExpired: strings.previewLinkStatusExpired,
    previewLinkStatusRevoked: strings.previewLinkStatusRevoked,
    previewLinkHoursLeft: strings.previewLinkHoursLeft,
    previewLinkUsedCount: strings.previewLinkUsedCount,
    previewLinkNeverUsed: strings.previewLinkNeverUsed,
    previewLinkRevoke: strings.previewLinkRevoke,
    previewLinkRevoked: strings.previewLinkRevoked,
    previewLinkNotFound: strings.previewLinkNotFound,
    previewLinkTooMany: strings.previewLinkTooMany,
    previewLinkDbMissing: strings.previewLinkDbMissing,
    previewLinkRevokeWarning: strings.previewLinkRevokeWarning,
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fg text-2xl font-bold">{strings.previewLinkTitle}</h1>
        <p className="text-fg-muted text-sm">{strings.previewLinkHint}</p>
        {/* อายุลิงก์จากค่ากลาง (ชั่วโมง) — เอกสารกับของจริงหลุดจากกันไม่ได้ */}
        <p className="text-fg-muted text-xs">
          {fillTemplate(strings.previewLinkTtlNote, { hours: PREVIEW_LINK_TTL_HOURS })}
        </p>
        <p className="text-fg-muted text-xs">{strings.previewLinkNoStoreWarning}</p>
      </header>

      {configured ? null : (
        <p className="border-line bg-surface text-brand-red rounded-2xl border p-5 text-sm">
          {strings.previewLinkDbMissing}
        </p>
      )}

      {configured ? (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-fg text-sm font-semibold">{strings.previewLinkCreate}</h2>
            <PreviewLinkCreateForm
              strings={managerStrings}
              maxActive={PREVIEW_LINK_MAX_ACTIVE}
              pages={previewablePages}
            />
          </section>

          <PreviewLinkTable rows={rows} strings={managerStrings} maxActive={PREVIEW_LINK_MAX_ACTIVE} />
        </>
      ) : null}

      {/* อ้างอิงหน้าที่พรีวิวได้จากรายการกลาง — เพิ่มหน้าใหม่แล้วหน้านี้ไม่ต้องแก้ */}
      <p className="text-fg-muted text-[11px]">
        {PREVIEWABLE_PAGE_IDS.join(" · ")}
      </p>
    </main>
  );
}

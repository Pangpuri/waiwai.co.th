import Link from "next/link";


import { HeroPrCardEditor } from "@/features/admin/ui/hero-pr-card-editor";
import { HeroSlideManager } from "@/features/admin/ui/hero-slide-manager";
import { ImageLibraryProvider, type ImageLibraryItem } from "@/features/admin/ui/image-library";
import { requireAdminUser } from "@/lib/auth/dal";
import { can } from "@/lib/auth/roles";
import { heroCardContentOf, heroCardDraftOf } from "@/lib/content/home-card";
import { loadHomeContentSafely } from "@/lib/content/repository";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import {
  addHeroSlideAction,
  deleteHeroSlideForeverAction,
  restoreHeroSlideAction,
  saveHeroSettingAction,
} from "@/app/admin/hero/actions";
import { auditStamp } from "@/features/admin/audit-labels";
import { HERO_EFFECTS, HERO_SPEED_PRESETS, type HeroEffect } from "@/lib/hero/model";
import { listHeroPageSlidesForAdmin, listTrashedHeroPageSlides, loadHeroSetting } from "@/lib/hero/repository";
import { listMedia } from "@/lib/media/repository";
import { fillTemplate } from "@/lib/i18n/template";
import { feedbackOf, type HeroErrorCode, type HeroSavedCode } from "@/lib/hero/feedback";
import { TRASH_RETENTION_DAYS } from "@/lib/retention/plan";

/**
 * หลังบ้าน "สไลด์ & แคมเปญ" (รอบที่ 184 · เฟส 3 ส่วนแรก)
 *
 * มติเจ้าของ 2026-10-07: แยกเป็น **โมดูลของตัวเอง** + เมนูในไซด์บาร์ต่อจาก "ส่วนกลางของเว็บ"
 * เพราะสไลด์หน้าแรกเป็นของระดับเว็บ + จะมีการ์ดวางบนสไลด์ + ช่วงเวลาแคมเปญ (ไม่ใช่เลย์เอาต์ของหน้าใดหน้าหนึ่ง)
 *
 * รอบนี้ = **จอแสดงรายการ** (อ่านอย่างเดียว) ⇒ เห็นว่าหน้าแรกกำลังใช้สไลด์อะไรอยู่ + ตรวจข้อมูลจริงได้
 * ⏭ เฟสถัดไป: เพิ่ม/ลบภาพ · ลากสลับลำดับ · เลือกจุดโฟกัส 3×3 · ซูม · เปิด/ปิด · ถังขยะ · ประวัติ · การ์ดแคมเปญ
 */
/** ป้ายของเอฟเฟคแต่ละแบบ (ข้อความจากพจนานุกรม — ไม่พิมพ์ไทยในไฟล์นี้) */

export default async function AdminHeroPage({
  searchParams,
}: {
  searchParams: Promise<{ readonly tab?: string; readonly saved?: string; readonly error?: string; readonly fields?: string }>;
}) {
  const user = await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const s = messages.admin;
  /* การ์ด PR แคมเปญ (การ์ดที่ขยับบนหน้าแรก) — รอบที่ 200 อ่านค่าจริง · รอบที่ 203 แก้ได้จากที่นี่ */
  const homeContent = await loadHomeContentSafely();
  const prCardDraft = heroCardDraftOf(homeContent);
  const wiggleCard = heroCardContentOf(homeContent, messages, "th");
  /* แท็บในหน้าเดียว (มติเจ้าของ): สไลด์ | แคมเปญ — จำแท็บใน URL */
  const query = await searchParams;

  /* ผลการบันทึกล่าสุด (action ส่งกลับมาเป็นรหัส) — ผู้ใช้ต้องเห็นเสมอว่าสำเร็จหรือไม่ (มติเจ้าของ 2026-10-07) */
  const feedback = feedbackOf({ saved: query.saved, error: query.error });
  const savedMessages: Readonly<Record<HeroSavedCode, string>> = {
    "slide-added": s.feedbackSlideAdded,
    "slide-removed": s.feedbackSlideRemoved,
    "slide-moved": s.feedbackSlideMoved,
    "slide-reordered": s.feedbackSlideReordered,
    "slide-saved": s.feedbackSlideSaved,
    "effect-saved": s.feedbackEffectSaved,
    "slide-restored": s.feedbackSlideRestored,
    "slide-purged": s.feedbackSlidePurged,
    "card-saved": s.feedbackCardSaved,
  };
  const errorMessages: Readonly<Record<HeroErrorCode, string>> = {
    invalid: s.feedbackErrorInvalid,
    "save-failed": s.feedbackErrorSaveFailed,
  };

  /* คลังภาพสำหรับช่องเลือกภาพ — ส่งให้เฉพาะผู้มีสิทธิ์ media (แบบเดียวกับตัวสร้างหน้า · รอบที่ 93) */
  const imageLibrary: readonly ImageLibraryItem[] = can(user.role, "media")
    ? (await listMedia(48)).map((item) => ({ id: item.id, filename: item.filename, altTh: item.altTh, altEn: item.altEn }))
    : [];
  const setting = await loadHeroSetting();
  const effectLabels: Readonly<Record<HeroEffect, string>> = {
    fade: s.heroAdminEffectFade,
    slide: s.heroAdminEffectSlide,
    zoom: s.heroAdminEffectZoom,
    none: s.heroAdminEffectNone,
  };
  const slides = await listHeroPageSlidesForAdmin();
  const trashed = await listTrashedHeroPageSlides();
  const activeCount = slides.filter((slide) => slide.isActive).length;

  return (
    <ImageLibraryProvider items={imageLibrary}>
      <div className="container-site flex flex-col gap-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-fg text-2xl font-semibold">{s.heroAdminTitle}</h1>
        <p className="text-fg-muted max-w-3xl text-sm">{s.heroAdminIntro}</p>
        <p className="text-fg text-sm font-medium">{fillTemplate(s.heroAdminCount, { n: activeCount })}</p>
        <p className="text-fg-muted text-xs">{s.heroAdminNextStep}</p>
        <p>
          <Link href="/th" className="text-brand-red text-sm underline underline-offset-2">
            {s.heroAdminSeeSite}
          </Link>
        </p>
      </header>

      {feedback === null ? null : (
        <div role="status" className="border-line bg-surface text-fg rounded-xl border px-3 py-2 text-sm">
          <p>{feedback.kind === "saved" ? "✓ " + savedMessages[feedback.code] : "⚠ " + errorMessages[feedback.code]}</p>
        </div>
      )}

      {/* แท็บ: สไลด์ | แคมเปญ (รอบที่ 190) */}
      {/*
        ★ รอบที่ 200 → 203 — "การ์ด PR แคมเปญ" (การ์ดที่ขยับมุมขวาล่างของหน้าแรก)
        เดิมมีแผงบอกทางไปแก้ที่หน้าจอ "เนื้อหาแบบมีโครง" · เจ้าของสั่งย้ายมาเป็น **ส่วนของตัวเองในหน้าแคมเปญ**
        ⇒ แก้ข้อความสั้น + อัปโหลดภาพได้ที่นี่ ไม่ต้องออกจากหน้านี้
      */}
      <section className="flex flex-col gap-2">
        <HeroPrCardEditor card={prCardDraft} frame={setting.prCardFrame} strings={s} />
        <p className="text-fg-muted text-[11px]">
          {s.wiggleCardHint} · {wiggleCard.title}
        </p>
      </section>


      <form action={saveHeroSettingAction} className="border-line bg-surface flex flex-wrap items-end gap-3 rounded-xl border p-3">
        <label className="text-fg-muted flex flex-col gap-1 text-xs">
          {s.heroAdminEffect}
          <select name="effect" defaultValue={setting.effect} className="border-line text-fg rounded-md border px-2 py-1 text-xs">
            {HERO_EFFECTS.map((effect) => (
              <option key={effect} value={effect}>
                {effectLabels[effect]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-fg-muted flex flex-col gap-1 text-xs">
          {s.heroAdminSpeed}
          <select name="intervalMs" defaultValue={String(setting.intervalMs)} className="border-line text-fg rounded-md border px-2 py-1 text-xs">
            {HERO_SPEED_PRESETS.map((ms) => (
              <option key={ms} value={String(ms)}>
                {ms / 1000}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="border-line text-fg rounded-md border px-3 py-1.5 text-xs font-semibold">
          {s.heroAdminEffectSave}
        </button>
      </form>
      <form action={addHeroSlideAction}>
        <button type="submit" className="bg-brand-red text-on-brand rounded-md px-3 py-1.5 text-sm font-semibold">
          {s.heroAdminAdd}
        </button>
      </form>
      <p className="text-fg-muted -mt-3 text-xs">{s.heroAdminAddHint}</p>

      {slides.length === 0 ? (
        <p className="border-line text-fg-muted rounded-xl border border-dashed p-6 text-sm">{s.heroAdminEmpty}</p>
      ) : (
        <HeroSlideManager slides={slides} strings={s} />
      )}

      {/* ── ถังขยะสไลด์ (รอบที่ 186) — กู้คืนได้ · ลบถาวรต้องยืนยัน ───────────────── */}
      <section className="border-line flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-fg text-lg font-semibold">{s.heroTrashTitle}</h2>
          <p className="text-fg-muted text-xs">{s.heroTrashHint}</p>
          <p className="text-fg-muted text-xs">{fillTemplate(s.heroTrashNote, { days: TRASH_RETENTION_DAYS })}</p>
        </div>
        {trashed.length === 0 ? (
          <p className="text-fg-muted text-sm">{s.heroTrashEmpty}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {trashed.map((entry) => (
              <li key={entry.slide.id} className="border-line flex flex-col gap-2 rounded-lg border p-2">
                {entry.slide.mediaPath.trim() === "" ? (
                  <div className="bg-bg-subtle text-fg-muted flex h-20 w-full items-center justify-center rounded-md text-xs">
                    {s.heroAdminNoImage}
                  </div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={entry.slide.mediaPath} alt={entry.slide.altTh} className="bg-bg-subtle h-20 w-full rounded-md object-cover" />
                )}
                <p className="text-fg text-xs font-semibold">{entry.slide.id}</p>
                <p className="text-fg-muted text-[11px]">
                  {s.heroTrashDeletedAt}: {auditStamp(entry.deletedAt)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={restoreHeroSlideAction}>
                    <input type="hidden" name="id" value={entry.slide.id} />
                    <button type="submit" className="border-line text-fg rounded-md border px-2 py-1 text-xs font-semibold">
                      {s.heroRestore}
                    </button>
                  </form>
                  <form action={deleteHeroSlideForeverAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={entry.slide.id} />
                    <label className="text-fg-muted flex items-center gap-1 text-[11px]">
                      <input type="checkbox" name="confirm" value="yes" />
                      {s.heroPurgeConfirm}
                    </label>
                    <button type="submit" className="border-line text-fg-muted rounded-md border px-2 py-1 text-xs">
                      {s.heroPurge}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </ImageLibraryProvider>
  );
}

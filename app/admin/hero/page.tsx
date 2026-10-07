import Link from "next/link";

import { HeroSlideManager } from "@/features/admin/ui/hero-slide-manager";
import { requireAdminUser } from "@/lib/auth/dal";
import { getMessagesFor } from "@/lib/i18n/dictionaries";
import { addHeroSlideAction, saveHeroSettingAction } from "@/app/admin/hero/actions";
import { HERO_EFFECTS, HERO_SPEED_PRESETS, type HeroEffect } from "@/lib/hero/model";
import { listHeroPageSlidesForAdmin, loadHeroSetting } from "@/lib/hero/repository";
import { fillTemplate } from "@/lib/i18n/template";

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

export default async function AdminHeroPage() {
  await requireAdminUser("content");
  const messages = await getMessagesFor("th");
  const s = messages.admin;

  const setting = await loadHeroSetting();
  const effectLabels: Readonly<Record<HeroEffect, string>> = {
    fade: s.heroAdminEffectFade,
    slide: s.heroAdminEffectSlide,
    zoom: s.heroAdminEffectZoom,
    none: s.heroAdminEffectNone,
  };
  const slides = await listHeroPageSlidesForAdmin();
  const activeCount = slides.filter((slide) => slide.isActive).length;

  return (
    <div className="flex flex-col gap-6">
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

      {/* เอฟเฟค + ความเร็ว (รอบที่ 185) — ใช้กับสไลด์ทั้งชุด */}
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
    </div>
  );
}

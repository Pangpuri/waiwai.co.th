"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit/log";
import { requireAdminUser } from "@/lib/auth/dal";
import { refreshPublicSite } from "@/lib/cache/refresh";
import { HERO_FOCUS_PRESETS, HERO_ZOOM_PRESETS } from "@/lib/blocks/hero-slides";
import { clampFocus, clampZoom, isLocalMediaPath, parseHeroSetting } from "@/lib/hero/model";
import {
  createHeroPageSlide,
  listHeroPageSlidesForAdmin,
  deleteHeroPageSlideForever,
  reorderHeroPageSlides,
  restoreHeroPageSlide,
  saveHeroSetting,
  trashHeroPageSlide,
  updateHeroPageSlide,
} from "@/lib/hero/repository";

/**
 * Server Action ของหลังบ้าน "สไลด์ & แคมเปญ" (รอบที่ 184 · เฟส 3)
 *
 * กติกาเดียวกับหลังบ้านสินค้า/เมนู/ข่าว
 * - **ตรวจสิทธิ์ทุก action** (`requireAdminUser("content")`)
 * - **ไม่เชื่อข้อมูลจากเบราว์เซอร์** — พาธภาพต้องเป็นพาธในเว็บ (มติ D9) · จุดโฟกัส/ซูมถูกบีบช่วงค่า · alt ไทยบังคับ
 * - เขียน audit ทุกครั้ง (`hero-save`) · สั่ง `refreshPublicSite("page")` ให้หน้าแรกอัปเดตทันที (ISR)
 */

/** หลังแก้ข้อมูลแล้ว: สั่งให้หน้าเว็บสร้างใหม่ + หน้าจอหลังบ้านรีเฟรช */
async function refreshAfterChange(): Promise<void> {
  revalidatePath("/admin/hero");
  await refreshPublicSite("page");
}

/** เพิ่มสไลด์ใหม่ (ยังไม่เลือกภาพ) */
export async function addHeroSlideAction(): Promise<void> {
  const user = await requireAdminUser("content");
  const id = await createHeroPageSlide(user.email);
  if (id !== null) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: `hero:${id}`, detail: "add" });
    await refreshAfterChange();
  }
}

/** ลบสไลด์ = ย้ายเข้าถังขยะ (กู้คืนได้ในเฟสถัดไป) */
export async function removeHeroSlideAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  if (id === "") return;
  const ok = await trashHeroPageSlide(id, user.email);
  if (ok) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: `hero:${id}`, detail: "trash" });
    await refreshAfterChange();
  }
}

/** ย้ายขึ้น/ลงหนึ่งช่อง (ไม่ต้องมี JS) */
export async function moveHeroSlideAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  const delta = Number(formData.get("delta"));
  if (id === "" || delta !== 1) {
    if (id === "" || delta !== -1) return;
  }

  const slides = await listHeroPageSlidesForAdmin();
  const from = slides.findIndex((slide) => slide.id === id);
  const to = from + (delta === 1 ? 1 : -1);
  if (from < 0 || to < 0 || to >= slides.length) return;

  const order = slides.map((slide) => slide.id);
  const moved = order[from];
  const target = order[to];
  if (moved === undefined || target === undefined) return;
  order[from] = target;
  order[to] = moved;

  const changed = await reorderHeroPageSlides(order, user.email);
  if (changed > 0) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: `hero:${id}`, detail: delta === 1 ? "down" : "up" });
    await refreshAfterChange();
  }
}

/** ลากสลับลำดับ — เบราว์เซอร์ส่งรายการ id ที่เรียงใหม่แล้ว */
export async function reorderHeroSlidesAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const raw = typeof formData.get("order") === "string" ? String(formData.get("order")) : "";
  const requested = raw.split(",").map((id) => id.trim()).filter((id) => id !== "");
  if (requested.length === 0) return;

  /* ⚠️ ไม่เชื่อลำดับที่ส่งมา: เก็บได้เฉพาะ id ที่มีจริงในฐานข้อมูล (กัน id ปลอม/หลุด) */
  const slides = await listHeroPageSlidesForAdmin();
  const known = new Set(slides.map((slide) => slide.id));
  const order = [...requested.filter((id) => known.has(id)), ...slides.map((slide) => slide.id).filter((id) => !requested.includes(id))];
  if (new Set(order).size !== slides.length) return;

  const changed = await reorderHeroPageSlides(order, user.email);
  if (changed > 0) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: "hero:order", detail: "reorder" });
    await refreshAfterChange();
  }
}

/** บันทึกรายละเอียดสไลด์ (ภาพ · คำอธิบาย · จุดโฟกัส · ซูม · เปิด/ปิด) */
export async function saveHeroSlideAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  if (id === "") return;

  const mediaPath = typeof formData.get("mediaPath") === "string" ? String(formData.get("mediaPath")).trim() : "";
  const altTh = typeof formData.get("altTh") === "string" ? String(formData.get("altTh")).trim() : "";
  const altEn = typeof formData.get("altEn") === "string" ? String(formData.get("altEn")).trim() : "";
  const focusId = typeof formData.get("focus") === "string" ? String(formData.get("focus")) : "";
  const preset = HERO_FOCUS_PRESETS.find((item) => item.id === focusId) ?? HERO_FOCUS_PRESETS[4];
  const zoomRaw = Number(formData.get("zoom"));
  const zoom = HERO_ZOOM_PRESETS.includes(zoomRaw) ? zoomRaw : 1;
  const isActive = formData.get("isActive") === "on";

  /* ภาพว่าง = ยังไม่เลือก (ยอมให้บันทึกได้ แต่จะไม่แสดงบนหน้าเว็บ) · ใส่พาธที่ผิดรูปแบบ = ไม่บันทึก */
  if (mediaPath !== "" && !isLocalMediaPath(mediaPath)) return;
  if (altTh === "" && mediaPath !== "") return;

  const ok = await updateHeroPageSlide(
    id,
    {
      mediaPath,
      altTh,
      altEn,
      focusX: clampFocus(preset?.x ?? 50),
      focusY: clampFocus(preset?.y ?? 50),
      zoom: clampZoom(zoom),
      isActive,
    },
    user.email,
  );
  if (ok) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: `hero:${id}`, detail: "details" });
    await refreshAfterChange();
  }
}

/** บันทึกเอฟเฟค + ความเร็วของสไลด์ทั้งชุด (รอบที่ 185) */
export async function saveHeroSettingAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const effect = typeof formData.get("effect") === "string" ? String(formData.get("effect")) : "";
  const intervalRaw = Number(formData.get("intervalMs"));
  const setting = parseHeroSetting({ effect, intervalMs: intervalRaw });
  const ok = await saveHeroSetting(setting, user.email);
  if (ok) {
    await recordAudit({
      action: "hero-save",
      actorEmail: user.email,
      target: "hero:setting",
      detail: `${setting.effect}:${setting.intervalMs}`,
    });
    await refreshAfterChange();
  }
}

/** กู้คืนสไลด์จากถังขยะ (รอบที่ 186) */
export async function restoreHeroSlideAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  if (id === "") return;
  const ok = await restoreHeroPageSlide(id, user.email);
  if (ok) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: `hero:${id}`, detail: "restore" });
    await refreshAfterChange();
  }
}

/**
 * ลบถาวรจากถังขยะ (รอบที่ 186) — **ย้อนกลับไม่ได้**
 * ⚠️ ต้องยืนยันในฟอร์ม (`confirm=yes`) ไม่งั้นไม่ทำอะไร — กันการกดพลาด
 * ⚠️ ชั้นข้อมูลยังบังคับว่า "ต้องเป็นของในถัง" อีกชั้น (ประตูใน SQL)
 */
export async function deleteHeroSlideForeverAction(formData: FormData): Promise<void> {
  const user = await requireAdminUser("content");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  if (id === "" || formData.get("confirm") !== "yes") return;
  const ok = await deleteHeroPageSlideForever(id);
  if (ok) {
    await recordAudit({ action: "hero-save", actorEmail: user.email, target: `hero:${id}`, detail: "purge" });
    await refreshAfterChange();
  }
}

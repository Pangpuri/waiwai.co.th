"use client";

import { useState } from "react";

import { saveHeroCardAction } from "@/app/admin/hero/pr-card-actions";
import { ImageDrop } from "@/features/admin/ui/image-drop";
import type { HeroCardInput } from "@/lib/content/home-card";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ตัวแก้ "การ์ด PR แคมเปญ" (การ์ดที่ขยับมุมขวาล่างของหน้าแรก) — รอบที่ 203
 *
 * ทำไมต้องมี
 * - ก่อนรอบนี้การ์ดนี้แก้ได้ที่หน้าจอ "เนื้อหาแบบมีโครง" เท่านั้น (`/admin/content/home`)
 *   ซึ่งเป็นหน้าจอรวมทั้งหน้า ⇒ เจ้าของต้องออกจากหน้าแคมเปญไปหาช่องนั้น
 * - คำเจ้าของ: *"ย้ายมันไปไว้ส่วนแคมเปญ … อัปโหลดรูปได้ เปลี่ยนข้อความสั้น ๆ ได้
 *   เอามาเป็นส่วนของตัวเอง ไม่ต้องพาไปหน้าแก้ไขภาพรวม"*
 *
 * กติกา
 * - ฟอร์มเดียวจบ (ไม่ซ้อนฟอร์ม) · ทำงานได้โดยไม่ต้องมี JS (ปุ่ม submit ธรรมดา)
 * - ภาพใช้ `ImageDrop` ตัวเดียวกับแคมเปญ (อัปโหลดจากเครื่อง/เลือกจากคลัง) ⇒ ย่อภาพ+ตรวจหัวไฟล์ตามกติการอบ 99
 *   และส่งค่าที่เลือกจริงด้วย input ซ่อน (รูปแบบเดียวกับจอแคมเปญ)
 */
export function HeroPrCardEditor({
  card,
  strings,
}: {
  readonly card: HeroCardInput;
  readonly strings: Messages["admin"];
}) {
  /* ค่าภาพ = state ฝั่งจอ (อัปโหลด/เลือกจากคลังแล้วส่งค่าล่าสุดตอนกดบันทึก) */
  const [image, setImage] = useState({
    path: card.imagePath,
    altTh: card.imageAltTh,
    altEn: card.imageAltEn,
    hasWatermark: false,
  });

  const field = "border-line text-fg w-full rounded-md border px-2 py-1 text-sm";

  return (
    <section className="border-line bg-surface flex flex-col gap-3 rounded-xl border p-3">
      <div className="flex flex-col gap-1">
        <p className="text-fg text-sm font-semibold">{strings.prCardTitle}</p>
        <p className="text-fg-muted text-xs">{strings.prCardHint}</p>
      </div>

      <form action={saveHeroCardAction} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
          {strings.prCardFieldTitleTh}
          <input type="text" name="titleTh" required maxLength={80} defaultValue={card.titleTh} className={field} />
        </label>
        <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
          {strings.prCardFieldTitleEn}
          <input type="text" name="titleEn" maxLength={80} defaultValue={card.titleEn} className={field} />
        </label>
        <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
          {strings.prCardFieldBodyTh}
          <input type="text" name="bodyTh" required maxLength={200} defaultValue={card.bodyTh} className={field} />
        </label>
        <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
          {strings.prCardFieldBodyEn}
          <input type="text" name="bodyEn" maxLength={200} defaultValue={card.bodyEn} className={field} />
        </label>
        <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
          {strings.prCardFieldLinkLabelTh}
          <input type="text" name="linkLabelTh" maxLength={30} defaultValue={card.linkLabelTh} className={field} />
        </label>
        <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
          {strings.prCardFieldLinkLabelEn}
          <input type="text" name="linkLabelEn" maxLength={30} defaultValue={card.linkLabelEn} className={field} />
        </label>
        <label className="text-fg-muted flex flex-col gap-1 text-[11px] sm:col-span-2">
          {strings.prCardFieldHref}
          <input type="text" name="href" maxLength={300} defaultValue={card.href} className={field} />
        </label>
        </div>
      {/* ค่าภาพล่าสุด (state ฝั่งจอ) — ต้องอยู่ในฟอร์มบันทึก ส่วนตัวอัปโหลดอยู่ "นอก" ฟอร์มด้านล่าง */}
      <input type="hidden" name="imagePath" value={image.path} />
      <input type="hidden" name="imageAltTh" value={image.altTh} />
      <input type="hidden" name="imageAltEn" value={image.altEn} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="bg-brand-red text-on-brand rounded-md px-3 py-1.5 text-xs font-semibold">
          {strings.prCardSave}
        </button>
        <span className="text-fg-muted text-[11px]">{strings.prCardSaveHint}</span>
      </div>
    </form>

      {/*
        ⚠️ `ImageDrop` **มีฟอร์มของตัวเอง** (สำหรับอัปโหลด) ⇒ ห้ามวางซ้อนในฟอร์มบันทึก
        (เคสจริง: React ฟ้อง hydration error ว่าแท็กฟอร์มซ้อนกัน แล้วเบราว์เซอร์ตัดฟอร์มชั้นในทิ้ง
        = ปุ่มอัปโหลดพัง) — รูปแบบเดียวกับจอแคมเปญ
        ⚠️ คอมเมนต์นี้ **ห้ามมีตัวอักษรแท็กฟอร์ม** เพราะเทสต์สแกนซอร์สนับความลึกของฟอร์มแบบตรง ๆ
      */}
            <ImageDrop
        strings={strings}
        value={image}
        onChange={(patch) => setImage((current) => ({ ...current, ...patch }))}
        label={strings.prCardFieldImage}
        /* ภาพการ์ดเป็นโปสเตอร์แนวตั้ง/จัตุรัส — บอกขนาดแนะนำให้เห็นในกรอบว่าง */
        frameHint={strings.prCardImageHint}
        showWatermark={false}
      />
      {/* ส่งค่าล่าสุดของภาพ (รูปแบบเดียวกับจอแคมเปญ) */}
    </section>
  );
}

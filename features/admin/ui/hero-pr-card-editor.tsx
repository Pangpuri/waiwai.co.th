"use client";

import { useState } from "react";

import { saveHeroCardAction } from "@/app/admin/hero/pr-card-actions";
import { ImageDrop } from "@/features/admin/ui/image-drop";
import type { HeroCardInput } from "@/lib/content/home-card";
import { PR_CARD_FRAMES, frameOf, previewAspectOf, type PrCardFrame } from "@/lib/hero/pr-card-frame";
import type { Messages } from "@/lib/i18n/messages/th";

/**
 * ตัวแก้ "การ์ด PR แคมเปญ" (การ์ดที่ขยับมุมขวาล่างของหน้าแรก) — รอบที่ 203 · ทบทวนผังรอบที่ 204
 *
 * ที่มา
 * - รอบ 200: การ์ดนี้เดิมแก้ได้ที่หน้าจอ "เนื้อหาแบบมีโครง" เท่านั้น (ต้องออกจากหน้าแคมเปญไปหาช่องนั้น)
 * - รอบ 203: ย้ายมาเป็นส่วนของตัวเองในหน้าแคมเปญ (คำเจ้าของ) — แก้ข้อความสั้น + อัปโหลดภาพได้ในที่เดียว
 * - รอบ 204: เจ้าของเสนอผังใหม่ *"บล็อคของรูปภาพให้อยู่ด้านซ้ายของบล็อค ข้อความให้อยู่ด้านขวา
 *   เพื่อจะได้เห็นภาพเต็ม ๆ ก่อนโพสต์"* ⇒ จัด 2 คอลัมน์ + ภาพตัวอย่างแบบ **เห็นเต็มใบ** (ไม่ตัดขอบ)
 *
 * กติกา
 * - ฟอร์มเดียวจบ (ไม่ซ้อนฟอร์ม) · ทำงานได้โดยไม่ต้องมี JS
 * - ⚠️ `ImageDrop` มีฟอร์มของตัวเอง (อัปโหลด) ⇒ **ต้องอยู่นอกฟอร์มบันทึก** เสมอ
 *   (เคสจริงรอบ 203: วางซ้อนแล้ว React ฟ้อง hydration error และเบราว์เซอร์ตัดฟอร์มชั้นในทิ้ง)
 * - ค่าภาพส่งไปกับฟอร์มบันทึกด้วย input ซ่อน (state ฝั่งจอ = ค่าล่าสุดที่เลือก/อัปโหลด)
 */
export function HeroPrCardEditor({
  card,
  frame: cardFrame,
  strings,
}: {
  readonly card: HeroCardInput;
  readonly frame: PrCardFrame;
  readonly strings: Messages["admin"];
}) {
  /* ค่าภาพ = state ฝั่งจอ (อัปโหลด/เลือกจากคลังแล้วส่งค่าล่าสุดตอนกดบันทึก) */
  const [image, setImage] = useState({
    path: card.imagePath,
    altTh: card.imageAltTh,
    altEn: card.imageAltEn,
    hasWatermark: false,
  });

  /* กรอบภาพ (รอบที่ 208) — เลือกได้ว่า "ยืดหดตามภาพ" หรือกรอบคงที่ · พรีวิวเปลี่ยนตามทันที */
  const [frame, setFrame] = useState<PrCardFrame>(cardFrame);

  const field = "border-line text-fg w-full rounded-md border px-2 py-1 text-sm";

  return (
    <section className="border-line bg-surface flex flex-col gap-3 rounded-xl border p-3">
      <div className="flex flex-col gap-1">
        <p className="text-fg text-sm font-semibold">{strings.prCardTitle}</p>
        <p className="text-fg-muted text-xs">{strings.prCardHint}</p>
      </div>

      {/* ผัง: ภาพ (ซ้าย) · ข้อความ (ขวา) — บนจอเล็กจะเรียงบนลงล่างตามลำดับนี้ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/*
          ซ้าย: ภาพการ์ด — แสดงแบบ "เห็นเต็มใบ" (contain)
          ⚠️ `ImageDrop` **มีฟอร์มของตัวเอง** (สำหรับอัปโหลด) ⇒ ห้ามวางซ้อนในฟอร์มบันทึก
          (เคสจริง: React ฟ้อง hydration error ว่าแท็กฟอร์มซ้อนกัน แล้วเบราว์เซอร์ตัดฟอร์มชั้นในทิ้ง
          = ปุ่มอัปโหลดพัง) — รูปแบบเดียวกับจอแคมเปญ
          ⚠️ คอมเมนต์นี้ **ห้ามมีตัวอักษรแท็กฟอร์ม** เพราะเทสต์สแกนซอร์สนับความลึกของฟอร์มแบบตรง ๆ
        */}
        <div className="flex flex-col gap-2">
          <ImageDrop
            strings={strings}
            value={image.path.trim() === "" ? null : image}
            onChange={(patch) => setImage((current) => ({ ...current, ...patch }))}
            label={strings.prCardFieldImage}
            /* กรอบว่างโชว์สัดส่วนโปสเตอร์แนวตั้ง (4:5) · ภาพจริงแสดงเต็มใบ */
            frameAspect={4 / 5}
            frameHint={strings.prCardImageHint}
            previewFit="contain"
            previewAspect={previewAspectOf(frame)}
            showWatermark={false}
          />
        </div>

        {/* ขวา: ข้อความ + ปุ่มบันทึก (ค่าภาพส่งไปกับฟอร์มนี้ด้วย input ซ่อน) */}
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
            <label className="text-fg-muted flex flex-col gap-1 text-[11px] sm:col-span-2">
              {strings.prCardFieldBodyTh}
              <input type="text" name="bodyTh" required maxLength={200} defaultValue={card.bodyTh} className={field} />
            </label>
            <label className="text-fg-muted flex flex-col gap-1 text-[11px] sm:col-span-2">
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
              {strings.prCardFieldFrame}
              <select
                name="imageFrame"
                value={frame}
                onChange={(event) => setFrame(frameOf(event.target.value))}
                className={field}
              >
                {PR_CARD_FRAMES.map((option) => (
                  <option key={option} value={option}>
                    {strings.prCardFrameLabels[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-fg-muted flex flex-col gap-1 text-[11px] sm:col-span-2">
              {strings.prCardFieldHref}
              <input type="text" name="href" maxLength={300} defaultValue={card.href} className={field} />
            </label>
          </div>

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
      </div>
    </section>
  );
}

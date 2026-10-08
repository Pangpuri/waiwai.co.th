"use client";

import {
  addCampaignAction,
  removeCampaignAction,
  restoreCampaignAction,
  saveCampaignAction,
} from "@/app/admin/hero/campaign-actions";
import {
  CAMPAIGN_ANCHOR_PRESETS,
  DEFAULT_PLACEMENT_ANCHOR,
  EMPTY_CAMPAIGN_IMAGE_DRAFT,
  MAX_CAMPAIGNS,
  anchorPresetOf,
  campaignReadiness,
  campaignWindowState,
  liveCampaignsOf,
  mergeCampaignImage,
  toDateTimeLocalValue,
  type Campaign,
  type CampaignAnchorPreset,
  type CampaignImageDraft,
  type CampaignPlacement,
} from "@/lib/campaigns/model";
import { useState } from "react";

import { CampaignAnchorPreview } from "@/features/admin/ui/campaign-anchor-preview";
import { ImageDrop } from "@/features/admin/ui/image-drop";
import type { Messages } from "@/lib/i18n/messages/th";

export type CampaignSlideOption = { readonly id: string; readonly label: string; readonly mediaPath: string };

/**
 * หน้า "แคมเปญ" (แท็บใน `/admin/hero` · รอบที่ 190)
 *
 * มติเจ้าของ: แคมเปญต้องเป็นของตัวเอง — สร้างครั้งเดียว · เลือกว่าจะแสดงบนสไลด์ไหน (ไม่เลือก = ทุกสไลด์) ·
 * ตั้งช่วงเวลาให้ขึ้น/ลงเอง ⇒ ไม่ต้องพิมพ์ซ้ำทุกสไลด์ และเห็นของซ้ำ/ของว่างได้จากที่เดียว
 *
 * - แสดง **คำเตือนความพร้อม** (`campaignReadiness`) ⇒ กัน "แคมเปญเปล่าขึ้นเว็บ"
 * - สถานะ: ฉบับร่าง/เผยแพร่ + ช่วงเวลา (แสดงตลอด/รอเริ่ม/กำลังแสดง/หมดเวลา)
 * - ตำแหน่งการ์ด: กรอกตัวเลข % หรือกดปุ่มลัด ซ้าย/กลาง/ขวา (ลากเองได้ในขั้นถัดไป)
 * - ทุกอย่างเป็น `<form>` ธรรมดา ⇒ ใช้ได้แม้ปิด JavaScript · ⚠️ ไม่มี `<form>` ซ้อนกัน
 */
export function CampaignManager({
  campaigns,
  trashedCampaigns,
  newsPlacements,
  slideOptions,
  strings,
  nowIso,
}: {
  readonly campaigns: readonly Campaign[];
  readonly trashedCampaigns: readonly Campaign[];
  /* ตำแหน่งการ์ดบนหน้าเว็บอื่น (รอบที่ 198) — คีย์ = campaignId */
  readonly newsPlacements: Readonly<Record<string, CampaignPlacement>>;
  readonly slideOptions: readonly CampaignSlideOption[];
  readonly strings: Messages["admin"];
  readonly nowIso: string;
}) {
  const now = Date.parse(nowIso);
  /* รอบที่ 198: การ์ดที่คนเห็นบนเว็บ "ตอนนี้" — โชว์ไว้บนสุดของแท็บเพื่อพาไปแก้ใบที่ถูก */
  const live = liveCampaignsOf(campaigns, now);
  const liveIds = new Set(live.map((campaign) => campaign.id));
  /* จุดยึดฉบับร่างต่อแคมเปญ: ลากในพรีวิว/แก้ตัวเลข แล้วกด "บันทึก" จึงเขียนฐานข้อมูล */
  const [anchors, setAnchors] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(campaigns.map((campaign) => [campaign.id, { x: campaign.anchorX, y: campaign.anchorY }])),
  );
  const anchorOf = (id: string, fallbackX: number, fallbackY: number) => anchors[id] ?? { x: fallbackX, y: fallbackY };
  /*
    จุดยึดของ "หน้าข่าวสาร" (รอบที่ 198) — แยกจากของหน้าแรกโดยสิ้นเชิง
    ค่าเริ่มต้นมาจากตาราง `campaign_placement` (ไม่มีแถว = ปิดไว้ + ตำแหน่งซ้ายกลาง)
  */
  const [newsAnchors, setNewsAnchors] = useState<Record<string, { x: number; y: number }>>(() =>
    Object.fromEntries(
      campaigns.map((campaign) => {
        const placement = newsPlacements[campaign.id];
        return [
          campaign.id,
          placement === undefined ? { x: DEFAULT_PLACEMENT_ANCHOR.x, y: DEFAULT_PLACEMENT_ANCHOR.y } : { x: placement.anchorX, y: placement.anchorY },
        ];
      }),
    ),
  );
  const newsAnchorOf = (id: string) => newsAnchors[id] ?? { x: DEFAULT_PLACEMENT_ANCHOR.x, y: DEFAULT_PLACEMENT_ANCHOR.y };
  const setNewsAnchor = (id: string, x: number, y: number) => setNewsAnchors((current) => ({ ...current, [id]: { x, y } }));
  /*
    ภาพของการ์ด (รอบที่ 193): เลือกจากคลัง/อัปโหลดในหน้าจอ แล้วกดบันทึกจึงเขียนฐานข้อมูล
    ⚠️ รอบที่ 195: ช่องภาพส่งค่าเป็น **patch บางส่วน** ⇒ ต้องรวมผ่าน `mergeCampaignImage()` เท่านั้น
       (เดิมอ่านเป็นค่าเต็ม ⇒ แก้คำอธิบายภาพแล้วพาธถูกล้าง = ภาพหาย — บั๊กจริงที่เจ้าของเจอ)
  */
  const [images, setImages] = useState<Record<string, CampaignImageDraft>>(() =>
    Object.fromEntries(
      campaigns.map((campaign) => [
        campaign.id,
        { path: campaign.imagePath, altTh: campaign.imageAltTh, altEn: campaign.imageAltEn } satisfies CampaignImageDraft,
      ]),
    ),
  );
  const imageOf = (id: string): CampaignImageDraft => images[id] ?? EMPTY_CAMPAIGN_IMAGE_DRAFT;
  function patchImage(id: string, patch: Partial<CampaignImageDraft>): void {
    setImages((prev) => ({ ...prev, [id]: mergeCampaignImage(prev[id] ?? EMPTY_CAMPAIGN_IMAGE_DRAFT, patch) }));
  }
  function setAnchor(id: string, x: number, y: number): void {
    setAnchors((prev) => ({ ...prev, [id]: { x: Math.min(100, Math.max(0, Math.round(x))), y: Math.min(100, Math.max(0, Math.round(y))) } }));
  }
  const stateLabel: Readonly<Record<string, string>> = {
    always: strings.heroCardStateAlways,
    scheduled: strings.heroCardStateScheduled,
    live: strings.heroCardStateLive,
    expired: strings.heroCardStateExpired,
  };
  const presetLabel: Readonly<Record<CampaignAnchorPreset, string>> = {
    left: strings.heroCardPositionLeft,
    center: strings.heroCardPositionCenter,
    right: strings.heroCardPositionRight,
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-fg-muted max-w-3xl text-sm">{strings.campaignIntro}</p>
        <p className="text-fg-muted text-xs">{strings.campaignMax.replace("{max}", String(MAX_CAMPAIGNS))}</p>
      </div>

      {/*
        ★ รอบที่ 198 — เจ้าของทดสอบแล้วเจอว่า "กดเพิ่ม = ได้การ์ดใหม่" ไม่ได้แก้การ์ดที่ขยับอยู่บนเว็บ
        ⇒ เปิดแท็บนี้มาต้องเห็นก่อนว่า **ใบไหนคือการ์ดที่คนเห็นบนเว็บตอนนี้** แล้วมีปุ่มพาไปแก้ใบนั้น
      */}
      <div className="border-line bg-surface flex flex-col gap-2 rounded-xl border p-3">
        <p className="text-fg text-sm font-semibold">{strings.campaignLiveTitle}</p>
        {live.length === 0 ? (
          <p className="text-fg-muted text-xs">{strings.campaignLiveNone}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {live.map((campaign) => (
              <li key={campaign.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-fg text-xs">
                  <span className="font-semibold">{campaign.name.trim() === "" ? campaign.title.th : campaign.name}</span>
                  {" · "}
                  {strings.campaignLivePosition
                    .replace("{x}", String(campaign.anchorX))
                    .replace("{y}", String(campaign.anchorY))}
                </span>
                <a
                  href={`#campaign-${campaign.id}`}
                  className="border-line text-fg rounded-md border px-2 py-1 text-xs font-semibold"
                >
                  {strings.campaignLiveEdit}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-fg-muted text-xs">{strings.campaignAddHint}</p>
        <form action={addCampaignAction}>
          <button type="submit" className="border-line text-fg rounded-md border px-3 py-1.5 text-sm font-semibold">
            {strings.campaignAdd}
          </button>
        </form>
      </div>

      {campaigns.length === 0 ? (
        <p className="border-line text-fg-muted rounded-xl border border-dashed p-6 text-sm">{strings.campaignEmpty}</p>
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {campaigns.map((campaign) => {
            const state = campaignWindowState(campaign, now);
            /*
              ความพร้อมคำนวณจาก **ค่าที่แก้ค้างในฟอร์มด้วย** (ภาพ/คำอธิบายภาพ)
              ⇒ เลือกภาพแล้วยังไม่ใส่คำอธิบายภาพ = ขึ้น "ยังไม่พร้อม" ทันที ก่อนกดบันทึก (รอบที่ 195)
              ⚠️ ช่องข้อความ (ชื่อ/หัวข้อ/ลิงก์) ยังเป็น `defaultValue` ⇒ คำเตือนของช่องนั้นอัปเดตหลังบันทึก
            */
            const warnings = campaignReadiness({
              ...campaign,
              imagePath: imageOf(campaign.id).path,
              imageAltTh: imageOf(campaign.id).altTh,
            });
            const preset = anchorPresetOf(campaign.anchorX, campaign.anchorY);
            return (
              <li
                key={campaign.id}
                id={`campaign-${campaign.id}`}
                className="border-line bg-surface flex scroll-mt-24 flex-col gap-3 rounded-xl border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-fg text-sm font-semibold">{campaign.name.trim() === "" ? campaign.title.th : campaign.name}</p>
                  <span className="flex flex-wrap items-center gap-1 text-[11px]">
                    {liveIds.has(campaign.id) ? (
                      <span className="bg-brand-red text-on-brand rounded-full px-2 py-0.5 font-semibold">{strings.campaignLiveBadge}</span>
                    ) : null}
                    <span className="border-line text-fg-muted rounded-full border px-2 py-0.5">
                      {campaign.status === "published" ? strings.campaignStatusPublished : strings.campaignStatusDraft}
                    </span>
                    <span className="border-line text-fg-muted rounded-full border px-2 py-0.5">{stateLabel[state] ?? state}</span>
                    <span className="border-line text-fg-muted rounded-full border px-2 py-0.5">
                      {campaign.slideIds.length === 0
                        ? strings.campaignSlidesAll
                        : strings.campaignSlideCount.replace("{n}", String(campaign.slideIds.length))}
                    </span>
                  </span>
                </div>

                {/* คำเตือนความพร้อม — กันแคมเปญเปล่าขึ้นเว็บ */}
                {warnings.length === 0 ? (
                  <p className="text-[11px] text-brand-red">{strings.campaignReady}</p>
                ) : (
                  <details className="text-fg-muted text-[11px]">
                    <summary className="cursor-pointer font-semibold">{strings.campaignNotReady}</summary>
                    <ul className="mt-1 list-disc pl-4">
                      {warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* ช่องภาพกลาง — เลือกจากคลัง · อัปโหลดจากเครื่อง · ลากวาง · ย่อภาพให้เอง */}
                {/* ⚠️ ImageDrop เรนเดอร์ฟอร์มของตัวเอง ⇒ ต้องอยู่ "นอก" ฟอร์มบันทึก (บทเรียนรอบ 129/188) */}
                <ImageDrop
                  strings={strings}
                  compact
                  label={strings.campaignImage}
                  /* การ์ดแคมเปญไม่มีแนวคิด "ลายน้ำ" ⇒ ไม่ต้องมีช่องนั้นให้สับสน (รอบที่ 195) */
                  showWatermark={false}
                  value={
                    imageOf(campaign.id).path.trim() === ""
                      ? null
                      : { path: imageOf(campaign.id).path, altTh: imageOf(campaign.id).altTh, altEn: imageOf(campaign.id).altEn, hasWatermark: false }
                  }
                  onChange={(patch) => patchImage(campaign.id, patch)}
                />
                <form action={saveCampaignAction} className="flex flex-col gap-2">
                  <input type="hidden" name="id" value={campaign.id} />
                  <input type="hidden" name="imagePath" value={imageOf(campaign.id).path} />
                  <input type="hidden" name="imageAltTh" value={imageOf(campaign.id).altTh} />
                  <input type="hidden" name="imageAltEn" value={imageOf(campaign.id).altEn} />
                  <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
                    {strings.campaignName}
                    <input type="text" name="name" defaultValue={campaign.name} className="border-line text-fg rounded-md border px-2 py-1 text-xs" />
                  </label>
                  <div className="flex gap-2">
                    <label className="text-fg-muted flex flex-1 flex-col gap-1 text-[11px]">
                      {strings.heroCardTitle} (TH)
                      <input type="text" name="titleTh" defaultValue={campaign.title.th} className="border-line text-fg rounded-md border px-2 py-1 text-xs" />
                    </label>
                    <label className="text-fg-muted flex flex-1 flex-col gap-1 text-[11px]">
                      {strings.heroCardTitle} (EN)
                      <input type="text" name="titleEn" defaultValue={campaign.title.en} className="border-line text-fg rounded-md border px-2 py-1 text-xs" />
                    </label>
                  </div>
                  <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
                    {strings.heroCardBody} (TH)
                    <textarea name="bodyTh" rows={2} defaultValue={campaign.body.th} className="border-line text-fg rounded-md border px-2 py-1 text-xs" />
                  </label>
                  <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
                    {strings.heroCardBody} (EN)
                    <textarea name="bodyEn" rows={2} defaultValue={campaign.body.en} className="border-line text-fg rounded-md border px-2 py-1 text-xs" />
                  </label>
                  <div className="flex gap-2">
                    <label className="text-fg-muted flex flex-1 flex-col gap-1 text-[11px]">
                      {strings.heroCardCtaLabel} (TH)
                      <input type="text" name="ctaLabelTh" defaultValue={campaign.ctaLabel.th} className="border-line text-fg rounded-md border px-2 py-1 text-xs" />
                    </label>
                    <label className="text-fg-muted flex flex-1 flex-col gap-1 text-[11px]">
                      {strings.heroCardCtaLabel} (EN)
                      <input type="text" name="ctaLabelEn" defaultValue={campaign.ctaLabel.en} className="border-line text-fg rounded-md border px-2 py-1 text-xs" />
                    </label>
                  </div>
                  <label className="text-fg-muted flex flex-col gap-1 text-[11px]">
                    {strings.heroCardCtaHref}
                    <input type="text" name="ctaHref" defaultValue={campaign.ctaHref} placeholder="/products" className="border-line text-fg rounded-md border px-2 py-1 text-xs" />
                  </label>

                  {/* ตำแหน่งการ์ด: ตัวเลข % (ลากเองได้ในขั้นถัดไป) + ปุ่มลัด */}
                  <fieldset className="border-line flex flex-col gap-2 rounded-lg border p-2">
                    <legend className="text-fg-muted px-1 text-[11px]">
                      {strings.campaignPosition} {preset === null ? `(${strings.campaignAnchorCustom})` : ""}
                    </legend>
                    <CampaignAnchorPreview
                      imagePath={(slideOptions.find((option) => campaign.slideIds.includes(option.id)) ?? slideOptions[0])?.mediaPath ?? ""}
                      imageAltFallback={campaign.title.th}
                      title={campaign.title.th}
                      body={campaign.body.th}
                      ctaLabel={campaign.ctaLabel.th}
                      anchorX={anchorOf(campaign.id, campaign.anchorX, campaign.anchorY).x}
                      anchorY={anchorOf(campaign.id, campaign.anchorX, campaign.anchorY).y}
                      onAnchorChange={(x, y) => setAnchor(campaign.id, x, y)}
                      strings={strings}
                    />
                    <div className="flex flex-wrap gap-2">
                      <label className="text-fg-muted flex items-center gap-1 text-[11px]">
                        X%
                        <input type="number" name="anchorX" min={0} max={100} value={anchorOf(campaign.id, campaign.anchorX, campaign.anchorY).x} onChange={(event) => setAnchor(campaign.id, Number(event.target.value), anchorOf(campaign.id, campaign.anchorX, campaign.anchorY).y)} className="border-line text-fg w-16 rounded-md border px-2 py-1 text-xs" />
                      </label>
                      <label className="text-fg-muted flex items-center gap-1 text-[11px]">
                        Y%
                        <input type="number" name="anchorY" min={0} max={100} value={anchorOf(campaign.id, campaign.anchorX, campaign.anchorY).y} onChange={(event) => setAnchor(campaign.id, anchorOf(campaign.id, campaign.anchorX, campaign.anchorY).x, Number(event.target.value))} className="border-line text-fg w-16 rounded-md border px-2 py-1 text-xs" />
                      </label>
                      <button type="submit" name="preset" value="left" className="border-line text-fg rounded-md border px-2 py-1 text-[11px]">
                        {presetLabel.left}
                      </button>
                      <button type="submit" name="preset" value="center" className="border-line text-fg rounded-md border px-2 py-1 text-[11px]">
                        {presetLabel.center}
                      </button>
                      <button type="submit" name="preset" value="right" className="border-line text-fg rounded-md border px-2 py-1 text-[11px]">
                        {presetLabel.right}
                      </button>
                    </div>
                  </fieldset>

                  {/*
                    ── การ์ดบนหน้าอื่น: หน้าข่าวสาร (รอบที่ 198 · migration 0034) ─────────────────
                    ทำไมต้องมี: เจ้าของสั่ง *"รวมแคมเปญและข่าวสารล่าสุดไว้ที่หน้าข่าวสาร"*
                    ⇒ การ์ดใบเดิมโชว์ได้หลายหน้า และ **แต่ละหน้ามีจุดยึดของตัวเอง**
                    · เวทีในพรีวิวเป็นกล่องเปล่า (หน้าข่าวสารไม่มีภาพสไลด์) ⇒ `imagePath=""`
                    · ไม่มี `<form>` ซ้อน (พรีวิวไม่เรนเดอร์ฟอร์ม) — มีเทสต์กันไว้ตั้งแต่รอบที่ 129
                  */}
                  <fieldset className="border-line flex flex-col gap-2 rounded-lg border p-2">
                    <legend className="text-fg-muted px-1 text-[11px]">{strings.campaignNewsPlacement}</legend>
                    <label className="text-fg flex items-center gap-2 text-xs font-semibold">
                      <input
                        type="checkbox"
                        name="showOnNews"
                        defaultChecked={newsPlacements[campaign.id]?.isEnabled === true}
                      />
                      {strings.campaignShowOnNews}
                    </label>
                    <p className="text-fg-muted text-[11px]">{strings.campaignShowOnNewsHint}</p>
                    <CampaignAnchorPreview
                      imagePath=""
                      imageAltFallback={campaign.title.th}
                      title={campaign.title.th}
                      body={campaign.body.th}
                      ctaLabel={campaign.ctaLabel.th}
                      anchorX={newsAnchorOf(campaign.id).x}
                      anchorY={newsAnchorOf(campaign.id).y}
                      onAnchorChange={(x, y) => setNewsAnchor(campaign.id, x, y)}
                      strings={strings}
                    />
                    <div className="flex flex-wrap gap-2">
                      <label className="text-fg-muted flex items-center gap-1 text-[11px]">
                        X%
                        <input
                          type="number"
                          name="newsAnchorX"
                          min={0}
                          max={100}
                          value={newsAnchorOf(campaign.id).x}
                          onChange={(event) => setNewsAnchor(campaign.id, Number(event.target.value), newsAnchorOf(campaign.id).y)}
                          className="border-line text-fg w-16 rounded-md border px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="text-fg-muted flex items-center gap-1 text-[11px]">
                        Y%
                        <input
                          type="number"
                          name="newsAnchorY"
                          min={0}
                          max={100}
                          value={newsAnchorOf(campaign.id).y}
                          onChange={(event) => setNewsAnchor(campaign.id, newsAnchorOf(campaign.id).x, Number(event.target.value))}
                          className="border-line text-fg w-16 rounded-md border px-2 py-1 text-xs"
                        />
                      </label>
                      {CAMPAIGN_PRESET_BUTTONS.map((presetKey) => (
                        <button
                          key={presetKey}
                          type="button"
                          onClick={() => setNewsAnchor(campaign.id, CAMPAIGN_ANCHOR_PRESETS[presetKey].x, CAMPAIGN_ANCHOR_PRESETS[presetKey].y)}
                          className="border-line text-fg rounded-md border px-2 py-1 text-[11px]"
                        >
                          {presetLabel[presetKey]}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {/* สไลด์ที่จะแสดง — ไม่เลือกเลย = ทุกสไลด์ */}
                  <fieldset className="border-line flex flex-col gap-1 rounded-lg border p-2">
                    <legend className="text-fg-muted px-1 text-[11px]">{strings.campaignSlides}</legend>
                    <p className="text-fg-muted text-[11px]">{strings.campaignSlidesAll}</p>
                    <div className="flex flex-wrap gap-3">
                      {slideOptions.map((option) => (
                        <label key={option.id} className="text-fg-muted flex items-center gap-1 text-[11px]">
                          <input type="checkbox" name="slideIds" value={option.id} defaultChecked={campaign.slideIds.includes(option.id)} />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="flex gap-2">
                    <label className="text-fg-muted flex flex-1 flex-col gap-1 text-[11px]">
                      {strings.heroCardStarts}
                      <input type="datetime-local" name="startsAt" defaultValue={toDateTimeLocalValue(campaign.startsAt)} className="border-line text-fg rounded-md border px-2 py-1 text-xs" />
                    </label>
                    <label className="text-fg-muted flex flex-1 flex-col gap-1 text-[11px]">
                      {strings.heroCardEnds}
                      <input type="datetime-local" name="endsAt" defaultValue={toDateTimeLocalValue(campaign.endsAt)} className="border-line text-fg rounded-md border px-2 py-1 text-xs" />
                    </label>
                  </div>
                  <p className="text-fg-muted text-[11px]">{strings.heroCardWindowHint}</p>
                  <label className="text-fg-muted flex items-center gap-2 text-[11px]">
                    <input type="checkbox" name="isActive" defaultChecked={campaign.isActive} />
                    {strings.heroAdminToggle}
                  </label>
                  {/*
                    ★ รอบที่ 199 (บั๊กจริงจากเจ้าของ): ปุ่ม "เผยแพร่" เคยอยู่ **ฟอร์มแยก** ที่ส่งสำเนาค่าจาก
                    ฐานข้อมูล (ไม่ใช่ค่าที่พิมพ์บนจอ) ⇒ พิมพ์หัวข้อใหม่แล้วกดเผยแพร่ = ระบบยังเห็นหัวข้อเก่า (ว่าง)
                    ⇒ "ช่องหัวข้อ (TH) — ต้องกรอก" ทั้งที่กล่องมีข้อความ ⇒ รวมเป็นฟอร์มเดียว: ตรวจค่าที่พิมพ์ → บันทึก → เปลี่ยนสถานะ
                  */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="submit"
                      name="intent"
                      value="save"
                      className="border-line text-fg rounded-md border px-3 py-1.5 text-xs font-semibold"
                    >
                      {strings.heroCardSave}
                    </button>
                    <button
                      type="submit"
                      name="intent"
                      value={campaign.status === "published" ? "unpublish" : "publish"}
                      className="bg-brand-red text-on-brand rounded-md px-3 py-1.5 text-xs font-semibold"
                    >
                      {campaign.status === "published" ? strings.campaignUnpublish : strings.campaignPublish}
                    </button>
                  </div>
                </form>

                {/*
                  ⚠️ ฟอร์มแยกที่เหลือ = การย้ายเข้าถังเท่านั้น
                  ห้ามใส่สำเนาค่าของการ์ดไว้ในฟอร์มอื่นอีก — จะกลับไปเป็นบั๊กเดิม (ค่าเก่า/ค่าว่างหลอกผู้ใช้)
                */}
                <div className="flex flex-wrap items-center gap-2">
                  <form action={removeCampaignAction}>
                    <input type="hidden" name="id" value={campaign.id} />
                    <button type="submit" className="border-line text-fg-muted rounded-md border px-2 py-1 text-xs">
                      {strings.heroCardRemove}
                    </button>
                  </form>
                </div>
                <p className="text-fg-muted text-[11px]">{strings.heroCardTitleRequired}</p>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        ★ รอบที่ 198 — ถังขยะของแคมเปญ: ก่อนรอบนี้ย้ายเข้าถังได้แต่ **ไม่มีทางกู้คืนจากจอเลย**
        (เจ้าของกดลบการ์ดทดสอบแล้วกู้ไม่ได้) ⇒ ต้องดู/กู้คืนได้จากที่นี่
      */}
      <details className="border-line rounded-xl border p-3">
        <summary className="text-fg cursor-pointer text-sm font-semibold">
          {strings.campaignTrashTitle} ({trashedCampaigns.length})
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-fg-muted text-[11px]">{strings.campaignTrashHint}</p>
          {trashedCampaigns.length === 0 ? (
            <p className="text-fg-muted text-xs">{strings.campaignTrashEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {trashedCampaigns.map((campaign) => (
                <li key={campaign.id} className="border-line flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2">
                  <span className="text-fg text-xs">
                    {campaign.name.trim() === "" ? campaign.title.th : campaign.name}
                  </span>
                  <form action={restoreCampaignAction}>
                    <input type="hidden" name="id" value={campaign.id} />
                    <button type="submit" className="border-line text-fg rounded-md border px-2 py-1 text-xs font-semibold">
                      {strings.campaignRestore}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </section>
  );
}

/** ปุ่มลัดตำแหน่งที่ใช้ในหน้าจอ (ส่งออกให้เทสต์ตรวจได้ว่าตรงกับทะเบียนกลาง) */
export const CAMPAIGN_PRESET_BUTTONS: readonly CampaignAnchorPreset[] = ["left", "center", "right"];
export const CAMPAIGN_PRESET_ANCHORS = CAMPAIGN_ANCHOR_PRESETS;

"use client";

import { useActionState, useEffect, useState } from "react";

import { publishNavbarAction, saveNavbarDraftAction } from "@/app/admin/builder/navbar/actions";
import { INITIAL_BUILDER_STATE, type BuilderState } from "@/features/admin/builder-state";
import { ImageDrop } from "@/features/admin/ui/image-drop";
import {
  MAX_NAV_BUTTONS,
  MAX_NAV_ITEMS,
  NAVBAR_BACKGROUNDS,
  NAVBAR_BUTTON_POSITIONS,
  NAVBAR_BUTTON_TONES,
  NAVBAR_HEIGHTS,
  NAV_ICON_KEYS,
  navbarErrorsOf,
  validateNavbarConfig,
  type NavbarConfig,
  type NavbarItem,
} from "@/lib/chrome/navbar";
import { NavIcon } from "@/features/shell/ui/nav-icon";

/**
 * ตัวแก้ "แถบเมนู (navbar)" — ใช้ในแผงขวาของหน้าสร้างหน้าเว็บ (ผู้ใช้สั่ง รอบที่ 53)
 *
 * ออกแบบให้ตรงกับที่ผู้ใช้สั่ง: โลโก้ (ลากวาง) · สไตล์ (พื้นหลัง/ความสูง) ·
 * เมนูเพิ่ม/ลบ/สลับ · ปุ่มเพิ่ม/ลบ + ตำแหน่ง + โทนสีแบรนด์ + ไอคอนพื้นฐาน
 *
 * ⚠️ แก้ในหน้าจอก่อนเสมอ — ต้องกด "บันทึกฉบับร่าง" หรือ "เผยแพร่" จึงมีผล
 */

type Props = {
  readonly initial: NavbarConfig;
  /** id ของเมนูที่เป็น "หน้า" — ชื่อเมนูพวกนี้มาจากตาราง page (แก้ที่แท็บของหน้านั้น) */
  readonly pageNameIds?: readonly string[];
  readonly draftUpdatedAt: string | null;
  readonly publishedAt: string | null;
  readonly strings: {
    readonly [key: string]: string | { readonly [key: string]: string };
  };
};

type NavbarStrings = {
  readonly navbarTitle: string;
  readonly navbarHint: string;
  readonly navbarLogo: string;
  readonly navbarLogoSize: string;
  readonly navbarNoLogo: string;
  readonly navbarBackground: string;
  readonly navbarHeight: string;
  readonly navbarItems: string;
  readonly navbarAddItem: string;
  readonly navbarItemLabelTh: string;
  readonly navbarItemLabelEn: string;
  readonly navbarItemHref: string;
  readonly navbarItemIcon: string;
  readonly navbarButtons: string;
  readonly navbarAddButton: string;
  readonly navbarButtonTone: string;
  readonly navbarButtonPosition: string;
  readonly navbarMoveUp: string;
  readonly navbarMoveDown: string;
  readonly navbarRemove: string;
  readonly navbarPreview: string;
  readonly navbarSaveDraft: string;
  readonly navbarPublish: string;
  readonly navbarIssues: string;
  readonly sizeSm: string;
  readonly sizeMd: string;
  readonly sizeLg: string;
};

function str(value: string | { readonly [key: string]: string } | undefined, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStrings(raw: Props["strings"]): NavbarStrings {
  return {
    navbarTitle: str(raw["navbarTitle"]),
    navbarHint: str(raw["navbarHint"]),
    navbarLogo: str(raw["navbarLogo"]),
    navbarLogoSize: str(raw["navbarLogoSize"]),
    navbarNoLogo: str(raw["navbarNoLogo"]),
    navbarBackground: str(raw["navbarBackground"]),
    navbarHeight: str(raw["navbarHeight"]),
    navbarItems: str(raw["navbarItems"]),
    navbarAddItem: str(raw["navbarAddItem"]),
    navbarItemLabelTh: str(raw["navbarItemLabelTh"]),
    navbarItemLabelEn: str(raw["navbarItemLabelEn"]),
    navbarItemHref: str(raw["navbarItemHref"]),
    navbarItemIcon: str(raw["navbarItemIcon"]),
    navbarButtons: str(raw["navbarButtons"]),
    navbarAddButton: str(raw["navbarAddButton"]),
    navbarButtonTone: str(raw["navbarButtonTone"]),
    navbarButtonPosition: str(raw["navbarButtonPosition"]),
    navbarMoveUp: str(raw["navbarMoveUp"]),
    navbarMoveDown: str(raw["navbarMoveDown"]),
    navbarRemove: str(raw["navbarRemove"]),
    navbarPreview: str(raw["navbarPreview"]),
    navbarSaveDraft: str(raw["navbarSaveDraft"]),
    navbarPublish: str(raw["navbarPublish"]),
    navbarIssues: str(raw["navbarIssues"]),
    sizeSm: str(raw["sizeSm"]),
    sizeMd: str(raw["sizeMd"]),
    sizeLg: str(raw["sizeLg"]),
  };
}

const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted text-xs";

export function NavbarEditor({ initial, pageNameIds = [], draftUpdatedAt, publishedAt, strings: rawStrings }: Props) {
  const strings = asStrings(rawStrings);
  const [config, setConfig] = useState<NavbarConfig>(initial);
  const [draftState, draftAction, draftPending] = useActionState(saveNavbarDraftAction, INITIAL_BUILDER_STATE);
  const [publishState, publishAction, publishPending] = useActionState(publishNavbarAction, INITIAL_BUILDER_STATE);

  const issues = validateNavbarConfig(config);
  const errors = navbarErrorsOf(issues);

  const update = (next: NavbarConfig) => setConfig(next);
  const payload = JSON.stringify(config);

  /*
    ส่งค่าที่กำลังแก้ไปให้พรีวิวทันที (ผู้ใช้สั่ง รอบที่ 54: "วางภาพแล้วโลโก้ต้องเปลี่ยนทันที")
    - ส่งเฉพาะเมื่ออยู่ใน iframe (หน้าต่างแม่ = หน้าสร้างหน้าเว็บ)
    - หน่วง 120ms กันส่งถี่ตอนพิมพ์รัว
    - ⚠️ ไม่ได้บันทึก/เผยแพร่ให้ — เป็นแค่การแสดงผลในพรีวิว
  */
  useEffect(() => {
    /*
      ส่งเสมอ (ไม่ใช่เฉพาะใน iframe): หน้าจอ "ส่วนกลางของเว็บ" เป็นหน้าต่างเดียวกัน จึงรับข้อความนี้
      แล้วส่งต่อเข้า iframe ของตัวเองอีกรอบ (ทำให้พรีวิวเปลี่ยนทันทีทั้งสองหน้าจอ)
    */
    const target = window.parent === window ? window : window.parent;

    const timer = window.setTimeout(() => {
      target.postMessage({ type: "waiwai:navbar", config }, window.location.origin);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [config]);

  const setItem = (index: number, patch: Partial<NavbarItem>) => {
    update({ ...config, items: config.items.map((item, position) => (position === index ? { ...item, ...patch } : item)) });
  };

  const moveItem = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= config.items.length) return;
    const next = [...config.items];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(target, 0, moved);
    update({ ...config, items: next });
  };

  const statusLine = (state: BuilderState): string | null => {
    if (state.status === "idle") return null;
    if (state.status === "published") return draftState.status === "published" ? null : str(rawStrings["publishedBadge"], "");
    return null;
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-fg-muted text-xs">{strings.navbarHint}</p>

      {/* ── โลโก้ ── */}
      <div className="flex flex-col gap-1">
        <p className="text-fg text-xs font-semibold">{strings.navbarLogo}</p>
        <ImageDrop
          strings={rawStrings as unknown as Parameters<typeof ImageDrop>[0]["strings"]}
          compact
          label={strings.navbarLogo}
          value={config.logo === null ? null : { path: config.logo.path, altTh: config.logo.altTh, altEn: config.logo.altEn, hasWatermark: false }}
          onChange={(patch) =>
            update({
              ...config,
              logo:
                patch.path === undefined
                  ? null
                  : {
                      path: patch.path,
                      altTh: patch.altTh ?? config.logo?.altTh ?? "",
                      altEn: patch.altEn ?? config.logo?.altEn ?? "",
                    },
            })
          }
        />
        {config.logo === null ? <p className="text-fg-muted text-[11px]">{strings.navbarNoLogo}</p> : null}
      </div>

      {/* ── สไตล์ ── */}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{strings.navbarBackground}</span>
          <select
            value={config.background}
            onChange={(event) => update({ ...config, background: event.target.value as NavbarConfig["background"] })}
            className={FIELD_CLASS}
          >
            {NAVBAR_BACKGROUNDS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{strings.navbarHeight}</span>
          <select
            value={config.height}
            onChange={(event) => update({ ...config, height: event.target.value as NavbarConfig["height"] })}
            className={FIELD_CLASS}
          >
            {NAVBAR_HEIGHTS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{strings.navbarLogoSize}</span>
          <select
            value={config.logoSize}
            onChange={(event) => update({ ...config, logoSize: event.target.value as NavbarConfig["logoSize"] })}
            className={FIELD_CLASS}
          >
            <option value="sm">{strings.sizeSm}</option>
            <option value="md">{strings.sizeMd}</option>
            <option value="lg">{strings.sizeLg}</option>
          </select>
        </label>
      </div>

      {/* ── เมนู ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-fg text-xs font-semibold">
            {strings.navbarItems} ({config.items.length}/{MAX_NAV_ITEMS})
          </p>
          <button
            type="button"
            disabled={config.items.length >= MAX_NAV_ITEMS}
            onClick={() =>
              update({
                ...config,
                items: [
                  ...config.items,
                  { id: `item-${Date.now()}`, label: { th: "", en: "" }, href: "/", icon: "none" },
                ],
              })
            }
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            {strings.navbarAddItem}
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {config.items.map((item, index) => (
            <li key={item.id} className="border-line flex min-w-0 flex-col gap-1.5 rounded-lg border p-2">
              <div className="flex items-center gap-1">
                <NavIcon name={item.icon} className="text-fg-muted" />
                <span className="text-fg-muted text-[11px]">#{index + 1}</span>
                <div className="ml-auto flex gap-1">
                  <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="border-line text-fg rounded-lg border px-1.5 py-0.5 text-xs disabled:opacity-40">
                    {strings.navbarMoveUp}
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === config.items.length - 1}
                    className="border-line text-fg rounded-lg border px-1.5 py-0.5 text-xs disabled:opacity-40"
                  >
                    {strings.navbarMoveDown}
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ ...config, items: config.items.filter((_entry, position) => position !== index) })}
                    className="border-line text-fg-muted rounded-lg border px-1.5 py-0.5 text-xs"
                  >
                    {strings.navbarRemove}
                  </button>
                </div>
              </div>

              {pageNameIds.includes(item.id) ? (
                <p className="border-line bg-surface-raised text-fg-muted rounded-lg border p-2 text-[11px]">
                  {strings.navbarItemLabelTh}: <span className="text-fg font-semibold">{item.label.th}</span>
                  <br />
                  {str(rawStrings["pageMenuNameFromPage"], "")}
                </p>
              ) : (
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>{strings.navbarItemLabelTh}</span>
                  <input
                    type="text"
                    value={item.label.th}
                    onChange={(event) => setItem(index, { label: { ...item.label, th: event.target.value } })}
                    className={FIELD_CLASS}
                  />
                </label>
              )}
              <label className="flex flex-col gap-1">
                <span className={LABEL_CLASS}>{strings.navbarItemLabelEn}</span>
                <input
                  type="text"
                  value={item.label.en}
                  onChange={(event) => setItem(index, { label: { ...item.label, en: event.target.value } })}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL_CLASS}>{strings.navbarItemHref}</span>
                <input
                  type="text"
                  value={item.href}
                  onChange={(event) => setItem(index, { href: event.target.value })}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL_CLASS}>{strings.navbarItemIcon}</span>
                <select
                  value={item.icon}
                  onChange={(event) => setItem(index, { icon: event.target.value as NavbarItem["icon"] })}
                  className={FIELD_CLASS}
                >
                  {NAV_ICON_KEYS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* ── ปุ่ม ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-fg text-xs font-semibold">
            {strings.navbarButtons} ({config.buttons.length}/{MAX_NAV_BUTTONS})
          </p>
          <button
            type="button"
            disabled={config.buttons.length >= MAX_NAV_BUTTONS}
            onClick={() =>
              update({
                ...config,
                buttons: [
                  ...config.buttons,
                  {
                    id: `button-${Date.now()}`,
                    label: { th: "", en: "" },
                    href: "/",
                    icon: "none",
                    tone: "brand",
                    position: "right",
                  },
                ],
              })
            }
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-2 py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            {strings.navbarAddButton}
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {config.buttons.map((button, index) => (
            <li key={button.id} className="border-line flex min-w-0 flex-col gap-1.5 rounded-lg border p-2">
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ${button.tone === "outline" ? "border-line border text-fg" : "bg-brand-red text-on-brand"}`}>
                  <NavIcon name={button.icon} />
                  {button.label.th === "" ? str(rawStrings["untitledLabel"], "") : button.label.th}
                </span>
                <button
                  type="button"
                  onClick={() => update({ ...config, buttons: config.buttons.filter((_entry, position) => position !== index) })}
                  className="border-line text-fg-muted ml-auto rounded-lg border px-1.5 py-0.5 text-xs"
                >
                  {strings.navbarRemove}
                </button>
              </div>

              <label className="flex flex-col gap-1">
                <span className={LABEL_CLASS}>{strings.navbarItemLabelTh}</span>
                <input
                  type="text"
                  value={button.label.th}
                  onChange={(event) =>
                    update({ ...config, buttons: config.buttons.map((entry, position) => (position === index ? { ...entry, label: { ...entry.label, th: event.target.value } } : entry)) })
                  }
                  className={FIELD_CLASS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL_CLASS}>{strings.navbarItemLabelEn}</span>
                <input
                  type="text"
                  value={button.label.en}
                  onChange={(event) =>
                    update({ ...config, buttons: config.buttons.map((entry, position) => (position === index ? { ...entry, label: { ...entry.label, en: event.target.value } } : entry)) })
                  }
                  className={FIELD_CLASS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL_CLASS}>{strings.navbarItemHref}</span>
                <input
                  type="text"
                  value={button.href}
                  onChange={(event) =>
                    update({ ...config, buttons: config.buttons.map((entry, position) => (position === index ? { ...entry, href: event.target.value } : entry)) })
                  }
                  className={FIELD_CLASS}
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>{strings.navbarButtonTone}</span>
                  <select
                    value={button.tone}
                    onChange={(event) =>
                      update({
                        ...config,
                        buttons: config.buttons.map((entry, position) =>
                          position === index ? { ...entry, tone: event.target.value as NavbarConfig["buttons"][number]["tone"] } : entry,
                        ),
                      })
                    }
                    className={FIELD_CLASS}
                  >
                    {NAVBAR_BUTTON_TONES.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>{strings.navbarButtonPosition}</span>
                  <select
                    value={button.position}
                    onChange={(event) =>
                      update({
                        ...config,
                        buttons: config.buttons.map((entry, position) =>
                          position === index ? { ...entry, position: event.target.value as NavbarConfig["buttons"][number]["position"] } : entry,
                        ),
                      })
                    }
                    className={FIELD_CLASS}
                  >
                    {NAVBAR_BUTTON_POSITIONS.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className={LABEL_CLASS}>{strings.navbarItemIcon}</span>
                  <select
                    value={button.icon}
                    onChange={(event) =>
                      update({
                        ...config,
                        buttons: config.buttons.map((entry, position) =>
                          position === index ? { ...entry, icon: event.target.value as NavbarItem["icon"] } : entry,
                        ),
                      })
                    }
                    className={FIELD_CLASS}
                  >
                    {NAV_ICON_KEYS.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── สิ่งที่ต้องแก้ ── */}
      {errors.length > 0 ? (
        <div className="border-brand-red/60 bg-surface-raised flex flex-col gap-1 rounded-lg border p-2">
          <p className="text-fg text-xs font-semibold">{strings.navbarIssues}</p>
          <ul className="text-fg-muted list-disc pl-5 text-[11px]">
            {errors.slice(0, 8).map((issue) => (
              <li key={`${issue.code}-${issue.path}`}>
                {issue.detail ?? issue.code} · <span className="font-mono">{issue.path}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-fg-muted text-[11px]">
        {publishedAt === null ? "" : `${publishedAt.slice(0, 16).replace("T", " ")}`}
        {draftUpdatedAt === null ? "" : ` · ${str(rawStrings["draftPrefix"], "")} ${draftUpdatedAt.slice(0, 16).replace("T", " ")}`}
      </p>

      {/* ── บันทึก/เผยแพร่ ── */}
      <div className="flex flex-wrap items-center gap-2">
        <form action={draftAction}>
          <input type="hidden" name="payload" value={payload} />
          <button
            type="submit"
            disabled={draftPending || errors.length > 0}
            className="border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            {strings.navbarSaveDraft}
          </button>
        </form>

        <form action={publishAction}>
          <input type="hidden" name="payload" value={payload} />
          <button
            type="submit"
            disabled={publishPending || errors.length > 0}
            className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            {strings.navbarPublish}
          </button>
        </form>

        {statusLine(draftState) ?? statusLine(publishState)}
      </div>
    </div>
  );
}

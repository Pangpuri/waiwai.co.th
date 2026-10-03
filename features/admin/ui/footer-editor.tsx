"use client";

import { useActionState, useEffect, useState } from "react";

import { publishFooterAction, saveFooterDraftAction } from "@/app/admin/builder/footer/actions";
import { INITIAL_BUILDER_STATE } from "@/features/admin/builder-state";
import { NavIcon } from "@/features/shell/ui/nav-icon";
import {
  FOOTER_BACKGROUNDS,
  MAX_FOOTER_GROUPS,
  MAX_FOOTER_LINKS,
  MAX_FOOTER_SOCIALS,
  footerErrorsOf,
  validateFooterConfig,
  type FooterConfig,
  type FooterGroup,
} from "@/lib/chrome/footer";
import { NAV_ICON_KEYS } from "@/lib/chrome/navbar";

/**
 * ตัวแก้ "ท้ายเว็บ" (W3)
 *
 * ผู้ใช้สั่ง: *"แก้โลโก้ ข้อความ ลิงก์ โซเชียลของท้ายเว็บได้"*
 * โครงเดียวกับตัวแก้แถบเมนู: แก้ในหน้าจอ → ส่งค่าให้พรีวิวทันที (hot reload) → กดบันทึกฉบับร่าง/เผยแพร่
 * ⚠️ ข้อความทั้งหมดมาจากพจนานุกรม · สีเลือกจากชุดแบรนด์ · ไอคอนจากชุดที่เขียนเอง
 */

type Strings = {
  readonly footerHint: string;
  readonly footerAbout: string;
  readonly footerContactAddress: string;
  readonly footerContactPhone: string;
  readonly footerContactEmail: string;
  readonly footerGroups: string;
  readonly footerAddGroup: string;
  readonly footerGroupTitle: string;
  readonly footerAddLink: string;
  readonly footerLinkLabel: string;
  readonly footerLinkHref: string;
  readonly footerLinkIcon: string;
  readonly footerSocials: string;
  readonly footerAddSocial: string;
  readonly footerSocialLabel: string;
  readonly footerRights: string;
  readonly footerBackground: string;
  readonly footerSaveDraft: string;
  readonly footerPublish: string;
  readonly footerIssues: string;
  readonly footerRemove: string;
  readonly footerMoveUp: string;
  readonly footerMoveDown: string;
  readonly draftPrefix: string;
};

const FIELD_CLASS =
  "border-line bg-surface text-fg focus-visible:ring-ring w-full rounded-lg border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";
const LABEL_CLASS = "text-fg-muted text-xs";
const BUTTON_CLASS =
  "border-line text-fg hover:bg-surface-raised focus-visible:ring-ring rounded-lg border px-1.5 py-0.5 text-xs focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";

export function FooterEditor({
  initial,
  draftUpdatedAt,
  publishedAt,
  strings,
}: {
  readonly initial: FooterConfig;
  readonly draftUpdatedAt: string | null;
  readonly publishedAt: string | null;
  readonly strings: Strings;
}) {
  const [config, setConfig] = useState<FooterConfig>(initial);
  const [draftState, draftAction, draftPending] = useActionState(saveFooterDraftAction, INITIAL_BUILDER_STATE);
  const [publishState, publishAction, publishPending] = useActionState(publishFooterAction, INITIAL_BUILDER_STATE);

  const issues = validateFooterConfig(config);
  const errors = footerErrorsOf(issues);

  const payload = JSON.stringify(config);

  /* ส่งค่าที่กำลังแก้ให้พรีวิวทันที (hot reload) — เหมือนแถบเมนู */
  useEffect(() => {
    const target = window.parent === window ? window : window.parent;
    const timer = window.setTimeout(() => {
      target.postMessage({ type: "waiwai:footer", config }, window.location.origin);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [config]);

  const setGroup = (index: number, patch: Partial<FooterGroup>) =>
    setConfig({ ...config, groups: config.groups.map((group, position) => (position === index ? { ...group, ...patch } : group)) });

  const moveGroup = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= config.groups.length) return;
    const next = [...config.groups];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(target, 0, moved);
    setConfig({ ...config, groups: next });
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-fg-muted text-xs">{strings.footerHint}</p>

      {/* ── ข้อความ + ข้อมูลติดต่อ + พื้นหลัง ── */}
      <div className="grid gap-2">
        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{strings.footerAbout}</span>
          <textarea
            value={config.about.th}
            onChange={(event) => setConfig({ ...config, about: { ...config.about, th: event.target.value } })}
            rows={3}
            className={FIELD_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{strings.footerContactAddress}</span>
          <textarea
            value={config.contact.address.th}
            onChange={(event) =>
              setConfig({ ...config, contact: { ...config.contact, address: { ...config.contact.address, th: event.target.value } } })
            }
            rows={2}
            className={FIELD_CLASS}
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.footerContactPhone}</span>
            <input
              type="text"
              value={config.contact.phone}
              onChange={(event) => setConfig({ ...config, contact: { ...config.contact, phone: event.target.value } })}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{strings.footerContactEmail}</span>
            <input
              type="text"
              value={config.contact.email}
              onChange={(event) => setConfig({ ...config, contact: { ...config.contact, email: event.target.value } })}
              className={FIELD_CLASS}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>{strings.footerBackground}</span>
          <select
            value={config.background}
            onChange={(event) => setConfig({ ...config, background: event.target.value as FooterConfig["background"] })}
            className={FIELD_CLASS}
          >
            {FOOTER_BACKGROUNDS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── คอลัมน์ลิงก์ ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-fg text-xs font-semibold">
            {strings.footerGroups} ({config.groups.length}/{MAX_FOOTER_GROUPS})
          </p>
          <button
            type="button"
            disabled={config.groups.length >= MAX_FOOTER_GROUPS}
            onClick={() =>
              setConfig({
                ...config,
                groups: [
                  ...config.groups,
                  { id: `group-${Date.now()}`, title: { th: "", en: "" }, links: [] },
                ],
              })
            }
            className={BUTTON_CLASS}
          >
            {strings.footerAddGroup}
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {config.groups.map((group, index) => (
            <li key={group.id} className="border-line flex min-w-0 flex-col gap-1.5 rounded-lg border p-2">
              <div className="flex items-center gap-1">
                <span className="text-fg-muted text-[11px]">#{index + 1}</span>
                <div className="ml-auto flex gap-1">
                  <button type="button" onClick={() => moveGroup(index, -1)} disabled={index === 0} className={BUTTON_CLASS}>
                    {strings.footerMoveUp}
                  </button>
                  <button
                    type="button"
                    onClick={() => moveGroup(index, 1)}
                    disabled={index === config.groups.length - 1}
                    className={BUTTON_CLASS}
                  >
                    {strings.footerMoveDown}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, groups: config.groups.filter((_entry, position) => position !== index) })}
                    className={BUTTON_CLASS}
                  >
                    {strings.footerRemove}
                  </button>
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className={LABEL_CLASS}>{strings.footerGroupTitle}</span>
                <input
                  type="text"
                  value={group.title.th}
                  onChange={(event) => setGroup(index, { title: { ...group.title, th: event.target.value } })}
                  className={FIELD_CLASS}
                />
              </label>

              <ul className="flex flex-col gap-1.5">
                {group.links.map((link, linkIndex) => (
                  <li key={link.id} className="bg-surface-raised flex flex-col gap-1 rounded-lg p-2">
                    <label className="flex flex-col gap-1">
                      <span className={LABEL_CLASS}>{strings.footerLinkLabel}</span>
                      <input
                        type="text"
                        value={link.label.th}
                        onChange={(event) =>
                          setGroup(index, {
                            links: group.links.map((entry, position) =>
                              position === linkIndex ? { ...entry, label: { ...entry.label, th: event.target.value } } : entry,
                            ),
                          })
                        }
                        className={FIELD_CLASS}
                      />
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className={LABEL_CLASS}>{strings.footerLinkHref}</span>
                        <input
                          type="text"
                          value={link.href}
                          onChange={(event) =>
                            setGroup(index, {
                              links: group.links.map((entry, position) =>
                                position === linkIndex ? { ...entry, href: event.target.value } : entry,
                              ),
                            })
                          }
                          className={FIELD_CLASS}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className={LABEL_CLASS}>{strings.footerLinkIcon}</span>
                        <select
                          value={link.icon}
                          onChange={(event) =>
                            setGroup(index, {
                              links: group.links.map((entry, position) =>
                                position === linkIndex ? { ...entry, icon: event.target.value as typeof entry.icon } : entry,
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
                    <button
                      type="button"
                      onClick={() => setGroup(index, { links: group.links.filter((_entry, position) => position !== linkIndex) })}
                      className={`${BUTTON_CLASS} self-start`}
                    >
                      {strings.footerRemove}
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={group.links.length >= MAX_FOOTER_LINKS}
                onClick={() =>
                  setGroup(index, {
                    links: [...group.links, { id: `link-${Date.now()}`, label: { th: "", en: "" }, href: "/", icon: "none" }],
                  })
                }
                className={`${BUTTON_CLASS} self-start`}
              >
                {strings.footerAddLink}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ── โซเชียล ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-fg text-xs font-semibold">
            {strings.footerSocials} ({config.socials.length}/{MAX_FOOTER_SOCIALS})
          </p>
          <button
            type="button"
            disabled={config.socials.length >= MAX_FOOTER_SOCIALS}
            onClick={() =>
              setConfig({
                ...config,
                socials: [...config.socials, { id: `social-${Date.now()}`, label: { th: "", en: "" }, href: "", icon: "line" }],
              })
            }
            className={BUTTON_CLASS}
          >
            {strings.footerAddSocial}
          </button>
        </div>

        <ul className="flex flex-col gap-1.5">
          {config.socials.map((social, index) => (
            <li key={social.id} className="border-line flex flex-wrap items-end gap-1.5 rounded-lg border p-2">
              <NavIcon name={social.icon} className="text-fg-muted mb-1" />
              <label className="flex min-w-24 flex-1 flex-col gap-1">
                <span className={LABEL_CLASS}>{strings.footerSocialLabel}</span>
                <input
                  type="text"
                  value={social.label.th}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      socials: config.socials.map((entry, position) =>
                        position === index ? { ...entry, label: { ...entry.label, th: event.target.value } } : entry,
                      ),
                    })
                  }
                  className={FIELD_CLASS}
                />
              </label>
              <label className="flex min-w-32 flex-1 flex-col gap-1">
                <span className={LABEL_CLASS}>{strings.footerLinkHref}</span>
                <input
                  type="text"
                  value={social.href}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      socials: config.socials.map((entry, position) => (position === index ? { ...entry, href: event.target.value } : entry)),
                    })
                  }
                  className={FIELD_CLASS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL_CLASS}>{strings.footerLinkIcon}</span>
                <select
                  value={social.icon}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      socials: config.socials.map((entry, position) =>
                        position === index ? { ...entry, icon: event.target.value as typeof entry.icon } : entry,
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
              <button
                type="button"
                onClick={() => setConfig({ ...config, socials: config.socials.filter((_entry, position) => position !== index) })}
                className={BUTTON_CLASS}
              >
                {strings.footerRemove}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ── ลิขสิทธิ์ ── */}
      <label className="flex flex-col gap-1">
        <span className={LABEL_CLASS}>{strings.footerRights}</span>
        <input
          type="text"
          value={config.rights.th}
          onChange={(event) => setConfig({ ...config, rights: { ...config.rights, th: event.target.value } })}
          className={FIELD_CLASS}
        />
      </label>

      {/* ── สิ่งที่ต้องแก้ ── */}
      {errors.length > 0 ? (
        <div className="border-brand-red/60 bg-surface-raised flex flex-col gap-1 rounded-lg border p-2">
          <p className="text-fg text-xs font-semibold">{strings.footerIssues}</p>
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
        {publishedAt === null ? "" : publishedAt.slice(0, 16).replace("T", " ")}
        {draftUpdatedAt === null ? "" : ` · ${strings.draftPrefix} ${draftUpdatedAt.slice(0, 16).replace("T", " ")}`}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <form action={draftAction}>
          <input type="hidden" name="payload" value={payload} />
          <button type="submit" disabled={draftPending || errors.length > 0} className={BUTTON_CLASS}>
            {strings.footerSaveDraft}
          </button>
        </form>
        <form action={publishAction}>
          <input type="hidden" name="payload" value={payload} />
          <button
            type="submit"
            disabled={publishPending || errors.length > 0}
            className="bg-brand-red text-on-brand focus-visible:ring-ring rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            {strings.footerPublish}
          </button>
        </form>
        {draftState.status === "published" ? null : null}
        {publishState.status === "published" ? <span className="text-fg-muted text-xs">✓</span> : null}
      </div>
    </div>
  );
}

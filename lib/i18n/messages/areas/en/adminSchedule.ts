/**
 * Dictionary area: admin — scheduled publishing (X2.7 part 1)
 *
 * แยกเป็นพื้นที่ของตัวเองตามกติกาด่าน check:i18n (อย่าขยายเพดานของ admin.ts)
 * ⚠️ ชนิดอ้างจาก "รายการคีย์ของไฟล์ไทย" ⇒ ขาด/เกินคีย์เดียว typecheck แดงทันที
 */
import type { Messages } from "@/lib/i18n/messages/th";
import type { adminSchedule as thAdminSchedule } from "@/lib/i18n/messages/areas/th/adminSchedule";

export const adminSchedule: Pick<Messages["admin"], keyof typeof thAdminSchedule> = {
  /* ── Schedule panel in the page builder ─────────────────────────────────── */
  scheduleTitle: "Schedule publishing",
  scheduleHint:
    "The scheduled time publishes the saved version — it is saved first, then goes live when the time comes.",
  scheduleNone: "No schedule set",
  scheduleAt: "Publishes {time} (UTC)",
  scheduleBy: "Set by {email}",
  scheduleInputLabel: "Date and time (your device time zone)",
  scheduleSet: "Set schedule",
  scheduling: "Saving…",
  scheduleClear: "Clear schedule",
  scheduleSaved: "Publish schedule saved — it will go live when the time comes",
  scheduleCleared: "Publish schedule cleared",

  /* Reasons the schedule cannot be set (mapped from lib/blocks/schedule.ts) */
  scheduleProblemMissingTime: "Pick a date and time before setting the schedule",
  scheduleProblemInvalid: "The selected date and time cannot be read",
  scheduleProblemPast: "That time has already passed — choose a future time",
  scheduleProblemTooFar: "You can schedule at most 1 year ahead",
  scheduleProblemPage: "The target page is missing",
  scheduleProblemContent: "Cannot schedule yet — fix the content errors first",
  scheduleProblemServer: "Could not save the schedule — please try again",

  /* ── Card on the admin overview ────────────────────────────────────────── */
  scheduleCardTitle: "Scheduled work",
  scheduleCardHint:
    "Pages with a schedule are published when due (checked at admin sign-in, by the button below, or by the cron job `npm run db:publish-scheduled`).",
  scheduleCardNone: "No page has a publish schedule",
  scheduleCardDue: "{count} page(s) are due",
  scheduleCardNext: "Next: {time} (UTC)",
  scheduleCardRow: "{page} · {time} (UTC)",
  schedulePublishNow: "Publish due pages now",
  schedulePublishNowHint: "Use this when a scheduled page is due but has not gone live yet (e.g. no cron job is set up).",

  /* ── Audit log trail ──────────────────────────────────────────────────── */
  auditPublishScheduled: "Published on schedule",
};

/**
 * Dictionary area: admin — the "make it live" switch (round 238)
 *
 * ⚠️ Why a separate file: the `admin` area hit the 32KB cap (check:i18n rule:
 * "split into a sub-area, never raise the cap") ⇒ all `live*` keys moved here.
 *
 * Context (a real report from the owner, 2026-10-09):
 *   the public site serves the **published** document, not the draft being edited
 *   ⇒ turning the switch on before publishing showed an old page (preview looked right).
 *   Every string must state which version is being served and what to do first.
 */
export const adminLive = {
  liveOn: "Live on the public site",
  liveOff: "Not live yet",
  liveTurnOn: "Make it live",
  liveTurnOff: "Stop using (back to the designed layout)",
  liveHintOn: "The public site is serving the published version — draft edits need another “Publish” before they appear.",
  liveHintOff: "The public site still shows the designed layout — turn this on when the content is ready.",
  /* Published-vs-draft status (stops turning the switch on and getting an old page) */
  liveSyncOk: "The published version matches the draft you are editing ({published} blocks) — preview equals live.",
  liveSyncStale: "The draft ({draft} blocks) is not published yet — the site still shows the published version ({published} blocks); press “Publish” before turning this on.",
  liveSyncMissing: "This page has no published version yet — press “Publish” first, then turn this on.",
  liveTurnOnBlocked: "Cannot turn on yet — press “Publish” so the draft goes live (otherwise the site shows the old version).",
  liveBlockedStale: "Not turned on — the draft has not been published. Press “Publish” first (turning it on now would show the old version).",
  liveBlockedNoPublished: "Not turned on — this page has no published version yet. Press “Publish” first.",
  /* Round 239 — tell the truth after “Publish”: the switch is a separate step from publishing */
  publishedNotLive: "Published (revision {revision}) — but the public site is still not using this content, because the “Make it live” switch is off ⇒ press that switch in the panel above.",
  publishedLive: "The public site is showing this published version — what you see in the preview is what visitors see.",
};

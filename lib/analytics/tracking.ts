"use client";

import type { ClickEvent } from "./model";

export function trackClick(event: ClickEvent): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/preview/")) return;

  const body = JSON.stringify(event);
  if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }))) {
    return;
  }

  void fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).then((response) => {
    if (!response.ok) console.error(`[analytics] collector returned ${response.status}`);
  }).catch((error: unknown) => {
    console.error("[analytics] collector request failed", error);
  });
}

export function trackPageView(): void {
  trackClick({ type: "site_view", targetId: "site", source: "site" });
}

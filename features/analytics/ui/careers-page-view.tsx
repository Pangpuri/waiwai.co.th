"use client";

import { useEffect, useRef } from "react";

import { trackClick } from "@/lib/analytics/tracking";

export function CareersPageView() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackClick({ type: "careers_view", targetId: "careers", source: "careers" });
  }, []);

  return null;
}

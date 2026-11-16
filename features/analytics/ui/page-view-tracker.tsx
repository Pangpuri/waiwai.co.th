"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { isTrackablePageViewPath } from "@/lib/analytics/model";
import { trackPageView } from "@/lib/analytics/tracking";

export function PageViewTracker({ locale }: { readonly locale: string }) {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!isTrackablePageViewPath(pathname, locale) || lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;
    trackPageView();
  }, [locale, pathname]);

  return null;
}

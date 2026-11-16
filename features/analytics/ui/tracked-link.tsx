"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { trackClick } from "@/lib/analytics/tracking";
import type { ClickEvent } from "@/lib/analytics/model";

export function TrackedLink({
  href,
  event,
  className,
  target,
  rel,
  children,
}: {
  readonly href: string;
  readonly event: ClickEvent;
  readonly className?: string;
  readonly target?: string;
  readonly rel?: string;
  readonly children: ReactNode;
}) {
  return (
    <Link href={href} className={className} target={target} rel={rel} onClick={() => trackClick(event)}>
      {children}
    </Link>
  );
}

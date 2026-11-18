"use client";

import { useState, useRef, useEffect } from "react";

export function AdminTooltip({ text }: { readonly text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (!text) return null;

  return (
    <div className="relative inline-flex shrink-0" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((current) => !current);
        }}
        aria-label="คำแนะนำเมนู"
        title="คลิกเพื่อดูคำแนะนำการใช้งาน"
        className="border-line bg-surface hover:bg-surface-raised text-fg-muted hover:text-fg flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold transition shadow-xs"
      >
        ?
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-50 w-64 rounded-xl border border-line bg-surface p-3 text-xs text-fg shadow-lg">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-semibold text-primary">คำแนะนำการใช้งาน</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              }}
              className="text-fg-muted hover:text-fg text-sm leading-none font-bold px-1"
            >
              ×
            </button>
          </div>
          <p className="leading-relaxed text-fg-muted">{text}</p>
        </div>
      )}
    </div>
  );
}

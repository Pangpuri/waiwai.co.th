"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

import {
  DARK_CLASS,
  THEMES,
  resolveTheme,
  type Theme,
} from "@/lib/theme/theme";
import {
  readServerTheme,
  readTheme,
  subscribeTheme,
  writeTheme,
} from "@/lib/theme/theme-store";

/**
 * ข้อความที่ต้องใช้ — ส่งมาจาก Server Component เป็น plain object
 * (กฎข้อ 3: ห้าม Client Component อ่านพจนานุกรมเอง)
 */
export type ThemeToggleLabels = {
  readonly label: string;
  readonly light: string;
  readonly dark: string;
  readonly system: string;
};

const ICONS: Record<Theme, string> = {
  light:
    "M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  dark: "M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z",
  system: "M4 17V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10M8 21h8m-4-4v4",
};

export function ThemeToggle({ labels }: { readonly labels: ThemeToggleLabels }) {
  /*
    อ่านค่าที่ผู้ใช้เลือกผ่าน useSyncExternalStore
    ฝั่งเซิร์ฟเวอร์ได้ค่าเริ่มต้น แล้ว client จะอัปเดตเป็นค่าจริงหลัง hydrate
  */
  const theme = useSyncExternalStore(subscribeTheme, readTheme, readServerTheme);

  /*
    useLayoutEffect ไม่ใช่ useEffect เพราะต้องตั้งคลาสให้เสร็จก่อน paint เฟรมแรก
    และใน dev ที่ React remount หนึ่งครั้ง สคริปต์ก่อน paint จะไม่ถูกรันซ้ำ เอฟเฟกต์นี้จึงเป็นตัวคืนค่าให้
    (ใน production ไม่มีอะไรเปลี่ยน — ค่าถูกตั้งไปแล้วตั้งแต่ตอนเบราว์เซอร์ parse HTML)
  */
  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    // เอฟเฟกต์นี้แก้ DOM จริง (external system) จึงไม่ผิดกฎ react-hooks
    const apply = () => {
      const resolved = resolveTheme(theme, media.matches);
      document.documentElement.classList.toggle(DARK_CLASS, resolved === "dark");
      document.documentElement.style.colorScheme = resolved;
    };

    apply();

    // โหมด "ตามระบบ" ต้องเปลี่ยนตามทันทีเมื่อผู้ใช้สลับที่ OS
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const text: Record<Theme, string> = {
    light: labels.light,
    dark: labels.dark,
    system: labels.system,
  };

  return (
    <div
      role="group"
      aria-label={labels.label}
      className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5"
    >
      {THEMES.map((option) => {
        const active = theme === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => writeTheme(option)}
            aria-pressed={active}
            title={text[option]}
            className={[
              "grid h-8 w-8 place-items-center rounded-full transition-colors",
              active
                ? "bg-brand-yellow text-accent-on-yellow"
                : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
            ].join(" ")}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d={ICONS[option]} />
            </svg>
            <span className="sr-only">{text[option]}</span>
          </button>
        );
      })}
    </div>
  );
}

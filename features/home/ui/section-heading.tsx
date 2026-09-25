import type { ReactNode } from "react";

type SectionHeadingProps = {
  readonly eyebrow?: string;
  readonly title: string;
  readonly body?: string;
  readonly align?: "start" | "center";
  /** ปุ่ม/ลิงก์ที่วางชิดขวาบนจอใหญ่ */
  readonly action?: ReactNode;
};

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "start",
  action,
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <div
      className={[
        "flex flex-col gap-6",
        centered
          ? "items-center text-center"
          : "sm:flex-row sm:items-end sm:justify-between",
      ].join(" ")}
    >
      <div className={centered ? "max-w-2xl" : "max-w-2xl"}>
        {eyebrow ? (
          <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
            {eyebrow}
          </p>
        ) : null}

        <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight text-fg sm:text-4xl">
          {title}
        </h2>

        {body ? (
          <p className="mt-4 text-base leading-relaxed text-fg-muted">{body}</p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

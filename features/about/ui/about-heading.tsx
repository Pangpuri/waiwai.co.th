type AboutHeadingProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly body?: string;
};

/**
 * หัวข้อของ section ในหน้า /about
 *
 * ตั้งใจให้เป็นคอมโพเนนต์ของ feature นี้ ไม่ดึง SectionHeading ของหน้าแรกมาใช้
 * เพื่อไม่ให้ feature หนึ่งต้องพึ่ง ui ของอีก feature (หัวข้อของแต่ละหน้ามีสัดส่วนต่างกัน)
 */
export function AboutHeading({ eyebrow, title, body }: AboutHeadingProps) {
  return (
    <div className="max-w-2xl">
      <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-accent uppercase">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-red" />
        {eyebrow}
      </p>

      <h2 className="mt-3 font-display text-3xl leading-tight font-extrabold tracking-tight text-fg sm:text-4xl">
        {title}
      </h2>

      {body ? <p className="mt-4 text-base leading-relaxed text-fg-muted">{body}</p> : null}
    </div>
  );
}

import Link from "next/link";

/**
 * แถบนำทาง (breadcrumb) ที่ใช้ร่วมกันหลายหน้า
 *
 * เดิมเป็น markup ที่เขียนซ้ำในหน้า /about — แยกออกมาเพราะหน้า /about/certifications
 * ต้องใช้แบบ 3 ระดับ ถ้าปล่อยให้คัดลอกจะแก้ไม่ตรงกันในอนาคต
 *
 * a11y: รายการสุดท้ายคือหน้าปัจจุบัน → ติด `aria-current="page"` ให้
 * และ `nav` มี `aria-label` ที่รับเข้ามาจากพจนานุกรม (ไม่ hardcode ข้อความ)
 */

export type BreadcrumbItem = {
  readonly label: string;
  /** ไม่ใส่ = รายการสุดท้าย (หน้าปัจจุบัน) */
  readonly href?: string;
};

type BreadcrumbProps = {
  readonly items: readonly BreadcrumbItem[];
  readonly ariaLabel: string;
};

export function Breadcrumb({ items, ariaLabel }: BreadcrumbProps) {
  return (
    <nav aria-label={ariaLabel}>
      <ol className="flex flex-wrap items-center gap-2 text-xs font-medium text-fg-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const showLink = !isLast && item.href !== undefined;

          return (
            <li key={`${index}-${item.label}`} className="flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-line-strong">
                  /
                </span>
              ) : null}

              {showLink ? (
                <Link
                  href={item.href}
                  className="transition-colors hover:text-accent hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-semibold text-fg">
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type CurveTone = "bg" | "bg-cream" | "bg-subtle" | "surface";
type CurveEdge = "top" | "bottom";
type CurveSize = "sm" | "md";

type SectionCurveProps = {
  /** สีของเนิน — ต้องเป็นสีพื้นของ "แถบที่อยู่ฝั่งล่าง" ของขอบนั้น */
  readonly tone: CurveTone;
  /**
   * bottom = เนินเกาะขอบล่างของแถบตัวเอง (ใช้เมื่อแถบถัดไปไม่มีพื้นหลังของตัวเอง)
   * top    = เนินยื่นขึ้นไปเหนือขอบบนของแถบตัวเอง (ใช้เมื่อแถบนี้เป็นแถบสีเต็มความกว้าง)
   */
  readonly edge: CurveEdge;
  readonly size?: CurveSize;
};

/**
 * ขอบโค้งนุ่มระหว่าง section
 *
 * วิธีคิด: ขอบทุกจุดเป็น "เนิน" ของสีแถวล่างที่โป่งขึ้นตรงกลาง ~24px
 * ทำด้วย CSS ล้วน (ไม่ใช้ SVG/ไลบรารี) — `border-top-radius: 50% 100%` บนกล่องเต็มความกว้าง
 * จะได้เนินที่หนาสุดตรงกลาง แล้วค่อย ๆ จางไปหาศูนย์ที่ขอบจอทั้งสองข้าง
 *
 * - กล่องต้องมี `relative` (เนินเป็น absolute) และห้าม `overflow-hidden` ถ้าใช้ `edge="top"`
 *   เพราะเนินต้องยื่นออกไปนอกกล่อง (ไปอยู่ในพื้นที่ว่างของ section ด้านบน)
 * - สีใช้ token ของธีม (bg-bg / bg-bg-cream / bg-bg-subtle / bg-surface) → โหมดมืดทำงานอัตโนมัติ
 *   และผ่านด่าน `npm run check:dark`
 * - ปรับความสูงของเนินได้ที่ SIZE: md = 24px (ระหว่าง section) · sm = 8px (ใน header ที่พื้นที่จำกัด)
 */
const TONE: Record<CurveTone, string> = {
  bg: "bg-bg",
  "bg-cream": "bg-bg-cream",
  "bg-subtle": "bg-bg-subtle",
  surface: "bg-surface",
};

const SHAPE: Record<CurveEdge, Record<CurveSize, string>> = {
  bottom: {
    md: "bottom-0 h-6 rounded-t-[50%_100%]",
    sm: "bottom-0 h-2 rounded-t-[50%_100%]",
  },
  top: {
    md: "-top-6 h-6 rounded-t-[50%_100%]",
    sm: "-top-2 h-2 rounded-t-[50%_100%]",
  },
};

export function SectionCurve({ tone, edge, size = "md" }: SectionCurveProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        // เนินเป็นของประดับ — ต้องไม่บังการคลิกของเนื้อหาที่ทับกันอยู่
        "pointer-events-none absolute inset-x-0",
        SHAPE[edge][size],
        TONE[tone],
      ].join(" ")}
    />
  );
}

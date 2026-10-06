/**
 * กรอบพรีวิว "ขนาดเท่าหน้าเว็บจริง" (รอบที่ 146 · ฟีดแบ็กเจ้าของ)
 *
 * ปัญหาจริง: พรีวิวการ์ดสินค้าเคยเรนเดอร์ **ในคอลัมน์แคบของหลังบ้าน** ตรง ๆ
 *   → `ProductListSection` ใช้ breakpoint ของ **viewport** (`sm:`/`lg:`) ซึ่งยังเป็น "จอใหญ่"
 *   → จัดเป็น 3 คอลัมน์ในพื้นที่ ~400px ⇒ การ์ดกว้าง ~130px ข้อความถูกบีบเป็นแถวตั้งยาว ✗
 *
 * ทางแก้: เรนเดอร์ที่ **ความกว้างจริงแบบเดสก์ท็อป** แล้วให้เลื่อนแนวนอนได้
 *   ⇒ เลย์เอาต์/ความกว้างการ์ด/การจัดบรรทัด **เหมือนหน้าเว็บจริง** (สิ่งที่ผู้ใช้จะเห็นตอนเผยแพร่)
 *
 * ⚠️ กฎโปรเจกต์ (บทเรียนรอบที่ 33): **ห้ามตั้งความกว้างของพรีวิวตามความกว้างช่องในหลังบ้าน**
 *    (ของจริงคือ iframe ที่ต้อง `scale()` — ที่นี่เป็นคอมโพเนนต์ inline จึงเลือก "ความกว้างจริง + เลื่อน" แทน)
 *    ถ้าภายหลังต้องการให้ย่อพอดีช่องโดยไม่ต้องเลื่อน ให้ทำแบบ `scale()` ของตัวสร้างหน้าเว็บ (มี ResizeObserver)
 */

/** ความกว้างอ้างอิง = โซนเนื้อหาของเว็บจริงบนเดสก์ท็อป (max-width ของคอนเทนเนอร์ + padding) */
export const SITE_PREVIEW_WIDTH = 1152;

export function PreviewFrame({
  label,
  width = SITE_PREVIEW_WIDTH,
  children,
}: {
  readonly label: string;
  readonly width?: number;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-fg-muted mb-1 text-xs">{label}</p>
      <div className="border-line overflow-x-auto rounded-xl border">
        <div style={{ width }} className="bg-bg p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

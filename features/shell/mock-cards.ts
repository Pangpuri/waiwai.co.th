/**
 * ค่าคงที่ของ "กริดการ์ดตัวอย่าง" (mockup) — pure module ไม่มี JSX
 *
 * แยกออกมาจาก `ui/mock-card-grid.tsx` เพราะ unit test ของโปรเจกต์รันด้วย `node --test`
 * ซึ่งโหลดไฟล์ `.tsx` ไม่ได้ (Unknown file extension ".tsx")
 * → ค่าที่ต้องการให้เทสต์ตรวจต้องอยู่ในไฟล์ `.ts` เท่านั้น
 *
 * ผู้ใช้ระบุรูปแบบไว้ 2026-09-25: "เรียง 3 การ์ด 2 แถว" → 6 ใบ
 * (บนจอใหญ่ 3 คอลัมน์ ต้องตรงกับ `lg:grid-cols-3` ในคอมโพเนนต์)
 */

export const MOCK_CARDS_PER_ROW = 3;
export const MOCK_CARD_ROWS = 2;
export const MOCK_CARD_COUNT = MOCK_CARDS_PER_ROW * MOCK_CARD_ROWS;

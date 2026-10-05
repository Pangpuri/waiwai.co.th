/**
 * Dictionary area: "in progress" pages (closing the 404-link debt — round 81)
 *
 * ⚠️ ไม่ต้องประกาศชนิดเอง — `en.ts` ประกาศเป็น `Messages` (derive จาก th) ⇒ คีย์ขาด/เกิน = compile error
 * ⚠️ ไม่มีข้อความจริง/ตัวเลขที่แต่งขึ้น — บอกตรง ๆ ว่ายังรอข้อมูลที่ยืนยันแล้ว
 */
export const pendingPages = {
  eyebrow: "In progress",
  body: "This page is still being written — we publish it once the information is confirmed by its owner, so nothing misleading appears on the site.",
  whatNextTitle: "What you can do meanwhile",
  whatNextHome: "Back to the home page",
  whatNextContact: "Ask our team",
  notFoundNote: "If you followed a link from our site, this page really is being built (the link is not broken).",
  items: {
    sustainability: {
      title: "Sustainability",
      description:
        "Our sustainability page (environment · community · governance) — waiting for confirmed copy and figures from the owner.",
    },
    cookiePolicy: {
      title: "Cookie policy",
      description: "Cookie policy — waiting for a wording review together with the privacy policy.",
    },
    terms: {
      title: "Website terms of use",
      description: "Terms of use — waiting for wording reviewed by the owner / legal adviser.",
    },
  },
};

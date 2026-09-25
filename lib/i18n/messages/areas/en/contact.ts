/**
 * Contact page area (/contact)
 *
 * แยกจากพจนานุกรมก้อนเดียว (เดิมอยู่ lib/i18n/messages/en.ts) เพื่อให้
 * แต่ละพื้นที่มีไฟล์ของตัวเอง — ดูเพดานขนาดต่อพื้นที่ใน scripts/check-i18n.ts
 */

  /*
    The /contact page — round 17.
    The form comes from `contact/formcontact.txt`; the map is the company's own illustrated map.
    ⚠️ The form has no receiving side yet → shown as a sample with the send button disabled (see PRODUCT_ROADMAP.md § 9).
  */
export const contactPage = {
    meta: {
      title: "Contact us",
      description:
        "Contact channels and factory locations for Thai Preserved Food Factory Co., Ltd. (Wai Wai), plus a contact form.",
    },
    eyebrow: "Contact us",
    title: "Contact us",
    intro:
      "Pick whichever channel suits you, or fill in the form and we will route it to the right department.",
    channelsTitle: "Contact channels",
    phoneLabel: "Phone",
    addressLabel: "Address",
    plant1: "Factory 1 (Om Yai)",
    plant1Address: "42/1 Moo 2, Phetkasem Road, Om Yai, Sam Phran, Nakhon Pathom 73160, Thailand",
    plant2: "Factory 2 (Rai Khing)",
    plant2Address: "3 Moo 14, Rai Khing, Sam Phran, Nakhon Pathom, Thailand",
    mapTitle: "Factory location map",
    mapCaption:
      "A map showing Factory 1 (Om Yai) and Factory 2 (Rai Khing), with the routes and nearby landmarks.",
    mapAlt:
      "Illustrated map showing the locations of both Wai Wai factories in Sam Phran district, Nakhon Pathom, with Phetkasem Road and the surrounding landmarks",
    formTitle: "Contact form",
    formIntro: "Fill in the details below and we will send your message to the right department.",
    notice:
      "A sample for the marketing team to review — this form is not live yet and is pending approval.",
    formStatus:
      "The send button does not work in this sample version — please reach us by phone or post using the details above.",
    requiredNote: "* indicates a required question",
    topicLabel: "What is this about?",
    topicPlaceholder: "— Choose a topic —",
    nameLabel: "Name",
    namePlaceholder: "Full name",
    emailLabel: "E-mail",
    emailPlaceholder: "name@example.com",
    phoneFieldLabel: "Contact number",
    phonePlaceholder: "08X-XXX-XXXX",
    subjectLabel: "Subject",
    subjectPlaceholder: "Briefly summarise your enquiry",
    detailsLabel: "Details",
    detailsPlaceholder: "Tell us more",
    submit: "Send message",
    consent:
      "I consent to Wai Wai storing and using this information to reply, in line with the privacy policy.",
    note: "The contact form is not live in this sample version.",
    topics: {
      productIssue: "Product enquiry and problem report",
      orderDomestic: "Order products (in Thailand)",
      orderInternational: "Order products (international)",
      marketingSupport: "Marketing and PR support request",
      salesAndFleet: "Sales representatives and delivery fleet",
      supplierOffer: "Supplier and raw material offer",
      quickTerrace: "Quick Terrace",
    },
};

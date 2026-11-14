import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_FORM_MAIL_ROUTING,
  parseFormMailRouting,
  resolveMailRecipients,
} from "@/lib/forms/mail-routing";
import { buildFormNotificationMessage, normalizeSmtpFrom } from "@/lib/forms/email-message";
import type { FormNotificationDraft } from "@/lib/forms/email-message";
import { CONTACT_TOPICS } from "@/features/contact/content";

test("mail routing: defaults route every contact topic and careers to the requested recipients", () => {
  assert.deepEqual(resolveMailRecipients(DEFAULT_FORM_MAIL_ROUTING, "contact", "productIssue"), {
    to: "kanoktip@waiwai.co.th",
    cc: "waiwaiqccenter@gmail.com",
  });
  assert.equal(resolveMailRecipients(DEFAULT_FORM_MAIL_ROUTING, "contact", "orderDomestic")?.to, "salecenter@waiwai.co.th");
  assert.equal(resolveMailRecipients(DEFAULT_FORM_MAIL_ROUTING, "contact", "orderInternational")?.to, "export@waiwai.co.th");
  assert.equal(resolveMailRecipients(DEFAULT_FORM_MAIL_ROUTING, "contact", "marketingSupport")?.to, "waiwaimkt@gmail.com");
  assert.equal(resolveMailRecipients(DEFAULT_FORM_MAIL_ROUTING, "contact", "quickTerrace")?.to, "yuttakornchaivanit@hotmail.com");
  assert.equal(resolveMailRecipients(DEFAULT_FORM_MAIL_ROUTING, "contact", "salesAndFleet")?.to, "salecenter@waiwai.co.th");
  assert.equal(resolveMailRecipients(DEFAULT_FORM_MAIL_ROUTING, "contact", "supplierOffer")?.to, "suchat@waiwai.co.th");
  assert.deepEqual(resolveMailRecipients(DEFAULT_FORM_MAIL_ROUTING, "careers", ""), {
    to: "hrd@waiwai.co.th",
    cc: "",
  });
  assert.equal(resolveMailRecipients(DEFAULT_FORM_MAIL_ROUTING, "contact", "unknown"), null);
  assert.equal(resolveMailRecipients(DEFAULT_FORM_MAIL_ROUTING, "newsletter", ""), null);
  assert.deepEqual(Object.keys(DEFAULT_FORM_MAIL_ROUTING.contact).sort(), [...CONTACT_TOPICS].sort());
});

test("mail routing: accepts normalized recipient lists and rejects missing or invalid required addresses", () => {
  const parsed = parseFormMailRouting({
    ...DEFAULT_FORM_MAIL_ROUTING,
    contact: {
      ...DEFAULT_FORM_MAIL_ROUTING.contact,
      productIssue: { to: " first@example.com;\nsecond@example.com ", cc: "copy@example.com, " },
    },
  });
  assert.notEqual(parsed, null);
  assert.deepEqual(parsed?.contact.productIssue, {
    to: "first@example.com, second@example.com",
    cc: "copy@example.com",
  });

  assert.equal(
    parseFormMailRouting({
      ...DEFAULT_FORM_MAIL_ROUTING,
      careers: { to: "", cc: "" },
    }),
    null,
  );
  assert.equal(
    parseFormMailRouting({
      ...DEFAULT_FORM_MAIL_ROUTING,
      careers: { to: "not-an-email", cc: "" },
    }),
    null,
  );
});

test("form email: includes reply-to and a validated resume attachment; header values cannot add lines", () => {
  const draft: FormNotificationDraft = {
    form: "careers",
    email: "applicant@example.test",
    name: "Applicant",
    phone: "",
    topic: "Engineer\r\nBcc: attacker@example.test",
    subject: "",
    message: "Please review my application.",
    consent: true,
    payload: { experience: "3 years" },
  };
  const message = buildFormNotificationMessage(
    draft,
    DEFAULT_FORM_MAIL_ROUTING.careers,
    "website@waiwai.co.th",
    [{ filename: "resume.pdf", mime: "application/pdf", data: new Uint8Array([37, 80, 68, 70]) }],
  );

  assert.equal(message.to, "hrd@waiwai.co.th");
  assert.equal(message.replyTo, "applicant@example.test");
  assert.equal(message.subject.includes("\r"), false);
  assert.equal(message.subject.includes("\n"), false);
  assert.equal(message.attachments?.[0]?.filename, "resume.pdf");
  assert.equal(message.attachments?.[0]?.contentType, "application/pdf");
  assert.match(message.text, /experience: 3 years/);
});

test("SMTP From: accepts a display name only when its address matches SMTP_USER", () => {
  assert.equal(
    normalizeSmtpFrom("Wai Wai <contact@waiwai.co.th>", "contact@waiwai.co.th"),
    "Wai Wai <contact@waiwai.co.th>",
  );
  assert.equal(normalizeSmtpFrom("contact@waiwai.co.th", "CONTACT@WAIWAI.CO.TH"), "contact@waiwai.co.th");
  assert.equal(normalizeSmtpFrom("Wai Wai <other@waiwai.co.th>", "contact@waiwai.co.th"), null);
  assert.equal(normalizeSmtpFrom("Wai Wai <contact@waiwai.co.th>\r\nBcc: other@example.com", "contact@waiwai.co.th"), null);
  assert.equal(normalizeSmtpFrom("not-an-email", "contact@waiwai.co.th"), null);
});

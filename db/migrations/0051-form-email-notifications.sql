-- Contact and careers submissions remain stored in the inbox; email is a notification channel.
alter table form_submission
  add column if not exists notification_status text not null default 'not_applicable',
  add column if not exists notification_sent_at timestamptz;

alter table form_submission
  drop constraint if exists form_submission_notification_status_check;

alter table form_submission
  add constraint form_submission_notification_status_check
  check (notification_status in ('not_applicable', 'pending', 'sent', 'failed'));

insert into page_document (page, status, document, updated_at, updated_by)
values (
  'form-mail-routing',
  'draft',
  '{
    "contact": {
      "productIssue": {"to": "kanoktip@waiwai.co.th", "cc": "waiwaiqccenter@gmail.com"},
      "orderDomestic": {"to": "salecenter@waiwai.co.th", "cc": ""},
      "orderInternational": {"to": "export@waiwai.co.th", "cc": ""},
      "marketingSupport": {"to": "waiwaimkt@gmail.com", "cc": ""},
      "quickTerrace": {"to": "yuttakornchaivanit@hotmail.com", "cc": ""},
      "salesAndFleet": {"to": "salecenter@waiwai.co.th", "cc": ""},
      "supplierOffer": {"to": "suchat@waiwai.co.th", "cc": ""}
    },
    "careers": {"to": "hrd@waiwai.co.th", "cc": ""}
  }'::jsonb,
  now(),
  'migration:0051'
)
on conflict (page, status) do nothing;

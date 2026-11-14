alter table job_posting
  add column if not exists posted_at timestamptz;

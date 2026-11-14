alter table admin_user
  drop constraint if exists admin_user_role_check;

alter table admin_user
  add constraint admin_user_role_check
  check (role in ('editor', 'publisher', 'admin', 'hr'));

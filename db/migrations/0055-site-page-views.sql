alter table public.click_metric_daily
  drop constraint click_metric_daily_event_type_check,
  add constraint click_metric_daily_event_type_check
    check (event_type in ('site_view', 'store_click', 'news_click', 'recipe_click', 'careers_view', 'career_apply')),
  drop constraint click_metric_daily_source_check,
  add constraint click_metric_daily_source_check
    check (source in ('home', 'news', 'recipes', 'careers', 'site'));

create or replace function public.record_click_metric(p_event_type text, p_target_id text, p_source text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_event_type is null or p_source is null or p_target_id is null or length(p_target_id) not between 1 and 120 then
    return false;
  end if;

  if p_event_type = 'site_view' then
    if p_source <> 'site' or p_target_id <> 'site' then
      return false;
    end if;
  elsif p_event_type = 'store_click' then
    if p_source <> 'home' or p_target_id not in ('shopee', 'shopee-serda', 'lazada', 'lazada-serda', 'tiktok', 'makro-pro', 'thaimart') then
      return false;
    end if;
  elsif p_event_type = 'news_click' then
    if p_source not in ('home', 'news') or not exists (
      select 1 from public.news where id = p_target_id and status = 'published' and deleted_at is null
    ) then
      return false;
    end if;
  elsif p_event_type = 'recipe_click' then
    if p_source not in ('home', 'recipes') or not exists (
      select 1 from public.recipe where id = p_target_id and status = 'published' and deleted_at is null
    ) then
      return false;
    end if;
  elsif p_event_type = 'careers_view' then
    if p_source <> 'careers' or p_target_id <> 'careers' then
      return false;
    end if;
  elsif p_event_type = 'career_apply' then
    if p_source <> 'careers' or not exists (
      select 1 from public.job_posting where id = p_target_id and status = 'published' and deleted_at is null
    ) then
      return false;
    end if;
  else
    return false;
  end if;

  insert into public.click_metric_daily (day, event_type, target_id, source, clicks)
  values ((statement_timestamp() at time zone 'Asia/Bangkok')::date, p_event_type, p_target_id, p_source, 1)
  on conflict (day, event_type, source, target_id)
  do update set clicks = public.click_metric_daily.clicks + 1;
  return true;
end;
$$;

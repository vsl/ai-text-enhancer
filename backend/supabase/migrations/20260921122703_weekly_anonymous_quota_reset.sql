create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.runtime_settings (
  setting_name text primary key,
  bigint_value bigint not null check (bigint_value > 0)
);

alter table private.runtime_settings enable row level security;
revoke all on table private.runtime_settings from public, anon, authenticated;

insert into private.runtime_settings (setting_name, bigint_value)
values ('anonymous_weekly_token_allowance', 50000);

create or replace function private.reset_anonymous_quotas()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allowance bigint;
  updated_rows bigint;
begin
  select bigint_value
  into strict allowance
  from private.runtime_settings
  where setting_name = 'anonymous_weekly_token_allowance';

  update public.user_quotas as quota
  set
    tokens_available = allowance,
    tokens_used = 0,
    updated_at = now()
  from auth.users as account
  where account.id = quota.user_id
    and account.is_anonymous is true;

  get diagnostics updated_rows = row_count;
  return updated_rows;
end;
$$;

revoke all on function private.reset_anonymous_quotas() from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  welcome_tokens bigint := 50000;
  user_provider text;
begin
  if new.is_anonymous is true then
    user_provider := 'anonymous';

    select bigint_value
    into strict welcome_tokens
    from private.runtime_settings
    where setting_name = 'anonymous_weekly_token_allowance';
  else
    user_provider := coalesce(new.raw_app_meta_data->>'provider', 'email');
    user_provider := case
      when user_provider in ('google', 'github', 'apple', 'facebook', 'twitter', 'azure') then user_provider
      when user_provider = 'email' then 'email'
      else 'other'
    end;
  end if;

  insert into public.user_profiles (id, email, tier, is_admin, is_active, auth_provider)
  values (
    new.id,
    case
      when user_provider = 'anonymous' then 'anonymous-' || new.id || '@anon.local'
      else coalesce(nullif(new.email, ''), 'user-' || new.id || '@unknown.local')
    end,
    'free',
    false,
    true,
    user_provider
  );

  insert into public.user_quotas (user_id, tokens_available, tokens_used)
  values (new.id, welcome_tokens, 0);

  insert into public.token_purchases (user_id, tokens_added, purchase_type, description)
  values (new.id, welcome_tokens, 'registration', 'Welcome bonus for new user registration');

  return new;
exception
  when others then
    raise warning 'Error in handle_new_user trigger for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

select cron.schedule(
  'reset-anonymous-weekly-quotas',
  '0 0 * * 1',
  $$select private.reset_anonymous_quotas();$$
);

comment on table private.runtime_settings is 'Owner-managed runtime settings that are not exposed through the Data API';
comment on function private.reset_anonymous_quotas() is 'Resets anonymous user quotas to the configured weekly allowance';
comment on function public.handle_new_user() is 'Creates profiles and quotas; anonymous users receive the configured weekly allowance';

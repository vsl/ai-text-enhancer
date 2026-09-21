create extension if not exists pgtap with schema extensions;

begin;
set local search_path = extensions, public;

select plan(14);

select has_schema('private', 'private schema exists');
select has_table('private', 'runtime_settings', 'runtime settings table exists');
select is(
  (select bigint_value from private.runtime_settings where setting_name = 'anonymous_weekly_token_allowance'),
  50000::bigint,
  'weekly allowance defaults to 50,000'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, is_anonymous, confirmation_token, recovery_token,
  email_change_token_new, email_change
) values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', null, '', now(), now(), now(), '{}', '{}',
  false, true, '', '', '', ''
);

select is(
  (select tokens_available from public.user_quotas where user_id = '10000000-0000-0000-0000-000000000001'),
  50000::bigint,
  'new anonymous users receive the configured allowance'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, is_anonymous, confirmation_token, recovery_token,
  email_change_token_new, email_change
) values (
  '20000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'weekly-regular@example.com', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}', false, false, '', '', '', ''
);

update public.user_quotas
set tokens_available = 100, tokens_used = 49900, last_used_at = '2026-01-02 03:04:05+00'
where user_id = '10000000-0000-0000-0000-000000000001';

update public.user_quotas
set tokens_available = 123, tokens_used = 456
where user_id = '20000000-0000-0000-0000-000000000002';

select private.reset_anonymous_quotas();

select results_eq(
  $$select tokens_available, tokens_used, last_used_at from public.user_quotas where user_id = '10000000-0000-0000-0000-000000000001'$$,
  $$values (50000::bigint, 0::bigint, '2026-01-02 03:04:05+00'::timestamptz)$$,
  'reset replenishes anonymous users and preserves last_used_at'
);

select results_eq(
  $$select tokens_available, tokens_used from public.user_quotas where user_id = '20000000-0000-0000-0000-000000000002'$$,
  $$values (123::bigint, 456::bigint)$$,
  'reset does not change non-anonymous users'
);

update private.runtime_settings
set bigint_value = 75000
where setting_name = 'anonymous_weekly_token_allowance';

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, is_anonymous, confirmation_token, recovery_token,
  email_change_token_new, email_change
) values (
  '30000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', null, '', now(), now(), now(), '{}', '{}',
  false, true, '', '', '', ''
);

select is(
  (select tokens_available from public.user_quotas where user_id = '30000000-0000-0000-0000-000000000003'),
  75000::bigint,
  'changed allowance applies immediately to new anonymous users'
);

select private.reset_anonymous_quotas();
select is(
  (select tokens_available from public.user_quotas where user_id = '10000000-0000-0000-0000-000000000001'),
  75000::bigint,
  'changed allowance applies to existing anonymous users on reset'
);

select ok(not has_table_privilege('anon', 'private.runtime_settings', 'SELECT'), 'anon cannot read runtime settings');
select ok(not has_table_privilege('authenticated', 'private.runtime_settings', 'SELECT'), 'authenticated users cannot read runtime settings');
select ok(not has_function_privilege('anon', 'private.reset_anonymous_quotas()', 'EXECUTE'), 'anon cannot run the reset');
select ok(not has_function_privilege('authenticated', 'private.reset_anonymous_quotas()', 'EXECUTE'), 'authenticated users cannot run the reset');
select is(
  (select schedule from cron.job where jobname = 'reset-anonymous-weekly-quotas'),
  '0 0 * * 1',
  'weekly reset runs Monday at 00:00 UTC'
);
select is(
  (select command from cron.job where jobname = 'reset-anonymous-weekly-quotas'),
  'select private.reset_anonymous_quotas();',
  'cron invokes the private database function directly'
);

select * from finish();
rollback;

-- Edge Functions use the project's secret API key, which acts as service_role.
-- Keep browser roles on their existing RLS policies; this is server-only access.
GRANT SELECT, UPDATE ON TABLE public.user_profiles TO service_role;
GRANT SELECT ON TABLE public.user_quotas TO service_role;

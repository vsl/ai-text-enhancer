function requireValue(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const SUPABASE_URL = requireValue(
  'NEXT_PUBLIC_APP_SUPABASE_URL',
  process.env.NEXT_PUBLIC_APP_SUPABASE_URL
);
export const SUPABASE_ANON_KEY = requireValue(
  'NEXT_PUBLIC_APP_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_APP_SUPABASE_ANON_KEY
);
export const API_BASE_URL = requireValue(
  'NEXT_PUBLIC_API_BASE_URL',
  process.env.NEXT_PUBLIC_API_BASE_URL
);

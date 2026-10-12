/**
 * Supabase client adapter
 * Platform-agnostic Supabase client initialization
 *
 * This module creates a Supabase client instance for database
 * operations and JWT validation. Uses service role key for server-side operations.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.76.1';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Initialize Supabase client
 *
 * @param supabaseUrl - Supabase project URL
 * @param serviceRoleKey - Supabase service role key (for server-side operations)
 * @returns Initialized Supabase client
 */
export function initializeSupabase(
  supabaseUrl: string,
  serviceRoleKey: string
): SupabaseClient {
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required');
  }

  if (!serviceRoleKey) {
    throw new Error('APP_SUPABASE_SERVICE_ROLE_KEY is required');
  }

  // Create client with service role key (bypasses RLS for admin operations)
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}

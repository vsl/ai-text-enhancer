/**
 * Supabase Client Configuration
 * Platform-agnostic Supabase client initialization
 *
 * This module provides a singleton Supabase client instance for database
 * operations and JWT validation. Uses service role key for server-side operations.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

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

  supabaseInstance = client;
  return client;
}

/**
 * Get Supabase client instance
 *
 * @returns Supabase client instance
 * @throws Error if client not initialized
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    throw new Error(
      'Supabase client not initialized. Call initializeSupabase() first.'
    );
  }

  return supabaseInstance;
}

/**
 * Reset Supabase client (for testing)
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null;
}

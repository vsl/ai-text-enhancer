// ============================================
// PLATFORM-SPECIFIC CODE (Deno/Supabase)
// User Profile API Edge Function Handler
// Target: <100 lines
// ============================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleRequest } from './handler.ts';
import { AuthMiddleware } from '../../../src/services/auth-middleware.ts';
import { initializeSupabase } from '../../../src/config/supabase.config.ts';
import { getEnvVar } from '../../../src/config/loader.ts';

// Load environment variables (using APP_ prefix to avoid Edge Functions restriction)
const SUPABASE_URL = getEnvVar('SUPABASE_URL');
const APP_SUPABASE_SERVICE_ROLE_KEY = getEnvVar('APP_SUPABASE_SERVICE_ROLE_KEY');

// Initialize Supabase client
const supabase = initializeSupabase(SUPABASE_URL!, APP_SUPABASE_SERVICE_ROLE_KEY!);

// Initialize auth middleware
const authMiddleware = new AuthMiddleware(supabase);

// Start HTTP server
Deno.serve(async (req: Request) => {
  return await handleRequest(req, { authMiddleware, supabase });
});

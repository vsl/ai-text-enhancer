import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleRequest } from './handler.ts';
import { AuthMiddleware } from '../../../src/services/auth-middleware.ts';
import { initializeSupabase } from '../../../src/connectors/supabase-client.ts';
import { loadSupabaseConfig } from '../../../src/config/loader.ts';

// Load environment variables (using APP_ prefix to avoid Edge Functions restriction)
const config = loadSupabaseConfig();

// Initialize Supabase client
const supabase = initializeSupabase(config.url, config.serviceRoleKey);

// Initialize auth middleware
const authMiddleware = new AuthMiddleware(supabase);

// Start HTTP server
Deno.serve(async (req: Request) => {
  return await handleRequest(req, { authMiddleware, supabase });
});

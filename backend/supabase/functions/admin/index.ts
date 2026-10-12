import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleRequest } from './handler.ts';
import { AdminService } from '../../../src/services/admin.service.ts';
import { initializeSupabase } from '../../../src/connectors/supabase-client.ts';
import { loadSupabaseConfig } from '../../../src/config/loader.ts';
import { loadBootstrapConfig } from '../../../src/config/admin.config.ts';

// Load environment variables (using APP_ prefix to avoid Edge Functions restriction)
const config = loadSupabaseConfig();
const bootstrap = loadBootstrapConfig();

// Initialize Supabase client
const supabase = initializeSupabase(config.url, config.serviceRoleKey);

// Initialize admin service
const adminService = new AdminService(supabase);

// Start HTTP server
Deno.serve(async (req: Request) => {
  return await handleRequest(req, {
    adminService,
    bootstrapSecretKey: bootstrap.secretKey,
    bootstrapUsers: bootstrap.users,
  });
});

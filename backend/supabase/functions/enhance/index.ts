// ============================================
// PLATFORM-SPECIFIC CODE (Deno/Supabase)
// This is the ONLY file that should use Deno APIs
// Target: 50-100 lines
// ============================================

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleRequest } from './handler.ts';
import { loadConfig, validateConfig } from '../../../src/config/index.ts';
import { initializeSupabase } from '../../../src/config/supabase.config.ts';
import { BatchOrchestrator } from '../../../src/services/batch-orchestrator.ts';
import { AuthMiddleware } from '../../../src/services/auth-middleware.ts';
import { QuotaService } from '../../../src/services/quota-service.ts';
import { AuthorizationService } from '../../../src/services/authorization-service.ts';

// Load configuration once at startup
const config = loadConfig();
validateConfig(config);

// Initialize Supabase client
const supabase = initializeSupabase(config.supabase.url, config.supabase.serviceRoleKey);

// Initialize services
const quotaService = new QuotaService(supabase);
const authzService = new AuthorizationService();
const orchestrator = new BatchOrchestrator(
  config.llmProviders,
  quotaService,
  authzService,
  config.timeout,
  config.exposeErrorDetails
);
const authMiddleware = new AuthMiddleware(supabase, config.supabase.jwtSecret);

// Start HTTP server using Deno.serve (no import needed)
Deno.serve(async (req: Request) => {
  return await handleRequest(req, { orchestrator, authMiddleware, config });
});

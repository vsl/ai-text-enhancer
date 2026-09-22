// ============================================
// PLATFORM-SPECIFIC REQUEST HANDLING FOR /me
// Deno-specific but isolated for easy porting
// ============================================

import type { AuthMiddleware } from '../../../src/services/auth-middleware.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthenticationError } from '../../../src/errors/auth-errors.ts';
import { getFunctionPath } from '../../../src/utils/function-path.ts';

interface Services {
  authMiddleware: AuthMiddleware;
  supabase: SupabaseClient;
}

export async function handleRequest(
  req: Request,
  services: Services
): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathname = getFunctionPath(url.pathname, 'me');

    // Health check endpoint
    if (pathname === '/health') {
      return jsonResponse(
        { status: 'ok', service: 'ai-text-enhancer-me' },
        200,
        corsHeaders
      );
    }

    // Only GET method allowed for /me
    if (req.method !== 'GET') {
      return jsonResponse(
        { error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET method is allowed' } },
        405,
        corsHeaders
      );
    }

    // Authenticate user
    const headers = Object.fromEntries(req.headers.entries());
    const userProfile = await services.authMiddleware.authenticate(headers);

    // Return profile and quota data
    const response = {
      profile: {
        id: userProfile.userId,
        email: userProfile.email,
        tier: userProfile.tier,
        is_admin: userProfile.isAdmin,
        is_active: userProfile.isActive,
        auth_provider: userProfile.authProvider,
      },
      quota: {
        tokens_available: userProfile.tokensAvailable,
        tokens_used: userProfile.tokensUsed,
      },
    };

    return jsonResponse(response, 200, corsHeaders);
  } catch (error) {
    return handleError(error, corsHeaders);
  }
}

function handleError(error: unknown, corsHeaders: Record<string, string>): Response {
  console.error('[ME ERROR]', error);

  if (error instanceof AuthenticationError) {
    return jsonResponse(
      { error: { code: 'AUTHENTICATION_FAILED', message: error.message } },
      401,
      corsHeaders
    );
  }

  return jsonResponse(
    { error: { code: 'INTERNAL_ERROR', message: (error as Error).message } },
    500,
    corsHeaders
  );
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

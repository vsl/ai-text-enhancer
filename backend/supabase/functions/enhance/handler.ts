// ============================================
// PLATFORM-SPECIFIC REQUEST HANDLING
// Still Deno-specific but isolated for easy porting
// ============================================

import type { BatchOrchestrator } from '../../../src/services/batch-orchestrator.ts';
import type { AuthMiddleware } from '../../../src/services/auth-middleware.ts';
import type { SystemConfig } from '../../../src/types/config.types.ts';
import {
  AuthenticationError,
  AuthorizationError
} from '../../../src/errors/auth-errors.ts';
import { QuotaError } from '../../../src/errors/quota-errors.ts';
import { LLMError } from '../../../src/errors/llm-errors.ts';
import {
  InvalidRequestError,
  OrchestrationError,
} from '../../../src/errors/orchestration-errors.ts';
import { getFunctionPath } from '../../../src/utils/function-path.ts';
import { addTraceMetadata, traceRun } from '../../../src/observability/tracing.ts';

interface Services {
  orchestrator: BatchOrchestrator;
  authMiddleware: AuthMiddleware;
  config: SystemConfig;
}

export async function handleRequest(
  req: Request,
  services: Services
): Promise<Response> {
  const requestId = crypto.randomUUID();
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Expose-Headers': 'X-Request-ID',
    'X-Request-ID': requestId,
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const method = req.method;
    const pathname = getFunctionPath(url.pathname, 'enhance');

    // Route: GET /health or GET /
    if (method === 'GET' && (pathname === '/health' || pathname === '/')) {
      return jsonResponse({ status: 'ok', service: 'ai-text-enhancer' }, 200, corsHeaders);
    }

    // Route: POST / (main endpoint)
    if (method === 'POST' && pathname === '/') {
      return await handleEnhance(req, services, corsHeaders, requestId);
    }

    // 404 Not Found
    return jsonResponse(
      { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
      404,
      corsHeaders
    );

  } catch (error) {
    return handleError(error, services.config.exposeErrorDetails, corsHeaders, requestId);
  }
}

/**
 * Handle batch enhancement request
 */
async function handleEnhance(
  req: Request,
  services: Services,
  corsHeaders: Record<string, string>,
  requestId: string,
): Promise<Response> {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());
  const result = await traceRun({
    name: 'enhance.batch',
    runType: 'chain',
    inputs: { requestBody: rawBody },
    metadata: { requestId },
    operation: async () => {
      const body: unknown = JSON.parse(rawBody);
      const user = await services.authMiddleware.authenticate(headers);
      addTraceMetadata({ requestId, userId: user.userId, userTier: user.tier });
      return services.orchestrator.processBatch(user, body, requestId);
    },
  });

  return jsonResponse(result, 200, corsHeaders);
}

/**
 * Handle errors and return appropriate responses
 */
function handleError(
  error: unknown,
  exposeErrorDetails: boolean,
  corsHeaders: Record<string, string>,
  requestId: string,
): Response {
  // Always log full error details for admin monitoring
  console.error(`[ERROR][${requestId}]`, error);

  // Helper to build error response
  const buildErrorResponse = (code: string, message?: string) => {
    const errorObj: { code: string; message?: string } = { code };
    if (exposeErrorDetails && message) {
      errorObj.message = message;
    }
    return { error: errorObj };
  };

  if (error instanceof InvalidRequestError) {
    return jsonResponse(
      { error: { code: error.code, message: error.message } },
      400,
      corsHeaders
    );
  }

  // Authentication errors (401)
  if (error instanceof AuthenticationError) {
    return jsonResponse(
      buildErrorResponse('AUTHENTICATION_FAILED', error.message),
      401,
      corsHeaders
    );
  }

  // Authorization errors (403)
  if (error instanceof AuthorizationError) {
    return jsonResponse(
      buildErrorResponse('AUTHORIZATION_FAILED', error.message),
      403,
      corsHeaders
    );
  }

  // Quota errors (429)
  if (error instanceof QuotaError) {
    return jsonResponse(
      buildErrorResponse('QUOTA_EXCEEDED', error.message),
      429,
      corsHeaders
    );
  }

  // LLM errors (502)
  if (error instanceof LLMError) {
    return jsonResponse(
      buildErrorResponse('LLM_ERROR', error.message),
      502,
      corsHeaders
    );
  }

  // Orchestration errors (400)
  if (error instanceof OrchestrationError) {
    return jsonResponse(
      buildErrorResponse(error.code, error.message),
      400,
      corsHeaders
    );
  }

  // JSON parse errors (400)
  if (error instanceof SyntaxError || (error as Error)?.name === 'SyntaxError') {
    return jsonResponse(
      { error: { code: 'INVALID_REQUEST', message: 'Request body is not valid JSON' } },
      400,
      corsHeaders
    );
  }

  // Generic errors (500)
  return jsonResponse(
    buildErrorResponse('INTERNAL_ERROR', (error as Error).message),
    500,
    corsHeaders
  );
}

/**
 * Create JSON response
 */
function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

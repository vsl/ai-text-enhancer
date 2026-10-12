import { ADMIN_POLICY } from '../../../src/config/admin.config.ts';
import type { AdminService } from '../../../src/services/admin.service.ts';
import { AuthenticationError, AuthorizationError } from '../../../src/errors/auth-errors.ts';
import type { BootstrapUser } from '../../../src/types/admin.types.ts';
import { AdminServiceError } from '../../../src/services/admin.service.ts';
import { UserRepositoryError } from '../../../src/repositories/user.repository.ts';
import { QuotaRepositoryError } from '../../../src/repositories/quota.repository.ts';
import { getFunctionPath } from '../../../src/utils/function-path.ts';

interface Services {
  adminService: AdminService;
  bootstrapSecretKey?: string;
  bootstrapUsers: BootstrapUser[];
}

export async function handleRequest(
  req: Request,
  services: Services
): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const method = req.method;

    const pathname = getFunctionPath(url.pathname, 'admin');

    // Route: POST /bootstrap
    if (method === 'POST' && pathname === '/bootstrap') {
      return await handleBootstrap(req, services, corsHeaders);
    }

    // All other routes require admin authentication
    await authenticateAdmin(req, services);

    // Route: POST /users/:userId/tokens
    const tokensMatch = pathname.match(/^\/users\/([^/]+)\/tokens$/);
    if (method === 'POST' && tokensMatch) {
      return await handleAdjustTokens(req, tokensMatch[1], services, corsHeaders);
    }

    // Route: PUT /users/:userId/tier
    const tierMatch = pathname.match(/^\/users\/([^/]+)\/tier$/);
    if (method === 'PUT' && tierMatch) {
      return await handleChangeTier(req, tierMatch[1], services, corsHeaders);
    }

    // Route: GET /users/:userId
    const userMatch = pathname.match(/^\/users\/([^/]+)$/);
    if (method === 'GET' && userMatch) {
      return await handleGetUser(userMatch[1], services, corsHeaders);
    }

    // Route: PUT /users/:userId/status
    const statusMatch = pathname.match(/^\/users\/([^/]+)\/status$/);
    if (method === 'PUT' && statusMatch) {
      return await handleUpdateStatus(req, statusMatch[1], services, corsHeaders);
    }

    // Route: GET /users
    if (method === 'GET' && pathname === '/users') {
      return await handleListUsers(url, services, corsHeaders);
    }

    return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }, 404, corsHeaders);
  } catch (error) {
    return handleError(error, corsHeaders);
  }
}

async function handleBootstrap(req: Request, services: Services, corsHeaders: Record<string, string>) {
  if (!services.bootstrapSecretKey || services.bootstrapUsers.length === 0) {
    return jsonResponse({ error: { code: 'BOOTSTRAP_DISABLED', message: 'Bootstrap is not configured' } }, 503, corsHeaders);
  }
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== services.bootstrapSecretKey) {
    throw new AuthenticationError('Invalid bootstrap secret key');
  }

  const result = await services.adminService.bootstrapUsers(services.bootstrapUsers);
  return jsonResponse(result, 200, corsHeaders);
}

async function authenticateAdmin(req: Request, services: Services): Promise<string> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  return services.adminService.authenticateAdmin(token);
}

async function handleAdjustTokens(req: Request, userId: string, services: Services, corsHeaders: Record<string, string>) {
  const body = await readObject(req);
  const { tokens, description } = body;

  if (typeof tokens !== 'number' || !Number.isSafeInteger(tokens)
    || (description !== undefined && typeof description !== 'string')) {
    return jsonResponse({ error: { code: 'INVALID_REQUEST', message: 'tokens must be a number' } }, 400, corsHeaders);
  }

  const result = await services.adminService.adjustTokens(userId, tokens, description);
  return jsonResponse(result, 200, corsHeaders);
}

async function handleChangeTier(req: Request, userId: string, services: Services, corsHeaders: Record<string, string>) {
  const body = await readObject(req);
  const { tier } = body;

  if (tier !== 'free' && tier !== 'plus' && tier !== 'premium') {
    return jsonResponse({ error: { code: 'INVALID_REQUEST', message: 'tier is required and must be a string' } }, 400, corsHeaders);
  }

  const result = await services.adminService.changeTier(userId, tier);
  return jsonResponse(result, 200, corsHeaders);
}

async function handleGetUser(userId: string, services: Services, corsHeaders: Record<string, string>) {
  const result = await services.adminService.getUserDetails(userId);
  return jsonResponse(result, 200, corsHeaders);
}

async function handleUpdateStatus(req: Request, userId: string, services: Services, corsHeaders: Record<string, string>) {
  const body = await readObject(req);
  const { isActive } = body;

  if (typeof isActive !== 'boolean') {
    return jsonResponse({ error: { code: 'INVALID_REQUEST', message: 'isActive must be a boolean' } }, 400, corsHeaders);
  }

  const result = isActive
    ? await services.adminService.unblockUser(userId)
    : await services.adminService.blockUser(userId);

  return jsonResponse(result, 200, corsHeaders);
}

async function handleListUsers(url: URL, services: Services, corsHeaders: Record<string, string>) {
  const limit = paginationValue(url, 'limit', ADMIN_POLICY.defaultListLimit);
  const offset = paginationValue(url, 'offset', ADMIN_POLICY.defaultListOffset);

  const result = await services.adminService.listUsers(limit, offset);
  return jsonResponse(result, 200, corsHeaders);
}

function handleError(error: unknown, corsHeaders: Record<string, string>): Response {
  console.error('[ADMIN ERROR]', error);

  if (error instanceof AuthenticationError) {
    return jsonResponse(
      { error: { code: 'AUTHENTICATION_FAILED', message: error.message } },
      401,
      corsHeaders
    );
  }

  if (error instanceof AuthorizationError) {
    return jsonResponse({ error: { code: 'AUTHORIZATION_FAILED', message: error.message } }, 403, corsHeaders);
  }

  if (error instanceof AdminServiceError || error instanceof UserRepositoryError || error instanceof QuotaRepositoryError) {
    return jsonResponse(
      { error: { code: 'ADMIN_ERROR', message: error.message } },
      400,
      corsHeaders
    );
  }

  if (error instanceof SyntaxError) {
    return jsonResponse(
      { error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } },
      400,
      corsHeaders
    );
  }

  return jsonResponse(
    { error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
    500,
    corsHeaders
  );
}

async function readObject(req: Request): Promise<Record<string, unknown>> {
  const body: unknown = await req.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AdminServiceError('Request body must be a JSON object');
  }
  return body as Record<string, unknown>;
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

function paginationValue(url: URL, name: string, fallback: number): number {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value)) {
    throw new AdminServiceError(`${name} must be a nonnegative integer`);
  }
  return value;
}

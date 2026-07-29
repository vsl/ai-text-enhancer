import Stripe from 'npm:stripe@17.5.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { loadConfig } from '../../../src/config/index.ts';
import { AuthMiddleware } from '../../../src/services/auth-middleware.ts';
import { PaymentService } from '../../../src/services/payment-service.ts';
import { QuotaRepository } from '../../../src/repositories/quota.repository.ts';
import { InvalidPackageError } from '../../../src/errors/payment-errors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const corsResponse = () => new Response('ok', { headers: corsHeaders });
const jsonHeaders = () => ({ ...corsHeaders, 'Content-Type': 'application/json' });

const config = loadConfig();
const stripe = new Stripe(config.payment.stripeSecretKey, { apiVersion: '2024-11-20.acacia' });
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
const authMiddleware = new AuthMiddleware(config);
const quotaRepository = new QuotaRepository(supabase);
const paymentService = new PaymentService(quotaRepository, config);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  try {
    // Authenticate user
    const user = await authMiddleware.authenticate(req.headers);

    // Block anonymous users from purchasing tokens
    if (user.authProvider === 'anonymous') {
      return new Response(
        JSON.stringify({
          error: {
            code: 'ANONYMOUS_PURCHASE_FORBIDDEN',
            message: 'Anonymous users cannot purchase tokens. Please sign up with email to purchase.',
          },
        }),
        { status: 403, headers: jsonHeaders() }
      );
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' },
        }),
        { status: 400, headers: jsonHeaders() }
      );
    }

    const { packageId, successUrl, cancelUrl } = body;

    // Validate required fields
    if (!packageId || !successUrl || !cancelUrl) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'MISSING_FIELDS',
            message: 'Required fields: packageId, successUrl, cancelUrl',
          },
        }),
        { status: 400, headers: jsonHeaders() }
      );
    }

    // Create checkout session
    const session = await paymentService.createCheckoutSession(
      user.userId,
      packageId,
      successUrl,
      cancelUrl,
      stripe
    );

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { status: 200, headers: jsonHeaders() }
    );
  } catch (error) {
    console.error('Create checkout error:', error);

    if (error instanceof InvalidPackageError) {
      return new Response(
        JSON.stringify({ error: { code: error.code, message: error.message } }),
        { status: 400, headers: jsonHeaders() }
      );
    }

    const status = error.code === 'INVALID_TOKEN' || error.code === 'USER_NOT_FOUND' ? 401 : 500;
    return new Response(
      JSON.stringify({
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: error.message || 'An unexpected error occurred',
        },
      }),
      { status, headers: jsonHeaders() }
    );
  }
});

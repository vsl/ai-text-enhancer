import Stripe from 'npm:stripe@17.5.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { loadConfig, loadPaymentConfig } from '../../../src/config/index.ts';
import { PaymentService } from '../../../src/services/payment-service.ts';
import { QuotaRepository } from '../../../src/repositories/quota.repository.ts';

const config = loadConfig();
const paymentConfig = loadPaymentConfig();
const stripe = new Stripe(paymentConfig.stripeSecretKey, { apiVersion: '2024-11-20.acacia' });
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
const quotaRepository = new QuotaRepository(supabase);
const paymentService = new PaymentService(quotaRepository);

Deno.serve(async (req) => {
  // Get raw body for signature verification
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  // Validate signature header exists
  if (!signature) {
    console.error('Missing stripe-signature header');
    return new Response('Missing signature', { status: 400 });
  }

  // Validate body not empty
  if (!body) {
    console.error('Empty request body');
    return new Response('Empty body', { status: 400 });
  }

  // Verify webhook signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, paymentConfig.stripeWebhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return new Response('Invalid signature', { status: 400 });
  }

  // Process webhook event
  try {
    await paymentService.processWebhook(event);
  } catch (error) {
    console.error('Webhook processing error:', error);
    // CRITICAL: Always return 200 to prevent Stripe retries
    // Log the error but acknowledge receipt
  }

  // Always return 200 OK to acknowledge receipt
  return new Response('OK', { status: 200 });
});

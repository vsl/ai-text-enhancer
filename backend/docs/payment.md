> **Historical reference:** This document may describe earlier providers, limits, or deployment steps. For the current public demo, use the [root README](../../README.md), current source configuration, and deployment workflow. Stripe payment functions are a disabled prototype, not live endpoints.

# Payment System Guide

**Last Updated:** January 2025

Complete payment system documentation covering Stripe integration, token purchases, webhook handling, security, and deployment.

---

## Table of Contents

1. [Overview](#overview)
2. [Token Packages Configuration](#token-packages-configuration)
3. [Architecture](#architecture)
4. [Payment Flows](#payment-flows)
5. [Anonymous User Restrictions](#anonymous-user-restrictions)
6. [Security & Idempotency](#security--idempotency)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Error Handling](#error-handling)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Checklist](#deployment-checklist)

---

## Overview

### Design Philosophy

The payment system integrates **Stripe Checkout** to enable users to purchase additional tokens beyond their tier limits. The system follows the same **two-layer architecture** principle:

- **Handler Layer:** Stripe webhook signature verification, request extraction
- **Core Logic Layer:** Payment processing, token addition, refund handling (platform-agnostic)

**Key Principles:**
- **Registered users only** - Anonymous users cannot purchase tokens (account recovery requirement)
- **Atomic operations** - Token additions use database functions with row-level locking
- **Idempotency** - Duplicate webhook events are safely ignored
- **Partial refunds** - Proportional token deduction when refunds are issued
- **Audit trail** - All purchases recorded in `token_purchases` table

### Payment Method

**Stripe Checkout (Hosted):**
- Users are redirected to Stripe's hosted checkout page
- Stripe handles payment UI, card validation, 3D Secure
- Backend creates checkout session with user metadata
- Webhook receives payment confirmation and adds tokens

**Why Stripe Checkout?**
- PCI compliance handled by Stripe
- Mobile-friendly responsive design
- Supports 135+ currencies and local payment methods
- Built-in fraud detection

---

## Token Packages Configuration

### Package Definitions

Token packages are defined in `src/config/payment.config.ts`:

```typescript
export interface TokenPackage {
  id: string;              // Unique package ID
  name: string;            // Display name
  tokens: number;          // Number of tokens
  price: number;           // Price in cents (USD)
  currency: string;        // ISO currency code
  popular?: boolean;       // Highlight as popular choice
}

export const TOKEN_PACKAGES: TokenPackage[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    tokens: 100_000,
    price: 500,            // $5.00
    currency: 'USD',
  },
  {
    id: 'popular',
    name: 'Popular Pack',
    tokens: 500_000,
    price: 2000,           // $20.00
    currency: 'USD',
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium Pack',
    tokens: 1_000_000,
    price: 3500,           // $35.00
    currency: 'USD',
  },
  {
    id: 'enterprise',
    name: 'Enterprise Pack',
    tokens: 5_000_000,
    price: 15000,          // $150.00
    currency: 'USD',
  },
];
```

### Pricing Strategy

**Current Rates (USD):**
- 100k tokens = $5.00 ($0.05 per 1k tokens)
- 500k tokens = $20.00 ($0.04 per 1k tokens) - **20% discount**
- 1M tokens = $35.00 ($0.035 per 1k tokens) - **30% discount**
- 5M tokens = $150.00 ($0.03 per 1k tokens) - **40% discount**

**Design Notes:**
- Higher volume = better value (encourages larger purchases)
- All tiers can purchase (free, plus, premium)
- Tokens are added to existing balance (cumulative, no expiration)

---

## Architecture

### Two-Layer Design

Following the project's core portability principle, payment logic is split into two layers:

#### Layer 1: Handler (Platform-Specific)

**Location:** `supabase/functions/create-checkout/` and `supabase/functions/stripe-webhook/`

**Allowed APIs:** `Deno.*`, `Request`, `Response`

**Responsibilities:**
- Extract request body/headers
- Verify Stripe webhook signatures (using Stripe SDK)
- Initialize PaymentService with configuration
- Format responses

**Create Checkout Handler (~80 lines):**
```typescript
// supabase/functions/create-checkout/index.ts
import Stripe from 'npm:stripe@17.5.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { loadConfig } from '../../../src/config/index.ts';
import { AuthMiddleware } from '../../../src/services/auth-middleware.ts';
import { PaymentService } from '../../../src/services/payment-service.ts';
import { QuotaRepository } from '../../../src/repositories/quota.repository.ts';

const config = loadConfig();
const stripe = new Stripe(config.payment.stripeSecretKey);
const supabaseClient = createClient(config.supabase.url, config.supabase.serviceRoleKey);
const authMiddleware = new AuthMiddleware(config);
const quotaRepository = new QuotaRepository(supabaseClient);
const paymentService = new PaymentService(quotaRepository, config);

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const corsResponse = () => new Response('ok', { headers: corsHeaders });
const jsonHeaders = () => ({ ...corsHeaders, 'Content-Type': 'application/json' });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    // Extract and validate JWT
    const user = await authMiddleware.authenticate(req.headers);

    // Block anonymous users from purchasing
    if (user.authProvider === 'anonymous') {
      return new Response(JSON.stringify({
        error: {
          code: 'ANONYMOUS_PURCHASE_NOT_ALLOWED',
          message: 'Please create an account before purchasing tokens. Anonymous users cannot make purchases to prevent token loss if browser data is cleared.',
        },
      }), { status: 403, headers: jsonHeaders() });
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON',
        },
      }), { status: 400, headers: jsonHeaders() });
    }

    const { packageId, successUrl, cancelUrl } = requestBody;

    // Validate required fields
    if (!packageId || !successUrl || !cancelUrl) {
      return new Response(JSON.stringify({
        error: {
          code: 'MISSING_REQUIRED_FIELD',
          message: 'Missing required fields: packageId, successUrl, cancelUrl',
        },
      }), { status: 400, headers: jsonHeaders() });
    }

    // Create checkout session (calls core service)
    const session = await paymentService.createCheckoutSession(
      user.id,
      packageId,
      successUrl,
      cancelUrl,
      stripe
    );

    return new Response(JSON.stringify({
      sessionId: session.id,
      url: session.url,
    }), { headers: jsonHeaders() });

  } catch (error: any) {
    console.error('Create checkout error:', error);
    return new Response(JSON.stringify({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An error occurred',
      },
    }), { status: error.statusCode || 500, headers: jsonHeaders() });
  }
});
```

**Webhook Handler (~80 lines):**
```typescript
// supabase/functions/stripe-webhook/index.ts
import Stripe from 'npm:stripe@17.5.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { loadConfig } from '../../../src/config/index.ts';
import { PaymentService } from '../../../src/services/payment-service.ts';
import { QuotaRepository } from '../../../src/repositories/quota.repository.ts';

const config = loadConfig();
const stripe = new Stripe(config.payment.stripeSecretKey);
const supabaseClient = createClient(config.supabase.url, config.supabase.serviceRoleKey);
const quotaRepository = new QuotaRepository(supabaseClient);
const paymentService = new PaymentService(quotaRepository, config);

Deno.serve(async (req: Request) => {
  // Get raw body and signature header
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  // Validate signature header exists
  if (!signature) {
    console.error('Missing stripe-signature header');
    return new Response('Missing signature', { status: 400 });
  }

  // Validate request body is not empty
  if (!body) {
    console.error('Empty request body');
    return new Response('Empty request body', { status: 400 });
  }

  // Verify webhook signature (HANDLER LAYER ONLY)
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      config.payment.stripeWebhookSecret
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  // Process event (CORE LOGIC LAYER)
  // Always return 200 to prevent Stripe retries, even if processing fails
  try {
    await paymentService.processWebhook(event);
  } catch (processingError: any) {
    console.error('Webhook processing error:', processingError);
    // Still return 200 to acknowledge receipt
  }

  return new Response('OK', { status: 200 });
});
```

#### Layer 2: Core Logic (Platform-Agnostic)

**Location:** `src/services/payment-service.ts`

**Forbidden APIs:** `Deno.*` (must be platform-portable)

**Allowed APIs:** `fetch`, `process.env`, npm packages

**Responsibilities:**
- Validate token package IDs
- Create Stripe checkout sessions with user metadata
- Process webhook events (checkout completed, refunds, failures)
- Add tokens via QuotaRepository
- Handle idempotency (check for duplicate event IDs)
- Calculate proportional refunds

**Core Service Structure:**
```typescript
// src/services/payment-service.ts
import type Stripe from 'stripe';
import { QuotaRepository } from '../repositories/quota.repository.ts';
import { TOKEN_PACKAGES } from '../config/payment.config.ts';

export class PaymentService {
  constructor(
    private quotaRepository: QuotaRepository,
    private config: AppConfig
  ) {}

  async createCheckoutSession(
    userId: string,
    packageId: string,
    successUrl: string,
    cancelUrl: string,
    stripe: Stripe  // Injected from handler
  ): Promise<{ id: string; url: string }> {
    // Validate package
    const package = TOKEN_PACKAGES.find(p => p.id === packageId);
    if (!package) throw new InvalidPackageError(packageId);

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: package.currency.toLowerCase(),
          product_data: {
            name: package.name,
            description: `${package.tokens.toLocaleString()} tokens for AI Text Enhancer`,
          },
          unit_amount: package.price,
        },
        quantity: 1,
      }],
      metadata: {
        userId,           // CRITICAL: Used by webhook to identify user
        packageId,
        tokensAdded: package.tokens.toString(),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return { id: session.id, url: session.url! };
  }

  async processWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case 'charge.refunded':
        await this.handleRefund(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    // Validate metadata exists and contains required fields
    const metadata = session.metadata;
    if (!metadata || !metadata.userId || !metadata.tokensAdded || !metadata.packageId) {
      console.error('Missing required metadata in checkout session:', session.id);
      throw new Error(`Missing metadata in session ${session.id}`);
    }

    const { userId, tokensAdded, packageId } = metadata;

    // Validate amount and currency exist
    if (!session.amount_total || !session.currency) {
      console.error('Missing amount_total or currency in session:', session.id);
      throw new Error(`Missing payment details in session ${session.id}`);
    }

    const amountPaid = session.amount_total / 100; // Convert cents to dollars
    const currency = session.currency.toUpperCase();
    const eventId = session.id; // Used for idempotency

    // Check for duplicate processing
    const isDuplicate = await this.quotaRepository.isPurchaseProcessed(eventId);
    if (isDuplicate) {
      console.log(`Skipping duplicate webhook event: ${eventId}`);
      return;
    }

    // Add tokens to user account
    await this.quotaRepository.addTokens(
      userId,
      parseInt(tokensAdded),
      'purchase',
      `Purchased ${packageId} package via Stripe (Event: ${eventId})`,
      amountPaid,
      currency
    );
  }

  private async handleRefund(charge: Stripe.Charge): Promise<void> {
    // Validate charge amounts exist
    if (charge.amount === undefined || charge.amount_refunded === undefined) {
      console.error('Missing amount or amount_refunded in charge:', charge.id);
      return;
    }

    // Calculate proportional token deduction
    const refundAmount = charge.amount_refunded / 100;
    const totalAmount = charge.amount / 100;

    // Prevent division by zero
    if (totalAmount === 0) {
      console.error('Cannot process refund: original charge amount is zero for charge:', charge.id);
      return;
    }

    const refundPercentage = refundAmount / totalAmount;

    // Find original purchase by charge ID
    const purchase = await this.quotaRepository.getPurchaseByChargeId(charge.id);
    if (!purchase) {
      console.error(`Purchase not found for charge: ${charge.id}`);
      return;
    }

    // Deduct proportional tokens
    const tokensToDeduct = Math.floor(purchase.tokens_added * refundPercentage);
    await this.quotaRepository.deductTokens(purchase.user_id, tokensToDeduct);

    // Record refund in purchases table
    await this.quotaRepository.recordRefund(
      purchase.user_id,
      tokensToDeduct,
      refundAmount,
      charge.currency.toUpperCase(),
      `Refund for charge ${charge.id}`
    );
  }

  private async handlePaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
    // Log failure for analytics (no token changes)
    console.error('Payment failed:', {
      intentId: intent.id,
      amount: intent.amount / 100,
      currency: intent.currency,
      lastError: intent.last_payment_error?.message,
    });
  }
}
```

---

## Payment Flows

### 1. Checkout Creation Flow

```
┌─────────────┐
│   Frontend  │
│  (User UI)  │
└──────┬──────┘
       │ 1. User clicks "Buy 500k Tokens"
       │
       │ POST /create-checkout
       │ { packageId: "popular", successUrl: "...", cancelUrl: "..." }
       │ Authorization: Bearer <jwt>
       ▼
┌──────────────────────────────────────────┐
│  Edge Function: /create-checkout         │
│  ┌────────────────────────────────────┐  │
│  │ Handler Layer                      │  │
│  │ 1. Extract JWT token               │  │
│  │ 2. Validate user (AuthMiddleware)  │  │
│  │ 3. Check user.auth_provider        │  │
│  │    ❌ If 'anonymous' → reject       │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ Core Logic Layer                   │  │
│  │ 4. Validate packageId              │  │
│  │ 5. Get package config              │  │
│  │ 6. Create Stripe checkout session: │  │
│  │    - line_items with price         │  │
│  │    - metadata: { userId, ... }     │  │
│  │    - success/cancel URLs           │  │
│  └────────────────────────────────────┘  │
└──────┬───────────────────────────────────┘
       │ Response: { sessionId, url }
       ▼
┌──────────────┐
│   Frontend   │ 2. Redirect user to Stripe Checkout
│              │    window.location.href = session.url
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Stripe    │ 3. User completes payment
│   Checkout   │    (card details, 3D Secure, etc.)
└──────────────┘
```

### 2. Webhook Processing Flow

```
┌──────────────┐
│    Stripe    │ 1. Payment successful
│   Platform   │
└──────┬───────┘
       │ POST /stripe-webhook
       │ Stripe-Signature: t=...,v1=...
       │ { type: "checkout.session.completed", data: { ... } }
       ▼
┌──────────────────────────────────────────┐
│  Edge Function: /stripe-webhook          │
│  ┌────────────────────────────────────┐  │
│  │ Handler Layer                      │  │
│  │ 1. Get raw request body            │  │
│  │ 2. Get Stripe-Signature header     │  │
│  │ 3. Verify signature:               │  │
│  │    stripe.webhooks.constructEvent  │  │
│  │    ❌ Invalid → 400 response        │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ Core Logic Layer                   │  │
│  │ 4. Extract metadata from event:    │  │
│  │    - userId                        │  │
│  │    - tokensAdded                   │  │
│  │    - packageId                     │  │
│  │ 5. Check idempotency:              │  │
│  │    - Query token_purchases for     │  │
│  │      description containing        │  │
│  │      "Event: <session.id>"         │  │
│  │    - If exists → skip (return OK)  │  │
│  │ 6. Add tokens:                     │  │
│  │    QuotaRepository.addTokens(      │  │
│  │      userId,                       │  │
│  │      tokensAdded,                  │  │
│  │      'purchase',                   │  │
│  │      description,                  │  │
│  │      amountPaid,                   │  │
│  │      currency                      │  │
│  │    )                               │  │
│  └────────────────────────────────────┘  │
└──────┬───────────────────────────────────┘
       │ Response: 200 OK (always, even on errors)
       ▼
┌──────────────┐
│    Stripe    │ 2. Marks webhook as delivered
└──────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  PostgreSQL Database                      │
│  ┌────────────────────────────────────┐  │
│  │ add_tokens() function executes:    │  │
│  │ 1. BEGIN TRANSACTION               │  │
│  │ 2. SELECT ... FOR UPDATE           │  │
│  │    (row-level lock on user_quotas) │  │
│  │ 3. UPDATE tokens_available         │  │
│  │ 4. INSERT into token_purchases     │  │
│  │ 5. COMMIT                          │  │
│  └────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

### 3. Refund Processing Flow

```
┌──────────────┐
│ Stripe Admin │ 1. Admin issues refund (full or partial)
│   Dashboard  │
└──────┬───────┘
       │ Webhook: charge.refunded
       ▼
┌──────────────────────────────────────────┐
│  Edge Function: /stripe-webhook          │
│  1. Verify signature                     │
│  2. Extract refund data:                 │
│     - charge.id                          │
│     - amount_refunded (cents)            │
│     - amount (total charge)              │
│  3. Calculate proportional deduction:    │
│     refundPercentage = refunded / total  │
│  4. Find original purchase by charge.id  │
│  5. Calculate tokens to deduct:          │
│     tokensToDeduct = floor(              │
│       originalTokens * refundPercentage  │
│     )                                    │
│  6. Deduct tokens from user account      │
│  7. Record refund in token_purchases     │
│     (with negative tokens_added)         │
└───────────────────────────────────────────┘
```

**Example Refund Calculation:**
- User purchased 500k tokens for $20.00
- Admin refunds $10.00 (50% refund)
- Tokens deducted: floor(500,000 * 0.5) = 250,000 tokens

---

## Anonymous User Restrictions

### Why Registered Users Only?

**Problem with anonymous payments:**
1. **Token loss risk** - Anonymous users lose access if they clear browser storage
2. **No account recovery** - Cannot prove ownership or recover paid tokens
3. **Support nightmare** - "I paid but lost my tokens" with no email verification
4. **No receipts** - Stripe sends receipts to email, but anonymous users have fake emails
5. **Refund complications** - Cannot verify user identity for refund requests

**Industry precedent:** All major SaaS platforms (Stripe, AWS, OpenAI, etc.) require account creation before payment.

### Implementation

**Check in `/create-checkout` handler:**

```typescript
// After authenticating user
const user = await authMiddleware.authenticate(req.headers);

// Block anonymous users
if (user.auth_provider === 'anonymous') {
  return new Response(
    JSON.stringify({
      error: {
        code: 'ANONYMOUS_PURCHASE_NOT_ALLOWED',
        message: 'Please create an account before purchasing tokens. Anonymous users cannot make purchases to prevent token loss if browser data is cleared.',
      },
    }),
    { status: 403, headers: jsonHeaders() }
  );
}
```

**Frontend UX:**
- Show "Create Account to Buy Tokens" button for anonymous users
- Redirect to signup/login flow
- After account creation, allow purchases

**Future Enhancement (Optional):**
- Enable Supabase account linking (anonymous → email)
- Allow anonymous users to upgrade account before checkout
- Preserve existing tokens when linking accounts

---

## Security & Idempotency

### Webhook Signature Verification

**Critical for security:** Always verify webhook signatures to prevent fake webhook attacks.

```typescript
// Handler layer (platform-specific)
try {
  event = stripe.webhooks.constructEvent(
    rawBody,                          // Raw request body (not parsed JSON)
    signature,                        // stripe-signature header
    config.payment.stripeWebhookSecret // From environment
  );
} catch (err) {
  console.error('Webhook signature verification failed:', err.message);
  return new Response('Invalid signature', { status: 400 });
}
```

**Why signature verification matters:**
- Prevents attackers from sending fake webhooks to add tokens
- Ensures webhook originated from Stripe
- Validates webhook payload hasn't been tampered with

### Idempotency Handling

**Problem:** Stripe may send the same webhook multiple times (network retries, failures, etc.)

**Solution:** Track processed events to avoid duplicate token additions.

**Implementation Strategy:**

> ⚠️ **IMPORTANT:** Idempotency is critical for payment systems. Duplicate webhook events can result in users receiving tokens multiple times for a single payment.

**Option 1: Add stripe_event_id column (RECOMMENDED):**

This describes the prototype approach, which is disabled in the current deployment:

```sql
ALTER TABLE token_purchases ADD COLUMN stripe_event_id TEXT UNIQUE;
CREATE INDEX idx_token_purchases_stripe_event_id
ON token_purchases(stripe_event_id)
WHERE stripe_event_id IS NOT NULL;
```

```typescript
// In QuotaRepository.isPurchaseProcessed()
async isPurchaseProcessed(eventId: string): Promise<boolean> {
  const { data } = await this.supabase
    .from('token_purchases')
    .select('id')
    .eq('stripe_event_id', eventId)
    .maybeSingle();

  return !!data;
}

// In QuotaRepository.addTokens()
async addTokens(
  userId: string,
  tokensAdded: number,
  purchaseType: string,
  description: string,
  amountPaid?: number,
  currency: string = 'USD',
  stripeEventId?: string  // Add this parameter
): Promise<void> {
  // Use database function with stripe_event_id
  await this.supabase.rpc('add_tokens', {
    p_user_id: userId,
    p_tokens_added: tokensAdded,
    p_purchase_type: purchaseType,
    p_description: description,
    p_amount_paid: amountPaid,
    p_currency: currency,
    p_stripe_event_id: stripeEventId,
  });
}
```

**Option 2: Check description field (TEMPORARY WORKAROUND):**

> ⚠️ **WARNING:** This approach is fragile and NOT recommended for production:
> - Description field can be modified by admins
> - LIKE queries are slower than indexed columns
> - No database-level uniqueness guarantee
> - Risk of race conditions if multiple webhooks arrive simultaneously

Use this only for initial development/testing:

```typescript
// Store Stripe event ID in description
const description = `Purchased ${packageId} package via Stripe (Event: ${session.id})`;

// Before processing, check if event already processed
const existingPurchase = await quotaRepository.getPurchaseByDescription(
  `Event: ${session.id}`
);

if (existingPurchase) {
  console.log(`Duplicate webhook event: ${session.id}`);
  return; // Skip processing
}

await quotaRepository.addTokens(userId, tokens, 'purchase', description, ...);
```

**Migration Path:**

If starting with Option 2, plan to migrate to Option 1 before production:

1. Add `stripe_event_id` column to schema
2. Update `add_tokens()` database function to accept `p_stripe_event_id`
3. Update `QuotaRepository.addTokens()` signature
4. Update `PaymentService` to pass event ID
5. Backfill existing purchases if needed
6. Deploy changes
7. Add UNIQUE constraint for enforcement

### Race Condition Protection

**Database-level protection** already exists via `add_tokens()` function:

```sql
-- Atomic operation with row-level lock
SELECT * FROM user_quotas WHERE user_id = p_user_id FOR UPDATE;
UPDATE user_quotas SET tokens_available = tokens_available + p_tokens_added;
INSERT INTO token_purchases (...);
```

This prevents race conditions if multiple webhook handlers process the same event simultaneously.

### Environment Variable Security

**Sensitive credentials:**
- `STRIPE_SECRET_KEY` - Never expose to frontend
- `STRIPE_WEBHOOK_SECRET` - Used only by backend
- `STRIPE_PUBLISHABLE_KEY` - Safe to expose to frontend

**Best practices:**
- Store secrets in Supabase Secrets (encrypted at rest)
- Use different keys for development vs. production
- Rotate webhook secret if compromised
- Never commit keys to git

---

## Database Schema

### Existing Tables (Already Prepared)

The database schema is **already configured** for Stripe payments. No migrations needed!

#### user_quotas
```sql
CREATE TABLE user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tokens_available BIGINT NOT NULL DEFAULT 0,
  tokens_used BIGINT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
```

#### token_purchases
```sql
CREATE TABLE token_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tokens_added BIGINT NOT NULL,           -- Positive for purchases, negative for refunds
  purchase_type TEXT NOT NULL,            -- 'purchase' for Stripe payments
  amount_paid DECIMAL(10, 2),             -- ✅ For Stripe payment amount
  currency TEXT DEFAULT 'USD',            -- ✅ For Stripe currency
  description TEXT,                       -- ✅ For Stripe event ID and package info
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_purchases_user_id ON token_purchases(user_id);
CREATE INDEX idx_token_purchases_created_at ON token_purchases(created_at DESC);
```

**Key Insights:**
- `amount_paid` and `currency` columns are already designed for Stripe
- `purchase_type` enum includes `'purchase'` value
- `description` field can store Stripe event IDs for idempotency
- Indexes support purchase history queries

### Database Functions (Already Implemented)

#### add_tokens()
```sql
CREATE OR REPLACE FUNCTION add_tokens(
  p_user_id UUID,
  p_tokens_added BIGINT,
  p_purchase_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_amount_paid DECIMAL DEFAULT NULL,
  p_currency TEXT DEFAULT 'USD'
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Atomic update with row-level lock
  UPDATE user_quotas
  SET
    tokens_available = tokens_available + p_tokens_added,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Record transaction
  INSERT INTO token_purchases (
    user_id,
    tokens_added,
    purchase_type,
    description,
    amount_paid,
    currency
  ) VALUES (
    p_user_id,
    p_tokens_added,
    p_purchase_type,
    p_description,
    p_amount_paid,
    p_currency
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

**Usage in PaymentService:**
```typescript
await quotaRepository.addTokens(
  userId,
  500_000,              // tokens
  'purchase',           // purchase_type
  'Purchased popular package via Stripe (Event: cs_test_abc123)', // description
  20.00,                // amount_paid
  'USD'                 // currency
);
```

---

## API Endpoints

### POST /create-checkout

**Authentication:** Required (Bearer token)

**Purpose:** Create a Stripe checkout session for token purchase

**Request:**
```json
{
  "packageId": "popular",
  "successUrl": "https://yourapp.com/payment/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://yourapp.com/payment/cancel"
}
```

**Request Fields:**
- `packageId` (string, required) - Must match ID in `TOKEN_PACKAGES` config
- `successUrl` (string, required) - Redirect URL after successful payment (use `{CHECKOUT_SESSION_ID}` placeholder)
- `cancelUrl` (string, required) - Redirect URL if user cancels

**Response (200 OK):**
```json
{
  "sessionId": "cs_test_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

**Response Fields:**
- `sessionId` - Stripe checkout session ID (can be used to verify payment on success page)
- `url` - Redirect user to this URL to complete payment

**Errors:**

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_TOKEN` | 401 | Missing or invalid JWT token |
| `USER_BLOCKED` | 403 | User account is blocked (is_active = false) |
| `ANONYMOUS_PURCHASE_NOT_ALLOWED` | 403 | Anonymous users cannot make purchases |
| `INVALID_PACKAGE_ID` | 400 | Package ID not found in TOKEN_PACKAGES config |
| `MISSING_REQUIRED_FIELD` | 400 | successUrl or cancelUrl missing |

**Example cURL:**
```bash
curl -X POST http://localhost:54321/functions/v1/create-checkout \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "popular",
    "successUrl": "http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}",
    "cancelUrl": "http://localhost:3000/cancel"
  }'
```

**Frontend Integration (React/Next.js):**
```typescript
const handleBuyTokens = async (packageId: string) => {
  const response = await fetch('/functions/v1/create-checkout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      packageId,
      successUrl: `${window.location.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/payment/cancel`,
    }),
  });

  const { url } = await response.json();

  // Redirect to Stripe Checkout
  window.location.href = url;
};
```

---

### POST /stripe-webhook

**Authentication:** Stripe signature verification (not JWT)

**Purpose:** Receive webhook events from Stripe and process payments

**Headers:**
- `stripe-signature` (required) - Webhook signature for verification

**Request Body:**
Raw Stripe webhook event (JSON string, not parsed)

**Supported Events:**
- `checkout.session.completed` - Payment successful, add tokens
- `charge.refunded` - Refund issued, deduct tokens proportionally
- `payment_intent.payment_failed` - Payment failed, log for analytics

**Response:**
- `200 OK` - Always return 200 to acknowledge receipt (even on processing errors)
- `400 Bad Request` - Only for invalid signature

**Important:** This endpoint is called by Stripe servers, not frontend. Configure the webhook URL in Stripe Dashboard.

**Stripe Dashboard Configuration:**
1. Go to Developers → Webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. Select events: `checkout.session.completed`, `charge.refunded`, `payment_intent.payment_failed`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET` environment variable

---

## Error Handling

### Custom Error Classes

**Location:** `src/errors/payment-errors.ts`

```typescript
export class InvalidPackageError extends Error {
  code = 'INVALID_PACKAGE_ID';
  statusCode = 400;

  constructor(packageId: string) {
    super(`Invalid package ID: ${packageId}`);
  }
}

export class AnonymousPurchaseNotAllowedError extends Error {
  code = 'ANONYMOUS_PURCHASE_NOT_ALLOWED';
  statusCode = 403;

  constructor() {
    super('Please create an account before purchasing tokens. Anonymous users cannot make purchases to prevent token loss.');
  }
}

export class InvalidWebhookSignatureError extends Error {
  code = 'INVALID_WEBHOOK_SIGNATURE';
  statusCode = 400;

  constructor() {
    super('Webhook signature verification failed');
  }
}

export class PaymentProcessingError extends Error {
  code = 'PAYMENT_PROCESSING_ERROR';
  statusCode = 500;

  constructor(message: string) {
    super(message);
  }
}
```

### Error Handling in Handlers

**Complete Create Checkout Handler with All Validations:**
```typescript
// supabase/functions/create-checkout/handler.ts
import { InvalidPackageError } from '../../../src/errors/payment-errors.ts';

export async function handleCreateCheckout(
  req: Request,
  authMiddleware: AuthMiddleware,
  paymentService: PaymentService,
  stripe: Stripe
): Promise<Response> {
  try {
    // 1. Authenticate user
    const user = await authMiddleware.authenticate(req.headers);

    // 2. Block anonymous users
    if (user.authProvider === 'anonymous') {
      return new Response(JSON.stringify({
        error: {
          code: 'ANONYMOUS_PURCHASE_NOT_ALLOWED',
          message: 'Please create an account before purchasing tokens.',
        },
      }), { status: 403, headers: jsonHeaders() });
    }

    // 3. Parse and validate JSON
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      return new Response(JSON.stringify({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON',
        },
      }), { status: 400, headers: jsonHeaders() });
    }

    const { packageId, successUrl, cancelUrl } = requestBody;

    // 4. Validate required fields
    if (!packageId || !successUrl || !cancelUrl) {
      return new Response(JSON.stringify({
        error: {
          code: 'MISSING_REQUIRED_FIELD',
          message: 'Missing required fields: packageId, successUrl, cancelUrl',
        },
      }), { status: 400, headers: jsonHeaders() });
    }

    // 5. Create checkout session
    const session = await paymentService.createCheckoutSession(
      user.id,
      packageId,
      successUrl,
      cancelUrl,
      stripe
    );

    return new Response(JSON.stringify({
      sessionId: session.id,
      url: session.url,
    }), { headers: jsonHeaders() });

  } catch (error: any) {
    console.error('Create checkout error:', error);

    // Handle known errors
    if (error instanceof InvalidPackageError) {
      return new Response(JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
        },
      }), { status: error.statusCode, headers: jsonHeaders() });
    }

    // Handle authentication errors
    if (error.code === 'INVALID_TOKEN' || error.code === 'USER_BLOCKED') {
      return new Response(JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
        },
      }), { status: error.statusCode || 401, headers: jsonHeaders() });
    }

    // Generic error
    return new Response(JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    }), { status: 500, headers: jsonHeaders() });
  }
}
```

**Complete Webhook Handler with All Validations:**
```typescript
// supabase/functions/stripe-webhook/handler.ts
export async function handleStripeWebhook(
  req: Request,
  paymentService: PaymentService,
  stripe: Stripe,
  webhookSecret: string
): Promise<Response> {
  // 1. Get raw body and signature
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  // 2. Validate signature header exists
  if (!signature) {
    console.error('Missing stripe-signature header');
    return new Response('Missing signature', { status: 400 });
  }

  // 3. Validate body is not empty
  if (!body) {
    console.error('Empty request body');
    return new Response('Empty request body', { status: 400 });
  }

  // 4. Verify webhook signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (signatureError: any) {
    console.error('Webhook signature verification failed:', signatureError.message);
    return new Response('Invalid signature', { status: 400 });
  }

  // 5. Process event (always return 200 to prevent retries)
  try {
    await paymentService.processWebhook(event);
  } catch (processingError: any) {
    console.error('Webhook processing error:', {
      type: event.type,
      eventId: event.id,
      error: processingError.message,
    });
    // Still return 200 to acknowledge receipt
    // Stripe will not retry if we return 200
  }

  return new Response('OK', { status: 200 });
}
```

**Helper Functions:**
```typescript
// Shared CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const jsonHeaders = () => ({
  ...corsHeaders,
  'Content-Type': 'application/json',
});
```

### Webhook Retry Behavior

**Stripe's retry logic:**
- If webhook returns non-2xx status, Stripe retries
- Retries with exponential backoff (up to 3 days)
- After max retries, webhook marked as failed in dashboard

**Best practices:**
- Always return 200 OK to acknowledge receipt
- Handle processing errors internally (log but don't throw)
- Use idempotency to safely handle duplicate events
- Monitor webhook failures in Stripe Dashboard

---

## Testing Strategy

### Local Testing with Stripe CLI

**Install Stripe CLI:**
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/v1.21.9/stripe_1.21.9_linux_x86_64.tar.gz
tar -xvf stripe_1.21.9_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

**Login to Stripe:**
```bash
stripe login
```

**Forward webhooks to local server:**
```bash
# Start Supabase local stack first
supabase start

# Forward webhooks to local function
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

**Output:**
```
> Ready! You are using Stripe API Version [2024-11-20]. Your webhook signing secret is whsec_xxxxx
```

**Copy webhook secret to environment:**
```bash
# .env.local
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

**Trigger test webhooks:**
```bash
# Test successful payment
stripe trigger checkout.session.completed

# Test refund
stripe trigger charge.refunded

# Test failed payment
stripe trigger payment_intent.payment_failed
```

### Test Cards

**Use Stripe's test cards in checkout:**

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Visa - always succeeds |
| `4000 0025 0000 3155` | Visa - requires 3D Secure authentication |
| `4000 0000 0000 9995` | Visa - always declined (insufficient funds) |
| `4000 0000 0000 0002` | Visa - always declined (generic error) |

**Test card details:**
- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

### Unit Tests

**Test PaymentService methods with edge cases:**

```typescript
// tests/unit/services/payment-service.test.ts
import { PaymentService } from '../../../src/services/payment-service';
import { QuotaRepository } from '../../../src/repositories/quota.repository';
import { InvalidPackageError } from '../../../src/errors/payment-errors';

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockQuotaRepository: jest.Mocked<QuotaRepository>;
  let mockStripe: any;

  beforeEach(() => {
    mockQuotaRepository = {
      addTokens: jest.fn(),
      deductTokens: jest.fn(),
      isPurchaseProcessed: jest.fn(),
      getPurchaseByChargeId: jest.fn(),
    } as any;

    mockStripe = {
      checkout: {
        sessions: {
          create: jest.fn(),
        },
      },
    };

    paymentService = new PaymentService(mockQuotaRepository, mockConfig);
  });

  describe('createCheckoutSession', () => {
    test('creates Stripe session with correct metadata', async () => {
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/test',
      });

      const result = await paymentService.createCheckoutSession(
        'user-123',
        'popular',
        'http://success.com',
        'http://cancel.com',
        mockStripe
      );

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            userId: 'user-123',
            packageId: 'popular',
            tokensAdded: '500000',
          }),
        })
      );
      expect(result.url).toBe('https://checkout.stripe.com/test');
    });

    test('throws InvalidPackageError for unknown package', async () => {
      await expect(
        paymentService.createCheckoutSession(
          'user-123',
          'nonexistent',
          'http://success.com',
          'http://cancel.com',
          mockStripe
        )
      ).rejects.toThrow(InvalidPackageError);
    });
  });

  describe('processWebhook - checkout.session.completed', () => {
    test('handles successful payment idempotently', async () => {
      // First call - should process
      mockQuotaRepository.isPurchaseProcessed.mockResolvedValue(false);

      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            metadata: {
              userId: 'user-123',
              tokensAdded: '500000',
              packageId: 'popular',
            },
            amount_total: 2000, // $20.00
            currency: 'usd',
          },
        },
      };

      await paymentService.processWebhook(event as any);

      expect(mockQuotaRepository.addTokens).toHaveBeenCalledWith(
        'user-123',
        500000,
        'purchase',
        expect.stringContaining('Event: cs_test_123'),
        20.00,
        'USD'
      );

      // Second call - should skip (idempotent)
      mockQuotaRepository.isPurchaseProcessed.mockResolvedValue(true);
      await paymentService.processWebhook(event as any);

      // Still only called once
      expect(mockQuotaRepository.addTokens).toHaveBeenCalledTimes(1);
    });

    test('throws error when metadata is missing', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            metadata: {}, // Missing required fields
            amount_total: 2000,
            currency: 'usd',
          },
        },
      };

      await expect(
        paymentService.processWebhook(event as any)
      ).rejects.toThrow('Missing metadata');
    });

    test('throws error when amount_total is missing', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            metadata: {
              userId: 'user-123',
              tokensAdded: '500000',
              packageId: 'popular',
            },
            // amount_total missing
            currency: 'usd',
          },
        },
      };

      await expect(
        paymentService.processWebhook(event as any)
      ).rejects.toThrow('Missing payment details');
    });
  });

  describe('handleRefund', () => {
    test('calculates proportional token deduction for 50% refund', async () => {
      const charge = {
        id: 'ch_test_123',
        amount: 2000,         // $20.00 total
        amount_refunded: 1000, // $10.00 refunded (50%)
        currency: 'usd',
      };

      mockQuotaRepository.getPurchaseByChargeId.mockResolvedValue({
        user_id: 'user-123',
        tokens_added: 500000,
      });

      await paymentService['handleRefund'](charge as any);

      // Should deduct 250,000 tokens (50% of 500,000)
      expect(mockQuotaRepository.deductTokens).toHaveBeenCalledWith(
        'user-123',
        250000
      );
    });

    test('handles full refund (100%)', async () => {
      const charge = {
        id: 'ch_test_123',
        amount: 2000,
        amount_refunded: 2000, // Full refund
        currency: 'usd',
      };

      mockQuotaRepository.getPurchaseByChargeId.mockResolvedValue({
        user_id: 'user-123',
        tokens_added: 500000,
      });

      await paymentService['handleRefund'](charge as any);

      // Should deduct all 500,000 tokens
      expect(mockQuotaRepository.deductTokens).toHaveBeenCalledWith(
        'user-123',
        500000
      );
    });

    test('safely handles zero total amount (no division by zero)', async () => {
      const charge = {
        id: 'ch_test_123',
        amount: 0,            // Zero total (edge case)
        amount_refunded: 0,
        currency: 'usd',
      };

      // Should not throw error, just return early
      await paymentService['handleRefund'](charge as any);

      // Should not call deductTokens
      expect(mockQuotaRepository.deductTokens).not.toHaveBeenCalled();
    });

    test('safely handles missing charge amounts', async () => {
      const charge = {
        id: 'ch_test_123',
        // amount and amount_refunded missing
        currency: 'usd',
      };

      // Should not throw error, just return early
      await paymentService['handleRefund'](charge as any);

      // Should not call deductTokens
      expect(mockQuotaRepository.deductTokens).not.toHaveBeenCalled();
    });

    test('handles missing purchase record gracefully', async () => {
      const charge = {
        id: 'ch_test_123',
        amount: 2000,
        amount_refunded: 1000,
        currency: 'usd',
      };

      mockQuotaRepository.getPurchaseByChargeId.mockResolvedValue(null);

      // Should not throw error, just return early
      await paymentService['handleRefund'](charge as any);

      // Should not call deductTokens
      expect(mockQuotaRepository.deductTokens).not.toHaveBeenCalled();
    });
  });
});
```

### Integration Testing

**Test complete payment flow:**

```bash
# 1. Start local Supabase
supabase start

# 2. Bootstrap test users
curl -X POST http://localhost:54321/functions/v1/admin/bootstrap \
  -H "Authorization: Bearer $BOOTSTRAP_SECRET_KEY"

# 3. Login as free user and get JWT
TOKEN=$(curl -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "free@textenhancer.dev", "password": "Free_User_2025"}' \
  | jq -r '.access_token')

# 4. Create checkout session
CHECKOUT=$(curl -X POST http://localhost:54321/functions/v1/create-checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "popular",
    "successUrl": "http://localhost:3000/success",
    "cancelUrl": "http://localhost:3000/cancel"
  }')

echo $CHECKOUT | jq

# 5. In separate terminal, forward webhooks
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# 6. Trigger test webhook
stripe trigger checkout.session.completed

# 7. Check user quota (should have 550k tokens: 50k initial + 500k purchase)
curl -X GET http://localhost:54321/functions/v1/me \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.quota.tokens_available'
```

---

## Deployment Checklist

### 1. Environment Variables

**Add to Supabase Secrets (production):**
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Or use environment sync script:**
```bash
# Update .env.production with Stripe keys
echo "STRIPE_SECRET_KEY=sk_live_..." >> .env.production
echo "STRIPE_WEBHOOK_SECRET=whsec_..." >> .env.production

# Sync to Supabase
npm run setup:env
```

### 2. Stripe Dashboard Configuration

**Create webhook endpoint:**
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter URL: `https://your-project-ref.supabase.co/functions/v1/stripe-webhook`
4. Select events to listen to:
   - ✅ `checkout.session.completed`
   - ✅ `charge.refunded`
   - ✅ `payment_intent.payment_failed`
5. Click "Add endpoint"
6. Copy "Signing secret" (starts with `whsec_`)
7. Save to `STRIPE_WEBHOOK_SECRET` environment variable

**Create products (optional):**
- While checkout sessions can create products dynamically, you may want to pre-create products in Stripe Dashboard for better reporting
- Products → Add product → Set name, price, metadata

### 3. Deploy Edge Functions

**Deploy payment functions:**
```bash
# Deploy all functions (includes /create-checkout and /stripe-webhook)
npm run deploy

# Or deploy individually
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
```

**Verify deployment:**
```bash
# Check health of create-checkout
curl https://your-project.supabase.co/functions/v1/create-checkout

# Should return 405 Method Not Allowed (POST required)
```

### 4. Test in Production

**Create checkout session (production):**
```bash
# Get production JWT token first
PROD_TOKEN="<production-jwt-token>"

# Create checkout
curl -X POST https://your-project.supabase.co/functions/v1/create-checkout \
  -H "Authorization: Bearer $PROD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "starter",
    "successUrl": "https://yourapp.com/success",
    "cancelUrl": "https://yourapp.com/cancel"
  }'
```

**Use test mode in production:**
- Create separate webhook endpoint for test mode: `.../stripe-webhook-test`
- Use test API keys to verify before switching to live mode
- Process small-value purchase with real card before going live

### 5. Monitor Webhooks

**Stripe Dashboard monitoring:**
- Webhooks → Click endpoint → View webhook attempts
- Monitor success rate (should be close to 100%)
- Check failed events and retry manually if needed

**Application logging:**
```bash
# Tail Edge Function logs
npm run logs:tail

# Filter for payment-related logs
npm run logs | grep -i "payment\|webhook\|stripe"
```

**Set up alerts (optional):**
- Stripe Dashboard → Developers → Webhooks → Configure email alerts
- Get notified when webhooks fail repeatedly

### 6. Security Checklist

- ✅ Webhook signature verification enabled
- ✅ Anonymous users blocked from purchases
- ✅ Environment secrets not committed to git
- ✅ Different Stripe keys for dev/prod
- ✅ HTTPS enforced for webhook endpoint
- ✅ Rate limiting on /create-checkout (prevent spam)
- ✅ Input validation on packageId, URLs
- ✅ Error messages don't expose sensitive data

### 7. Database Verification

**Check indexes exist:**
```sql
-- Should show indexes on token_purchases
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename = 'token_purchases';
```

**Verify functions:**
```sql
-- Test add_tokens function
SELECT add_tokens(
  '<test-user-id>',
  100000,
  'purchase',
  'Test purchase',
  5.00,
  'USD'
);

-- Check result in token_purchases
SELECT * FROM token_purchases WHERE user_id = '<test-user-id>';
```

---

## Future Enhancements

### Planned Features

1. **Subscription Plans**
   - Monthly/yearly subscriptions with recurring token grants
   - Different subscription tiers (Basic, Pro, Enterprise)
   - Proration handling for upgrades/downgrades

2. **Promotional Discounts**
   - Stripe coupon support
   - Referral bonuses
   - Seasonal promotions

3. **Token Gifting**
   - Purchase tokens for another user
   - Gift codes/vouchers

4. **Usage Analytics**
   - Track revenue per user
   - Token purchase patterns
   - Conversion funnel (free → paid)

5. **Account Linking for Anonymous Users**
   - Enable Supabase account linking
   - Allow anonymous → email account upgrades
   - Preserve tokens when linking accounts

### Schema Enhancements (Future)

**Add stripe_event_id column for better idempotency:**
```sql
ALTER TABLE token_purchases
ADD COLUMN stripe_event_id TEXT UNIQUE,
ADD COLUMN stripe_charge_id TEXT;

CREATE INDEX idx_token_purchases_stripe_event_id
ON token_purchases(stripe_event_id)
WHERE stripe_event_id IS NOT NULL;
```

**Add subscriptions table:**
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,  -- active, canceled, past_due
  plan_id TEXT NOT NULL,
  tokens_per_period BIGINT NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Summary

The payment system is designed to integrate seamlessly with the existing architecture:

**✅ Already prepared:**
- Database schema with `amount_paid`, `currency`, `description` columns
- Atomic `add_tokens()` database function
- Token quota management via QuotaRepository
- Purchase history tracking

**✅ To implement:**
- PaymentService (platform-agnostic core logic)
- /create-checkout Edge Function (thin handler)
- /stripe-webhook Edge Function (thin handler)
- Payment configuration (TOKEN_PACKAGES)
- Custom error classes
- Unit tests for payment flows

**✅ Security features:**
- Webhook signature verification
- Anonymous user blocking
- Idempotency handling
- Atomic database operations

**✅ Follows project principles:**
- Two-layer architecture (36-line handlers + core logic)
- Platform portability (Stripe SDK in handler, logic in src/)
- Comprehensive testing (Jest unit tests)
- Clear error handling (custom error classes)

**Migration effort:** If platform changes (AWS Lambda, Cloudflare Workers), only the webhook verification code in handlers needs rewriting (~80 lines). All payment logic in `PaymentService` remains unchanged.

---

## Validation & Edge Case Handling

This guide includes comprehensive validation and error handling for production readiness:

### Input Validation
- ✅ **Signature verification** - Null check before using `stripe-signature` header
- ✅ **Empty body check** - Validate webhook request body is not empty
- ✅ **JSON parsing** - Try-catch for malformed request bodies with proper error responses
- ✅ **Required fields** - Validate `packageId`, `successUrl`, `cancelUrl` exist before processing
- ✅ **Anonymous blocking** - Check `user.authProvider !== 'anonymous'` with 403 response

### Webhook Event Validation
- ✅ **Metadata validation** - Check all required fields exist in `session.metadata` before processing
- ✅ **Amount validation** - Ensure `amount_total` and `currency` exist in session
- ✅ **Charge amounts** - Validate `amount` and `amount_refunded` exist before refund calculation
- ✅ **Division by zero** - Prevent crash when `charge.amount === 0`
- ✅ **Missing purchase** - Gracefully handle refund when original purchase not found

### Error Handling Patterns
- ✅ **Structured errors** - All errors return JSON with `code` and `message` fields
- ✅ **HTTP status codes** - Proper 400/403/500 status codes for different error types
- ✅ **Webhook resilience** - Always return 200 to Stripe except for signature failures
- ✅ **Error logging** - Console logging with context for debugging
- ✅ **No sensitive data** - Error messages don't expose internal details

### Idempotency Best Practices
- ✅ **Recommended approach** - Use dedicated `stripe_event_id` column with UNIQUE constraint
- ✅ **Temporary workaround** - Description-based check with clear warnings about limitations
- ✅ **Migration path** - Step-by-step guide to upgrade from Option 2 to Option 1

### Testing Coverage
- ✅ **Edge cases** - Tests for missing metadata, zero amounts, division by zero
- ✅ **Idempotency** - Tests verify duplicate events are safely ignored
- ✅ **Refund calculations** - Tests for 50%, 100%, and edge case refunds
- ✅ **Error scenarios** - Tests for invalid packages, missing purchases, etc.

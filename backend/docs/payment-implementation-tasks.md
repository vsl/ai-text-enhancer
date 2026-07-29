# Payment System Implementation Tasks

**Feature Summary:**
Implementing Stripe Checkout integration for token purchases with two-layer architecture (platform-agnostic core + thin Edge Function handlers). Only registered users can purchase tokens. Includes webhook processing for payments, refunds, idempotency handling, and atomic database operations.

---

## Phase 1: Configuration & Error Handling

### Task 1.1: Create Payment Configuration Module
**File:** `src/config/payment.config.ts`

**Description:**
Define token packages with pricing, create TypeScript interfaces for type safety.

**Acceptance Criteria:**
- [ ] Create `TokenPackage` interface with fields: `id`, `name`, `tokens`, `price`, `currency`, `popular?`
- [ ] Define `TOKEN_PACKAGES` array with 4 packages:
  - [ ] Starter: 100k tokens @ $5 (500 cents)
  - [ ] Popular: 500k tokens @ $20 (2000 cents) with `popular: true`
  - [ ] Premium: 1M tokens @ $35 (3500 cents)
  - [ ] Enterprise: 5M tokens @ $150 (15000 cents)
- [ ] Export `TOKEN_PACKAGES` constant
- [ ] Add helper function `getPackageById(packageId: string): TokenPackage | undefined`
- [ ] Add JSDoc comments explaining pricing strategy (volume discounts)

**Testing:**
- [ ] Verify all packages have unique IDs
- [ ] Verify pricing math (cents conversion)
- [ ] Test `getPackageById` returns correct package
- [ ] Test `getPackageById` returns undefined for invalid ID

---

### Task 1.2: Create Custom Payment Error Classes
**File:** `src/errors/payment-errors.ts`

**Description:**
Define custom error classes for payment-specific failures with proper error codes and status codes.

**Acceptance Criteria:**
- [ ] Create `InvalidPackageError` class
  - [ ] Set `code = 'INVALID_PACKAGE_ID'`
  - [ ] Set `statusCode = 400`
  - [ ] Constructor accepts `packageId: string`
  - [ ] Message: `Invalid package ID: ${packageId}`
- [ ] Create `AnonymousPurchaseNotAllowedError` class
  - [ ] Set `code = 'ANONYMOUS_PURCHASE_NOT_ALLOWED'`
  - [ ] Set `statusCode = 403`
  - [ ] Message explaining why anonymous users cannot purchase
- [ ] Create `InvalidWebhookSignatureError` class
  - [ ] Set `code = 'INVALID_WEBHOOK_SIGNATURE'`
  - [ ] Set `statusCode = 400`
  - [ ] Message: `Webhook signature verification failed`
- [ ] Create `PaymentProcessingError` class
  - [ ] Set `code = 'PAYMENT_PROCESSING_ERROR'`
  - [ ] Set `statusCode = 500`
  - [ ] Constructor accepts custom message

**Testing:**
- [ ] Test each error class creates instances with correct properties
- [ ] Test error messages are descriptive
- [ ] Test status codes match HTTP standards

---

## Phase 2: Core Payment Service (Platform-Agnostic)

### Task 2.1: Implement PaymentService - Checkout Session Creation
**File:** `src/services/payment-service.ts`

**Description:**
Create platform-agnostic service for creating Stripe checkout sessions with user metadata.

**Acceptance Criteria:**
- [ ] Create `PaymentService` class with constructor accepting `QuotaRepository` and `AppConfig`
- [ ] Implement `createCheckoutSession()` method:
  - [ ] Parameters: `userId`, `packageId`, `successUrl`, `cancelUrl`, `stripe` (injected)
  - [ ] Validate package exists using `getPackageById()`
  - [ ] Throw `InvalidPackageError` if package not found
  - [ ] Create Stripe checkout session with:
    - [ ] `mode: 'payment'`
    - [ ] Line items with dynamic price creation
    - [ ] Product data: name, description with token count
    - [ ] Metadata: `userId`, `packageId`, `tokensAdded` (as string)
    - [ ] Success and cancel URLs
  - [ ] Return `{ id: session.id, url: session.url }`
- [ ] Add TypeScript types for return values
- [ ] Add JSDoc comments

**Testing:**
- [ ] Test creates session with correct metadata
- [ ] Test throws InvalidPackageError for unknown package
- [ ] Test all 4 packages create sessions with correct pricing
- [ ] Test success/cancel URLs are passed through correctly
- [ ] Mock Stripe SDK to avoid real API calls

---

### Task 2.2: Implement PaymentService - Webhook Processing
**File:** `src/services/payment-service.ts` (continued)

**Description:**
Add webhook event processing for checkout completion, refunds, and payment failures.

**Acceptance Criteria:**
- [ ] Implement `processWebhook()` method:
  - [ ] Parameter: `event: Stripe.Event`
  - [ ] Switch on `event.type`:
    - [ ] Case `checkout.session.completed` → call `handleCheckoutCompleted()`
    - [ ] Case `charge.refunded` → call `handleRefund()`
    - [ ] Case `payment_intent.payment_failed` → call `handlePaymentFailed()`
- [ ] Implement private `handleCheckoutCompleted()`:
  - [ ] Extract and validate metadata exists (userId, tokensAdded, packageId)
  - [ ] Throw error if metadata missing with descriptive message
  - [ ] Validate `amount_total` and `currency` exist
  - [ ] Throw error if payment details missing
  - [ ] Convert amount from cents to dollars: `amount_total / 100`
  - [ ] Check idempotency: `await quotaRepository.isPurchaseProcessed(session.id)`
  - [ ] Skip if duplicate (log and return early)
  - [ ] Call `quotaRepository.addTokens()` with:
    - [ ] userId from metadata
    - [ ] tokens from metadata (parse as integer)
    - [ ] purchase_type: `'purchase'`
    - [ ] description: `Purchased ${packageId} package via Stripe (Event: ${session.id})`
    - [ ] amountPaid in dollars
    - [ ] currency (uppercase)
- [ ] Add comprehensive validation error messages
- [ ] Add console logging for debugging

**Testing:**
- [ ] Test successful payment adds tokens
- [ ] Test duplicate event is skipped (idempotency)
- [ ] Test missing metadata throws descriptive error
- [ ] Test missing amount_total throws error
- [ ] Test amount conversion (cents → dollars)
- [ ] Mock QuotaRepository methods

---

### Task 2.3: Implement PaymentService - Refund Handling
**File:** `src/services/payment-service.ts` (continued)

**Description:**
Add proportional refund handling with token deduction calculations.

**Acceptance Criteria:**
- [ ] Implement private `handleRefund()` method:
  - [ ] Parameter: `charge: Stripe.Charge`
  - [ ] Validate `charge.amount` and `charge.amount_refunded` exist
  - [ ] Return early if amounts missing (log error)
  - [ ] Check for zero total amount (prevent division by zero)
  - [ ] Return early if amount is zero (log error)
  - [ ] Calculate refund percentage: `amount_refunded / amount` (both in cents)
  - [ ] Find original purchase: `await quotaRepository.getPurchaseByChargeId(charge.id)`
  - [ ] Return early if purchase not found (log error)
  - [ ] Calculate tokens to deduct: `Math.floor(purchase.tokens_added * refundPercentage)`
  - [ ] Call `quotaRepository.deductTokens(userId, tokensToDeduct)`
  - [ ] Call `quotaRepository.recordRefund()` with:
    - [ ] userId
    - [ ] tokensToDeduct
    - [ ] refundAmount in dollars
    - [ ] currency (uppercase)
    - [ ] description: `Refund for charge ${charge.id}`
- [ ] Add error handling for edge cases
- [ ] Add console logging for refund operations

**Testing:**
- [ ] Test 50% refund deducts 50% of tokens
- [ ] Test 100% refund deducts all tokens
- [ ] Test zero amount doesn't crash (returns early)
- [ ] Test missing amounts doesn't crash (returns early)
- [ ] Test missing purchase record doesn't crash (returns early)
- [ ] Test rounding (Math.floor) works correctly

---

### Task 2.4: Implement PaymentService - Payment Failure Logging
**File:** `src/services/payment-service.ts` (continued)

**Description:**
Add logging for failed payments (no token changes, just analytics).

**Acceptance Criteria:**
- [ ] Implement private `handlePaymentFailed()` method:
  - [ ] Parameter: `intent: Stripe.PaymentIntent`
  - [ ] Log error with console.error including:
    - [ ] Intent ID
    - [ ] Amount in dollars (convert from cents)
    - [ ] Currency
    - [ ] Last error message if available
  - [ ] No database operations (logging only)
- [ ] Use structured logging format

**Testing:**
- [ ] Test logs payment failure with correct details
- [ ] Test doesn't modify database
- [ ] Test handles missing last_payment_error gracefully

---

## Phase 3: Database Layer (QuotaRepository Extensions)

### Task 3.1: Add Idempotency Check to QuotaRepository
**File:** `src/repositories/quota.repository.ts`

**Description:**
Add method to check if Stripe event already processed (prevents duplicate token grants).

**Acceptance Criteria:**
- [ ] Implement `isPurchaseProcessed()` method:
  - [ ] Parameter: `eventId: string` (Stripe session ID)
  - [ ] Query `token_purchases` table
  - [ ] Use `.select('id')` (only need existence check)
  - [ ] Filter where `description` contains `Event: ${eventId}` using `.like()`
  - [ ] Use `.maybeSingle()` to get at most one result
  - [ ] Return `!!data` (boolean)
- [ ] Add JSDoc comment explaining idempotency purpose
- [ ] Add TODO comment about migrating to `stripe_event_id` column

**Testing:**
- [ ] Test returns false when purchase doesn't exist
- [ ] Test returns true when purchase exists
- [ ] Test handles database errors gracefully
- [ ] Mock Supabase client

---

### Task 3.2: Add Purchase Lookup by Charge ID
**File:** `src/repositories/quota.repository.ts` (continued)

**Description:**
Add method to find original purchase by Stripe charge ID (needed for refund processing).

**Acceptance Criteria:**
- [ ] Implement `getPurchaseByChargeId()` method:
  - [ ] Parameter: `chargeId: string`
  - [ ] Query `token_purchases` table
  - [ ] Select `user_id`, `tokens_added` columns
  - [ ] Filter where `description` contains `charge ${chargeId}` using `.like()`
  - [ ] Use `.maybeSingle()`
  - [ ] Return `data` or `null`
- [ ] Add TypeScript return type
- [ ] Add JSDoc comment
- [ ] Add TODO comment about using dedicated `stripe_charge_id` column

**Testing:**
- [ ] Test returns purchase when found
- [ ] Test returns null when not found
- [ ] Test returns correct user_id and tokens_added
- [ ] Mock Supabase client

---

### Task 3.3: Add Token Deduction Method
**File:** `src/repositories/quota.repository.ts` (continued)

**Description:**
Add method to deduct tokens (for refund processing).

**Acceptance Criteria:**
- [ ] Implement `deductTokens()` method:
  - [ ] Parameters: `userId: string`, `tokensToDeduct: number`
  - [ ] Call `addTokens()` with negative value: `-tokensToDeduct`
  - [ ] Use `purchase_type: 'refund'`
  - [ ] Pass through description parameter
- [ ] Reuse existing `add_tokens()` database function
- [ ] Add JSDoc comment

**Testing:**
- [ ] Test deducts tokens from user balance
- [ ] Test creates negative entry in token_purchases
- [ ] Test handles insufficient balance gracefully
- [ ] Mock database function call

---

### Task 3.4: Add Refund Recording Method
**File:** `src/repositories/quota.repository.ts` (continued)

**Description:**
Add method to record refund transaction in token_purchases table.

**Acceptance Criteria:**
- [ ] Implement `recordRefund()` method:
  - [ ] Parameters: `userId`, `tokensDeducted`, `refundAmount`, `currency`, `description`
  - [ ] Call `addTokens()` with negative tokens: `-tokensDeducted`
  - [ ] Use `purchase_type: 'refund'`
  - [ ] Pass `refundAmount` as negative value (to show money returned)
  - [ ] Include currency and description
- [ ] Add JSDoc comment explaining refund recording
- [ ] Add validation for positive input values (will be negated internally)

**Testing:**
- [ ] Test records refund with negative tokens
- [ ] Test records negative amount_paid (money returned)
- [ ] Test includes correct currency and description
- [ ] Mock database operations

---

## Phase 4: Edge Function Handlers (Platform-Specific)

### Task 4.1: Create /create-checkout Handler - Setup
**File:** `supabase/functions/create-checkout/index.ts`

**Description:**
Create Edge Function handler for creating Stripe checkout sessions with proper CORS and dependencies.

**Acceptance Criteria:**
- [ ] Import dependencies:
  - [ ] `Stripe` from `npm:stripe@17.5.0`
  - [ ] `createClient` from `jsr:@supabase/supabase-js@2`
  - [ ] `loadConfig` from config
  - [ ] `AuthMiddleware` from services
  - [ ] `PaymentService` from services
  - [ ] `QuotaRepository` from repositories
- [ ] Initialize services:
  - [ ] Load config using `loadConfig()`
  - [ ] Create Stripe instance with secret key
  - [ ] Create Supabase client with service role key
  - [ ] Create AuthMiddleware instance
  - [ ] Create QuotaRepository instance
  - [ ] Create PaymentService instance
- [ ] Define CORS headers:
  - [ ] `Access-Control-Allow-Origin: *`
  - [ ] `Access-Control-Allow-Headers: authorization, content-type`
  - [ ] `Access-Control-Allow-Methods: POST, OPTIONS`
- [ ] Create helper functions:
  - [ ] `corsResponse()` - returns 200 OK with CORS headers
  - [ ] `jsonHeaders()` - returns CORS + Content-Type: application/json

**Testing:**
- [ ] Test CORS headers are present in responses
- [ ] Test OPTIONS request returns 200 OK
- [ ] Test dependencies are imported correctly
- [ ] Deploy to local Supabase and test endpoint exists

---

### Task 4.2: Create /create-checkout Handler - Request Processing
**File:** `supabase/functions/create-checkout/index.ts` (continued)

**Description:**
Implement request handler with authentication, validation, and error handling.

**Acceptance Criteria:**
- [ ] Create `Deno.serve()` handler:
  - [ ] Handle OPTIONS requests → return `corsResponse()`
  - [ ] Wrap main logic in try-catch block
  - [ ] Extract JWT using `authMiddleware.authenticate(req.headers)`
  - [ ] Check if `user.authProvider === 'anonymous'`
  - [ ] If anonymous, return 403 error:
    - [ ] Error code: `ANONYMOUS_PURCHASE_NOT_ALLOWED`
    - [ ] Error message explaining account requirement
    - [ ] Status: 403
    - [ ] Headers: `jsonHeaders()`
  - [ ] Parse request body with try-catch:
    - [ ] On JSON parse error, return 400 with `INVALID_JSON` code
  - [ ] Extract `packageId`, `successUrl`, `cancelUrl` from body
  - [ ] Validate all fields are present:
    - [ ] If missing, return 400 with `MISSING_REQUIRED_FIELD` code
    - [ ] List all required fields in message
  - [ ] Call `paymentService.createCheckoutSession()`:
    - [ ] Pass userId, packageId, successUrl, cancelUrl, stripe instance
  - [ ] Return success response:
    - [ ] Status: 200
    - [ ] Body: `{ sessionId, url }`
    - [ ] Headers: `jsonHeaders()`

**Testing:**
- [ ] Test OPTIONS request returns CORS headers
- [ ] Test valid request creates checkout session
- [ ] Test anonymous user gets 403 error
- [ ] Test invalid JSON returns 400 error
- [ ] Test missing fields return 400 error
- [ ] Test authenticated user gets session URL

---

### Task 4.3: Create /create-checkout Handler - Error Handling
**File:** `supabase/functions/create-checkout/index.ts` (continued)

**Description:**
Add comprehensive error handling for all failure scenarios.

**Acceptance Criteria:**
- [ ] Catch block handles different error types:
  - [ ] Log error to console with `console.error()`
  - [ ] Check if error is `InvalidPackageError`:
    - [ ] Return error code and message from error
    - [ ] Status: error.statusCode
  - [ ] Check if error is auth error (INVALID_TOKEN, USER_BLOCKED):
    - [ ] Return error code and message
    - [ ] Status: error.statusCode or 401
  - [ ] Generic error fallback:
    - [ ] Return `INTERNAL_ERROR` code
    - [ ] Return safe message: `An unexpected error occurred`
    - [ ] Status: 500
  - [ ] All errors return JSON with CORS headers
- [ ] Never expose sensitive error details to client
- [ ] Keep handler under 100 lines total

**Testing:**
- [ ] Test InvalidPackageError returns 400 with correct code
- [ ] Test authentication errors return 401/403
- [ ] Test generic errors return 500 with safe message
- [ ] Test error responses include CORS headers
- [ ] Count lines to verify <100 line limit

---

### Task 4.4: Create /stripe-webhook Handler - Setup
**File:** `supabase/functions/stripe-webhook/index.ts`

**Description:**
Create Edge Function handler for Stripe webhook events with signature verification.

**Acceptance Criteria:**
- [ ] Import dependencies:
  - [ ] `Stripe` from `npm:stripe@17.5.0`
  - [ ] `createClient` from Supabase
  - [ ] `loadConfig` from config
  - [ ] `PaymentService` from services
  - [ ] `QuotaRepository` from repositories
- [ ] Initialize services:
  - [ ] Load config
  - [ ] Create Stripe instance
  - [ ] Create Supabase client
  - [ ] Create QuotaRepository
  - [ ] Create PaymentService
- [ ] No CORS headers needed (server-to-server)

**Testing:**
- [ ] Test services initialize correctly
- [ ] Test endpoint is accessible
- [ ] Deploy to local Supabase

---

### Task 4.5: Create /stripe-webhook Handler - Signature Verification
**File:** `supabase/functions/stripe-webhook/index.ts` (continued)

**Description:**
Implement webhook signature verification for security.

**Acceptance Criteria:**
- [ ] Create `Deno.serve()` handler:
  - [ ] Get raw request body: `await req.text()`
  - [ ] Get signature header: `req.headers.get('stripe-signature')`
  - [ ] Validate signature header exists:
    - [ ] If missing, log error and return 400
  - [ ] Validate body is not empty:
    - [ ] If empty, log error and return 400
  - [ ] Verify webhook signature in try-catch:
    - [ ] Call `stripe.webhooks.constructEvent(body, signature, webhookSecret)`
    - [ ] On error, log error message and return 400 `Invalid signature`
  - [ ] Store verified event in variable

**Testing:**
- [ ] Test missing signature header returns 400
- [ ] Test empty body returns 400
- [ ] Test invalid signature returns 400
- [ ] Test valid signature constructs event
- [ ] Use Stripe CLI to send test webhooks

---

### Task 4.6: Create /stripe-webhook Handler - Event Processing
**File:** `supabase/functions/stripe-webhook/index.ts` (continued)

**Description:**
Process verified webhook events and handle errors gracefully.

**Acceptance Criteria:**
- [ ] After signature verification:
  - [ ] Wrap processing in try-catch block
  - [ ] Call `await paymentService.processWebhook(event)`
  - [ ] On error, log error details:
    - [ ] Event type
    - [ ] Event ID
    - [ ] Error message
  - [ ] ALWAYS return 200 OK (even on processing errors)
  - [ ] Never throw errors (prevents Stripe retries)
- [ ] Return plain text response: `OK`
- [ ] Keep handler under 100 lines total

**Testing:**
- [ ] Test successful webhook processing returns 200
- [ ] Test processing errors still return 200
- [ ] Test errors are logged but not thrown
- [ ] Test webhook events trigger token additions
- [ ] Use Stripe CLI: `stripe trigger checkout.session.completed`
- [ ] Count lines to verify <100 line limit

---

## Phase 5: Configuration Integration

### Task 5.1: Add Stripe Configuration to Config Loader
**File:** `src/config/loader.ts`

**Description:**
Add Stripe environment variables to configuration loader with proper validation.

**Acceptance Criteria:**
- [ ] Add `payment` section to `AppConfig` interface:
  - [ ] `stripeSecretKey: string`
  - [ ] `stripeWebhookSecret: string`
  - [ ] `stripePublishableKey: string`
- [ ] In `loadConfig()` function, add payment config:
  - [ ] `stripeSecretKey: getEnvVar('STRIPE_SECRET_KEY')`
  - [ ] `stripeWebhookSecret: getEnvVar('STRIPE_WEBHOOK_SECRET')`
  - [ ] `stripePublishableKey: getEnvVar('STRIPE_PUBLISHABLE_KEY')`
- [ ] Export updated `AppConfig` type
- [ ] Add JSDoc comments for each payment variable

**Testing:**
- [ ] Test throws error if STRIPE_SECRET_KEY missing
- [ ] Test throws error if STRIPE_WEBHOOK_SECRET missing
- [ ] Test throws error if STRIPE_PUBLISHABLE_KEY missing
- [ ] Test loads all variables correctly when present
- [ ] Test with .env.local file

---

### Task 5.2: Update Environment Example File
**File:** `.env.local.example`

**Description:**
Add Stripe configuration variables to example file with clear documentation.

**Acceptance Criteria:**
- [ ] Add payment section with header comment
- [ ] Add `STRIPE_SECRET_KEY` with:
  - [ ] Comment: For Stripe API authentication
  - [ ] Example value: `sk_test_...`
  - [ ] Note: Use test key for dev, live key for production
- [ ] Add `STRIPE_WEBHOOK_SECRET` with:
  - [ ] Comment: Webhook signing secret from Stripe Dashboard
  - [ ] Example value: `whsec_...`
  - [ ] Note: Get from Stripe Dashboard → Developers → Webhooks
- [ ] Add `STRIPE_PUBLISHABLE_KEY` with:
  - [ ] Comment: For frontend (safe to expose)
  - [ ] Example value: `pk_test_...`
- [ ] Add link to payment.md documentation

**Testing:**
- [ ] Verify comments are clear and helpful
- [ ] Verify example values follow Stripe format
- [ ] Copy to .env.local and verify config loads

---

## Phase 6: Testing

### Task 6.1: Write Unit Tests for PaymentService - Checkout Creation
**File:** `tests/unit/services/payment-service.test.ts`

**Description:**
Test checkout session creation with various scenarios.

**Acceptance Criteria:**
- [ ] Setup test environment:
  - [ ] Mock QuotaRepository
  - [ ] Mock Stripe SDK
  - [ ] Mock AppConfig
  - [ ] Create PaymentService instance
- [ ] Test: `creates Stripe session with correct metadata`
  - [ ] Mock `stripe.checkout.sessions.create` to return session
  - [ ] Call `createCheckoutSession()` with valid inputs
  - [ ] Assert metadata contains userId, packageId, tokensAdded
  - [ ] Assert line items have correct price
  - [ ] Assert returns sessionId and url
- [ ] Test: `throws InvalidPackageError for unknown package`
  - [ ] Call with nonexistent packageId
  - [ ] Assert throws InvalidPackageError
  - [ ] Assert error code is INVALID_PACKAGE_ID
- [ ] Test: `creates sessions for all 4 token packages`
  - [ ] Loop through TOKEN_PACKAGES
  - [ ] Create session for each package
  - [ ] Assert correct tokens in metadata
  - [ ] Assert correct price in line items

**Testing:**
- [ ] Run tests: `npm test -- payment-service.test.ts`
- [ ] Verify all tests pass
- [ ] Check code coverage for createCheckoutSession method

---

### Task 6.2: Write Unit Tests for PaymentService - Webhook Processing
**File:** `tests/unit/services/payment-service.test.ts` (continued)

**Description:**
Test webhook event processing with edge cases.

**Acceptance Criteria:**
- [ ] Test: `handles successful payment idempotently`
  - [ ] Mock `isPurchaseProcessed()` to return false (first call)
  - [ ] Create mock checkout.session.completed event
  - [ ] Call `processWebhook()`
  - [ ] Assert `addTokens()` called with correct parameters
  - [ ] Mock `isPurchaseProcessed()` to return true (second call)
  - [ ] Call `processWebhook()` again
  - [ ] Assert `addTokens()` only called once total (idempotent)
- [ ] Test: `throws error when metadata is missing`
  - [ ] Create event with empty metadata
  - [ ] Assert throws error with "Missing metadata" message
- [ ] Test: `throws error when amount_total is missing`
  - [ ] Create event with valid metadata but no amount_total
  - [ ] Assert throws error with "Missing payment details"
- [ ] Test: `converts amount from cents to dollars correctly`
  - [ ] Create event with amount_total: 2000 (cents)
  - [ ] Assert `addTokens()` called with 20.00 (dollars)

**Testing:**
- [ ] Run tests and verify all pass
- [ ] Check edge cases are covered
- [ ] Verify error messages are descriptive

---

### Task 6.3: Write Unit Tests for PaymentService - Refund Handling
**File:** `tests/unit/services/payment-service.test.ts` (continued)

**Description:**
Test refund processing with proportional token deduction.

**Acceptance Criteria:**
- [ ] Test: `calculates proportional token deduction for 50% refund`
  - [ ] Create charge with amount: 2000, amount_refunded: 1000
  - [ ] Mock `getPurchaseByChargeId()` to return 500k tokens
  - [ ] Call `handleRefund()`
  - [ ] Assert `deductTokens()` called with 250,000 tokens
- [ ] Test: `handles full refund (100%)`
  - [ ] Create charge with full refund
  - [ ] Assert deducts all original tokens
- [ ] Test: `safely handles zero total amount`
  - [ ] Create charge with amount: 0
  - [ ] Assert doesn't call `deductTokens()`
  - [ ] Assert doesn't crash
- [ ] Test: `safely handles missing charge amounts`
  - [ ] Create charge without amount/amount_refunded
  - [ ] Assert returns early without crashing
- [ ] Test: `handles missing purchase record gracefully`
  - [ ] Mock `getPurchaseByChargeId()` to return null
  - [ ] Assert returns early without calling `deductTokens()`

**Testing:**
- [ ] Run tests and verify all pass
- [ ] Verify Math.floor rounding works correctly
- [ ] Check no division by zero errors

---

### Task 6.4: Write Unit Tests for Payment Error Classes
**File:** `tests/unit/errors/payment-errors.test.ts`

**Description:**
Test custom error classes have correct properties.

**Acceptance Criteria:**
- [ ] Test `InvalidPackageError`:
  - [ ] Assert code is `INVALID_PACKAGE_ID`
  - [ ] Assert statusCode is 400
  - [ ] Assert message includes package ID
- [ ] Test `AnonymousPurchaseNotAllowedError`:
  - [ ] Assert code is `ANONYMOUS_PURCHASE_NOT_ALLOWED`
  - [ ] Assert statusCode is 403
  - [ ] Assert message is descriptive
- [ ] Test `InvalidWebhookSignatureError`:
  - [ ] Assert code is `INVALID_WEBHOOK_SIGNATURE`
  - [ ] Assert statusCode is 400
- [ ] Test `PaymentProcessingError`:
  - [ ] Assert code is `PAYMENT_PROCESSING_ERROR`
  - [ ] Assert statusCode is 500
  - [ ] Assert accepts custom message

**Testing:**
- [ ] Run tests and verify all pass
- [ ] Verify errors extend Error class properly

---

### Task 6.5: Write Unit Tests for QuotaRepository Payment Methods
**File:** `tests/unit/repositories/quota.repository.test.ts` (add to existing file)

**Description:**
Test new payment-related repository methods.

**Acceptance Criteria:**
- [ ] Test `isPurchaseProcessed()`:
  - [ ] Mock Supabase query to return no results
  - [ ] Assert returns false
  - [ ] Mock Supabase query to return purchase
  - [ ] Assert returns true
- [ ] Test `getPurchaseByChargeId()`:
  - [ ] Mock Supabase query to return purchase
  - [ ] Assert returns correct user_id and tokens_added
  - [ ] Mock to return null
  - [ ] Assert returns null
- [ ] Test `deductTokens()`:
  - [ ] Call with positive amount
  - [ ] Assert calls `addTokens()` with negative value
- [ ] Test `recordRefund()`:
  - [ ] Call with refund details
  - [ ] Assert calls `addTokens()` with negative tokens and amount

**Testing:**
- [ ] Run tests and verify all pass
- [ ] Mock Supabase client properly
- [ ] Verify method signatures match expectations

---

## Phase 7: Documentation & Deployment

### Task 7.1: Update CLAUDE.md with Payment System Overview
**File:** `CLAUDE.md`

**Description:**
Add payment system section to AI assistant instructions.

**Acceptance Criteria:**
- [ ] Add "Payment System (Stripe Integration)" section after "Anonymous Users"
- [ ] Include subsections:
  - [ ] Architecture (two-layer design)
  - [ ] Key Features (bullet list)
  - [ ] Edge Functions (create-checkout, stripe-webhook)
  - [ ] Database Schema (note: already prepared)
  - [ ] Anonymous User Restriction (explanation)
- [ ] Add link to complete documentation: `docs/payment.md`
- [ ] Add payment environment variables to "Environment Variables" section
- [ ] Keep description concise (10-15 lines)

**Testing:**
- [ ] Verify links work
- [ ] Verify formatting is consistent
- [ ] Check section placement makes sense

---

### Task 7.2: Add Payment Commands to Development Scripts
**File:** `package.json` (optional if commands needed)

**Description:**
Add npm scripts for payment testing if needed.

**Acceptance Criteria:**
- [ ] Consider adding script for Stripe webhook forwarding
- [ ] Consider adding script for testing token purchases
- [ ] Document commands in CLAUDE.md if added

**Testing:**
- [ ] Test any new scripts work correctly
- [ ] Verify commands are documented

---

### Task 7.3: Create Deployment Checklist Document
**File:** `docs/payment-deployment-checklist.md`

**Description:**
Create step-by-step deployment guide extracted from payment.md.

**Acceptance Criteria:**
- [ ] Extract deployment steps from payment.md
- [ ] Create checklist format with checkboxes
- [ ] Include:
  - [ ] Environment variable setup
  - [ ] Stripe Dashboard configuration
  - [ ] Webhook endpoint creation
  - [ ] Edge Function deployment
  - [ ] Testing in production
  - [ ] Monitoring setup
  - [ ] Security checklist
- [ ] Add troubleshooting section

**Testing:**
- [ ] Follow checklist for local deployment
- [ ] Verify all steps are clear
- [ ] Test webhook endpoint creation

---

## Phase 8: Integration Testing (Local Development)

### Task 8.1: Setup Local Stripe Testing Environment
**Description:**
Configure Stripe CLI for local webhook testing.

**Acceptance Criteria:**
- [ ] Install Stripe CLI (if not installed)
- [ ] Login to Stripe: `stripe login`
- [ ] Start Supabase local stack: `supabase start`
- [ ] Forward webhooks: `stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook`
- [ ] Copy webhook signing secret to .env.local
- [ ] Restart Edge Functions to pick up new env vars

**Testing:**
- [ ] Verify Stripe CLI connects successfully
- [ ] Verify webhook secret is detected
- [ ] Test webhook forwarding works

---

### Task 8.2: Test Create Checkout Flow End-to-End
**Description:**
Test complete checkout session creation flow locally.

**Acceptance Criteria:**
- [ ] Create test user (use bootstrap if needed)
- [ ] Get JWT token for test user
- [ ] Test anonymous user rejection:
  - [ ] Create anonymous user session
  - [ ] Call /create-checkout
  - [ ] Assert returns 403 error
- [ ] Test valid checkout creation:
  - [ ] Call /create-checkout with registered user JWT
  - [ ] Assert returns sessionId and url
  - [ ] Assert url starts with Stripe checkout URL
- [ ] Test invalid package rejection:
  - [ ] Call with packageId: "invalid"
  - [ ] Assert returns 400 error
- [ ] Test missing fields validation:
  - [ ] Call without successUrl
  - [ ] Assert returns 400 error with field list

**Testing:**
- [ ] Use curl or Postman to test endpoint
- [ ] Verify all error codes match spec
- [ ] Check response format matches API docs

---

### Task 8.3: Test Webhook Processing End-to-End
**Description:**
Test webhook events trigger correct token operations.

**Acceptance Criteria:**
- [ ] Test checkout.session.completed:
  - [ ] Trigger event: `stripe trigger checkout.session.completed`
  - [ ] Check Edge Function logs for processing
  - [ ] Query user_quotas to verify tokens added
  - [ ] Query token_purchases to verify transaction recorded
  - [ ] Trigger same event again (idempotency test)
  - [ ] Verify tokens NOT added second time
- [ ] Test charge.refunded:
  - [ ] Create purchase record in database
  - [ ] Trigger refund event
  - [ ] Verify tokens deducted proportionally
  - [ ] Verify refund recorded in token_purchases
- [ ] Test payment_intent.payment_failed:
  - [ ] Trigger failed payment event
  - [ ] Verify logged but no database changes

**Testing:**
- [ ] Monitor logs: `npm run logs:tail`
- [ ] Query database to verify operations
- [ ] Test all webhook event types

---

### Task 8.4: Test Complete Purchase Flow with Real Stripe Checkout
**Description:**
Perform end-to-end test using actual Stripe test checkout page.

**Acceptance Criteria:**
- [ ] Create checkout session for test user
- [ ] Open checkout URL in browser
- [ ] Complete payment with test card: `4242 4242 4242 4242`
- [ ] Get redirected to success URL
- [ ] Verify webhook received by Edge Function
- [ ] Verify tokens added to user account
- [ ] Verify purchase recorded with correct amount
- [ ] Call /me endpoint to verify updated balance

**Testing:**
- [ ] Test all 4 token packages
- [ ] Test with different test cards
- [ ] Test cancellation flow (cancel URL redirect)
- [ ] Verify success URL includes session_id parameter

---

## Phase 9: Production Preparation (Optional - Future)

### Task 9.1: Add stripe_event_id Column (Robust Idempotency)
**Description:**
Migrate from description-based idempotency to dedicated column.

**Acceptance Criteria:**
- [ ] Create migration file: `supabase/migrations/XXX_add_stripe_event_id.sql`
- [ ] Add column: `ALTER TABLE token_purchases ADD COLUMN stripe_event_id TEXT`
- [ ] Add unique constraint: `ADD CONSTRAINT unique_stripe_event_id UNIQUE (stripe_event_id)`
- [ ] Create index: `CREATE INDEX idx_token_purchases_stripe_event_id ON token_purchases(stripe_event_id) WHERE stripe_event_id IS NOT NULL`
- [ ] Update `add_tokens()` database function to accept `p_stripe_event_id` parameter
- [ ] Update QuotaRepository.addTokens() signature
- [ ] Update PaymentService to pass event ID
- [ ] Update isPurchaseProcessed() to query stripe_event_id column
- [ ] Apply migration: `supabase db push`

**Testing:**
- [ ] Test migration runs successfully
- [ ] Test unique constraint prevents duplicates
- [ ] Test idempotency with new column
- [ ] Verify index improves query performance

---

### Task 9.2: Production Deployment
**Description:**
Deploy to Supabase production environment.

**Acceptance Criteria:**
- [ ] Set production Stripe keys: `supabase secrets set STRIPE_SECRET_KEY=sk_live_...`
- [ ] Set production webhook secret: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`
- [ ] Deploy Edge Functions: `npm run deploy`
- [ ] Create webhook endpoint in Stripe Dashboard (production)
- [ ] Add production URL to webhook endpoints
- [ ] Select events: checkout.session.completed, charge.refunded, payment_intent.payment_failed
- [ ] Test with small real purchase
- [ ] Monitor webhook delivery in Stripe Dashboard
- [ ] Set up webhook failure alerts

**Testing:**
- [ ] Test /create-checkout health check
- [ ] Test small purchase with real card
- [ ] Verify webhook processing in production logs
- [ ] Test refund flow in production

---

## Completion Checklist

### Functionality
- [ ] All 4 token packages create checkout sessions
- [ ] Anonymous users are blocked from purchasing
- [ ] Webhook signature verification works
- [ ] Successful payments add tokens
- [ ] Duplicate webhooks are ignored (idempotent)
- [ ] Refunds deduct tokens proportionally
- [ ] Failed payments are logged

### Code Quality
- [ ] All unit tests pass: `npm test`
- [ ] Type checking passes: `npm run type-check`
- [ ] Portability check passes: `npm run lint:portability`
- [ ] No Deno.* in src/ directory
- [ ] Handler files under 100 lines
- [ ] All methods have JSDoc comments

### Documentation
- [ ] CLAUDE.md updated with payment section
- [ ] .env.local.example includes Stripe variables
- [ ] payment.md is accurate and complete
- [ ] Deployment checklist created

### Testing
- [ ] Local Stripe CLI testing works
- [ ] All webhook events tested locally
- [ ] End-to-end purchase flow tested
- [ ] Error scenarios tested
- [ ] Edge cases covered

### Security
- [ ] Webhook signature verification enabled
- [ ] Anonymous users blocked
- [ ] Environment secrets not committed
- [ ] Error messages don't expose sensitive data
- [ ] Input validation on all endpoints

---

**Total Estimated Tasks:** 60+ granular tasks across 9 phases

**Implementation Order:** Follow phases sequentially for best results. Each phase builds on previous phases.

**Progress Tracking:** Mark tasks with `[+]` when completed, leave as `[]` when pending.

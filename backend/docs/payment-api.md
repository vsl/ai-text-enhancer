> **Historical reference:** This document may describe earlier providers, limits, or deployment steps. For the current public demo, use the [root README](../../README.md), current source configuration, and deployment workflow. Stripe payment functions are a disabled prototype, not live endpoints.

# Payment API Documentation

**Version:** 1.0
**Last Updated:** January 2025

Quick reference guide for integrating Stripe-based token purchases into the frontend.

---

## Overview

The payment system allows **registered users** to purchase additional tokens through Stripe Checkout. Anonymous users cannot purchase tokens to prevent token loss if browser data is cleared.

### Key Features

- **Hosted Checkout** - Users redirected to Stripe's secure payment page
- **Token Packages** - Fixed pricing tiers (100k to 5M tokens)
- **Automatic Fulfillment** - Tokens added automatically after successful payment
- **Refund Support** - Proportional token deduction on refunds

### Token Packages

| Package | Tokens | Price | Cost per 1k tokens |
|---------|--------|-------|-------------------|
| Starter | 100,000 | $5.00 | $0.05 |
| Popular | 500,000 | $20.00 | $0.04 (20% discount) |
| Premium | 1,000,000 | $35.00 | $0.035 (30% discount) |
| Enterprise | 5,000,000 | $150.00 | $0.03 (40% discount) |

---

## Authentication

All payment endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <user-jwt-token>
```

**Anonymous users will receive a 403 error** when attempting to create checkout sessions.

---

## API Endpoints

### POST /functions/v1/create-checkout

Creates a Stripe checkout session and returns a URL to redirect the user.

#### Request

```typescript
{
  "packageId": string,      // Required: "starter" | "popular" | "premium" | "enterprise"
  "successUrl": string,     // Required: URL to redirect after successful payment
  "cancelUrl": string       // Required: URL to redirect if user cancels
}
```

#### Example Request

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-checkout \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "popular",
    "successUrl": "https://yourapp.com/payment/success?session_id={CHECKOUT_SESSION_ID}",
    "cancelUrl": "https://yourapp.com/payment/cancel"
  }'
```

**Note:** Use `{CHECKOUT_SESSION_ID}` placeholder in successUrl - Stripe will replace it with the actual session ID.

#### Success Response (200 OK)

```typescript
{
  "sessionId": string,  // Stripe checkout session ID
  "url": string         // Redirect user to this URL to complete payment
}
```

#### Example Success Response

```json
{
  "sessionId": "cs_test_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_PACKAGE_ID` | Package ID not found (must be: starter, popular, premium, enterprise) |
| 400 | `MISSING_REQUIRED_FIELD` | successUrl or cancelUrl missing from request |
| 400 | `INVALID_JSON` | Request body is not valid JSON |
| 401 | `INVALID_TOKEN` | JWT token is missing or invalid |
| 403 | `ANONYMOUS_PURCHASE_NOT_ALLOWED` | Anonymous users cannot purchase tokens |
| 403 | `USER_BLOCKED` | User account is blocked (is_active = false) |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

#### Example Error Response

```json
{
  "error": {
    "code": "ANONYMOUS_PURCHASE_NOT_ALLOWED",
    "message": "Please create an account before purchasing tokens. Anonymous users cannot make purchases to prevent token loss if browser data is cleared."
  }
}
```

---

## Payment Flow

```
┌─────────────┐
│   User UI   │
└──────┬──────┘
       │ 1. User clicks "Buy Tokens"
       │
       │ POST /create-checkout
       │ { packageId, successUrl, cancelUrl }
       │ Authorization: Bearer <jwt>
       ▼
┌──────────────────┐
│  Backend API     │ 2. Validate user (not anonymous)
│                  │ 3. Create Stripe checkout session
└──────┬───────────┘
       │ Response: { sessionId, url }
       ▼
┌──────────────┐
│   User UI    │ 4. Redirect to Stripe:
│              │    window.location.href = url
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Stripe     │ 5. User enters payment details
│   Checkout   │ 6. Completes payment
└──────┬───────┘
       │
       ├─────► Success: Redirect to successUrl
       │
       └─────► Cancel: Redirect to cancelUrl


       (In background after successful payment)

┌──────────────┐
│   Stripe     │ 7. Send webhook to backend
│              │    POST /stripe-webhook
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Backend API     │ 8. Verify webhook signature
│                  │ 9. Add tokens to user account
│                  │ 10. Record purchase in database
└──────────────────┘
```

---

## Frontend Integration Guide

### Step 1: Display Token Packages

Fetch and display available packages (hardcoded is fine, or fetch from config):

```typescript
const packages = [
  { id: 'starter', name: 'Starter Pack', tokens: 100000, price: 5.00 },
  { id: 'popular', name: 'Popular Pack', tokens: 500000, price: 20.00, popular: true },
  { id: 'premium', name: 'Premium Pack', tokens: 1000000, price: 35.00 },
  { id: 'enterprise', name: 'Enterprise Pack', tokens: 5000000, price: 150.00 },
];
```

### Step 2: Check if User Can Purchase

Anonymous users should see "Create Account to Buy Tokens" button:

```typescript
// Assuming you have user profile from GET /me endpoint
if (user.auth_provider === 'anonymous') {
  // Show "Create Account" button instead of "Buy Tokens"
  return <CreateAccountButton />;
}
```

### Step 3: Handle Purchase Click

```typescript
const handleBuyTokens = async (packageId: string) => {
  try {
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

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }

    const { url } = await response.json();

    // Redirect to Stripe Checkout
    window.location.href = url;

  } catch (error) {
    console.error('Failed to create checkout session:', error);
    // Show error to user
  }
};
```

### Step 4: Handle Success Page

After successful payment, Stripe redirects to your `successUrl`:

```typescript
// /payment/success page
const SuccessPage = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get('session_id');

  // Optionally verify the session with your backend
  // Or simply refresh user quota from GET /me

  useEffect(() => {
    // Refresh user quota to show updated balance
    fetchUserProfile();
  }, []);

  return (
    <div>
      <h1>Payment Successful!</h1>
      <p>Your tokens have been added to your account.</p>
      <p>Session ID: {sessionId}</p>
    </div>
  );
};
```

### Step 5: Handle Cancel Page

If user cancels payment:

```typescript
// /payment/cancel page
const CancelPage = () => {
  return (
    <div>
      <h1>Payment Cancelled</h1>
      <p>Your payment was cancelled. No charges were made.</p>
      <a href="/pricing">Return to pricing</a>
    </div>
  );
};
```

### Step 6: Refresh User Balance

After successful payment, refresh the user's quota:

```typescript
const refreshUserBalance = async () => {
  const response = await fetch('/functions/v1/me', {
    headers: {
      'Authorization': `Bearer ${userToken}`,
    },
  });

  const data = await response.json();
  // Update UI with new balance
  setTokenBalance(data.quota.tokens_available);
};
```

---

## Complete React Example

```typescript
import React, { useState } from 'react';

interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  price: number;
  popular?: boolean;
}

const packages: TokenPackage[] = [
  { id: 'starter', name: 'Starter Pack', tokens: 100000, price: 5.00 },
  { id: 'popular', name: 'Popular Pack', tokens: 500000, price: 20.00, popular: true },
  { id: 'premium', name: 'Premium Pack', tokens: 1000000, price: 35.00 },
  { id: 'enterprise', name: 'Enterprise Pack', tokens: 5000000, price: 150.00 },
];

export const PricingPage: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Assume these come from context or props
  const userToken = 'your-jwt-token';
  const isAnonymous = false; // Get from user profile

  const handlePurchase = async (packageId: string) => {
    setLoading(packageId);
    setError(null);

    try {
      const response = await fetch('https://your-project.supabase.co/functions/v1/create-checkout', {
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message);
      }

      const { url } = await response.json();
      window.location.href = url;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checkout session');
      setLoading(null);
    }
  };

  return (
    <div className="pricing-page">
      <h1>Choose Your Token Package</h1>

      {error && <div className="error">{error}</div>}

      <div className="packages-grid">
        {packages.map(pkg => (
          <div key={pkg.id} className={`package-card ${pkg.popular ? 'popular' : ''}`}>
            {pkg.popular && <span className="badge">Most Popular</span>}
            <h2>{pkg.name}</h2>
            <p className="tokens">{pkg.tokens.toLocaleString()} tokens</p>
            <p className="price">${pkg.price.toFixed(2)}</p>
            <button
              onClick={() => handlePurchase(pkg.id)}
              disabled={loading === pkg.id || isAnonymous}
            >
              {loading === pkg.id ? 'Processing...' :
               isAnonymous ? 'Create Account First' :
               'Buy Now'}
            </button>
          </div>
        ))}
      </div>

      {isAnonymous && (
        <div className="anonymous-notice">
          Please create an account to purchase tokens. This prevents token loss if browser data is cleared.
        </div>
      )}
    </div>
  );
};
```

---

## Testing with Stripe Test Cards

Use these test card numbers in Stripe Checkout (test mode only):

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |
| `4000 0000 0000 9995` | Payment declined (insufficient funds) |

**Card details for testing:**
- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

---

## Webhook Events (Backend Only)

The following webhooks are handled automatically by the backend - **no frontend action required**:

- `checkout.session.completed` - Tokens added to user account
- `charge.refunded` - Tokens deducted proportionally
- `payment_intent.payment_failed` - Logged for analytics

---

## Security Notes

1. **Never expose `STRIPE_SECRET_KEY`** - Only use `STRIPE_PUBLISHABLE_KEY` in frontend (if needed for custom integrations)
2. **Always use HTTPS** in production
3. **Validate session_id** on success page if you need to verify payment status
4. **Don't trust client-side state** - Always fetch fresh quota from `/me` endpoint after payment

---

## Troubleshooting

### "Anonymous users cannot make purchases" error

**Solution:** User must create a permanent account (email/social login) before purchasing.

### Tokens not appearing after successful payment

**Possible causes:**
1. Webhook not delivered to backend (check Stripe Dashboard → Webhooks)
2. Webhook signature verification failed (check backend logs)
3. Database error during token addition (check backend logs)

**Solution:** Contact support with `session_id` from success URL.

### Payment succeeded but user was redirected to cancel URL

**Cause:** This shouldn't happen - indicates a Stripe configuration issue.

**Solution:** Check Stripe Dashboard session details and webhook delivery status.

---

## Support

For complete implementation details, see:
- **Full Documentation:** [docs/payment.md](./payment.md)
- **Implementation Tasks:** [docs/payment-implementation-tasks.md](./payment-implementation-tasks.md)
- **Deployment Guide:** [docs/payment.md#deployment-checklist](./payment.md#deployment-checklist)

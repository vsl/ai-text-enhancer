# Backend Improvements Needed for Payment Integration

## Overview

The frontend payment integration is complete, but the backend needs updates to properly handle tier upgrades based on token package purchases.

## Current Behavior

Currently, the `/create-checkout` endpoint only handles token purchases. The user's tier (free/plus/premium) is stored separately and doesn't automatically update when purchasing token packages.

## Required Changes

### 1. Tier Upgrade Logic on Token Purchase

**Requirement**: When a user purchases a token package, their tier should be upgraded based on the package purchased.

**Tier Mapping**:
- **Free tier**: Default tier, no purchase required
- **Plus tier**: Unlocked when user purchases any of these packages:
  - Starter Pack (100k tokens - $5)
  - Popular Pack (500k tokens - $20)
- **Premium tier**: Unlocked when user purchases:
  - Premium Pack (1M tokens - $35)

**Implementation Notes**:
- Tier upgrades should happen automatically in the webhook handler (`checkout.session.completed`)
- User tier should be upgraded but never downgraded (e.g., if Premium user buys Starter pack, they stay Premium)
- Update the `user_profiles` table to set the new tier level

### 2. Token Expiration

**Requirement**: Tokens should expire after 1 year from purchase date.

**Implementation**:
- Add `expires_at` field to token purchase records
- Set `expires_at = purchase_date + 1 year` when tokens are added
- Background job to periodically check and expire old tokens
- When calculating `tokens_available` in `/me` endpoint, exclude expired tokens

**Database Schema Changes Needed**:
```sql
-- Add expiration tracking to token transactions or purchases table
ALTER TABLE token_purchases ADD COLUMN expires_at TIMESTAMP;

-- Or if using a transactions table:
ALTER TABLE token_transactions ADD COLUMN expires_at TIMESTAMP;
```

### 3. Tier Benefits Documentation

**Frontend displays these tier limits** (from `TIER_LIMITS` constant):

**Free Tier**:
- Max text length: 500 characters
- Max context length: 800 characters
- Max batch size: 3 assistants
- Available models: gemini-flash, open-router-free

**Plus Tier**:
- Max text length: 2000 characters
- Max context length: 3000 characters
- Max batch size: 10 assistants
- Available models: gemini-flash, open-router-free, gemini-pro

**Premium Tier**:
- Max text length: 5000 characters
- Max context length: 10000 characters
- Max batch size: 10 assistants
- Available models: gemini-flash, open-router-free, gemini-pro, gpt-4

**Backend should enforce these limits** in the `/enhance` endpoint.

### 4. Recommended API Response Updates

**`/me` endpoint should include**:
```json
{
  "profile": {
    "id": "...",
    "email": "...",
    "tier": "plus",
    // ... existing fields
  },
  "quota": {
    "tokens_available": 450000,
    "tokens_used": 50000,
    "tokens_expire_at": "2026-01-15T00:00:00Z"  // NEW: when current tokens expire
  },
  "tier_unlocked_by": "popular"  // NEW: which package unlocked current tier
}
```

### 5. Webhook Handler Updates

**In `checkout.session.completed` webhook handler**:

```typescript
// Pseudo-code for webhook handler
async function handleCheckoutCompleted(session) {
  const packageId = session.metadata.packageId;
  const userId = session.metadata.userId;

  // 1. Add tokens to user account
  const tokensToAdd = getTokensForPackage(packageId);
  await addTokens(userId, tokensToAdd);

  // 2. Set expiration date (1 year from now)
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  await setTokenExpiration(userId, expiresAt);

  // 3. Upgrade tier based on package
  const newTier = getTierForPackage(packageId);
  await upgradeUserTier(userId, newTier); // Only upgrade, never downgrade

  // 4. Record purchase
  await recordPurchase(userId, packageId, session.id);
}

function getTierForPackage(packageId) {
  const tierMap = {
    'starter': 'plus',
    'popular': 'plus',
    'premium': 'premium'
  };
  return tierMap[packageId];
}

async function upgradeUserTier(userId, newTier) {
  const currentTier = await getUserTier(userId);
  const tierHierarchy = { free: 0, plus: 1, premium: 2 };

  // Only upgrade if new tier is higher
  if (tierHierarchy[newTier] > tierHierarchy[currentTier]) {
    await updateUserTier(userId, newTier);
  }
}
```

### 6. Migration Considerations

**For existing users**:
- Users who have already purchased tokens should have their tiers retroactively upgraded based on their purchase history
- Set expiration dates for existing token balances (1 year from migration date, or based on last purchase date)

## Testing Requirements

### Test Cases to Verify:

1. **New user purchases Starter pack**:
   - ✓ User tier upgraded from free to plus
   - ✓ 100k tokens added
   - ✓ Tokens expire in 1 year

2. **Plus user purchases Premium pack**:
   - ✓ User tier upgraded from plus to premium
   - ✓ 1M tokens added
   - ✓ New tokens expire in 1 year

3. **Premium user purchases Starter pack**:
   - ✓ User tier stays premium (no downgrade)
   - ✓ 100k tokens still added
   - ✓ New tokens expire in 1 year

4. **Token expiration**:
   - ✓ Expired tokens don't count toward `tokens_available`
   - ✓ User can still use unexpired tokens
   - ✓ Tier doesn't downgrade when tokens expire

5. **Refunds**:
   - ✓ Tokens are deducted proportionally
   - ✓ Tier downgrade logic if user has no other purchases at that tier level

## Priority

**High Priority**:
- Tier upgrade logic (affects user experience immediately)
- Token expiration tracking (financial accuracy)

**Medium Priority**:
- Enhanced API responses with expiration dates
- Migration for existing users

## Questions for Backend Team

1. Where are token purchases currently recorded? (table name/structure)
2. Is there an existing background job system for token expiration checks?
3. Should tier downgrades happen on refund, or should tiers be permanent once unlocked?
4. Do we want to show multiple expiration dates if user has tokens from multiple purchases?

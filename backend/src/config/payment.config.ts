/**
 * Payment Configuration
 *
 * Defines all available token packages for purchase with pricing,
 * currency, and metadata. This is the single source of truth for
 * payment package definitions.
 *
 * Pricing Strategy:
 * - Starter: $5 for 100k tokens (~$0.05 per 1k tokens)
 * - Popular: $20 for 500k tokens (~$0.04 per 1k tokens, 20% discount)
 * - Premium: $35 for 1M tokens (~$0.035 per 1k tokens, 30% discount)
 * - Enterprise: $150 for 5M tokens (~$0.03 per 1k tokens, 40% discount)
 *
 * Volume pricing encourages larger purchases while keeping
 * entry-level packages affordable for casual users.
 */

/**
 * Token package definition for purchase
 */
export interface TokenPackage {
  /** Unique package identifier (used in API requests) */
  id: string;
  /** Display name shown to users */
  name: string;
  /** Number of tokens in this package */
  tokens: number;
  /** Price in smallest currency unit (cents for USD) */
  price: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Whether this package should be highlighted as popular choice */
  popular?: boolean;
}

/**
 * All available token packages
 *
 * Packages are ordered from smallest to largest to encourage
 * upselling in UI display. The "Popular" package is marked
 * with popular=true for UI highlighting.
 */
export const TOKEN_PACKAGES: readonly TokenPackage[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    tokens: 100_000,
    price: 500, // $5.00 USD
    currency: 'USD',
  },
  {
    id: 'popular',
    name: 'Popular Pack',
    tokens: 500_000,
    price: 2000, // $20.00 USD
    currency: 'USD',
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium Pack',
    tokens: 1_000_000,
    price: 3500, // $35.00 USD
    currency: 'USD',
  },
  {
    id: 'enterprise',
    name: 'Enterprise Pack',
    tokens: 5_000_000,
    price: 15000, // $150.00 USD
    currency: 'USD',
  },
] as const;

/**
 * Get package configuration by ID
 *
 * @param packageId - The package identifier
 * @returns Package configuration or null if not found
 *
 * @example
 * ```typescript
 * const pkg = getPackageById('popular');
 * if (pkg) {
 *   console.log(`${pkg.name}: ${pkg.tokens} tokens for $${pkg.price / 100}`);
 * }
 * ```
 */
export function getPackageById(packageId: string): TokenPackage | null {
  return TOKEN_PACKAGES.find((p) => p.id === packageId) ?? null;
}

/**
 * Get all available packages
 *
 * @returns Array of all token packages
 */
export function getAllPackages(): readonly TokenPackage[] {
  return TOKEN_PACKAGES;
}

/**
 * Get the popular/featured package
 *
 * @returns The package marked as popular, or null if none
 */
export function getPopularPackage(): TokenPackage | null {
  return TOKEN_PACKAGES.find((p) => p.popular === true) ?? null;
}

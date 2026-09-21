"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { TOKEN_PACKAGES, TIER_LIMITS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, Zap, Crown, AlertCircle, Gift } from 'lucide-react';
import { API_BASE_URL } from '@/lib/runtime-config';

export default function PricingPage() {
  const { user, profile, isAnonymous, getAuthToken, loading } = useAuth();
  const [purchasingPackage, setPurchasingPackage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async (packageId: string) => {
    setPurchasingPackage(packageId);
    setError(null);

    try {
      // Check if user is anonymous
      if (isAnonymous) {
        setError('Please create an account before purchasing tokens. Anonymous users cannot make purchases to prevent token loss if browser data is cleared.');
        setPurchasingPackage(null);
        return;
      }

      // Get auth token
      const token = await getAuthToken();

      // Create checkout session
      const response = await fetch(`${API_BASE_URL}/create-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packageId,
          successUrl: `${window.location.origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/pricing/cancel`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checkout session');
      setPurchasingPackage(null);
    }
  };

  const getPackageIcon = (packageId: string) => {
    switch (packageId) {
      case 'starter':
        return <Sparkles className="h-8 w-8 text-primary" />;
      case 'popular':
        return <Zap className="h-8 w-8 text-primary" />;
      case 'premium':
        return <Crown className="h-8 w-8 text-primary" />;
      default:
        return <Sparkles className="h-8 w-8 text-primary" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Pricing & Packages</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Purchase token packages to unlock higher tiers and continue using AI Text Enhancer. All packages include tier upgrades with enhanced limits.
          </p>
          {profile && (
            <div className="mt-6 p-4 bg-card border border-border rounded-lg max-w-md mx-auto">
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-3xl font-bold text-primary">
                {profile.tokens_available.toLocaleString()} tokens
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 max-w-4xl mx-auto">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </div>
        )}

        {/* Anonymous User Notice */}
        {isAnonymous && (
          <div className="mb-8 max-w-4xl mx-auto">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                  Create an Account to Purchase Tokens
                </p>
                <p className="text-sm text-yellow-600/80 dark:text-yellow-500/80">
                  Guest users cannot purchase tokens to prevent token loss if browser data is cleared.
                  Please create a permanent account first.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {/* Free Plan Card */}
          <div className="relative bg-card border border-border rounded-lg p-6 flex flex-col">
            {/* Current Plan Badge */}
            {profile?.tier === 'free' && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-muted text-foreground text-xs font-bold px-3 py-1 rounded-full border border-border">
                  CURRENT PLAN
                </span>
              </div>
            )}

            {/* Icon */}
            <div className="mb-4 flex justify-center">
              <Gift className="h-8 w-8 text-muted-foreground" />
            </div>

            {/* Plan Name */}
            <h3 className="text-xl font-bold text-center mb-2">Free Plan</h3>

            {/* Price */}
            <div className="text-center mb-4">
              <p className="text-4xl font-bold">$0</p>
              <p className="text-sm text-muted-foreground mt-1">Forever free</p>
            </div>

            {/* Features */}
            <div className="mb-6 flex-grow">
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>500 chars text limit</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>800 chars context</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>3 assistants max</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>Basic models</span>
                </li>
              </ul>
            </div>

            {/* No Button - Informational Only */}
            <div className="text-center text-sm text-muted-foreground">
              No purchase needed
            </div>
          </div>

          {/* Token Package Cards */}
          {TOKEN_PACKAGES.map((pkg) => {
            // Determine tier unlocked by this package
            const tierUnlocked = (pkg.id === 'starter' || pkg.id === 'popular') ? 'plus' : 'premium';
            const tierLimits = TIER_LIMITS[tierUnlocked];

            return (
              <div
                key={pkg.id}
                className={`relative bg-card border rounded-lg p-6 flex flex-col ${
                  pkg.popular
                    ? 'border-primary shadow-lg scale-105'
                    : 'border-border hover:border-primary/50'
                } transition-all duration-200`}
              >
                {/* Popular Badge */}
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div className="mb-4 flex justify-center">
                  {getPackageIcon(pkg.id)}
                </div>

                {/* Package Name */}
                <h3 className="text-xl font-bold text-center mb-2">{pkg.name}</h3>

                {/* Tier Badge */}
                <div className="text-center mb-4">
                  <span className="inline-block text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                    Unlocks {tierUnlocked.charAt(0).toUpperCase() + tierUnlocked.slice(1)} Tier
                  </span>
                </div>

                {/* Tokens */}
                <div className="text-center mb-4">
                  <p className="text-3xl font-bold text-primary">
                    {(pkg.tokens / 1000).toLocaleString()}k
                  </p>
                  <p className="text-sm text-muted-foreground">tokens</p>
                </div>

                {/* Price */}
                <div className="text-center mb-4">
                  <p className="text-4xl font-bold">${pkg.price.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {pkg.costPerThousand} per 1k tokens
                  </p>
                  {pkg.discount && (
                    <p className="text-xs text-green-600 dark:text-green-500 font-medium mt-1">
                      {pkg.discount}
                    </p>
                  )}
                </div>

                {/* Features */}
                <div className="mb-6 flex-grow">
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{pkg.tokens.toLocaleString()} tokens</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>Valid for 1 year</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{tierLimits.maxTextLength.toLocaleString()} chars text</span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{tierLimits.maxBatchSize} assistants max</span>
                    </li>
                  </ul>
                </div>

                {/* Buy Button */}
                <Button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchasingPackage === pkg.id || loading || isAnonymous}
                  className={`w-full ${
                    pkg.popular
                      ? 'bg-primary hover:bg-primary/90'
                      : ''
                  }`}
                >
                  {purchasingPackage === pkg.id
                    ? 'Processing...'
                    : isAnonymous
                    ? 'Create Account First'
                    : 'Buy Now'}
                </Button>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold mb-2">How do tokens work?</h3>
              <p className="text-sm text-muted-foreground">
                Tokens are used each time you enhance text with AI. The number of tokens consumed depends on the length of your text and the AI models you use.
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold mb-2">Do tokens expire?</h3>
              <p className="text-sm text-muted-foreground">
                Yes, purchased tokens are valid for 1 year from the date of purchase. This ensures you get the best value while keeping the service sustainable.
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold mb-2">Can I get a refund?</h3>
              <p className="text-sm text-muted-foreground">
                Refunds are processed proportionally based on unused tokens. If you've used 30% of your tokens, you'll receive a 70% refund.
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold mb-2">Is payment secure?</h3>
              <p className="text-sm text-muted-foreground">
                Yes, all payments are processed securely through Stripe, a leading payment processor trusted by millions of businesses worldwide.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

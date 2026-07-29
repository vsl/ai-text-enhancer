'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/features/LoadingSpinner';
import { TIER_LIMITS } from '@/lib/constants';

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, loading, signOut, tierLimits, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/text-ai-assistants');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'free':
        return 'bg-gray-500';
      case 'plus':
        return 'bg-blue-500';
      case 'premium':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const quotaPercentage = profile.tokens_used > 0 && profile.tokens_available > 0
    ? Math.min(100, (profile.tokens_used / (profile.tokens_available + profile.tokens_used)) * 100)
    : 0;

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/text-ai-assistants"
          className="text-primary hover:underline text-sm"
        >
          ← Back to App
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

      {/* Account Section */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Account Information</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tier</span>
            <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${getTierBadgeColor(profile.tier)}`}>
              {profile.tier.charAt(0).toUpperCase() + profile.tier.slice(1)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Auth Provider</span>
            <span className="font-medium capitalize">{profile.auth_provider}</span>
          </div>
        </div>
      </div>

      {/* Quota Section */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Token Quota</h2>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            {refreshing ? (
              <>
                <LoadingSpinner className="mr-2 h-3 w-3" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tokens Available</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {formatNumber(profile.tokens_available)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tokens Used</span>
            <span className="font-medium">{formatNumber(profile.tokens_used)}</span>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${quotaPercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {quotaPercentage.toFixed(1)}% used
            </p>
          </div>
        </div>
      </div>

      {/* Tier Limits Section */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Your Tier Limits</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="space-y-2">
              <tr className="border-b border-border">
                <td className="py-3 text-muted-foreground">Max Text Length</td>
                <td className="py-3 text-right font-medium">
                  {formatNumber(tierLimits.maxTextLength)} characters
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3 text-muted-foreground">Max Context Length</td>
                <td className="py-3 text-right font-medium">
                  {formatNumber(tierLimits.maxContextLength)} characters
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3 text-muted-foreground">Max Assistants (Batch Size)</td>
                <td className="py-3 text-right font-medium">
                  {tierLimits.maxBatchSize} assistants
                </td>
              </tr>
              <tr>
                <td className="py-3 text-muted-foreground align-top">Available Models</td>
                <td className="py-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    {tierLimits.availableModels.map((model) => (
                      <span key={model} className="font-medium">
                        {model}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Upgrade CTA */}
      {profile.tier !== 'premium' && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-2">Upgrade Your Plan</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Get more tokens, higher limits, and access to premium models
          </p>
          <Button variant="default" asChild>
            <Link href="/pricing">
              Upgrade to {profile.tier === 'free' ? 'Plus' : 'Premium'}
            </Link>
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          onClick={handleSignOut}
          variant="destructive"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}

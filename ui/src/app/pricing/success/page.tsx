"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshProfile, profile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(true);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Refresh user profile to get updated token balance
    const refresh = async () => {
      try {
        await refreshProfile();
      } catch (error) {
        console.error('Failed to refresh profile:', error);
      } finally {
        setIsRefreshing(false);
      }
    };

    refresh();
  }, [refreshProfile]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          {/* Success Icon */}
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-green-500/10 p-6">
              <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-500" />
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-4xl font-bold mb-4">Payment Successful!</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Your tokens have been added to your account and are ready to use.
          </p>

          {/* Token Balance */}
          {isRefreshing ? (
            <div className="mb-8 p-6 bg-card border border-border rounded-lg flex items-center justify-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Updating your balance...</p>
            </div>
          ) : profile ? (
            <div className="mb-8 p-6 bg-card border border-border rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Your New Balance</p>
              <p className="text-4xl font-bold text-primary">
                {profile.tokens_available.toLocaleString()} tokens
              </p>
            </div>
          ) : null}

          {/* Session ID (for support) */}
          {sessionId && (
            <div className="mb-8 p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Transaction ID (for your records)</p>
              <p className="text-xs font-mono break-all">{sessionId}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/text-ai-assistants" className="flex items-center gap-2">
                Start Enhancing Text
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/pricing">
                Buy More Tokens
              </Link>
            </Button>
          </div>

          {/* Additional Info */}
          <div className="mt-12 p-6 bg-card border border-border rounded-lg text-left">
            <h3 className="font-semibold mb-3">What's Next?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
                <span>Your tokens have been added to your account balance</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
                <span>You can start using them immediately to enhance text</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
                <span>A receipt has been sent to your email</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
                <span>Your tokens never expire</span>
              </li>
            </ul>
          </div>

          {/* Support Link */}
          <p className="mt-8 text-sm text-muted-foreground">
            Need help?{' '}
            <Link href="/contact" className="text-primary hover:underline">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}

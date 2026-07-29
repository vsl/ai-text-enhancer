"use client";

import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

export default function CancelPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          {/* Cancel Icon */}
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-yellow-500/10 p-6">
              <XCircle className="h-16 w-16 text-yellow-600 dark:text-yellow-500" />
            </div>
          </div>

          {/* Cancel Message */}
          <h1 className="text-4xl font-bold mb-4">Payment Cancelled</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Your payment was cancelled. No charges were made to your account.
          </p>

          {/* Info Box */}
          <div className="mb-8 p-6 bg-card border border-border rounded-lg text-left">
            <h3 className="font-semibold mb-3">What Happened?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You cancelled the payment process or closed the checkout window before completing your purchase.
              Your account balance remains unchanged.
            </p>
            <h3 className="font-semibold mb-3">Want to Try Again?</h3>
            <p className="text-sm text-muted-foreground">
              If you encountered any issues during checkout, please try again or contact our support team for assistance.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/pricing" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Return to Pricing
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/text-ai-assistants" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to App
              </Link>
            </Button>
          </div>

          {/* Support Section */}
          <div className="mt-12 p-6 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Need Help?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              If you're experiencing issues with payment or have questions about our token packages,
              we're here to help.
            </p>
            <Button asChild variant="link" className="text-primary">
              <Link href="/contact">
                Contact Support
              </Link>
            </Button>
          </div>

          {/* Common Reasons */}
          <div className="mt-8 text-left">
            <h3 className="font-semibold mb-4 text-center">Common Reasons for Cancellation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-card border border-border rounded-lg">
                <p className="text-sm font-medium mb-1">Closed the Window</p>
                <p className="text-xs text-muted-foreground">
                  The checkout window was closed before payment completion
                </p>
              </div>
              <div className="p-4 bg-card border border-border rounded-lg">
                <p className="text-sm font-medium mb-1">Changed Your Mind</p>
                <p className="text-xs text-muted-foreground">
                  Decided to choose a different package or purchase later
                </p>
              </div>
              <div className="p-4 bg-card border border-border rounded-lg">
                <p className="text-sm font-medium mb-1">Payment Issue</p>
                <p className="text-xs text-muted-foreground">
                  Encountered a problem with payment method or card details
                </p>
              </div>
              <div className="p-4 bg-card border border-border rounded-lg">
                <p className="text-sm font-medium mb-1">Want More Information</p>
                <p className="text-xs text-muted-foreground">
                  Need to review package details or compare options first
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

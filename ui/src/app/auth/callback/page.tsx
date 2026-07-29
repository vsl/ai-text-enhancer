'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/features/LoadingSpinner';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const code = hashParams.get('code');

      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch (error) {
          console.error('Error exchanging code for session:', error);
        }
      }

      // Redirect to main app
      router.push('/text-ai-assistants');
    };

    handleCallback();
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-16 flex justify-center">
      <LoadingSpinner />
    </div>
  );
}

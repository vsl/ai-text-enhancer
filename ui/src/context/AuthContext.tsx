'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { TierLimits, UserProfile } from '@/lib/types';
import { TIER_LIMITS } from '@/lib/constants';
import { API_BASE_URL } from '@/lib/runtime-config';

interface AuthContextType {
  profile: UserProfile | null;
  tierLimits: TierLimits;
  getAuthToken: () => Promise<string>;
  resetSession: () => Promise<void>;
  updateTokenBalance: (tokensUsed: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [tierLimits, setTierLimits] = useState<TierLimits>(TIER_LIMITS.free);

  const createAnonymousSession = async (): Promise<Session> => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (!data.session) throw new Error('Anonymous session was not created');
    return data.session;
  };

  const resetSession = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await createAnonymousSession();
  };

  const fetchUserProfile = async (accessToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        await resetSession();
        window.location.reload();
        return;
      }
      if (response.status === 403) throw new Error('Access is unavailable');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch usage profile');
      }

      const { profile: profileData, quota } = await response.json();
      if (!profileData) return;

      const userProfile: UserProfile = {
        id: profileData.id,
        email: profileData.email,
        tier: profileData.tier,
        tokens_available: quota?.tokens_available || 0,
        tokens_used: quota?.tokens_used || 0,
        auth_provider: profileData.auth_provider,
        created_at: profileData.created_at || new Date().toISOString(),
        is_anonymous: true,
      };
      setProfile(userProfile);
      setTierLimits(TIER_LIMITS[userProfile.tier]);
    } catch (error) {
      console.error('Error fetching usage profile:', error);
      setProfile(null);
      setTierLimits(TIER_LIMITS.free);
    }
  };

  useEffect(() => {
    let subscribed = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!subscribed) return;

      if (!nextSession) {
        setSession(null);
        setProfile(null);
        setTierLimits(TIER_LIMITS.free);

        if (event === 'INITIAL_SESSION') {
          setTimeout(() => {
            if (subscribed) createAnonymousSession().catch((error) => {
              console.error('Failed to create anonymous session:', error);
            });
          }, 0);
        }
        return;
      }

      if (!nextSession.user.is_anonymous) {
        setTimeout(() => {
          if (subscribed) resetSession().catch((error) => {
            console.error('Failed to replace non-anonymous session:', error);
          });
        }, 0);
        return;
      }

      setSession(nextSession);
      setTimeout(() => {
        if (subscribed) void fetchUserProfile(nextSession.access_token);
      }, 0);
    });

    return () => {
      subscribed = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.expires_at) return;

    const refreshTime = Math.max(session.expires_at * 1000 - Date.now() - 5 * 60 * 1000, 0);
    const refreshTimer = setTimeout(async () => {
      const { error } = await supabase.auth.refreshSession();
      if (error) console.error('Session refresh failed:', error);
    }, refreshTime);

    return () => clearTimeout(refreshTimer);
  }, [session]);

  const getAuthToken = async (): Promise<string> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session?.access_token || (await createAnonymousSession()).access_token;
  };

  const updateTokenBalance = (tokensUsed: number) => {
    setProfile((current) => current && ({
      ...current,
      tokens_available: Math.max(0, current.tokens_available - tokensUsed),
      tokens_used: current.tokens_used + tokensUsed,
    }));
  };

  return (
    <AuthContext.Provider value={{ profile, tierLimits, getAuthToken, resetSession, updateTokenBalance }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

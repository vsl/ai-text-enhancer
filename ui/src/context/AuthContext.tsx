'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile, TierLimits } from '@/lib/types';
import { TIER_LIMITS } from '@/lib/constants';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  tierLimits: TierLimits;
  isAnonymous: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  getAuthToken: () => Promise<string>;
  refreshProfile: () => Promise<void>;
  updateTokenBalance: (tokensUsed: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tierLimits, setTierLimits] = useState<TierLimits>(TIER_LIMITS.free);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Fetch user profile from /me endpoint
  const fetchUserProfile = async (accessToken: string) => {
    try {
      if (!accessToken) {
        throw new Error('No access token provided');
      }

      // Call /me endpoint with Bearer token
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:54321/functions/v1';
      const response = await fetch(`${apiBaseUrl}/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Handle different error statuses
        if (response.status === 401) {
          await signOut();
          window.location.reload();
          return; // Exit early since page will reload
        }
        if (response.status === 403) {
          throw new Error('Account is blocked');
        }
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch user profile');
      }

      const { profile: profileData, quota } = await response.json();

      if (profileData) {
        const userProfile: UserProfile = {
          id: profileData.id,
          email: profileData.email,
          tier: profileData.tier as 'free' | 'plus' | 'premium',
          tokens_available: quota?.tokens_available || 0,
          tokens_used: quota?.tokens_used || 0,
          auth_provider: profileData.auth_provider,
          created_at: profileData.created_at || new Date().toISOString(),
          is_anonymous: profileData.auth_provider === 'anonymous',
        };
        setProfile(userProfile);
        setTierLimits(TIER_LIMITS[userProfile.tier]);
        setIsAnonymous(userProfile.is_anonymous || false);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Fall back to free tier if profile fetch fails
      setProfile(null);
      setTierLimits(TIER_LIMITS.free);
    }
  };

  // Set up auth listener
  useEffect(() => {
    let isSubscribed = true;
    let hasInitialized = false;
    
    // Safety timeout to ensure loading never hangs indefinitely
    const loadingTimeout = setTimeout(() => {
      if (isSubscribed) {
        console.warn('Auth initialization timeout - setting loading to false');
        setLoading(false);
      }
    }, 4000); // 4 second timeout

    // Listen for auth changes - this fires immediately with current session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isSubscribed) return;
      
      // Skip duplicate INITIAL_SESSION event if we've already processed a session
      if (event === 'INITIAL_SESSION' && hasInitialized) {
        return;
      }
      
      clearTimeout(loadingTimeout);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user && session.access_token) {
        hasInitialized = true;
        await fetchUserProfile(session.access_token);
        setLoading(false);
      } else if (!hasInitialized) {
        // Only create anonymous session on first initialization if no session exists
        hasInitialized = true;
        try {
          await signInAnonymously();
          // Don't set loading to false here - wait for next onAuthStateChange event
        } catch (error) {
          console.error('Failed to create anonymous session:', error);
          setLoading(false);
        }
      } else {
        // Subsequent calls with no session (e.g., after sign out)
        setProfile(null);
        setTierLimits(TIER_LIMITS.free);
        setIsAnonymous(false);
        setLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Set up token refresh interval
  useEffect(() => {
    if (!session) return;

    // Refresh token 5 minutes before expiration
    const expiresAt = session.expires_at;
    if (!expiresAt) return;

    const expiresIn = (expiresAt * 1000) - Date.now();
    const refreshTime = Math.max(expiresIn - 5 * 60 * 1000, 0); // 5 min before expiry

    const refreshTimer = setTimeout(async () => {
      try {
        const { error } = await supabase.auth.refreshSession();
        if (error) console.error('Token refresh failed:', error);
      } catch (err) {
        console.error('Token refresh error:', err);
      }
    }, refreshTime);

    return () => clearTimeout(refreshTimer);
  }, [session]);

  // Sign up with email/password
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  };

  // Sign in anonymously
  const signInAnonymously = async () => {
    // Supabase anonymous sign-in using signInAnonymously method
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    // Session will be automatically set via onAuthStateChange
  };

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  // Sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // Sign in with OAuth
  const signInWithOAuth = async (provider: 'google' | 'github') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  // Reset password
  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  };

  // Get auth token for API calls
  const getAuthToken = async (): Promise<string> => {
    // Use session from state instead of getSession()
    if (session?.access_token) {
      return session.access_token;
    }

    // If no session in state, create anonymous session first
    await signInAnonymously();
    
    // Wait a bit for onAuthStateChange to update the session state
    return new Promise((resolve) => {
      const checkSession = () => {
        if (session?.access_token) {
          resolve(session.access_token);
        } else {
          setTimeout(checkSession, 100);
        }
      };
      checkSession();
    });
  };

  // Refresh user profile
  const refreshProfile = async () => {
    if (user && session?.access_token) {
      await fetchUserProfile(session.access_token);
    }
  };

  // Update token balance locally without API call
  const updateTokenBalance = (tokensUsed: number) => {
    if (profile) {
      setProfile({
        ...profile,
        tokens_available: Math.max(0, profile.tokens_available - tokensUsed),
        tokens_used: profile.tokens_used + tokensUsed,
      });
    }
  };

  const value = {
    user,
    profile,
    session,
    loading,
    tierLimits,
    isAnonymous,
    signUp,
    signIn,
    signInAnonymously,
    signOut,
    signInWithOAuth,
    resetPasswordForEmail,
    getAuthToken,
    refreshProfile,
    updateTokenBalance,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

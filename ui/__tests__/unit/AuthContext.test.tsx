jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInAnonymously: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
}));

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

global.fetch = jest.fn();

const session = {
  access_token: 'anonymous-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'anonymous-user', is_anonymous: true },
} as any;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext anonymous session', () => {
  let authStateChange: (event: string, nextSession: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
      authStateChange = callback;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    (supabase.auth.signInAnonymously as jest.Mock).mockResolvedValue({
      data: { session },
      error: null,
    });
    (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });
    (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({ error: null });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        profile: {
          id: 'anonymous-user',
          email: 'anonymous-user@anon.local',
          tier: 'free',
          auth_provider: 'anonymous',
          created_at: '2026-01-01T00:00:00Z',
        },
        quota: { tokens_available: 50000, tokens_used: 0 },
      }),
    });
  });

  it('creates an anonymous session when none exists', async () => {
    renderHook(() => useAuth(), { wrapper });

    act(() => authStateChange('INITIAL_SESSION', null));

    await waitFor(() => expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1));
  });

  it('loads only the anonymous quota API', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => authStateChange('SIGNED_IN', session));

    await waitFor(() => expect(result.current.profile?.tokens_available).toBe(50000));
    expect(Object.keys(result.current).sort()).toEqual([
      'getAuthToken',
      'profile',
      'resetSession',
      'tierLimits',
      'updateTokenBalance',
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/me'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer anonymous-token' }) })
    );
  });

  it('returns the existing anonymous bearer token', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session },
      error: null,
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(result.current.getAuthToken()).resolves.toBe('anonymous-token');
    expect(supabase.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('recovers a missing session before returning a bearer token', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(result.current.getAuthToken()).resolves.toBe('anonymous-token');
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('replaces an invalid session with a new anonymous session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => result.current.resetSession());

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('replaces a persisted non-anonymous session', async () => {
    renderHook(() => useAuth(), { wrapper });

    act(() => authStateChange('INITIAL_SESSION', {
      ...session,
      user: { id: 'old-user', is_anonymous: false },
    }));

    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalledTimes(1));
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('updates the displayed balance locally', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => authStateChange('SIGNED_IN', session));
    await waitFor(() => expect(result.current.profile).not.toBeNull());

    act(() => result.current.updateTokenBalance(125));

    expect(result.current.profile?.tokens_available).toBe(49875);
    expect(result.current.profile?.tokens_used).toBe(125);
  });
});

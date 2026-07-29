// Mock Supabase client FIRST before any imports
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInAnonymously: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      signInWithOAuth: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
}));

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// Mock fetch globally
global.fetch = jest.fn();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext - Bug Fix #1: Guest User Disappearing on Refresh', () => {
  let authStateChangeCallback: (event: string, session: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fetch for /me endpoint
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: {
          id: 'test-user-id',
          email: 'test@example.com',
          tier: 'free',
          auth_provider: 'email',
          created_at: '2024-01-01T00:00:00Z',
        },
        quota: {
          tokens_available: 1000,
          tokens_used: 0,
        },
      }),
    });
  });

  describe('Loading state management', () => {
    it('should start with loading = true', () => {
      // Mock onAuthStateChange to not fire immediately (simulating slow network)
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
        authStateChangeCallback = callback;
        // Don't call callback - simulating slow auth initialization
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      });

      (supabase.auth.getSession as jest.Mock).mockImplementation(() =>
        new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Should be loading initially
      expect(result.current.loading).toBe(true);
    });

    it('should set loading to false after session check completes (no session)', async () => {
      // Mock onAuthStateChange to fire with no session
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
        authStateChangeCallback = callback;
        setTimeout(() => {
          callback('INITIAL_SESSION', null);
        }, 0);
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      });

      // Mock no session
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      // Mock anonymous sign-in failure to prevent additional async operations
      (supabase.auth.signInAnonymously as jest.Mock).mockRejectedValue(
        new Error('Anonymous sign-in failed')
      );

      // Suppress expected console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Initially loading
      expect(result.current.loading).toBe(true);

      // Wait for loading to become false (Bug Fix #1 - line 110)
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 3000 });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should set loading to false after session check completes (with session)', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'mock-token',
        expires_at: Date.now() / 1000 + 3600,
      };

      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
        authStateChangeCallback = callback;
        setTimeout(() => {
          callback('INITIAL_SESSION', mockSession);
        }, 0);
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      });

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).not.toBeNull();
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.profile).not.toBeNull();
    });

    it('should set loading to false even if anonymous session creation fails', async () => {
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
        authStateChangeCallback = callback;
        setTimeout(() => {
          callback('INITIAL_SESSION', null);
        }, 0);
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      });

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      (supabase.auth.signInAnonymously as jest.Mock).mockRejectedValue(
        new Error('Failed to create anonymous session')
      );

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create anonymous session:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Session restoration', () => {
    it('should fetch user profile when existing session is found', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'mock-token',
        expires_at: Date.now() / 1000 + 3600,
      };

      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
        authStateChangeCallback = callback;
        setTimeout(() => {
          callback('INITIAL_SESSION', mockSession);
        }, 0);
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      });

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify profile was fetched
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );

      expect(result.current.profile).toEqual(
        expect.objectContaining({
          email: 'test@example.com',
          tier: 'free',
        })
      );
    });

    it('should attempt anonymous session creation when no session exists', async () => {
      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
        authStateChangeCallback = callback;
        // Fire initial session with no session
        setTimeout(() => {
          callback('INITIAL_SESSION', null);
          // After signInAnonymously is called (which happens in the INITIAL_SESSION handler),
          // simulate another auth state change event
          setTimeout(() => {
            callback('SIGNED_IN', null);
          }, 10);
        }, 0);
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      });

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      (supabase.auth.signInAnonymously as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(supabase.auth.signInAnonymously).toHaveBeenCalled();
    });

    it('should set loading to false after anonymous session creation completes', async () => {
      const anonSession = {
        user: { id: 'anon-user' },
        access_token: 'anon-token',
        expires_at: Date.now() / 1000 + 3600,
      };

      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
        authStateChangeCallback = callback;
        // First fire with no session, then fire with anon session after signInAnonymously is called
        setTimeout(() => {
          callback('INITIAL_SESSION', null);
          // Simulate the second auth state change after anonymous sign-in
          setTimeout(() => {
            callback('SIGNED_IN', anonSession);
          }, 10);
        }, 0);
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      });

      (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: null },
      });

      (supabase.auth.signInAnonymously as jest.Mock).mockResolvedValue({
        data: {
          user: { id: 'anon-user' },
          session: anonSession,
        },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial loading to complete (Bug Fix #1)
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Auth state change listener', () => {
    it('should set loading to false when auth state changes', async () => {
      // Suppress expected console.error from fetchUserProfile
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
        authStateChangeCallback = callback;
        // Fire initial session with no session, then fire second event after signInAnonymously
        setTimeout(() => {
          callback('INITIAL_SESSION', null);
          // Simulate the auth state change after anonymous sign-in
          setTimeout(() => {
            callback('SIGNED_IN', null);
          }, 10);
        }, 0);
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      });

      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      (supabase.auth.signInAnonymously as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for initial mount
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate auth state change
      await act(async () => {
        authStateChangeCallback('SIGNED_IN', {
          user: { id: 'new-user' },
          access_token: 'new-token',
        });
      });

      // Verify loading is set to false after state change (line 127)
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      consoleErrorSpy.mockRestore();
    });
  });
});

describe('AuthContext - updateTokenBalance Method (Bug Fix #2)', () => {
  let authStateChangeCallback: (event: string, session: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockSession = {
      user: { id: 'user-123', email: 'test@example.com' },
      access_token: 'mock-token',
      expires_at: Date.now() / 1000 + 3600,
    };

    (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
      authStateChangeCallback = callback;
      // Simulate INITIAL_SESSION event firing immediately (as Supabase does)
      setTimeout(() => {
        callback('INITIAL_SESSION', mockSession);
      }, 0);
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      };
    });

    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: mockSession
      },
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: {
          id: 'test-user-id',
          email: 'test@example.com',
          tier: 'free',
          auth_provider: 'email',
          created_at: '2024-01-01T00:00:00Z',
        },
        quota: {
          tokens_available: 1000,
          tokens_used: 100,
        },
      }),
    });
  });

  it('should decrease tokens_available when updateTokenBalance is called', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.profile).not.toBeNull();
    });

    const initialAvailable = result.current.profile!.tokens_available;
    expect(initialAvailable).toBe(1000);

    act(() => {
      result.current.updateTokenBalance(250);
    });

    expect(result.current.profile!.tokens_available).toBe(750);
  });

  it('should increase tokens_used when updateTokenBalance is called', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.profile).not.toBeNull();
    });

    const initialUsed = result.current.profile!.tokens_used;
    expect(initialUsed).toBe(100);

    act(() => {
      result.current.updateTokenBalance(50);
    });

    expect(result.current.profile!.tokens_used).toBe(150);
  });

  it('should not allow negative tokens_available', async () => {
    // Override fetch mock for this test
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: {
          id: 'test-user-id',
          email: 'test@example.com',
          tier: 'free',
          auth_provider: 'email',
          created_at: '2024-01-01T00:00:00Z',
        },
        quota: {
          tokens_available: 100,
          tokens_used: 0,
        },
      }),
    });

    // Need to re-mock onAuthStateChange to trigger with updated session
    const mockSession = {
      user: { id: 'user-123', email: 'test@example.com' },
      access_token: 'mock-token',
      expires_at: Date.now() / 1000 + 3600,
    };

    (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
      setTimeout(() => {
        callback('INITIAL_SESSION', mockSession);
      }, 0);
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      };
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.profile).not.toBeNull();
    });

    expect(result.current.profile!.tokens_available).toBe(100);

    act(() => {
      result.current.updateTokenBalance(150);
    });

    // Should be 0, not -50
    expect(result.current.profile!.tokens_available).toBe(0);
    expect(result.current.profile!.tokens_used).toBe(150);
  });

  it('should do nothing if profile is null', async () => {
    // Suppress expected console.error from anonymous sign-in failure
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Override the beforeEach mock to simulate no session
    (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
      // Simulate INITIAL_SESSION event with no session
      setTimeout(() => {
        callback('INITIAL_SESSION', null);
      }, 0);
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn(),
          },
        },
      };
    });

    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });

    (supabase.auth.signInAnonymously as jest.Mock).mockRejectedValue(
      new Error('Failed')
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Call updateTokenBalance with no profile
    act(() => {
      result.current.updateTokenBalance(100);
    });

    // Should not throw error
    expect(result.current.profile).toBeNull();

    consoleErrorSpy.mockRestore();
  });

  it('should handle multiple sequential token updates', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.profile).not.toBeNull();
    });

    act(() => {
      result.current.updateTokenBalance(100);
    });

    expect(result.current.profile!.tokens_available).toBe(900);
    expect(result.current.profile!.tokens_used).toBe(200);

    act(() => {
      result.current.updateTokenBalance(200);
    });

    expect(result.current.profile!.tokens_available).toBe(700);
    expect(result.current.profile!.tokens_used).toBe(400);
  });

  it('should correctly update both fields in a single call', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.profile).not.toBeNull();
    });

    const initialAvailable = result.current.profile!.tokens_available;
    const initialUsed = result.current.profile!.tokens_used;

    act(() => {
      result.current.updateTokenBalance(300);
    });

    expect(result.current.profile!.tokens_available).toBe(initialAvailable - 300);
    expect(result.current.profile!.tokens_used).toBe(initialUsed + 300);
  });
});

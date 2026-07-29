'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { SocialLoginButtons } from './SocialLoginButtons';
import { Eye, EyeOff } from 'lucide-react';

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export function SignUpModal({
  isOpen,
  onClose,
  onSwitchToLogin,
}: SignUpModalProps) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setError('');
      setLoading(false);
      setSuccess(false);
      setEmailError('');
      setPasswordError('');
      setConfirmPasswordError('');
    }
  }, [isOpen]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'Email is required';
    if (!emailRegex.test(email)) return 'Invalid email format';
    return '';
  };

  const validatePassword = (password: string) => {
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  const validateConfirmPassword = (confirmPassword: string, password: string) => {
    if (!confirmPassword) return 'Please confirm your password';
    if (confirmPassword !== password) return 'Passwords do not match';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Account Created!</DialogTitle>
            <DialogDescription>
              Your account has been successfully created. You can now sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-green-600 dark:text-green-400">
              Welcome! Redirecting...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Create Account</DialogTitle>
          <DialogDescription>
            Sign up to unlock all features and manage your workflows
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 p-3 bg-muted rounded-lg">
          <h4 className="text-sm font-medium mb-2">Benefits of Creating an Account</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>✓ Save your quota and usage history</li>
            <li>✓ Access from any device</li>
            <li>✓ Upgrade to Plus or Premium tiers</li>
            <li>✓ Password recovery</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="signup-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(validateEmail(e.target.value));
              }}
              onBlur={(e) => setEmailError(validateEmail(e.target.value))}
              placeholder="you@example.com"
              required
              autoComplete="email"
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'signup-email-error' : undefined}
              className={`w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:border-primary ${
                emailError ? 'border-destructive' : 'border-border'
              }`}
            />
            {emailError && (
              <p id="signup-email-error" className="text-destructive text-sm mt-1">{emailError}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(validatePassword(e.target.value));
                  if (confirmPassword && confirmPasswordError) {
                    setConfirmPasswordError(validateConfirmPassword(confirmPassword, e.target.value));
                  }
                }}
                onBlur={(e) => setPasswordError(validatePassword(e.target.value))}
                placeholder="At least 6 characters"
                required
                autoComplete="new-password"
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'signup-password-error' : undefined}
                className={`w-full px-3 py-2 pr-10 bg-background border rounded-lg focus:outline-none focus:border-primary ${
                  passwordError ? 'border-destructive' : 'border-border'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordError && (
              <p id="signup-password-error" className="text-destructive text-sm mt-1">{passwordError}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="signup-confirm-password" className="text-sm font-medium">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="signup-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (confirmPasswordError) {
                    setConfirmPasswordError(validateConfirmPassword(e.target.value, password));
                  }
                }}
                onBlur={(e) => setConfirmPasswordError(validateConfirmPassword(e.target.value, password))}
                placeholder="Re-enter your password"
                required
                autoComplete="new-password"
                aria-invalid={!!confirmPasswordError}
                aria-describedby={confirmPasswordError ? 'signup-confirm-password-error' : undefined}
                className={`w-full px-3 py-2 pr-10 bg-background border rounded-lg focus:outline-none focus:border-primary ${
                  confirmPasswordError ? 'border-destructive' : 'border-border'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPasswordError && (
              <p id="signup-confirm-password-error" className="text-destructive text-sm mt-1">{confirmPasswordError}</p>
            )}
          </div>

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <SocialLoginButtons onSuccess={onClose} />

        <div className="text-center text-sm">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-primary hover:underline font-medium"
          >
            Sign In
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

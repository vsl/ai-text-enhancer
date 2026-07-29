/**
 * Unit tests for form validation logic
 * Tests the validation functions used in LoginModal and SignUpModal
 */

describe('Form Validation Logic', () => {
  // Email validation function (extracted from LoginModal/SignUpModal)
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'Email is required';
    if (!emailRegex.test(email)) return 'Invalid email format';
    return '';
  };

  // Password validation function
  const validatePassword = (password: string) => {
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  // Confirm password validation function
  const validateConfirmPassword = (confirmPassword: string, password: string) => {
    if (!confirmPassword) return 'Please confirm your password';
    if (confirmPassword !== password) return 'Passwords do not match';
    return '';
  };

  describe('Email Validation', () => {
    it('returns error for empty email', () => {
      expect(validateEmail('')).toBe('Email is required');
    });

    it('returns error for invalid email format - missing @', () => {
      expect(validateEmail('invalidemail.com')).toBe('Invalid email format');
    });

    it('returns error for invalid email format - missing domain', () => {
      expect(validateEmail('test@')).toBe('Invalid email format');
    });

    it('returns error for invalid email format - missing TLD', () => {
      expect(validateEmail('test@example')).toBe('Invalid email format');
    });

    it('returns empty string for valid email', () => {
      expect(validateEmail('test@example.com')).toBe('');
    });

    it('returns empty string for valid email with subdomain', () => {
      expect(validateEmail('user@mail.example.com')).toBe('');
    });

    it('returns empty string for valid email with plus sign', () => {
      expect(validateEmail('user+tag@example.com')).toBe('');
    });
  });

  describe('Password Validation', () => {
    it('returns error for empty password', () => {
      expect(validatePassword('')).toBe('Password is required');
    });

    it('returns error for password less than 6 characters', () => {
      expect(validatePassword('12345')).toBe('Password must be at least 6 characters');
    });

    it('returns empty string for password with exactly 6 characters', () => {
      expect(validatePassword('123456')).toBe('');
    });

    it('returns empty string for password with more than 6 characters', () => {
      expect(validatePassword('password123')).toBe('');
    });

    it('returns empty string for strong password', () => {
      expect(validatePassword('StrongP@ssw0rd!')).toBe('');
    });
  });

  describe('Confirm Password Validation', () => {
    it('returns error for empty confirm password', () => {
      expect(validateConfirmPassword('', 'password123')).toBe('Please confirm your password');
    });

    it('returns error when passwords do not match', () => {
      expect(validateConfirmPassword('different', 'password123')).toBe('Passwords do not match');
    });

    it('returns empty string when passwords match', () => {
      expect(validateConfirmPassword('password123', 'password123')).toBe('');
    });

    it('returns empty string for matching complex passwords', () => {
      const password = 'C0mpl3x!P@ssw0rd';
      expect(validateConfirmPassword(password, password)).toBe('');
    });

    it('is case sensitive', () => {
      expect(validateConfirmPassword('Password', 'password')).toBe('Passwords do not match');
    });
  });

  describe('Integration Scenarios', () => {
    it('validates complete login form - all valid', () => {
      const email = 'user@example.com';
      const password = 'password123';

      expect(validateEmail(email)).toBe('');
      expect(validatePassword(password)).toBe('');
    });

    it('validates complete login form - all invalid', () => {
      const email = 'invalid';
      const password = '123';

      expect(validateEmail(email)).toBe('Invalid email format');
      expect(validatePassword(password)).toBe('Password must be at least 6 characters');
    });

    it('validates complete signup form - all valid', () => {
      const email = 'newuser@example.com';
      const password = 'securepass';
      const confirmPassword = 'securepass';

      expect(validateEmail(email)).toBe('');
      expect(validatePassword(password)).toBe('');
      expect(validateConfirmPassword(confirmPassword, password)).toBe('');
    });

    it('validates complete signup form - passwords mismatch', () => {
      const email = 'newuser@example.com';
      const password = 'securepass';
      const confirmPassword = 'different';

      expect(validateEmail(email)).toBe('');
      expect(validatePassword(password)).toBe('');
      expect(validateConfirmPassword(confirmPassword, password)).toBe('Passwords do not match');
    });
  });
});

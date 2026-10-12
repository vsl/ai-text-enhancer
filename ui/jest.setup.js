// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

process.env.NEXT_PUBLIC_APP_SUPABASE_URL ||= 'https://example.supabase.co';
process.env.NEXT_PUBLIC_APP_SUPABASE_ANON_KEY ||= 'test-anon-key';
process.env.NEXT_PUBLIC_API_BASE_URL ||= 'https://example.supabase.co/functions/v1';

// Polyfill for fetch (not available in Jest/JSDOM Node environment)
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}

// Polyfill for structuredClone (not available in Jest/JSDOM)
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Polyfill for ResizeObserver (needed for Radix UI Sheet component)
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock browser dialog functions (not implemented in jsdom)
global.confirm = jest.fn(() => true); // Default to confirming
global.alert = jest.fn();
global.prompt = jest.fn();

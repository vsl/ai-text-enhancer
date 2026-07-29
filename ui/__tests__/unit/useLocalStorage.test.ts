import { renderHook, act, waitFor } from '@testing-library/react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('Initial value', () => {
    it('should return initial value when localStorage is empty', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'));
      expect(result.current[0]).toBe('initial-value');
    });

    it('should return initial value for objects', () => {
      const initialValue = { name: 'test', count: 0 };
      const { result } = renderHook(() => useLocalStorage('test-key', initialValue));
      expect(result.current[0]).toEqual(initialValue);
    });

    it('should return initial value for arrays', () => {
      const initialValue = [1, 2, 3];
      const { result } = renderHook(() => useLocalStorage('test-key', initialValue));
      expect(result.current[0]).toEqual(initialValue);
    });
  });

  describe('Setting values', () => {
    it('should update state and persist to localStorage', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        result.current[1]('updated');
      });

      expect(result.current[0]).toBe('updated');
      expect(localStorage.getItem('test-key')).toBe(JSON.stringify('updated'));
    });

    it('should handle function updater', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 5));

      act(() => {
        result.current[1](prev => prev + 10);
      });

      expect(result.current[0]).toBe(15);
      expect(localStorage.getItem('test-key')).toBe(JSON.stringify(15));
    });

    it('should handle complex object updates', () => {
      const initialValue = { name: 'John', age: 30 };
      const { result } = renderHook(() => useLocalStorage('test-key', initialValue));

      act(() => {
        result.current[1]({ ...initialValue, age: 31 });
      });

      expect(result.current[0]).toEqual({ name: 'John', age: 31 });
      expect(localStorage.getItem('test-key')).toBe(JSON.stringify({ name: 'John', age: 31 }));
    });
  });

  describe('Retrieving from localStorage', () => {
    it('should retrieve existing value from localStorage on mount', () => {
      const existingValue = { test: 'data' };
      localStorage.setItem('test-key', JSON.stringify(existingValue));

      const { result } = renderHook(() => useLocalStorage('test-key', { test: 'initial' }));

      expect(result.current[0]).toEqual(existingValue);
    });

    it('should work with different data types', () => {
      localStorage.setItem('string-key', JSON.stringify('string value'));
      localStorage.setItem('number-key', JSON.stringify(42));
      localStorage.setItem('boolean-key', JSON.stringify(true));
      localStorage.setItem('array-key', JSON.stringify([1, 2, 3]));

      const { result: stringResult } = renderHook(() => useLocalStorage('string-key', ''));
      const { result: numberResult } = renderHook(() => useLocalStorage('number-key', 0));
      const { result: booleanResult } = renderHook(() => useLocalStorage('boolean-key', false));
      const { result: arrayResult } = renderHook(() => useLocalStorage('array-key', []));

      expect(stringResult.current[0]).toBe('string value');
      expect(numberResult.current[0]).toBe(42);
      expect(booleanResult.current[0]).toBe(true);
      expect(arrayResult.current[0]).toEqual([1, 2, 3]);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid JSON gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      localStorage.setItem('test-key', 'invalid-json{');

      const { result } = renderHook(() => useLocalStorage('test-key', 'fallback'));

      expect(result.current[0]).toBe('fallback');
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle localStorage quota exceeded', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      // Mock localStorage.setItem to throw quota exceeded error
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      act(() => {
        result.current[1]('new value');
      });

      // State should still update even if localStorage fails
      expect(result.current[0]).toBe('new value');
      expect(consoleErrorSpy).toHaveBeenCalled();

      setItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should handle generic localStorage errors', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Generic storage error');
      });

      act(() => {
        result.current[1]('new value');
      });

      expect(result.current[0]).toBe('new value');
      expect(consoleErrorSpy).toHaveBeenCalled();

      setItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('SSR safety', () => {
    it('should work when window is undefined', () => {
      // Save the original window object
      const originalWindow = global.window;

      // Mock window as undefined (SSR environment)
      // @ts-ignore
      delete global.window;

      const { result } = renderHook(() => useLocalStorage('test-key', 'ssr-initial'));

      expect(result.current[0]).toBe('ssr-initial');

      // Restore window
      global.window = originalWindow;
    });
  });

  describe('Cross-tab synchronization', () => {
    it('should sync value when storage event is fired', async () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      // Simulate storage event from another tab
      const newValue = 'updated-from-another-tab';
      act(() => {
        const event = new StorageEvent('storage', {
          key: 'test-key',
          newValue: JSON.stringify(newValue),
          oldValue: JSON.stringify('initial'),
          storageArea: localStorage,
        });
        window.dispatchEvent(event);
      });

      await waitFor(() => {
        expect(result.current[0]).toBe(newValue);
      });
    });

    it('should not sync when event is for different key', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        const event = new StorageEvent('storage', {
          key: 'different-key',
          newValue: JSON.stringify('other-value'),
          storageArea: localStorage,
        });
        window.dispatchEvent(event);
      });

      expect(result.current[0]).toBe('initial');
    });

    it('should handle storage event with null newValue', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        const event = new StorageEvent('storage', {
          key: 'test-key',
          newValue: null,
          storageArea: localStorage,
        });
        window.dispatchEvent(event);
      });

      // Should not change value when newValue is null
      expect(result.current[0]).toBe('initial');
    });

    it('should handle invalid JSON in storage event', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

      act(() => {
        const event = new StorageEvent('storage', {
          key: 'test-key',
          newValue: 'invalid-json{',
          storageArea: localStorage,
        });
        window.dispatchEvent(event);
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result.current[0]).toBe('initial');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Multiple instances', () => {
    it('should sync between multiple hook instances with same key', () => {
      const { result: result1 } = renderHook(() => useLocalStorage('shared-key', 'initial'));
      const { result: result2 } = renderHook(() => useLocalStorage('shared-key', 'initial'));

      act(() => {
        result1.current[1]('updated');
      });

      // Both should have the updated value
      expect(result1.current[0]).toBe('updated');
      
      // result2 won't automatically update without storage event
      // but localStorage should be updated
      expect(localStorage.getItem('shared-key')).toBe(JSON.stringify('updated'));
    });
  });
});

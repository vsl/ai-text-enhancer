import { getErrorMessage } from '@/lib/utils';
import { ERROR_MESSAGES } from '@/lib/constants';

describe('utils', () => {
  describe('getErrorMessage', () => {
    it('should return correct message for BATCH_SIZE_EXCEEDED', () => {
      expect(getErrorMessage('BATCH_SIZE_EXCEEDED')).toBe(ERROR_MESSAGES.BATCH_SIZE_EXCEEDED);
    });

    it('should return correct message for EMPTY_BATCH', () => {
      expect(getErrorMessage('EMPTY_BATCH')).toBe(ERROR_MESSAGES.EMPTY_BATCH);
    });

    it('should return correct message for AUTHENTICATION_FAILED', () => {
      expect(getErrorMessage('AUTHENTICATION_FAILED')).toBe(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    });

    it('should return correct message for AUTHORIZATION_FAILED', () => {
      expect(getErrorMessage('AUTHORIZATION_FAILED')).toBe(ERROR_MESSAGES.AUTHORIZATION_FAILED);
    });

    it('should return correct message for NOT_FOUND', () => {
      expect(getErrorMessage('NOT_FOUND')).toBe(ERROR_MESSAGES.NOT_FOUND);
    });

    it('should return correct message for QUOTA_EXCEEDED', () => {
      expect(getErrorMessage('QUOTA_EXCEEDED')).toBe(ERROR_MESSAGES.QUOTA_EXCEEDED);
    });

    it('should return correct message for INTERNAL_ERROR', () => {
      expect(getErrorMessage('INTERNAL_ERROR')).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    });

    it('should return correct message for LLM_ERROR', () => {
      expect(getErrorMessage('LLM_ERROR')).toBe(ERROR_MESSAGES.LLM_ERROR);
    });

    it('should return generic message for unknown error code', () => {
      expect(getErrorMessage('UNKNOWN_ERROR')).toBe('An unexpected error occurred. Please try again.');
    });

    it('should return generic message for empty string', () => {
      expect(getErrorMessage('')).toBe('An unexpected error occurred. Please try again.');
    });

    it('should return generic message for undefined error code', () => {
      expect(getErrorMessage(undefined as any)).toBe('An unexpected error occurred. Please try again.');
    });
  });
});

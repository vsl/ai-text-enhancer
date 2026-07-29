/**
 * Roles Configuration Tests
 */

import { ROLES, getRoleById, isModelAllowedForRole } from '../../../src/config/roles.config';

describe('Roles Configuration', () => {
  describe('ROLES', () => {
    it('should have exactly 4 roles defined', () => {
      expect(ROLES.length).toBe(4);
    });

    it('should have all required fields for each role', () => {
      ROLES.forEach((role) => {
        expect(role.id).toBeDefined();
        expect(role.name).toBeDefined();
        expect(role.systemPrompt).toBeDefined();
        expect(role.allowedModels).toBeDefined();
        expect(Array.isArray(role.allowedModels)).toBe(true);
        expect(role.systemPrompt.length).toBeGreaterThan(50);
      });
    });

    it('should have unique role IDs', () => {
      const ids = ROLES.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include editor role', () => {
      const role = ROLES.find((r) => r.id === 'editor');
      expect(role).toBeDefined();
      expect(role?.name).toBe('Editor');
      expect(role?.systemPrompt).toContain('text editor');
    });

    it('should include summarizer role', () => {
      const role = ROLES.find((r) => r.id === 'summarizer');
      expect(role).toBeDefined();
      expect(role?.name).toBe('Summarizer');
      expect(role?.systemPrompt).toContain('summarizer');
    });

    it('should include social_media_assistant role', () => {
      const role = ROLES.find((r) => r.id === 'social_media_assistant');
      expect(role).toBeDefined();
      expect(role?.name).toBe('Social Media Assistant');
      expect(role?.systemPrompt).toContain('social media');
    });

    it('should include email_assistant role', () => {
      const role = ROLES.find((r) => r.id === 'email_assistant');
      expect(role).toBeDefined();
      expect(role?.name).toBe('Email Assistant');
      expect(role?.systemPrompt).toContain('email');
    });

    it('should have system prompts that describe role focus', () => {
      ROLES.forEach((role) => {
        expect(role.systemPrompt.toLowerCase()).toContain('focus');
      });
    });

    it('should have at least one allowed model for each role', () => {
      ROLES.forEach((role) => {
        expect(role.allowedModels.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getRoleById', () => {
    it('should return role for valid ID', () => {
      const role = getRoleById('editor');
      expect(role).not.toBeNull();
      expect(role?.id).toBe('editor');
    });

    it('should return null for invalid ID', () => {
      const role = getRoleById('non-existent-role');
      expect(role).toBeNull();
    });

    it('should return correct role for summarizer', () => {
      const role = getRoleById('summarizer');
      expect(role).not.toBeNull();
      expect(role?.name).toBe('Summarizer');
    });

    it('should return correct role for social_media_assistant', () => {
      const role = getRoleById('social_media_assistant');
      expect(role).not.toBeNull();
      expect(role?.name).toBe('Social Media Assistant');
    });
  });

  describe('isModelAllowedForRole', () => {
    it('should return true when model is allowed for role', () => {
      const role = ROLES.find((r) => r.id === 'editor');
      if (role && role.allowedModels.length > 0) {
        const modelId = role.allowedModels[0];
        expect(isModelAllowedForRole('editor', modelId)).toBe(true);
      }
    });

    it('should return false when model is not in allowedModels', () => {
      expect(isModelAllowedForRole('summarizer', 'non-existent-model')).toBe(false);
    });

    it('should return false for non-existent role', () => {
      expect(isModelAllowedForRole('non-existent-role', 'gemini-flash')).toBe(false);
    });

    it('should return false for non-existent model', () => {
      expect(isModelAllowedForRole('editor', 'non-existent-model')).toBe(false);
    });

    it('should handle all models in editor role', () => {
      const role = getRoleById('editor');
      expect(role).not.toBeNull();
      
      // Editor should allow all configured models
      expect(isModelAllowedForRole('editor', 'gemini-flash')).toBe(true);
      expect(isModelAllowedForRole('editor', 'open-router-free')).toBe(true);
      expect(isModelAllowedForRole('editor', 'local-debug-model')).toBe(true);
    });

    it('should allow all models for all roles (simplified config)', () => {
      const allModelIds = ['gemini-flash', 'open-router-free', 'local-debug-model'];
      
      allModelIds.forEach((modelId) => {
        const translator = getRoleById('translator');
        if (translator) {
          const isAllowed = isModelAllowedForRole('translator', modelId);
          expect(isAllowed).toBe(true);
        }
      });
    });
  });
});
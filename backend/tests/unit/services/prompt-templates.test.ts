/**
 * Prompt Templates Tests
 * 
 * Tests for the PromptTemplates utility that constructs
 * prompts from TransformationOptions.
 */

import { PromptTemplates } from '../../../src/services/prompt-templates.ts';
import type { TransformationOptions } from '../../../src/types/api.types.ts';

describe('PromptTemplates', () => {
  describe('buildSystemPrompt', () => {
    it('should add JSON format enforcement to role prompt', () => {
      const rolePrompt = 'You are a professional editor.';
      const result = PromptTemplates.buildSystemPrompt(rolePrompt);

      expect(result).toContain('You are a professional editor.');
      expect(result).toContain('CRITICAL: You must respond with ONLY valid JSON');
      expect(result).toContain('{"text": "your enhanced text here"}');
    });
  });

  describe('buildUserPrompt', () => {
    it('should build prompt with improve option', () => {
      const options: TransformationOptions = {
        improve: true
      };

      const result = PromptTemplates.buildUserPrompt({
        options,
        userText: 'Some text'
      });

      expect(result).toContain('INSTRUCTIONS:');
      expect(result).toContain('- Improve the clarity, flow, and vocabulary');
      expect(result).toContain('TEXT TO ENHANCE(text that need improvement):');
      expect(result).toContain('Some text');
    });

    it('should provide default instruction when no options set', () => {
      const options: TransformationOptions = {};

      const result = PromptTemplates.buildUserPrompt({
        options,
        userText: 'text'
      });

      expect(result).toContain('- Enhance the text while preserving its original meaning');
    });
  });
});

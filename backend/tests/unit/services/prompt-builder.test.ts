/**
 * Prompt Builder Tests
 * 
 * Tests the prompt building system with AssistantConfiguration
 */

import { PromptBuilder } from '../../../src/services/prompt-builder.ts';
import type { AssistantConfiguration } from '../../../src/types/api.types.ts';

describe('PromptBuilder', () => {
  const builder = new PromptBuilder();

  describe('buildPrompt', () => {
    it('should build prompt for editor role with improve and fixMistakes options', () => {
      const config: AssistantConfiguration = {
        id: 'task_abc_123',
        model: 'open-router-free',
        aiRoleId: 'editor',
        userText: 'this sentance has a typo and is unprofessional.',
        options: {
          improve: true,
          fixMistakes: true,
          formality: 'Formal'
        }
      };

      const prompt = builder.buildPrompt(config);

      // Check system prompt contains role description and JSON enforcement
      expect(prompt.systemPrompt).toContain('text editor');
      expect(prompt.systemPrompt).toContain('CRITICAL: You must respond with ONLY valid JSON');
      expect(prompt.systemPrompt).toContain('{"text": "your enhanced text here"}');

      // Check user prompt contains instructions
      expect(prompt.userPrompt).toContain('INSTRUCTIONS:');
      expect(prompt.userPrompt).toContain('- Improve the clarity, flow, and vocabulary');
      expect(prompt.userPrompt).toContain('- Fix any grammar, spelling, or punctuation mistakes');
      expect(prompt.userPrompt).toContain('- Adjust the formality level to: formal and professional');

      // Check user prompt contains the text
      expect(prompt.userPrompt).toContain('TEXT TO ENHANCE(text that need improvement):');
      expect(prompt.userPrompt).toContain('this sentance has a typo and is unprofessional.');
    });

    it('should build prompt for social_media_assistant with context and emojis', () => {
      const config: AssistantConfiguration = {
        id: 'task_def_456',
        model: 'gemini-flash',
        aiRoleId: 'social_media_assistant',
        userText: 'New product launch: AI-powered headphones.',
        contextText: 'The target audience is young professionals who value both style and cutting-edge technology. The brand voice is modern, aspirational, and slightly edgy.',
        options: {
          lengthen: true,
          tone: 'aspirational',
          addEmojis: true
        }
      };

      const prompt = builder.buildPrompt(config);

      // Check system prompt contains social media assistant description
      expect(prompt.systemPrompt).toContain('social media content assistant');

      // Check user prompt contains correct instructions
      expect(prompt.userPrompt).toContain('- Add more detail, depth, and elaboration');
      expect(prompt.userPrompt).toContain('- Apply a aspirational tone');
      expect(prompt.userPrompt).toContain('- Add relevant and appropriate emojis');

      // Check context is included
      expect(prompt.userPrompt).toContain('CONTEXT(additional information):');
      expect(prompt.userPrompt).toContain('young professionals');
      expect(prompt.userPrompt).toContain('modern, aspirational, and slightly edgy');

      // Check text is included
      expect(prompt.userPrompt).toContain('TEXT TO ENHANCE(text that need improvement):');
      expect(prompt.userPrompt).toContain('New product launch: AI-powered headphones.');
    });

    it('should build prompt with translation option', () => {
      const config: AssistantConfiguration = {
        id: 'task_xyz_789',
        model: 'gemini-flash',
        aiRoleId: 'editor',
        userText: 'Hello, how are you?',
        options: {
          translateTo: 'es-ES'
        }
      };

      const prompt = builder.buildPrompt(config);

      expect(prompt.userPrompt).toContain('- Translate the text to: es-ES');
      expect(prompt.userPrompt).toContain('Hello, how are you?');
    });

    it('should build prompt with languageLevel option', () => {
      const config: AssistantConfiguration = {
        id: 'task_123',
        model: 'gemini-flash',
        aiRoleId: 'editor',
        userText: 'The implementation of the aforementioned methodology necessitates careful consideration.',
        options: {
          improve: true,
          languageLevel: 'simple'
        }
      };

      const prompt = builder.buildPrompt(config);

      expect(prompt.userPrompt).toContain('- Use language that is: simple and easy to understand');
    });

    it('should build prompt with shorten option', () => {
      const config: AssistantConfiguration = {
        id: 'task_456',
        model: 'gemini-flash',
        aiRoleId: 'summarizer',
        userText: 'This is a very long sentence that contains a lot of unnecessary words and redundant information.',
        options: {
          shorten: true
        }
      };

      const prompt = builder.buildPrompt(config);

      expect(prompt.userPrompt).toContain('- Make the text more concise and direct');
    });

    it('should build prompt with format option', () => {
      const config: AssistantConfiguration = {
        id: 'task_789',
        model: 'gemini-flash',
        aiRoleId: 'editor',
        userText: 'Here are some items: apples oranges bananas grapes',
        options: {
          format: true
        }
      };

      const prompt = builder.buildPrompt(config);

      expect(prompt.userPrompt).toContain('- Apply proper formatting (lists, paragraphs, structure)');
    });

    it('should provide default instruction when no options are set', () => {
      const config: AssistantConfiguration = {
        id: 'task_000',
        model: 'gemini-flash',
        aiRoleId: 'editor',
        userText: 'Some text',
        options: {}
      };

      const prompt = builder.buildPrompt(config);

      expect(prompt.userPrompt).toContain('- Enhance the text while preserving its original meaning');
    });

    it('should throw error for unknown role', () => {
      const config: AssistantConfiguration = {
        id: 'task_999',
        model: 'gemini-flash',
        aiRoleId: 'unknown-role',
        userText: 'Some text',
        options: {}
      };

      expect(() => builder.buildPrompt(config)).toThrow('Unknown AI role: unknown-role');
    });

    it('should throw error when model not allowed for role', () => {
      const config: AssistantConfiguration = {
        id: 'task_888',
        model: 'some-restricted-model',
        aiRoleId: 'editor',
        userText: 'Some text',
        options: {}
      };

      expect(() => builder.buildPrompt(config)).toThrow(
        "Model 'some-restricted-model' is not allowed for role 'editor'"
      );
    });

    it('should handle all transformation options together', () => {
      const config: AssistantConfiguration = {
        id: 'task_combo',
        model: 'gemini-flash',
        aiRoleId: 'editor',
        userText: 'some text here',
        contextText: 'blog post',
        options: {
          improve: true,
          fixMistakes: true,
          format: true,
          formality: 'Neutral',
          tone: 'friendly',
          languageLevel: 'intermediate'
        }
      };

      const prompt = builder.buildPrompt(config);

      expect(prompt.userPrompt).toContain('- Improve the clarity, flow, and vocabulary');
      expect(prompt.userPrompt).toContain('- Fix any grammar, spelling, or punctuation mistakes');
      expect(prompt.userPrompt).toContain('- Apply proper formatting');
      expect(prompt.userPrompt).toContain('- Adjust the formality level to: neutral and balanced');
      expect(prompt.userPrompt).toContain('- Apply a friendly tone');
      expect(prompt.userPrompt).toContain('- Use language that is: moderately complex');
      expect(prompt.userPrompt).toContain('CONTEXT(additional information):');
      expect(prompt.userPrompt).toContain('blog post');
    });
  });
});

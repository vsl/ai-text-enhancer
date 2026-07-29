/**
 * Prompt Templates
 * 
 * Constructs prompts from AssistantConfiguration and TransformationOptions.
 * Platform-agnostic - uses only standard JavaScript/TypeScript.
 */

import type { TransformationOptions } from '../types/api.types.ts';

export class PromptTemplates {
  /**
   * JSON format enforcement instruction
   * This ensures LLM responds with parseable JSON
   */
  static readonly JSON_FORMAT_INSTRUCTION = `
CRITICAL: You must respond with ONLY valid JSON in this exact format:
{"text": "your enhanced text here"}

Do not include any explanations, markdown, or additional text outside this JSON structure.`;

  /**
   * Build system prompt from role's base prompt
   * Adds JSON format enforcement
   */
  static buildSystemPrompt(roleSystemPrompt: string): string {
    return `${roleSystemPrompt}\n${this.JSON_FORMAT_INSTRUCTION}`;
  }

  /**
   * Build user prompt from AssistantConfiguration
   * Generates instructions from options + includes context and text
   */
  static buildUserPrompt(params: {
    options: TransformationOptions;
    userText: string;
    contextText?: string;
  }): string {
    const instructions = this.buildInstructions(params.options);
    
    let prompt = 'INSTRUCTIONS:\n';
    prompt += instructions.join('\n');
    prompt += '\n\n';

    prompt += 'TEXT TO ENHANCE(text that need improvement):\n';
    prompt += params.userText;

    if (params.contextText) {
      prompt += 'CONTEXT(additional information):\n';
      prompt += `${params.contextText}\n\n`;
    }

    return prompt;
  }

  /**
   * Build instructions array from TransformationOptions
   * Each enabled option adds specific instructions
   */
  private static buildInstructions(options: TransformationOptions): string[] {
    const instructions: string[] = [];

    // Core Transformations
    if (options.improve) {
      instructions.push('- Improve the clarity, flow, and vocabulary');
    }

    if (options.fixMistakes) {
      instructions.push('- Fix any grammar, spelling, or punctuation mistakes');
    }

    if (options.format) {
      instructions.push('- Apply proper formatting (lists, paragraphs, structure)');
    }

    // Length Adjustments
    if (options.shorten) {
      instructions.push('- Make the text more concise and direct');
    }

    if (options.lengthen) {
      instructions.push('- Add more detail, depth, and elaboration');
    }

    // Style Controls
    if (options.formality) {
      const formalityMap = {
        'Casual': 'casual and conversational',
        'Neutral': 'neutral and balanced',
        'Formal': 'formal and professional'
      };
      instructions.push(`- Adjust the formality level to: ${formalityMap[options.formality]}`);
    }

    if (options.tone) {
      instructions.push(`- Apply a ${options.tone} tone`);
    }

    if (options.languageLevel && options.languageLevel !== 'default') {
      const levelMap = {
        'simple': 'simple and easy to understand',
        'intermediate': 'moderately complex',
        'advanced': 'sophisticated and nuanced',
        'fluent': 'naturally flowing and idiomatic',
        'native': 'native speaker level'
      };
      instructions.push(`- Use language that is: ${levelMap[options.languageLevel]}`);
    }

    // Special Transformations
    if (options.translateTo) {
      instructions.push(`- Translate the text to: ${options.translateTo}`);
    }

    if (options.addEmojis) {
      instructions.push('- Add relevant and appropriate emojis');
    }

    // If no specific instructions, provide a default
    if (instructions.length === 0) {
      instructions.push('- Enhance the text while preserving its original meaning');
    }

    return instructions;
  }
}

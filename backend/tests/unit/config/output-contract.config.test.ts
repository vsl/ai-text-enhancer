import { parseTextOutput } from '../../../src/config/output-contract.config.ts';
import { LLMOutputError } from '../../../src/errors/llm-errors.ts';

describe('structured output failure classification', () => {
  it.each([
    ['', undefined, 'EMPTY_MODEL_OUTPUT'],
    ['', 'length', 'OUTPUT_TRUNCATED'],
    ['{"text":', undefined, 'INVALID_JSON'],
    ['{"text":', 'length', 'OUTPUT_TRUNCATED'],
    ['{"value":"wrong"}', undefined, 'SCHEMA_MISMATCH'],
    ['{"value":"wrong"}', 'length', 'OUTPUT_TRUNCATED'],
  ])('classifies %j with finish reason %j as %s', (raw, finishReason, code) => {
    try {
      parseTextOutput(raw, { finishReason, resolvedProvider: 'openrouter' });
      throw new Error('expected parser to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(LLMOutputError);
      expect((error as LLMOutputError).code).toBe(code);
    }
  });

  it('accepts exactly one non-empty text property', () => {
    expect(parseTextOutput('{"text":"ok"}')).toBe('ok');
    expect(parseTextOutput(JSON.stringify({ text: 'Use an em dash — here; and **bold** if needed.' })))
      .toBe('Use an em dash — here; and **bold** if needed.');
  });
});

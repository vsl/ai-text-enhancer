import { LLMOutputError } from '../errors/llm-errors.ts';
import type { LLMProviderDiagnostics } from '../types/llm.types.ts';

/** Shared structured-output contract used by every provider. */
export const TEXT_OUTPUT_SCHEMA_NAME = 'text_enhancement';

export const TEXT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
    },
  },
  required: ['text'],
  additionalProperties: false,
} as const;

/** Parse and strictly validate the provider response at the local boundary. */
export function parseTextOutput(
  responseText: string,
  diagnostics?: Pick<LLMProviderDiagnostics, 'finishReason' | 'resolvedProvider'>,
): string {
  const provider = diagnostics?.resolvedProvider ?? 'unknown';
  const truncated = diagnostics?.finishReason === 'length';

  if (responseText.trim().length === 0) {
    throw new LLMOutputError(
      provider,
      truncated ? 'Model output was truncated' : 'Model returned empty output',
      truncated ? 'OUTPUT_TRUNCATED' : 'EMPTY_MODEL_OUTPUT',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new LLMOutputError(
      provider,
      truncated ? 'Model output was truncated' : 'Model returned invalid JSON',
      truncated ? 'OUTPUT_TRUNCATED' : 'INVALID_JSON',
    );
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length !== 1 ||
    typeof (parsed as { text?: unknown }).text !== 'string' ||
    (parsed as { text: string }).text.trim().length === 0
  ) {
    throw new LLMOutputError(
      provider,
      truncated ? 'Model output was truncated' : 'LLM response does not match the output schema',
      truncated ? 'OUTPUT_TRUNCATED' : 'SCHEMA_MISMATCH',
    );
  }

  return (parsed as { text: string }).text;
}

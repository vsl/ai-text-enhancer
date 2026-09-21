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
export function parseTextOutput(responseText: string): string {
  const parsed: unknown = JSON.parse(responseText);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length !== 1 ||
    typeof (parsed as { text?: unknown }).text !== 'string' ||
    (parsed as { text: string }).text.trim().length === 0
  ) {
    throw new Error('LLM response is missing a string text field');
  }

  return (parsed as { text: string }).text;
}

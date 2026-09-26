import type { RejectionReason, TransformationOptions } from '../types/api.types.ts';

/** Check decoded output without silently repairing a model failure. */
export function checkOutput(options: TransformationOptions, text: string): RejectionReason[] {
  return options.avoidCommonAiSymbols === true && text.includes('\u2014') ? ['EM_DASH'] : [];
}

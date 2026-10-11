/** Evaluation policy, separate from production generation settings. */
export const EVALUATION_DEFAULTS = {
  suite: 'base' as const,
  tier: 'free' as const,
  repetitions: 3,
  concurrency: 1,
  smokeRepetitions: 1,
  smokeMaxTokens: 2_000,
  gates: { semanticMinimum: 0.6, aggregateTolerance: 0.02, sliceTolerance: 0.05 },
};

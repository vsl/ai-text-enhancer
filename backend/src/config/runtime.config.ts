/** Runtime policy. Environment overrides are parsed by loader.ts. */
export const RUNTIME_DEFAULTS = {
  timeoutMs: 30_000,
  maxBatchSize: 10,
  maxOutputTokens: 2_048,
  exposeErrorDetails: false,
  tier: 'free' as const,
  jev: { modelId: 'typesafe/jev-1.13', timeoutMs: 5_000 },
  tokenEstimate: { charactersPerToken: 4, overheadPerAssistant: 500 },
};

export const RUNTIME_BOUNDS = {
  timeoutMs: { min: 1_000, max: 300_000 },
  maxBatchSize: { min: 1, max: 100 },
};

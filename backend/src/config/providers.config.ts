/** Provider endpoints and attribution; credentials are supplied separately. */
export const PROVIDER_CONFIG = {
  openrouter: {
    chatUrl: 'https://openrouter.ai/api/v1/chat/completions',
    catalogUrl: 'https://openrouter.ai/api/v1/models',
    decisionsUrl: 'https://openrouter.ai/api/alpha/decisions',
    referer: 'https://github.com/vsl/ai-text-enhancer',
    title: 'AI Text Enhancer',
  },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models' },
  lmstudio: { baseUrl: 'http://localhost:1234', timeoutMs: 60_000 },
};

import { RUNTIME_DEFAULTS } from '../config/runtime.config.ts';
import { PROVIDER_CONFIG } from '../config/providers.config.ts';

export interface DecisionRequest {
  model: string;
  state: Record<string, unknown>;
  questions: Record<string,
    | { type: 'choice'; instructions: string; criteria: Record<string, string> }
    | { type: 'score'; instructions: string; criteria: string[] }
    | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } }
  >;
}
export interface DecisionConnector {
  decide(request: DecisionRequest): Promise<unknown>;
}

export class OpenRouterDecisionConnector implements DecisionConnector {
  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number = RUNTIME_DEFAULTS.jev.timeoutMs,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async decide(request: DecisionRequest): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let response: Response;
      try {
        response = await this.fetchFn(PROVIDER_CONFIG.openrouter.decisionsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': PROVIDER_CONFIG.openrouter.referer,
            'X-Title': PROVIDER_CONFIG.openrouter.title,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          throw new Error(`Jev request timed out after ${this.timeoutMs}ms`);
        }
        throw new Error('Jev request failed');
      }

      if (!response.ok) throw new Error(`Jev request failed with HTTP ${response.status}`);

      try {
        return JSON.parse(await response.text()) as unknown;
      } catch {
        throw new Error('Jev returned invalid JSON');
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

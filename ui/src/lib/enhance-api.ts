import { API_BASE_URL } from '@/config/runtime.config';
import type { AiConfig } from './types';
import type { BatchRequest, BatchResponse } from '../../../backend/src/types/api.types';

export class EnhancementApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(`Enhancement request failed with status ${status}`);
    this.name = 'EnhancementApiError';
  }
}

/** Translate UI options and handle HTTP; workflow state stays in WorkflowContext. */
export async function enhanceText(input: {
  configs: AiConfig[];
  userText: string;
  contextText: string;
  token: string;
  signal: AbortSignal;
}): Promise<BatchResponse> {
  const request: BatchRequest = {
    assistants: input.configs.map(config => {
      const { languageLevel, translateTo, ...options } = config.options;
      return {
        id: config.id.toString(),
        model: config.model,
        aiRoleId: config.aiRoleId,
        userText: input.userText,
        contextText: input.contextText,
        options: { ...options, languageLevel: languageLevel || 'default', ...(translateTo && { translateTo }) },
      };
    }),
  };
  const response = await fetch(`${API_BASE_URL}/enhance`, {
    method: 'POST',
    signal: input.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${input.token}` },
    body: JSON.stringify(request),
  });
  if (response.status === 401) throw new EnhancementApiError(401, 'AUTHENTICATION_FAILED');
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { code?: string } } | null;
    throw new EnhancementApiError(response.status, body?.error?.code || (response.status === 429 ? 'QUOTA_EXCEEDED' : ''));
  }
  return response.json() as Promise<BatchResponse>;
}

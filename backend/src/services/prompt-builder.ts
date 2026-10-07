/**
 * Prompt Builder Service
 * 
 * Constructs prompts from AssistantConfiguration by:
 * 1. Looking up the role's system prompt
 * 2. Keeping trusted transformations in the system prompt and source/context in user data
 * 3. Enforcing JSON response format
 * 
 * Platform-agnostic - no Deno or Node.js specific APIs.
 */

import { PromptTemplates, PROMPT_VERSION } from './prompt-templates.ts';
import type { 
  PromptBuildRequest, 
  ConstructedPrompt 
} from '../types/prompt.types.ts';
import { getRoleById } from '../config/roles.config.ts';
import type { RoleConfig } from '../types/config.types.ts';

export class PromptBuilder {
  /**
   * Build prompt from AssistantConfiguration
   * 
   * @param request - AssistantConfiguration from API request
   * @returns Constructed prompt with system, user, and combined prompts
   * @throws Error if role is not found or model not allowed for role
   */
  async buildPrompt(request: PromptBuildRequest): Promise<ConstructedPrompt> {
    // 1. Get role configuration
    const role = getRoleById(request.aiRoleId);
    
    if (!role) {
      throw new Error(`Unknown AI role: ${request.aiRoleId}`);
    }

    // 2. Validate model is allowed for this role
    if (!role.allowedModels.includes(request.model)) {
      throw new Error(
        `Model '${request.model}' is not allowed for role '${request.aiRoleId}'. ` +
        `Allowed models: ${role.allowedModels.join(', ')}`
      );
    }

    return constructPrompt(request, role);
  }
}

/** Composition shared with offline experiments; public model access stays above. */
export async function constructPrompt(
  request: Pick<PromptBuildRequest, 'aiRoleId' | 'userText' | 'contextText' | 'options'>,
  role: RoleConfig | null = getRoleById(request.aiRoleId),
): Promise<ConstructedPrompt> {
  if (!role) throw new Error(`Unknown AI role: ${request.aiRoleId}`);
  const systemPrompt = PromptTemplates.buildSystemPrompt(role.systemPrompt, request.options);
  return {
    systemPrompt,
    userPrompt: PromptTemplates.buildUserPrompt(request),
    promptRevision: buildPromptRevision(role.id, role.systemPromptVersion),
    promptFingerprint: await fingerprintPrompt(systemPrompt),
  };
}

export function buildPromptRevision(roleId: string, systemPromptVersion: string): string {
  return `${PROMPT_VERSION}/${roleId}@${systemPromptVersion}`;
}

export async function fingerprintPrompt(prompt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prompt));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

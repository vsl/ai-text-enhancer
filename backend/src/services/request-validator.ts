import {
  BOOLEAN_TRANSFORMATION_KEYS,
  FORMALITY_VALUES,
  LANGUAGE_LEVEL_VALUES,
  LANGUAGE_VALUES,
  TONE_VALUES,
  TRANSFORMATION_OPTION_KEYS,
} from '../config/transformation-options.config.ts';
import { getLimitsForTier } from '../config/tier-limits.config.ts';
import { getModelById } from '../config/models.config.ts';
import { getRoleById } from '../config/roles.config.ts';
import { InvalidRequestError } from '../errors/orchestration-errors.ts';
import type { BatchRequest, TransformationOptions } from '../types/api.types.ts';
import type { UserProfile } from '../types/auth.types.ts';

const REQUEST_KEYS = ['assistants'];
const ASSISTANT_KEYS = ['id', 'model', 'aiRoleId', 'userText', 'contextText', 'options'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new InvalidRequestError(message);
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) fail(`${path} contains unsupported field '${unknown}'`);
}

function requireNonblankString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${path} must be a nonblank string`);
  }
  return value;
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function validateOptions(value: unknown, path: string): TransformationOptions {
  if (!isRecord(value)) fail(`${path} must be an object`);
  rejectUnknownKeys(value, TRANSFORMATION_OPTION_KEYS, path);

  for (const key of BOOLEAN_TRANSFORMATION_KEYS) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      fail(`${path}.${key} must be a boolean`);
    }
  }

  if (value.formality !== undefined && !isOneOf(value.formality, FORMALITY_VALUES)) {
    fail(`${path}.formality is not supported`);
  }
  if (value.tone !== undefined && !isOneOf(value.tone, TONE_VALUES)) {
    fail(`${path}.tone is not supported`);
  }
  if (value.languageLevel !== undefined && !isOneOf(value.languageLevel, LANGUAGE_LEVEL_VALUES)) {
    fail(`${path}.languageLevel is not supported`);
  }
  if (value.translateTo !== undefined && !isOneOf(value.translateTo, LANGUAGE_VALUES)) {
    fail(`${path}.translateTo is not supported`);
  }
  if (value.shorten === true && value.lengthen === true) {
    fail(`${path} cannot enable shorten and lengthen together`);
  }

  return value as TransformationOptions;
}

export function validateBatchRequest(value: unknown, user: UserProfile): BatchRequest {
  if (!isRecord(value)) fail('Request body must be an object');
  rejectUnknownKeys(value, REQUEST_KEYS, 'Request body');
  if (!Array.isArray(value.assistants) || value.assistants.length === 0) {
    fail('assistants must be a nonempty array');
  }

  const limits = getLimitsForTier(user.tier);
  const ids = new Set<string>();
  const assistants = value.assistants.map((item, index) => {
    const path = `assistants[${index}]`;
    if (!isRecord(item)) fail(`${path} must be an object`);
    rejectUnknownKeys(item, ASSISTANT_KEYS, path);

    const id = requireNonblankString(item.id, `${path}.id`);
    if (ids.has(id)) fail('Assistant IDs must be unique');
    ids.add(id);

    const modelId = requireNonblankString(item.model, `${path}.model`);
    const roleId = requireNonblankString(item.aiRoleId, `${path}.aiRoleId`);
    const userText = requireNonblankString(item.userText, `${path}.userText`);
    const model = getModelById(modelId);
    const role = getRoleById(roleId);

    if (!model) fail(`${path}.model is not supported`);
    if (!role) fail(`${path}.aiRoleId is not supported`);
    if (!role.allowedModels.includes(modelId)) fail(`${path} uses an incompatible role and model`);
    if (userText.length > limits.maxUserTextLength) {
      fail(`${path}.userText exceeds the ${user.tier} tier limit of ${limits.maxUserTextLength} characters`);
    }
    if (item.contextText !== undefined && typeof item.contextText !== 'string') {
      fail(`${path}.contextText must be a string`);
    }
    if (typeof item.contextText === 'string' && item.contextText.length > limits.maxContextTextLength) {
      fail(`${path}.contextText exceeds the ${user.tier} tier limit of ${limits.maxContextTextLength} characters`);
    }

    return {
      id,
      model: modelId,
      aiRoleId: roleId,
      userText,
      ...(item.contextText !== undefined && { contextText: item.contextText }),
      options: validateOptions(item.options, `${path}.options`),
    };
  });

  return { assistants };
}

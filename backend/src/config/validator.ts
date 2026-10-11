import { RUNTIME_BOUNDS } from './runtime.config.ts';
/**
 * Configuration Validator
 * 
 * Validates the integrity and consistency of system configuration.
 * Ensures all models reference valid providers, roles reference valid models,
 * and all configuration values are within acceptable ranges.
 */

import type { SystemConfig } from '../types/config.types.ts';

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate complete system configuration
 * @param config - System configuration to validate
 * @throws Error if validation fails
 */
export function validateConfigDetailed(config: SystemConfig): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate models exist
  if (!config.models || config.models.length === 0) {
    errors.push({
      field: 'models',
      message: 'No models configured. At least one model is required.',
    });
  }

  // Validate roles exist
  if (!config.roles || config.roles.length === 0) {
    errors.push({
      field: 'roles',
      message: 'No roles configured. At least one role is required.',
    });
  }

  // Validate providers exist
  if (!config.llmProviders || config.llmProviders.length === 0) {
    errors.push({
      field: 'llmProviders',
      message: 'No LLM providers configured. At least one provider is required.',
    });
  }

  // Validate each role references valid models
  if (config.roles && config.models) {
    for (const role of config.roles) {
      for (const modelId of role.allowedModels) {
        const modelExists = config.models.some((m) => m.id === modelId);
        if (!modelExists) {
          errors.push({
            field: `roles.${role.id}.allowedModels`,
            message: `Role "${role.id}" references unknown model "${modelId}"`,
          });
        }
      }
    }
  }

  // Validate each model has a corresponding provider
  if (config.models && config.llmProviders) {
    const providerNames = new Set(config.llmProviders.map((p) => p.name));
    
    for (const model of config.models) {
      if (!providerNames.has(model.provider)) {
        errors.push({
          field: `models.${model.id}.provider`,
          message: `Model "${model.id}" references unknown provider "${model.provider}"`,
        });
      }
      if (model.structuredOutputMode !== 'json-schema' && model.structuredOutputMode !== 'json-object') {
        errors.push({
          field: `models.${model.id}.structuredOutputMode`,
          message: `Model "${model.id}" has unsupported structured output mode`,
        });
      }
    }
  }

  // Validate providers have API keys (except lmstudio)
  if (config.llmProviders) {
    for (const provider of config.llmProviders) {
      if (provider.name !== 'lmstudio' && !provider.apiKey) {
        errors.push({
          field: `llmProviders.${provider.name}.apiKey`,
          message: `Provider "${provider.name}" is missing required API key`,
        });
      }
    }
  }

  // Validate timeout value
  if (!Number.isSafeInteger(config.timeout) || config.timeout <= 0) {
    errors.push({
      field: 'timeout',
      message: `Timeout must be positive, got ${config.timeout}`,
    });
  }

  if (config.timeout < RUNTIME_BOUNDS.timeoutMs.min) {
    errors.push({
      field: 'timeout',
      message: `Timeout too low (${config.timeout}ms). Minimum recommended: 1000ms`,
    });
  }

  if (config.timeout > RUNTIME_BOUNDS.timeoutMs.max) {
    errors.push({
      field: 'timeout',
      message: `Timeout too high (${config.timeout}ms). Maximum recommended: 300000ms (5 minutes)`,
    });
  }

  // Validate max batch size
  if (!Number.isSafeInteger(config.maxBatchSize) || config.maxBatchSize <= 0) {
    errors.push({
      field: 'maxBatchSize',
      message: `Max batch size must be positive, got ${config.maxBatchSize}`,
    });
  }

  if (config.maxBatchSize > RUNTIME_BOUNDS.maxBatchSize.max) {
    errors.push({
      field: 'maxBatchSize',
      message: `Max batch size too high (${config.maxBatchSize}). Maximum recommended: 100`,
    });
  }

  if (!config.jev?.modelId) {
    errors.push({ field: 'jev.modelId', message: 'Jev model ID is required' });
  }
  if (!Number.isSafeInteger(config.jev?.timeoutMs) || config.jev.timeoutMs <= 0) {
    errors.push({ field: 'jev.timeoutMs', message: 'Jev timeout must be positive' });
  }

  // Validate Supabase configuration
  if (!config.supabase) {
    errors.push({
      field: 'supabase',
      message: 'Supabase configuration is missing',
    });
  } else {
    if (!config.supabase.url) {
      errors.push({
        field: 'supabase.url',
        message: 'Supabase URL is required',
      });
    } else {
      // Validate URL format
      try {
        new URL(config.supabase.url);
      } catch {
        errors.push({
          field: 'supabase.url',
          message: `Invalid Supabase URL: "${config.supabase.url}"`,
        });
      }
    }

    if (!config.supabase.serviceRoleKey) {
      errors.push({
        field: 'supabase.serviceRoleKey',
        message: 'Supabase service role key is required',
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Fail startup with a readable list of configuration problems. */
export function validateConfig(config: SystemConfig): void {
  const result = validateConfigDetailed(config);
  if (!result.valid) {
    const details = result.errors.map(error => `  - ${error.field}: ${error.message}`).join('\n');
    throw new Error(`Configuration validation failed:\n${details}`);
  }
}

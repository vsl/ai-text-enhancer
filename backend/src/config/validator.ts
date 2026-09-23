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
export function validateConfig(config: SystemConfig): void {
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
  if (config.timeout <= 0) {
    errors.push({
      field: 'timeout',
      message: `Timeout must be positive, got ${config.timeout}`,
    });
  }

  if (config.timeout < 1000) {
    errors.push({
      field: 'timeout',
      message: `Timeout too low (${config.timeout}ms). Minimum recommended: 1000ms`,
    });
  }

  if (config.timeout > 300000) {
    errors.push({
      field: 'timeout',
      message: `Timeout too high (${config.timeout}ms). Maximum recommended: 300000ms (5 minutes)`,
    });
  }

  // Validate max batch size
  if (config.maxBatchSize <= 0) {
    errors.push({
      field: 'maxBatchSize',
      message: `Max batch size must be positive, got ${config.maxBatchSize}`,
    });
  }

  if (config.maxBatchSize > 100) {
    errors.push({
      field: 'maxBatchSize',
      message: `Max batch size too high (${config.maxBatchSize}). Maximum recommended: 100`,
    });
  }

  if (!config.jev?.modelId) {
    errors.push({ field: 'jev.modelId', message: 'Jev model ID is required' });
  }
  if (!config.jev || config.jev.timeoutMs <= 0) {
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

  // Validate bootstrap secret
  if (!config.bootstrapSecretKey) {
    errors.push({
      field: 'bootstrapSecretKey',
      message: 'Bootstrap secret key is required',
    });
  }

  // Validate rate limits
  if (!config.rateLimits) {
    errors.push({
      field: 'rateLimits',
      message: 'Rate limits configuration is missing',
    });
  } else {
    const tiers = ['free', 'plus', 'premium'] as const;
    for (const tier of tiers) {
      const limits = config.rateLimits[tier];
      if (!limits) {
        errors.push({
          field: `rateLimits.${tier}`,
          message: `Rate limits for "${tier}" tier are missing`,
        });
      } else {
        if (limits.requestsPerDay <= 0) {
          errors.push({
            field: `rateLimits.${tier}.requestsPerDay`,
            message: `Requests per day must be positive for "${tier}" tier`,
          });
        }
        if (limits.requestsPerHour <= 0) {
          errors.push({
            field: `rateLimits.${tier}.requestsPerHour`,
            message: `Requests per hour must be positive for "${tier}" tier`,
          });
        }
        if (limits.requestsPerHour > limits.requestsPerDay) {
          errors.push({
            field: `rateLimits.${tier}`,
            message: `Requests per hour cannot exceed requests per day for "${tier}" tier`,
          });
        }
      }
    }
  }

  // If any errors, throw with detailed message
  if (errors.length > 0) {
    const errorMessages = errors.map((e) => `  - ${e.field}: ${e.message}`).join('\n');
    throw new Error(`Configuration validation failed:\n${errorMessages}`);
  }
}

/**
 * Validate configuration and return detailed result
 * @param config - System configuration to validate
 * @returns Validation result with errors
 */
export function validateConfigDetailed(config: SystemConfig): ValidationResult {
  try {
    validateConfig(config);
    return { valid: true, errors: [] };
  } catch (error) {
    // Parse error message to extract individual errors
    const message = error instanceof Error ? error.message : String(error);
    const errorLines = message.split('\n').slice(1); // Skip first line
    
    const errors: ValidationError[] = errorLines.map((line) => {
      const match = line.match(/^\s*-\s*([^:]+):\s*(.+)$/);
      if (match) {
        return { field: match[1], message: match[2] };
      }
      return { field: 'unknown', message: line.trim() };
    });

    return { valid: false, errors };
  }
}

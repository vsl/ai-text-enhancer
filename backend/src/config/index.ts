/**
 * Configuration Module
 * 
 * Public API for system configuration. Exports all configuration
 * loading, validation, and access functions.
 */

// Core functions
export { loadConfig, loadPaymentConfig, getEnvVar, hasRequiredEnvVars } from './loader.ts';
export { validateConfig, validateConfigDetailed } from './validator.ts';

// Configuration data
export { MODELS, getModelById, getModelsByProvider, getModelsByTier } from './models.config.ts';
export { ROLES, getRoleById, isModelAllowedForRole } from './roles.config.ts';
export { QUOTA_CONFIG, QUOTA_LIMITS } from './quota.config.ts';

// Types
export type * from '../types/config.types.ts';
export type { ValidationError, ValidationResult } from './validator.ts';

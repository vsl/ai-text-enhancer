import { booleanEnv, getEnvVar } from './environment.ts';

const DEFAULTS = {
  endpoint: 'https://api.smith.langchain.com',
  environment: 'local',
  release: 'local',
  deploymentId: 'local',
  logLevel: 'info',
};

export function loadTracingConfig() {
  const apiKey = getEnvVar('LANGSMITH_API_KEY');
  return {
    enabled: booleanEnv('LANGSMITH_TRACING', false) && Boolean(apiKey),
    captureContent: booleanEnv('LANGSMITH_CAPTURE_CONTENT', false),
    apiKey,
    endpoint: getEnvVar('LANGSMITH_ENDPOINT') || DEFAULTS.endpoint,
    project: getEnvVar('LANGSMITH_PROJECT'),
    environment: getEnvVar('APP_ENV') || DEFAULTS.environment,
    release: getEnvVar('APP_RELEASE') || DEFAULTS.release,
    deploymentId: getEnvVar('DENO_DEPLOYMENT_ID') || DEFAULTS.deploymentId,
    logLevel: (getEnvVar('LOG_LEVEL') || DEFAULTS.logLevel).toLowerCase(),
  };
}

/** Credentials to redact even when they appear in captured content. */
export function traceSecrets(): string[] {
  return ['OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'APP_SUPABASE_SERVICE_ROLE_KEY', 'LANGSMITH_API_KEY']
    .map(getEnvVar).filter((value): value is string => Boolean(value && value.length >= 8));
}

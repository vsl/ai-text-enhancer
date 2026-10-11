/** Only configuration modules should read process.env. */
export function getEnvVar(name: string): string | undefined {
  return process.env[name];
}

export function requiredEnv(name: string): string {
  const value = getEnvVar(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}. See .env.local.example.`);
  return value;
}

export function integerEnv(name: string, defaultValue: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  const raw = getEnvVar(name);
  if (raw === undefined || raw === '') return defaultValue;
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be a positive number between ${min} and ${max} (integer)`);
  }
  return value;
}

export function booleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = getEnvVar(name);
  if (raw === undefined || raw === '') return defaultValue;
  if (raw !== 'true' && raw !== 'false') throw new Error(`${name} must be true or false`);
  return raw === 'true';
}

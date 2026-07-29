/**
 * Type definitions for npm: imports (Deno-style)
 * Used for TypeScript type checking in Node.js environment
 */

// Supabase
declare module 'npm:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}

// Ajv (JSON schema validator)
declare module 'npm:ajv@8' {
  export { default } from 'ajv';
  export * from 'ajv';
}

// Jose (JWT library)
declare module 'npm:jose@5' {
  export * from 'jose';
}

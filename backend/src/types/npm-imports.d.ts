/**
 * Type declarations for npm: prefixed imports (Deno-style)
 * Maps Deno npm imports to standard npm packages for TypeScript type checking
 */

declare module 'npm:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}

declare module 'npm:ajv@8' {
  export * from 'ajv';
}

declare module 'npm:@google/generative-ai@0.21.0' {
  export * from '@google/generative-ai';
}

/**
 * Type definitions for npm: imports (Deno-style)
 * Used for TypeScript type checking in Node.js environment
 */

// Supabase
declare module 'npm:@supabase/supabase-js@2.76.1' {
  export * from '@supabase/supabase-js';
}

// LangSmith
declare module 'npm:langsmith@0.10.5' {
  export * from 'langsmith';
}

declare module 'npm:langsmith@0.10.5/traceable' {
  export * from 'langsmith/traceable';
}

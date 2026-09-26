import { registerHooks } from 'node:module';

// Resolve the Edge runtime's pinned LangSmith imports through the npm lockfile in Node.
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.replace(/^npm:langsmith@0\.10\.5(?=\/|$)/, 'langsmith'), context);
  },
});

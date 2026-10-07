import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

it('deploys only selected runtime secrets, not the evaluation keys in the local env file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'eval-env-test-'));
  try {
    writeFileSync(join(directory, '.env.local'), 'OPENROUTER_API_KEY=test-provider\nAPP_SUPABASE_SERVICE_ROLE_KEY=test-runtime\nBOOTSTRAP_SECRET_KEY=test-bootstrap\nJEV_TIMEOUT_MS=5000\nLANGSMITH_PROJECT=test-tracing\nLANGFUSE_SECRET_KEY=local-only-test\nSUPABASE_ACCESS_TOKEN=cli-only-test\n');
    writeFileSync(join(directory, 'supabase'), '#!/bin/bash\nif [ "$1" = status ]; then exit 0; fi\nprintf "%s\\n" "$@" >> calls.log\n', { mode: 0o755 });
    execFileSync('bash', [resolve('scripts/setup-env.sh')], { cwd: directory,
      env: { PATH: `${directory}:/usr/bin:/bin` }, stdio: 'pipe' });
    const calls = readFileSync(join(directory, 'calls.log'), 'utf8');
    expect(calls).toContain('OPENROUTER_API_KEY=test-provider');
    for (const key of ['APP_SUPABASE_SERVICE_ROLE_KEY=test-runtime', 'BOOTSTRAP_SECRET_KEY=test-bootstrap', 'JEV_TIMEOUT_MS=5000', 'LANGSMITH_PROJECT=test-tracing']) expect(calls).toContain(key);
    expect(calls).not.toContain('--env-file'); expect(calls).not.toContain('LANGFUSE');
    expect(calls).not.toContain('SUPABASE_ACCESS_TOKEN');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

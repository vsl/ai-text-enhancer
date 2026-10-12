import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const violations = [];

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else if (entry.name.endsWith('.ts')) {
      const lines = (await readFile(path, 'utf8')).split('\n');
      lines.forEach((line, index) => {
        if (/\bDeno\s*(?:\.|\[)/.test(line)) violations.push(`${relative(root, path)}:${index + 1}`);
      });
    }
  }
}

await inspect(root);
if (violations.length) {
  console.error(`Deno APIs belong in supabase/functions/, not src/:\n${violations.join('\n')}`);
  process.exitCode = 1;
} else console.log('Portable core verified: no Deno APIs in src/.');

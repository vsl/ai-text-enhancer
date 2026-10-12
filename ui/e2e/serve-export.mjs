import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

// Serve exported extensionless routes as Cloudflare Pages does, for browser tests.
const root = resolve('out');
const baseURL = new URL(process.env.E2E_BASE_URL || 'http://127.0.0.1:3000');
const contentTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, baseURL).pathname);
    const route = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = resolve(root, extname(route) ? route : `${route}.html`);
    if (!file.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(Number(baseURL.port || 3000), baseURL.hostname);

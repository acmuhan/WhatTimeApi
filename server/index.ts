import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTimeAggregatorService, TimeAggregatorService } from './time-service.js';

type AggregateService = Pick<TimeAggregatorService, 'getAggregate'>;

type ServerOptions = {
  service?: AggregateService;
  staticDir?: string;
};

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png'
};

export function createAppServer(options: ServerOptions = {}) {
  const service = options.service ?? createTimeAggregatorService();
  const staticDir = path.resolve(options.staticDir ?? process.env.STATIC_DIR ?? path.join(process.cwd(), 'dist/client'));

  return createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    setCorsHeaders(res);

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === '/api/time/aggregate' && method === 'GET') {
      try {
        const payload = await service.getAggregate();
        sendJson(res, 200, payload);
      } catch (error) {
        sendJson(res, 500, {
          error: error instanceof Error ? error.message : 'internal_error'
        });
      }
      return;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }

    await serveStatic(staticDir, url.pathname, res);
  });
}

async function serveStatic(staticDir: string, pathname: string, res: import('node:http').ServerResponse) {
  const normalizedPath = pathname === '/' ? '/index.html' : pathname;
  const requested = path.resolve(staticDir, `.${normalizedPath}`);

  if (!requested.startsWith(staticDir)) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }

  const target = existsSync(requested) ? requested : path.resolve(staticDir, 'index.html');

  if (!existsSync(target)) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }

  const ext = path.extname(target);
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
  const fileBuffer = await readFile(target);

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  res.end(fileBuffer);
}

function setCorsHeaders(res: import('node:http').ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res: import('node:http').ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function shouldStartServer() {
  const current = fileURLToPath(import.meta.url);
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return current === entry;
}

if (shouldStartServer()) {
  const port = Number(process.env.PORT ?? 9000);
  const host = '0.0.0.0';
  const server = createAppServer();

  server.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`[whattime] server started at http://${host}:${port}`);
  });
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../../server/index.js';
import type { AggregateResponse } from '../../server/types.js';

const samplePayload: AggregateResponse = {
  generatedAtMs: 1773552466000,
  cacheAgeMs: 0,
  sources: {
    taobao: {
      source: 'taobao',
      status: 'ok',
      serverTimeMs: 1773552465534,
      serverTimeISO: new Date(1773552465534).toISOString(),
      localDiffMs: 0,
      latencyMs: 32,
      fetchedAtMs: 1773552466000,
      staleFromLastSuccess: false,
      raw: {}
    },
    meituan: {
      source: 'meituan',
      status: 'ok',
      serverTimeMs: 1773552465321,
      serverTimeISO: new Date(1773552465321).toISOString(),
      localDiffMs: 0,
      latencyMs: 22,
      fetchedAtMs: 1773552466000,
      staleFromLastSuccess: false,
      raw: {}
    },
    suning: {
      source: 'suning',
      status: 'stale',
      serverTimeMs: 1773552465000,
      serverTimeISO: new Date(1773552465000).toISOString(),
      localDiffMs: -1000,
      latencyMs: 40,
      fetchedAtMs: 1773552466000,
      staleFromLastSuccess: true,
      raw: {},
      error: 'timeout'
    }
  }
};

describe('HTTP API', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'whattime-static-'));
  writeFileSync(path.join(tempDir, 'index.html'), '<!doctype html><title>ok</title>');

  const server = createAppServer({
    staticDir: tempDir,
    service: {
      getAggregate: async () => samplePayload
    }
  });

  let baseUrl = '';

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('server address unavailable');
    }

    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  });

  it('returns aggregate payload contract', async () => {
    const response = await fetch(`${baseUrl}/api/time/aggregate`);
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');

    const body = (await response.json()) as AggregateResponse;
    expect(body.generatedAtMs).toBeTypeOf('number');
    expect(body.sources.taobao.status).toBe('ok');
    expect(body.sources.suning.status).toBe('stale');
    expect(body.sources.suning.staleFromLastSuccess).toBe(true);
  });

  it('exposes health endpoint', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

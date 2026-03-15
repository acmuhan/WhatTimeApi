import { describe, expect, it } from 'vitest';
import { TimeAggregatorService } from '../../server/time-service.js';
import type { SourceKey } from '../../server/types.js';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function successPayload(source: SourceKey) {
  if (source === 'meituan') {
    return { data: 1773552465321, message: '成功', status: 0 };
  }
  if (source === 'taobao') {
    return { api: 'mtop.common.getTimestamp', data: { t: '1773552465534' } };
  }
  return { sysTime1: '20260315132745', sysTime2: '2026-03-15 13:27:45' };
}

describe('TimeAggregatorService', () => {
  it('uses cache within ttl and refreshes after ttl', async () => {
    let now = 1_000;
    let fetchCalls = 0;

    const service = new TimeAggregatorService({
      cacheTtlMs: 1000,
      requestTimeoutMs: 2000,
      now: () => now,
      fetchImpl: async (url) => {
        fetchCalls += 1;
        const source = sourceFromUrl(url.toString());
        return jsonResponse(successPayload(source));
      }
    });

    await service.getAggregate();
    expect(fetchCalls).toBe(3);

    now += 600;
    await service.getAggregate();
    expect(fetchCalls).toBe(3);

    now += 1200;
    await service.getAggregate();
    expect(fetchCalls).toBe(6);
  });

  it('marks stale when source fails after a success', async () => {
    let shouldFailMeituan = false;
    let now = 1_000;

    const service = new TimeAggregatorService({
      cacheTtlMs: 0,
      requestTimeoutMs: 2000,
      now: () => now,
      fetchImpl: async (url) => {
        const source = sourceFromUrl(url.toString());
        if (source === 'meituan' && shouldFailMeituan) {
          throw new Error('meituan timeout');
        }
        return jsonResponse(successPayload(source));
      }
    });

    const first = await service.getAggregate();
    expect(first.sources.meituan.status).toBe('ok');

    shouldFailMeituan = true;
    now += 5;

    const second = await service.getAggregate();
    expect(second.sources.meituan.status).toBe('stale');
    expect(second.sources.meituan.staleFromLastSuccess).toBe(true);
    expect(second.sources.meituan.serverTimeMs).toBe(first.sources.meituan.serverTimeMs);
    expect(second.sources.meituan.error).toContain('timeout');
  });

  it('returns error when a source fails before first success', async () => {
    const service = new TimeAggregatorService({
      cacheTtlMs: 0,
      requestTimeoutMs: 2000,
      fetchImpl: async (url) => {
        const source = sourceFromUrl(url.toString());
        if (source === 'taobao') {
          throw new Error('taobao down');
        }
        return jsonResponse(successPayload(source));
      }
    });

    const result = await service.getAggregate();
    expect(result.sources.taobao.status).toBe('error');
    expect(result.sources.taobao.serverTimeMs).toBeNull();
    expect(result.sources.taobao.error).toContain('down');
  });

  it('deduplicates in-flight refresh requests', async () => {
    let gateResolve: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      gateResolve = resolve;
    });

    let fetchCalls = 0;

    const service = new TimeAggregatorService({
      cacheTtlMs: 0,
      requestTimeoutMs: 2000,
      fetchImpl: async (url) => {
        fetchCalls += 1;
        await gate;
        const source = sourceFromUrl(url.toString());
        return jsonResponse(successPayload(source));
      }
    });

    const first = service.getAggregate();
    const second = service.getAggregate();

    expect(fetchCalls).toBe(3);

    gateResolve?.();
    await Promise.all([first, second]);
    expect(fetchCalls).toBe(3);
  });
});

function sourceFromUrl(url: string): SourceKey {
  if (url.includes('taobao')) {
    return 'taobao';
  }
  if (url.includes('meituan')) {
    return 'meituan';
  }
  return 'suning';
}

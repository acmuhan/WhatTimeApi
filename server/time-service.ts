import { PARSERS, formatServerIso } from './parsers.js';
import { SOURCE_URLS } from './source-urls.js';
import type { AggregateResponse, SourceKey, TimeSourceData } from './types.js';

const SOURCE_ORDER: SourceKey[] = ['taobao', 'meituan', 'suning'];

type FetchImpl = typeof fetch;

type TimeServiceOptions = {
  cacheTtlMs?: number;
  requestTimeoutMs?: number;
  fetchImpl?: FetchImpl;
  now?: () => number;
};

export class TimeAggregatorService {
  private readonly cacheTtlMs: number;
  private readonly requestTimeoutMs: number;
  private readonly fetchImpl: FetchImpl;
  private readonly now: () => number;

  private cachePayload: AggregateResponse | null = null;
  private inFlight: Promise<AggregateResponse> | null = null;
  private lastSuccessMap: Partial<Record<SourceKey, TimeSourceData>> = {};

  constructor(options: TimeServiceOptions = {}) {
    this.cacheTtlMs = options.cacheTtlMs ?? Number(process.env.TIME_CACHE_TTL_MS ?? 1000);
    this.requestTimeoutMs = options.requestTimeoutMs ?? Number(process.env.TIME_REQUEST_TIMEOUT_MS ?? 1200);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
  }

  async getAggregate(): Promise<AggregateResponse> {
    const nowMs = this.now();

    if (this.cachePayload && nowMs - this.cachePayload.generatedAtMs <= this.cacheTtlMs) {
      return this.withCacheAge(this.cachePayload, nowMs);
    }

    if (this.inFlight) {
      const payload = await this.inFlight;
      return this.withCacheAge(payload, this.now());
    }

    this.inFlight = this.refreshPayload();

    try {
      const payload = await this.inFlight;
      this.cachePayload = payload;
      return this.withCacheAge(payload, this.now());
    } finally {
      this.inFlight = null;
    }
  }

  private withCacheAge(payload: AggregateResponse, nowMs: number): AggregateResponse {
    return {
      ...payload,
      cacheAgeMs: Math.max(0, nowMs - payload.generatedAtMs)
    };
  }

  private async refreshPayload(): Promise<AggregateResponse> {
    const [taobao, meituan, suning] = await Promise.all([
      this.fetchSource('taobao'),
      this.fetchSource('meituan'),
      this.fetchSource('suning')
    ]);

    return {
      generatedAtMs: this.now(),
      cacheAgeMs: 0,
      sources: {
        taobao,
        meituan,
        suning
      }
    };
  }

  private async fetchSource(source: SourceKey): Promise<TimeSourceData> {
    const startedAt = this.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      let response: Response;
      try {
        response = await this.fetchImpl(SOURCE_URLS[source], {
          method: 'GET',
          headers: {
            Accept: 'application/json'
          },
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const raw = await response.json();
      const fetchedAtMs = this.now();
      const serverTimeMs = PARSERS[source](raw);
      const latencyMs = Math.max(0, fetchedAtMs - startedAt);

      const result: TimeSourceData = {
        source,
        status: 'ok',
        serverTimeMs,
        serverTimeISO: formatServerIso(serverTimeMs),
        localDiffMs: serverTimeMs - fetchedAtMs,
        latencyMs,
        fetchedAtMs,
        raw,
        staleFromLastSuccess: false
      };

      this.lastSuccessMap[source] = result;
      return result;
    } catch (error) {
      const failedAt = this.now();
      const latencyMs = Math.max(0, failedAt - startedAt);
      const message = toErrorMessage(error);
      const prev = this.lastSuccessMap[source];

      if (prev) {
        return {
          ...prev,
          status: 'stale',
          staleFromLastSuccess: true,
          error: message,
          latencyMs,
          fetchedAtMs: failedAt
        };
      }

      return {
        source,
        status: 'error',
        serverTimeMs: null,
        serverTimeISO: null,
        localDiffMs: null,
        latencyMs,
        fetchedAtMs: failedAt,
        raw: null,
        error: message,
        staleFromLastSuccess: false
      };
    }
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return '未知错误';
}

export function createTimeAggregatorService(options: TimeServiceOptions = {}): TimeAggregatorService {
  return new TimeAggregatorService(options);
}

export const DEFAULT_SOURCE_ORDER = SOURCE_ORDER;

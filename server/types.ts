export type SourceKey = 'taobao' | 'meituan' | 'suning';
export type SourceStatus = 'ok' | 'stale' | 'error';

export interface TimeSourceData {
  source: SourceKey;
  status: SourceStatus;
  serverTimeMs: number | null;
  serverTimeISO: string | null;
  localDiffMs: number | null;
  latencyMs: number | null;
  fetchedAtMs: number;
  raw: unknown;
  error?: string;
  staleFromLastSuccess: boolean;
}

export interface AggregateResponse {
  generatedAtMs: number;
  cacheAgeMs: number;
  sources: Record<SourceKey, TimeSourceData>;
}

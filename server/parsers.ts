function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') {
    throw new Error('响应不是对象');
  }
  return input as Record<string, unknown>;
}

function toFiniteNumber(value: unknown, label: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`${label} 不是有效数字`);
  }
  return Math.trunc(num);
}

function toIsoString(ms: number): string {
  return new Date(ms).toISOString();
}

export function parseMeituan(raw: unknown): number {
  const record = asRecord(raw);
  return toFiniteNumber(record.data, '美团 data');
}

export function parseTaobao(raw: unknown): number {
  const record = asRecord(raw);
  const data = asRecord(record.data);
  return toFiniteNumber(data.t, '淘宝 data.t');
}

export function parseSuningSysTime1(sysTime1: string): number {
  if (!/^\d{14}$/.test(sysTime1)) {
    throw new Error('苏宁 sysTime1 格式错误');
  }

  const year = Number(sysTime1.slice(0, 4));
  const month = Number(sysTime1.slice(4, 6)) - 1;
  const day = Number(sysTime1.slice(6, 8));
  const hour = Number(sysTime1.slice(8, 10));
  const minute = Number(sysTime1.slice(10, 12));
  const second = Number(sysTime1.slice(12, 14));

  return Date.UTC(year, month, day, hour - 8, minute, second);
}

export function parseSuningSysTime2(sysTime2: string): number {
  const normalized = sysTime2.replace(' ', 'T');
  const parsed = Date.parse(`${normalized}+08:00`);
  if (!Number.isFinite(parsed)) {
    throw new Error('苏宁 sysTime2 格式错误');
  }
  return parsed;
}

export function parseSuning(raw: unknown): number {
  const record = asRecord(raw);

  if (typeof record.sysTime1 === 'string') {
    return parseSuningSysTime1(record.sysTime1);
  }

  if (typeof record.sysTime2 === 'string') {
    return parseSuningSysTime2(record.sysTime2);
  }

  throw new Error('苏宁时间字段缺失');
}

export const PARSERS = {
  meituan: parseMeituan,
  taobao: parseTaobao,
  suning: parseSuning
} as const;

export function formatServerIso(serverTimeMs: number): string {
  return toIsoString(serverTimeMs);
}

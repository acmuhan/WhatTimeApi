const SOURCE_URLS = {
  taobao: 'https://acs.m.taobao.com/gw/mtop.common.getTimestamp/',
  meituan: 'https://cube.meituan.com/ipromotion/cube/toc/component/base/getServerCurrentTime',
  suning: 'http://quan.suning.com/getSysTime.do'
};

const CACHE_TTL_MS = readEnvNumber('TIME_CACHE_TTL_MS', 1000);
const REQUEST_TIMEOUT_MS = readEnvNumber('TIME_REQUEST_TIMEOUT_MS', 1200);

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type, authorization'
};

/** @type {null | { generatedAtMs:number, cacheAgeMs:number, sources: Record<string, any> }} */
let aggregateCache = null;
/** @type {null | Promise<any>} */
let inFlight = null;
/** @type {Partial<Record<'taobao'|'meituan'|'suning', any>>} */
let lastSuccessMap = {};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    if (url.pathname === '/api/time/aggregate' && request.method === 'GET') {
      try {
        const payload = await getAggregate();
        return json(payload, 200);
      } catch (error) {
        return json({ error: toErrorMessage(error) }, 500);
      }
    }

    return fetch(request);
  }
};

async function getAggregate() {
  const nowMs = Date.now();

  if (aggregateCache && nowMs - aggregateCache.generatedAtMs <= CACHE_TTL_MS) {
    return withCacheAge(aggregateCache, nowMs);
  }

  if (inFlight) {
    const payload = await inFlight;
    return withCacheAge(payload, Date.now());
  }

  inFlight = refreshAggregate();

  try {
    const payload = await inFlight;
    aggregateCache = payload;
    return withCacheAge(payload, Date.now());
  } finally {
    inFlight = null;
  }
}

async function refreshAggregate() {
  const [taobao, meituan, suning] = await Promise.all([
    fetchSource('taobao'),
    fetchSource('meituan'),
    fetchSource('suning')
  ]);

  return {
    generatedAtMs: Date.now(),
    cacheAgeMs: 0,
    sources: {
      taobao,
      meituan,
      suning
    }
  };
}

async function fetchSource(source) {
  const startedAt = Date.now();

  try {
    const raw = await requestJson(SOURCE_URLS[source], REQUEST_TIMEOUT_MS);
    const fetchedAtMs = Date.now();
    const serverTimeMs = parseBySource(source, raw);

    const result = {
      source,
      status: 'ok',
      serverTimeMs,
      serverTimeISO: new Date(serverTimeMs).toISOString(),
      localDiffMs: serverTimeMs - fetchedAtMs,
      latencyMs: Math.max(0, fetchedAtMs - startedAt),
      fetchedAtMs,
      raw,
      staleFromLastSuccess: false
    };

    lastSuccessMap[source] = result;
    return result;
  } catch (error) {
    const failedAt = Date.now();
    const prev = lastSuccessMap[source];
    const errorMessage = toErrorMessage(error);

    if (prev) {
      return {
        ...prev,
        status: 'stale',
        staleFromLastSuccess: true,
        error: errorMessage,
        latencyMs: Math.max(0, failedAt - startedAt),
        fetchedAtMs: failedAt
      };
    }

    return {
      source,
      status: 'error',
      serverTimeMs: null,
      serverTimeISO: null,
      localDiffMs: null,
      latencyMs: Math.max(0, failedAt - startedAt),
      fetchedAtMs: failedAt,
      raw: null,
      error: errorMessage,
      staleFromLastSuccess: false
    };
  }
}

function parseBySource(source, raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('response is not an object');
  }

  if (source === 'meituan') {
    const ms = Number(raw.data);
    if (!Number.isFinite(ms)) {
      throw new Error('invalid meituan data');
    }
    return Math.trunc(ms);
  }

  if (source === 'taobao') {
    const ms = Number(raw.data && raw.data.t);
    if (!Number.isFinite(ms)) {
      throw new Error('invalid taobao data.t');
    }
    return Math.trunc(ms);
  }

  if (typeof raw.sysTime1 === 'string' && /^\d{14}$/.test(raw.sysTime1)) {
    const s = raw.sysTime1;
    const year = Number(s.slice(0, 4));
    const month = Number(s.slice(4, 6)) - 1;
    const day = Number(s.slice(6, 8));
    const hour = Number(s.slice(8, 10));
    const minute = Number(s.slice(10, 12));
    const second = Number(s.slice(12, 14));
    return Date.UTC(year, month, day, hour - 8, minute, second);
  }

  if (typeof raw.sysTime2 === 'string') {
    const normalized = raw.sysTime2.replace(' ', 'T');
    const parsed = Date.parse(`${normalized}+08:00`);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error('invalid suning sysTime');
}

async function requestJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function withCacheAge(payload, nowMs) {
  return {
    ...payload,
    cacheAgeMs: Math.max(0, nowMs - payload.generatedAtMs)
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'unknown_error';
}

function readEnvNumber(name, fallbackValue) {
  try {
    if (typeof process !== 'undefined' && process && process.env && process.env[name]) {
      const value = Number(process.env[name]);
      if (Number.isFinite(value)) {
        return value;
      }
    }
  } catch (_e) {
    // ignore
  }

  return fallbackValue;
}
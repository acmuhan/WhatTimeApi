import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAggregate = vi.fn();

vi.mock('../../server/time-service', () => ({
  createTimeAggregatorService: () => ({
    getAggregate
  })
}));

type ResponseRecorder = {
  headers: Record<string, string>;
  statusCode: number | null;
  jsonBody: unknown;
  ended: boolean;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    end: () => void;
    json: (payload: unknown) => void;
  };
};

function createResponseRecorder(): ResponseRecorder {
  return {
    headers: {},
    statusCode: null,
    jsonBody: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return {
        end: () => {
          this.ended = true;
        },
        json: (payload) => {
          this.jsonBody = payload;
        }
      };
    }
  };
}

describe('vercel aggregate handler', () => {
  beforeEach(() => {
    getAggregate.mockReset();
  });

  it('adds CORS headers to GET responses', async () => {
    const handlerModule = await import('../../api/time/aggregate');
    const handler = handlerModule.default;
    const response = createResponseRecorder();
    const payload = { generatedAtMs: 1, cacheAgeMs: 0, sources: {} };
    getAggregate.mockResolvedValue(payload);

    await handler({ method: 'GET' }, response);

    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers['Access-Control-Allow-Methods']).toBe('GET,OPTIONS');
    expect(response.headers['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization');
    expect(response.jsonBody).toEqual(payload);
  });

  it('handles OPTIONS preflight with CORS headers', async () => {
    const handlerModule = await import('../../api/time/aggregate');
    const handler = handlerModule.default;
    const response = createResponseRecorder();

    await handler({ method: 'OPTIONS' }, response);

    expect(response.statusCode).toBe(204);
    expect(response.ended).toBe(true);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});

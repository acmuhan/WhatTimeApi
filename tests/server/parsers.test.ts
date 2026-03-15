import { describe, expect, it } from 'vitest';
import {
  parseMeituan,
  parseSuning,
  parseSuningSysTime1,
  parseSuningSysTime2,
  parseTaobao
} from '../../server/parsers.js';

describe('parsers', () => {
  it('parses meituan data field as milliseconds', () => {
    const ms = parseMeituan({ data: 1773552465321 });
    expect(ms).toBe(1773552465321);
  });

  it('parses taobao data.t as milliseconds', () => {
    const ms = parseTaobao({ data: { t: '1773552465534' } });
    expect(ms).toBe(1773552465534);
  });

  it('parses suning sysTime1 first', () => {
    const ms = parseSuning({ sysTime1: '20260315132745', sysTime2: '2026-03-15 13:27:45' });
    expect(ms).toBe(parseSuningSysTime1('20260315132745'));
  });

  it('falls back to suning sysTime2', () => {
    const ms = parseSuning({ sysTime2: '2026-03-15 13:27:45' });
    expect(ms).toBe(parseSuningSysTime2('2026-03-15 13:27:45'));
  });

  it('throws when response shape is invalid', () => {
    expect(() => parseMeituan({ foo: 1 })).toThrow();
    expect(() => parseTaobao({ data: {} })).toThrow();
    expect(() => parseSuning({})).toThrow();
  });

  it('throws on invalid suning sysTime1 format', () => {
    expect(() => parseSuningSysTime1('20260315')).toThrow();
  });

  it('throws on invalid suning sysTime2 format', () => {
    expect(() => parseSuningSysTime2('not-a-date')).toThrow();
  });
});

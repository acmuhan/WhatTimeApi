// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import App from '../../src/App.vue';
import type { AggregateResponse, SourceStatus } from '../../src/types';

function createPayload(options?: {
  taobaoLatency?: number;
  meituanLatency?: number;
  suningLatency?: number;
  taobaoStatus?: SourceStatus;
  meituanStatus?: SourceStatus;
  suningStatus?: SourceStatus;
}): AggregateResponse {
  const now = Date.now();

  return {
    generatedAtMs: now,
    cacheAgeMs: 0,
    sources: {
      taobao: {
        source: 'taobao',
        status: options?.taobaoStatus ?? 'ok',
        serverTimeMs: now + 20,
        serverTimeISO: new Date(now + 20).toISOString(),
        localDiffMs: 20,
        latencyMs: options?.taobaoLatency ?? 140,
        fetchedAtMs: now,
        raw: {},
        staleFromLastSuccess: false
      },
      meituan: {
        source: 'meituan',
        status: options?.meituanStatus ?? 'ok',
        serverTimeMs: now + 10,
        serverTimeISO: new Date(now + 10).toISOString(),
        localDiffMs: 10,
        latencyMs: options?.meituanLatency ?? 40,
        fetchedAtMs: now,
        raw: {},
        staleFromLastSuccess: false
      },
      suning: {
        source: 'suning',
        status: options?.suningStatus ?? 'ok',
        serverTimeMs: now + 30,
        serverTimeISO: new Date(now + 30).toISOString(),
        localDiffMs: 30,
        latencyMs: options?.suningLatency ?? 90,
        fetchedAtMs: now,
        raw: {},
        staleFromLastSuccess: false
      }
    }
  };
}

describe('App dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T13:27:45.000+08:00'));
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps fixed source card order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(createPayload()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await settleUi();

    const titles = wrapper.findAll('[data-testid="source-title"]').map((node) => node.text());
    expect(titles).toEqual(['Taobao', 'Meituan', 'Suning']);
  });

  it('supports manual calibration button', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(createPayload()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await settleUi();

    const before = fetchMock.mock.calls.length;
    await wrapper.get('[data-testid="manual-calibrate"]').trigger('click');
    await settleUi();

    expect(fetchMock.mock.calls.length).toBe(before + 1);
  });

  it('sorts latency ranking ascending', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(createPayload({ taobaoLatency: 180, meituanLatency: 35, suningLatency: 100 })), {
          status: 200
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await settleUi();

    const ranking = wrapper.findAll('[data-testid="latency-item"]').map((node) => node.text());
    expect(ranking[0]).toContain('Meituan');
    expect(ranking[1]).toContain('Suning');
    expect(ranking[2]).toContain('Taobao');
  });

  it('runs auto calibration every 10 seconds and can be disabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(createPayload()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await settleUi();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    await settleUi();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await wrapper.get('[data-testid="auto-calibration-toggle"]').trigger('click');
    await nextTick();

    await vi.advanceTimersByTimeAsync(20_000);
    await settleUi();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('supports custom interval and enforces min 10s', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(createPayload()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await settleUi();

    await wrapper.get('[data-testid="interval-dec"]').trigger('click');
    await settleUi();
    expect(wrapper.get('[data-testid="interval-value"]').text()).toBe('10s');

    await wrapper.get('[data-testid="preset-15"]').trigger('click');
    await settleUi();
    expect(wrapper.get('[data-testid="interval-value"]').text()).toBe('15s');

    await vi.advanceTimersByTimeAsync(10_000);
    await settleUi();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    await settleUi();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('can filter by stale group', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify(
            createPayload({
              taobaoStatus: 'ok',
              meituanStatus: 'stale',
              suningStatus: 'error'
            })
          ),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await settleUi();

    await wrapper.get('[data-testid="filter-stale"]').trigger('click');
    await settleUi();

    const titles = wrapper.findAll('[data-testid="source-title"]').map((node) => node.text());
    expect(titles).toEqual(['Meituan']);
  });

  it('keeps clock moving locally between calibrations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(createPayload()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await settleUi();

    const firstPrimary = wrapper.get('[data-testid="main-clock-primary"]').text();

    await vi.advanceTimersByTimeAsync(1_500);
    await settleUi();

    const secondPrimary = wrapper.get('[data-testid="main-clock-primary"]').text();
    expect(secondPrimary).not.toBe(firstPrimary);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('supports switching main clock source', async () => {
    const payload = createPayload();
    const now = Date.now();
    payload.sources.taobao.serverTimeMs = now + 1_200;
    payload.sources.taobao.serverTimeISO = new Date(now + 1_200).toISOString();
    payload.sources.meituan.serverTimeMs = now + 100;
    payload.sources.meituan.serverTimeISO = new Date(now + 100).toISOString();
    payload.sources.suning.serverTimeMs = now + 2_300;
    payload.sources.suning.serverTimeISO = new Date(now + 2_300).toISOString();

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(App);
    await settleUi();

    const defaultPrimary = wrapper.get('[data-testid="main-clock-primary"]').text();

    await wrapper.get('[data-testid="clock-source-meituan"]').trigger('click');
    await settleUi();
    const meituanPrimary = wrapper.get('[data-testid="main-clock-primary"]').text();

    await wrapper.get('[data-testid="clock-source-reference"]').trigger('click');
    await settleUi();
    const restoredPrimary = wrapper.get('[data-testid="main-clock-primary"]').text();

    expect(meituanPrimary).not.toBe(defaultPrimary);
    expect(restoredPrimary).toBe(defaultPrimary);
  });

  it('recalibrates when tab becomes visible', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(createPayload()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    mount(App);
    await settleUi();

    document.dispatchEvent(new Event('visibilitychange'));
    await settleUi();

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

async function settleUi() {
  await flushPromises();
  await nextTick();
}

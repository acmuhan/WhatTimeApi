import type { SourceKey } from '../types';

export const TAOBAO_ICON = new URL('../../icons/tb.ico', import.meta.url).href;
export const MEITUAN_ICON = new URL('../../icons/favicon-mt.ico', import.meta.url).href;
export const SUNING_ICON = new URL('../../icons/suning.ico', import.meta.url).href;

export const SOURCE_ORDER: SourceKey[] = ['taobao', 'meituan', 'suning'];
export const SOURCE_META: Record<SourceKey, { label: string; icon: string }> = {
  taobao: { label: '淘宝', icon: TAOBAO_ICON },
  meituan: { label: '美团', icon: MEITUAN_ICON },
  suning: { label: '苏宁', icon: SUNING_ICON }
};

export const DISPLAY_TICK_MS = 100;
export const MAX_ERROR_LOGS = 12;
export const MIN_INTERVAL_SEC = 10;
export const MAX_INTERVAL_SEC = 120;
export const INTERVAL_STEP_SEC = 5;
export const INTERVAL_PRESETS = [10, 15, 20, 30, 60] as const;
export const MILLISECOND_DIGIT_OPTIONS = [1, 2, 3] as const;

export const CALIBRATION_CONFIG = {
  driftThresholdMs: 120,
  smoothDurationMs: 700
};

export type MainClockSource = 'reference' | SourceKey;
export type GroupFilter = 'all' | 'ok' | 'stale' | 'error';

export const MAIN_CLOCK_SOURCE_OPTIONS: ReadonlyArray<{ key: MainClockSource; label: string }> = [
  { key: 'reference', label: '中位数' },
  { key: 'taobao', label: '淘宝' },
  { key: 'meituan', label: '美团' },
  { key: 'suning', label: '苏宁' }
];

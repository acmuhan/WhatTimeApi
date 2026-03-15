<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  calibrateBaseline,
  estimateServerMs,
  getPerfNow,
  isSmoothActive,
  type ClockBaseline
} from './clock-engine';
import type { AggregateResponse, SourceKey, SourceStatus, TimeSourceData } from './types';

const TAOBAO_ICON = new URL('../icons/tb.ico', import.meta.url).href;
const MEITUAN_ICON = new URL('../icons/favicon-mt.ico', import.meta.url).href;
const SUNING_ICON = new URL('../icons/suning.ico', import.meta.url).href;

const SOURCE_ORDER: SourceKey[] = ['taobao', 'meituan', 'suning'];
const SOURCE_META: Record<SourceKey, { label: string; icon: string }> = {
  taobao: { label: '淘宝', icon: TAOBAO_ICON },
  meituan: { label: '美团', icon: MEITUAN_ICON },
  suning: { label: '苏宁', icon: SUNING_ICON }
};

const DISPLAY_TICK_MS = 100;
const MAX_ERROR_LOGS = 12;
const MIN_INTERVAL_SEC = 10;
const MAX_INTERVAL_SEC = 120;
const INTERVAL_STEP_SEC = 5;
const INTERVAL_PRESETS = [10, 15, 20, 30, 60] as const;
const CALIBRATION_CONFIG = {
  driftThresholdMs: 120,
  smoothDurationMs: 700
};

type GroupFilter = 'all' | SourceStatus;
type GroupKey = SourceStatus;
type MainClockSource = 'reference' | SourceKey;
type DocumentPictureInPictureApi = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};
type SourceCard = {
  sourceKey: SourceKey;
  label: string;
  icon: string;
  source: TimeSourceData | null;
  baseline: ClockBaseline | null;
  estimatedMs: number | null;
  offsetMs: number | null;
  status: SourceStatus;
};

const aggregate = ref<AggregateResponse | null>(null);
const loading = ref(false);
const autoCalibration = ref(true);
const showMilliseconds = ref(true);
const millisecondDigits = ref(1);
const mobileSettingsExpanded = ref(false);
const calibrationIntervalSec = ref<number>(10);
const groupFilter = ref<GroupFilter>('all');
const mainClockSource = ref<MainClockSource>('meituan');
const pipSupported = ref(false);
const pipActive = ref(false);
const recentErrors = ref<string[]>([]);
const renderPerfNow = ref(getPerfNow());
const calibrationAtMs = ref<number | null>(null);
const clockBaselines = ref<Record<SourceKey, ClockBaseline | null>>(createEmptyBaselines());

let displayTimer: number | null = null;
let autoCalibrationTimer: number | null = null;
let inFlightCalibration: Promise<void> | null = null;
let pipClockTimer: number | null = null;
let pipClockWindow: Window | null = null;
let pipResizeHandler: ((() => void) | null) = null;

const calibrationIntervalMs = computed(() => calibrationIntervalSec.value * 1000);
const MILLISECOND_DIGIT_OPTIONS = [1, 2, 3] as const;
const MAIN_CLOCK_SOURCE_OPTIONS: ReadonlyArray<{ key: MainClockSource; label: string }> = [
  { key: 'reference', label: '中位数' },
  { key: 'taobao', label: '淘宝' },
  { key: 'meituan', label: '美团' },
  { key: 'suning', label: '苏宁' }
];

const sourceCards = computed<SourceCard[]>(() => {
  return SOURCE_ORDER.map((sourceKey) => {
    const source = aggregate.value?.sources[sourceKey] ?? null;
    const baseline = clockBaselines.value[sourceKey];

    const estimatedMs = baseline
      ? estimateServerMs(baseline, renderPerfNow.value)
      : (source?.serverTimeMs ?? null);

    const offsetMs = estimatedMs === null ? null : Math.trunc(estimatedMs - Date.now());

    return {
      sourceKey,
      label: SOURCE_META[sourceKey].label,
      icon: SOURCE_META[sourceKey].icon,
      source,
      baseline,
      estimatedMs,
      offsetMs,
      status: source?.status ?? 'error'
    };
  });
});

const groupedCards = computed<Record<SourceStatus, SourceCard[]>>(() => {
  const groups: Record<SourceStatus, SourceCard[]> = {
    ok: [],
    stale: [],
    error: []
  };

  for (const card of sourceCards.value) {
    groups[card.status].push(card);
  }

  return groups;
});

const visibleGroups = computed(() => {
  const allGroups = [
    { key: 'ok' as GroupKey, title: '正常数据源', cards: groupedCards.value.ok },
    { key: 'stale' as GroupKey, title: '备用数据源', cards: groupedCards.value.stale },
    { key: 'error' as GroupKey, title: '错误数据源', cards: groupedCards.value.error }
  ];

  if (groupFilter.value === 'all') {
    return allGroups;
  }

  return allGroups.filter((group) => group.key === groupFilter.value);
});

const summaryStats = computed(() => {
  const sources = sourceCards.value.filter((item) => item.source !== null);
  const okCount = groupedCards.value.ok.length;
  const staleCount = groupedCards.value.stale.length;
  const errorCount = groupedCards.value.error.length;

  let latencyTotal = 0;
  let latencyCount = 0;

  for (const item of sources) {
    if (item.source?.latencyMs !== null && item.source?.latencyMs !== undefined) {
      latencyTotal += item.source.latencyMs;
      latencyCount += 1;
    }
  }

  return {
    okCount,
    staleCount,
    errorCount,
    avgLatency: latencyCount > 0 ? Math.round(latencyTotal / latencyCount) : null
  };
});

const referenceTimeMs = computed(() => {
  const values = sourceCards.value
    .map((item) => item.estimatedMs)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return null;
  }

  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) {
    return values[mid];
  }

  return Math.round((values[mid - 1] + values[mid]) / 2);
});

const referenceOffsetMs = computed(() => {
  if (referenceTimeMs.value === null) {
    return null;
  }

  return Math.trunc(referenceTimeMs.value - Date.now());
});

const mainClockState = computed(() => {
  if (mainClockSource.value === 'reference') {
    return {
      ms: referenceTimeMs.value,
      offsetMs: referenceOffsetMs.value
    };
  }

  const selected = sourceCards.value.find((item) => item.sourceKey === mainClockSource.value) ?? null;
  return {
    ms: selected?.estimatedMs ?? null,
    offsetMs: selected?.offsetMs ?? null
  };
});

const clockPrimaryParts = computed(() => formatClockPrimaryParts(mainClockState.value.ms));

const clockSecondary = computed(() => {
  if (mainClockState.value.ms === null) {
    return null;
  }

  return {
    millis: formatMillis(mainClockState.value.ms),
    offset: formatSignedMs(mainClockState.value.offsetMs)
  };
});

const calibrationMode = computed<'calibrating' | 'smooth' | 'locked'>(() => {
  if (loading.value) {
    return 'calibrating';
  }

  const hasSmoothing = sourceCards.value.some((item) => {
    if (!item.baseline) {
      return false;
    }

    return isSmoothActive(item.baseline, renderPerfNow.value);
  });

  return hasSmoothing ? 'smooth' : 'locked';
});

const calibrationModeLabel = computed(() => {
  if (calibrationMode.value === 'calibrating') {
    return '校准中';
  }

  if (calibrationMode.value === 'smooth') {
    return '平滑校正';
  }

  return '已锁定';
});

const calibrationModeClass = computed(() => `mode-${calibrationMode.value}`);

const generatedAtParts = computed(() => formatTimestampDetailedParts(aggregate.value?.generatedAtMs ?? null));

const nextCalibrationText = computed(() => {
  if (!autoCalibration.value) {
    return '自动校准已关闭';
  }

  if (calibrationAtMs.value === null) {
    return '等待首次校准';
  }

  const ms = Math.max(0, calibrationIntervalMs.value - (Date.now() - calibrationAtMs.value));
  return `下次校准 ${formatCountdown(ms)}`;
});

const latencyRanking = computed(() => {
  return sourceCards.value
    .filter((item) => item.source !== null)
    .slice()
    .sort((a, b) => {
      const aLatency = a.source?.latencyMs ?? Number.POSITIVE_INFINITY;
      const bLatency = b.source?.latencyMs ?? Number.POSITIVE_INFINITY;
      return aLatency - bLatency;
    });
});

const offsetRanking = computed(() => {
  return sourceCards.value
    .filter((item) => item.offsetMs !== null)
    .slice()
    .sort((a, b) => Math.abs(b.offsetMs ?? 0) - Math.abs(a.offsetMs ?? 0));
});

async function calibrateNow(reason: 'manual' | 'auto' | 'initial' | 'visible' = 'manual') {
  if (inFlightCalibration) {
    await inFlightCalibration;
    return;
  }

  const task = (async () => {
    loading.value = true;
    try {
      const response = await fetch('/api/time/aggregate', {
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as AggregateResponse;
      aggregate.value = payload;
      applyCalibration(payload);
      collectSourceErrors(payload, reason);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'request_failed';
      pushError(`Calibration failed: ${message}`);
    } finally {
      loading.value = false;
    }
  })();

  inFlightCalibration = task;
  try {
    await task;
  } finally {
    inFlightCalibration = null;
  }
}

function applyCalibration(payload: AggregateResponse) {
  const perfNow = getPerfNow();
  const wallNow = Date.now();
  const next = { ...clockBaselines.value };

  for (const sourceKey of SOURCE_ORDER) {
    const item = payload.sources[sourceKey];
    if (item.serverTimeMs === null || Number.isNaN(item.serverTimeMs)) {
      continue;
    }

    next[sourceKey] = calibrateBaseline(
      next[sourceKey],
      item.serverTimeMs,
      perfNow,
      wallNow,
      CALIBRATION_CONFIG
    );
  }

  clockBaselines.value = next;
  calibrationAtMs.value = wallNow;
}

function collectSourceErrors(payload: AggregateResponse, reason: string) {
  for (const sourceKey of SOURCE_ORDER) {
    const source = payload.sources[sourceKey];
    if (source.status === 'ok') {
      continue;
    }

    const detail = source.error ?? 'unknown_error';
    pushError(`${SOURCE_META[sourceKey].label} (${reason}): ${detail}`);
  }
}

function pushError(message: string) {
  const stamped = `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${message}`;
  recentErrors.value = [stamped, ...recentErrors.value].slice(0, MAX_ERROR_LOGS);
}

function startDisplayTimer() {
  if (displayTimer !== null) {
    window.clearInterval(displayTimer);
  }

  displayTimer = window.setInterval(() => {
    renderPerfNow.value = getPerfNow();
  }, DISPLAY_TICK_MS);
}

function stopDisplayTimer() {
  if (displayTimer !== null) {
    window.clearInterval(displayTimer);
    displayTimer = null;
  }
}

function startAutoCalibrationTimer() {
  if (autoCalibrationTimer !== null) {
    window.clearInterval(autoCalibrationTimer);
  }

  autoCalibrationTimer = window.setInterval(() => {
    void calibrateNow('auto');
  }, calibrationIntervalMs.value);
}

function stopAutoCalibrationTimer() {
  if (autoCalibrationTimer !== null) {
    window.clearInterval(autoCalibrationTimer);
    autoCalibrationTimer = null;
  }
}

function handleVisibilityChange() {
  if (!document.hidden && autoCalibration.value) {
    void calibrateNow('visible');
  }
}

function setCalibrationIntervalSec(nextSec: number) {
  calibrationIntervalSec.value = clamp(nextSec, MIN_INTERVAL_SEC, MAX_INTERVAL_SEC);
}

function decreaseInterval() {
  setCalibrationIntervalSec(calibrationIntervalSec.value - INTERVAL_STEP_SEC);
}

function increaseInterval() {
  setCalibrationIntervalSec(calibrationIntervalSec.value + INTERVAL_STEP_SEC);
}

function setGroupFilter(next: GroupFilter) {
  groupFilter.value = next;
}

function setMainClockSource(next: MainClockSource) {
  mainClockSource.value = next;
}

function setMillisecondDigits(next: number) {
  millisecondDigits.value = clamp(Math.trunc(next), 1, 3);
}

function getDocumentPictureInPictureApi(): DocumentPictureInPictureApi | null {
  const candidate = (window as Window & { documentPictureInPicture?: DocumentPictureInPictureApi })
    .documentPictureInPicture;
  return candidate ?? null;
}

function formatPipClock(ms: number | null): string {
  return `${formatPipClockHead(ms)}.${formatMillisecondFraction(ms)}`;
}

function formatPipClockHtml(ms: number | null): string {
  return `${formatPipClockHead(ms)}.<span class="pip-ms-accent">${formatMillisecondFraction(ms)}</span>`;
}

function updatePipClock() {
  if (!pipClockWindow || pipClockWindow.closed) {
    stopPipClockTimer();
    pipClockWindow = null;
    pipActive.value = false;
    return;
  }

  const clock = pipClockWindow.document.getElementById('pip-clock');
  if (clock) {
    clock.innerHTML = formatPipClockHtml(mainClockState.value.ms);
    pipResizeHandler?.();
  }
}

function startPipClockTimer() {
  stopPipClockTimer();
  pipClockTimer = window.setInterval(() => {
    updatePipClock();
  }, 33);
}

function stopPipClockTimer() {
  if (pipClockTimer !== null) {
    window.clearInterval(pipClockTimer);
    pipClockTimer = null;
  }
}

function cleanupPipState() {
  stopPipClockTimer();
  if (pipClockWindow && pipResizeHandler) {
    pipClockWindow.removeEventListener('resize', pipResizeHandler);
  }
  pipResizeHandler = null;
  pipClockWindow = null;
  pipActive.value = false;
}

async function openPipClock() {
  const api = getDocumentPictureInPictureApi();
  if (!api) {
    pushError('当前浏览器不支持画中画时钟');
    return;
  }

  if (pipClockWindow && !pipClockWindow.closed) {
    pipClockWindow.focus();
    return;
  }

  try {
    const pipWindow = await api.requestWindow({ width: 360, height: 220 });
    pipClockWindow = pipWindow;

    const doc = pipWindow.document;
    doc.body.innerHTML = '';

    const style = doc.createElement('style');
    style.textContent = `
      :root { color-scheme: dark; }
      body {
        margin: 0;
        height: 100vh;
        width: 100vw;
        display: grid;
        place-items: center;
        background: #0a1420;
        font-family: 'Sora', 'Manrope', 'Segoe UI Variable', 'PingFang SC', 'Noto Sans SC', sans-serif;
        overflow: hidden;
      }
      #pip-clock {
        font-size: 64px;
        font-weight: 900;
        line-height: 1;
        color: #e8f3ff;
        letter-spacing: 0.04em;
        font-variant-numeric: tabular-nums;
        text-shadow: 0 10px 28px rgba(58, 132, 255, 0.35);
        white-space: nowrap;
        user-select: none;
      }
      .pip-ms-accent {
        color: #ffb6c8;
      }
    `;
    doc.head.append(style);

    const clock = doc.createElement('div');
    clock.id = 'pip-clock';
    clock.innerHTML = formatPipClockHtml(mainClockState.value.ms);
    doc.body.append(clock);

    const applyPipClockScale = () => {
      const target = pipWindow.document.getElementById('pip-clock');
      if (!target) {
        return;
      }

      const width = Math.max(1, pipWindow.innerWidth);
      const height = Math.max(1, pipWindow.innerHeight);
      const content = target.textContent ?? '00:00:00';

      // Fit by both width and height to avoid overflow in narrow PiP windows.
      const widthPerChar = 0.72;
      const sizeByWidth = (width - 12) / Math.max(1, content.length * widthPerChar);
      const sizeByHeight = (height - 12) * 0.78;
      const size = Math.floor(Math.min(sizeByWidth, sizeByHeight));
      target.style.fontSize = `${Math.max(18, size)}px`;
    };
    pipResizeHandler = applyPipClockScale;
    pipWindow.addEventListener('resize', applyPipClockScale);
    applyPipClockScale();

    pipWindow.addEventListener('pagehide', () => {
      cleanupPipState();
    });

    pipActive.value = true;
    startPipClockTimer();
    updatePipClock();
    applyPipClockScale();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    pushError(`开启画中画失败: ${message}`);
    cleanupPipState();
  }
}

function closePipClock() {
  if (pipClockWindow && !pipClockWindow.closed) {
    pipClockWindow.close();
  }
  cleanupPipState();
}

async function togglePipClock() {
  if (pipActive.value) {
    closePipClock();
    return;
  }

  await openPipClock();
}

function sourceStatusLabel(status: TimeSourceData['status']) {
  if (status === 'ok') {
    return '正常';
  }

  if (status === 'stale') {
    return '过期';
  }

  return '错误';
}

function sourceStatusClass(status: TimeSourceData['status']) {
  return `status-${status}`;
}

function formatClockPrimaryParts(ms: number | null): { time: string; fraction: string | null } {
  return {
    time: formatClockTime(ms),
    fraction: showMilliseconds.value ? formatMillisecondFraction(ms) : null
  };
}

function formatClockTime(ms: number | null): string {
  if (ms === null) {
    return '--:--:--';
  }

  return new Date(ms).toLocaleTimeString('zh-CN', {
    hour12: false,
    timeZone: 'Asia/Shanghai'
  });
}

function formatPipClockHead(ms: number | null): string {
  if (ms === null) {
    return '--:--:--';
  }

  const date = new Date(ms);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatMillisecondFraction(ms: number | null): string {
  const digits = clamp(Math.trunc(millisecondDigits.value), 1, 3);
  if (ms === null) {
    return '-'.repeat(digits);
  }

  const raw = Math.abs(Math.trunc(ms)) % 1000;
  const divisor = 10 ** (3 - digits);
  const value = Math.floor(raw / divisor);
  return String(value).padStart(digits, '0');
}

function formatMillis(ms: number | null): string {
  if (ms === null) {
    return `${'-'.repeat(clamp(Math.trunc(millisecondDigits.value), 1, 3))} 毫秒`;
  }

  return `${formatMillisecondFraction(ms)} 毫秒`;
}

function formatSignedMs(ms: number | null): string {
  if (ms === null) {
    return '--';
  }

  const sign = ms >= 0 ? '+' : '-';
  return `${sign}${Math.abs(Math.trunc(ms))} 毫秒`;
}

function formatLatency(ms: number | null): string {
  if (ms === null) {
    return '--';
  }

  return `${Math.trunc(ms)} 毫秒`;
}

function formatTimestampDetailedParts(ms: number | null): { head: string; tail: string | null } {
  if (ms === null) {
    return { head: '--', tail: null };
  }

  const date = new Date(ms);
  const head = date.toLocaleString('zh-CN', {
    hour12: false,
    timeZone: 'Asia/Shanghai'
  });
  return { head, tail: formatMillisecondFraction(ms) };
}

function formatCountdown(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${sec}s`;
}

function createEmptyBaselines(): Record<SourceKey, ClockBaseline | null> {
  return {
    taobao: null,
    meituan: null,
    suning: null
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

watch(autoCalibration, (enabled) => {
  if (enabled) {
    startAutoCalibrationTimer();
    return;
  }

  stopAutoCalibrationTimer();
});

watch(calibrationIntervalSec, () => {
  if (autoCalibration.value) {
    startAutoCalibrationTimer();
  }
});

onMounted(() => {
  startDisplayTimer();
  void calibrateNow('initial');
  pipSupported.value = getDocumentPictureInPictureApi() !== null;

  if (autoCalibration.value) {
    startAutoCalibrationTimer();
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onBeforeUnmount(() => {
  stopDisplayTimer();
  stopAutoCalibrationTimer();
  closePipClock();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<template>
  <main class="time-layout">
    <section class="panel hero-panel">
      <div class="hero-top">
        <p class="kicker">OpenRealm 时间控制台</p>
        <span class="mode-pill" :class="calibrationModeClass" data-testid="calibration-mode">
          {{ calibrationModeLabel }}
        </span>
      </div>

      <div class="hero-clock-zone">
        <div class="clock-text-wrap">
          <p class="main-clock" data-testid="main-clock-primary">
            <span>{{ clockPrimaryParts.time }}</span>
            <template v-if="clockPrimaryParts.fraction !== null">
              <span>.</span>
              <span class="ms-accent">{{ clockPrimaryParts.fraction }}</span>
            </template>
          </p>
          <p class="main-clock-sub" data-testid="main-clock-secondary">
            <template v-if="clockSecondary !== null">
              <span class="ms-accent">{{ clockSecondary.millis }}</span>
              <span> · 本地偏差 {{ clockSecondary.offset }}</span>
            </template>
            <template v-else>-- 毫秒 · 本地偏差 --</template>
          </p>
          <div class="calibration-meta">
            <span>
              上次校准:
              <span>{{ generatedAtParts.head }}</span>
              <template v-if="generatedAtParts.tail !== null">
                <span>.</span>
                <span class="ms-accent">{{ generatedAtParts.tail }}</span>
              </template>
            </span>
            <span data-testid="next-calibration">{{ nextCalibrationText }}</span>
          </div>
        </div>
      </div>

      <div class="controls-grid controls-grid-pinned">
        <div class="control-card">
          <p class="control-title">校准</p>
          <div class="action-row">
            <button
              type="button"
              class="pill-btn"
              :class="autoCalibration ? 'is-active' : ''"
              data-testid="auto-calibration-toggle"
              @click="autoCalibration = !autoCalibration"
            >
              {{ autoCalibration ? '自动: 开启' : '自动: 关闭' }}
            </button>
            <button
              type="button"
              class="pill-btn"
              :disabled="loading"
              data-testid="manual-calibrate"
              @click="calibrateNow('manual')"
            >
              {{ loading ? '校准中...' : '立即校准' }}
            </button>
          </div>
        </div>

        <div class="control-card">
          <p class="control-title">主时钟源</p>
          <div class="group-row">
            <button
              v-for="option in MAIN_CLOCK_SOURCE_OPTIONS"
              :key="option.key"
              type="button"
              class="group-btn"
              :class="mainClockSource === option.key ? 'is-active' : ''"
              :data-testid="`clock-source-${option.key}`"
              @click="setMainClockSource(option.key)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="control-card">
          <p class="control-title">画中画</p>
          <div class="action-row">
            <button
              type="button"
              class="pill-btn"
              :class="pipActive ? 'is-active' : ''"
              :disabled="!pipSupported && !pipActive"
              data-testid="pip-toggle"
              @click="togglePipClock"
            >
              {{
                !pipSupported && !pipActive
                  ? '画中画: 不支持'
                  : (pipActive ? '画中画: 关闭' : '画中画: 开启')
              }}
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="settings-toggle"
        data-testid="settings-toggle"
        @click="mobileSettingsExpanded = !mobileSettingsExpanded"
      >
        {{ mobileSettingsExpanded ? '收起设置' : '更多设置' }}
      </button>

      <div class="controls-grid controls-grid-extra" :class="{ 'is-expanded': mobileSettingsExpanded }">
        <div class="control-card">
          <p class="control-title">刷新间隔 (最小10秒)</p>
          <div class="interval-box">
            <button type="button" class="icon-btn" data-testid="interval-dec" @click="decreaseInterval">-</button>
            <span class="interval-value" data-testid="interval-value">{{ calibrationIntervalSec }}s</span>
            <button type="button" class="icon-btn" data-testid="interval-inc" @click="increaseInterval">+</button>
          </div>
          <div class="preset-row">
            <button
              v-for="preset in INTERVAL_PRESETS"
              :key="preset"
              type="button"
              class="preset-btn"
              :class="calibrationIntervalSec === preset ? 'is-active' : ''"
              :data-testid="`preset-${preset}`"
              @click="setCalibrationIntervalSec(preset)"
            >
              {{ preset }}s
            </button>
          </div>
        </div>

        <div class="control-card">
          <p class="control-title">分组筛选</p>
          <div class="group-row">
            <button
              type="button"
              class="group-btn"
              :class="groupFilter === 'all' ? 'is-active' : ''"
              data-testid="filter-all"
              @click="setGroupFilter('all')"
            >
              全部
            </button>
            <button
              type="button"
              class="group-btn"
              :class="groupFilter === 'ok' ? 'is-active' : ''"
              data-testid="filter-ok"
              @click="setGroupFilter('ok')"
            >
              正常
            </button>
            <button
              type="button"
              class="group-btn"
              :class="groupFilter === 'stale' ? 'is-active' : ''"
              data-testid="filter-stale"
              @click="setGroupFilter('stale')"
            >
              过期
            </button>
            <button
              type="button"
              class="group-btn"
              :class="groupFilter === 'error' ? 'is-active' : ''"
              data-testid="filter-error"
              @click="setGroupFilter('error')"
            >
              错误
            </button>
          </div>
        </div>

        <div class="control-card">
          <p class="control-title">时间显示</p>
          <div class="action-row">
            <button
              type="button"
              class="pill-btn"
              :class="showMilliseconds ? 'is-active' : ''"
              data-testid="millis-toggle"
              @click="showMilliseconds = !showMilliseconds"
            >
              {{ showMilliseconds ? '毫秒: 显示' : '毫秒: 隐藏' }}
            </button>
          </div>
          <div class="preset-row">
            <button
              v-for="digits in MILLISECOND_DIGIT_OPTIONS"
              :key="digits"
              type="button"
              class="preset-btn"
              :class="millisecondDigits === digits ? 'is-active' : ''"
              :data-testid="`millis-digits-${digits}`"
              @click="setMillisecondDigits(digits)"
            >
              {{ digits }}位
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="summary-grid">
      <article class="panel summary-card">
        <p>平均延迟</p>
        <strong>{{ formatLatency(summaryStats.avgLatency) }}</strong>
      </article>
    </section>

    <section v-for="group in visibleGroups" :key="group.key" class="group-section">
      <header class="group-head">
        <h2>{{ group.title }}</h2>
        <span class="group-count">{{ group.cards.length }} 个数据源</span>
      </header>

      <div v-if="group.cards.length > 0" class="source-grid">
        <article v-for="item in group.cards" :key="item.sourceKey" class="panel source-card">
          <header class="source-header">
            <div class="source-brand">
              <div class="brand-icon">
                <img class="brand-icon-image" :src="item.icon" :alt="`${item.label} icon`" loading="lazy" />
              </div>
              <div>
                <p class="source-name" data-testid="source-title">{{ item.label }}</p>
                <p class="source-time">
                  <span>{{ formatClockPrimaryParts(item.estimatedMs).time }}</span>
                  <template v-if="showMilliseconds">
                    <span>.</span>
                    <span class="ms-accent">{{ formatMillisecondFraction(item.estimatedMs) }}</span>
                  </template>
                </p>
                <p class="source-subtime">
                  <span class="ms-accent">{{ formatMillis(item.estimatedMs) }}</span>
                  <span> · 偏差 {{ formatSignedMs(item.offsetMs) }}</span>
                </p>
              </div>
            </div>

            <span v-if="item.source" class="status-pill" :class="sourceStatusClass(item.source.status)">
              {{ sourceStatusLabel(item.source.status) }}
            </span>
          </header>

          <div class="source-metrics">
            <div>
              <span>延迟</span>
              <strong>{{ formatLatency(item.source?.latencyMs ?? null) }}</strong>
            </div>
            <div>
              <span>获取时间</span>
              <strong>
                <span>{{ formatTimestampDetailedParts(item.source?.fetchedAtMs ?? null).head }}</span>
                <template v-if="formatTimestampDetailedParts(item.source?.fetchedAtMs ?? null).tail !== null">
                  <span>.</span>
                  <span class="ms-accent">
                    {{ formatTimestampDetailedParts(item.source?.fetchedAtMs ?? null).tail }}
                  </span>
                </template>
              </strong>
            </div>
          </div>

          <p v-if="item.source?.error" class="error-text">{{ item.source.error }}</p>
        </article>
      </div>

      <article v-else class="panel empty-group">该分组暂无数据源</article>
    </section>

    <section class="panel dual-panel">
      <article class="dual-card">
        <h3>延迟排名</h3>
        <div v-for="entry in latencyRanking" :key="entry.sourceKey" class="rank-row" data-testid="latency-item">
          <span>{{ entry.label }}</span>
          <strong>{{ formatLatency(entry.source?.latencyMs ?? null) }}</strong>
        </div>
      </article>
      <article class="dual-card">
        <h3>偏差排名</h3>
        <div v-for="entry in offsetRanking" :key="`offset-${entry.sourceKey}`" class="rank-row">
          <span>{{ entry.label }}</span>
          <strong>{{ formatSignedMs(entry.offsetMs) }}</strong>
        </div>
      </article>
    </section>

    <section class="panel error-panel">
      <h3>最近错误</h3>
      <p v-if="recentErrors.length === 0" class="quiet">暂无错误</p>
      <div v-else class="error-list">
        <p v-for="message in recentErrors" :key="message">{{ message }}</p>
      </div>
    </section>
  </main>
</template>

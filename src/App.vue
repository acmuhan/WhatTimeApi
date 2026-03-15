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
  taobao: { label: 'Taobao', icon: TAOBAO_ICON },
  meituan: { label: 'Meituan', icon: MEITUAN_ICON },
  suning: { label: 'Suning', icon: SUNING_ICON }
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
const calibrationIntervalSec = ref<number>(10);
const groupFilter = ref<GroupFilter>('all');
const mainClockSource = ref<MainClockSource>('reference');
const recentErrors = ref<string[]>([]);
const renderPerfNow = ref(getPerfNow());
const calibrationAtMs = ref<number | null>(null);
const clockBaselines = ref<Record<SourceKey, ClockBaseline | null>>(createEmptyBaselines());

let displayTimer: number | null = null;
let autoCalibrationTimer: number | null = null;
let inFlightCalibration: Promise<void> | null = null;

const calibrationIntervalMs = computed(() => calibrationIntervalSec.value * 1000);
const MAIN_CLOCK_SOURCE_OPTIONS: ReadonlyArray<{ key: MainClockSource; label: string }> = [
  { key: 'reference', label: 'Median' },
  { key: 'taobao', label: 'Taobao' },
  { key: 'meituan', label: 'Meituan' },
  { key: 'suning', label: 'Suning' }
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
    { key: 'ok' as GroupKey, title: 'Healthy Sources', cards: groupedCards.value.ok },
    { key: 'stale' as GroupKey, title: 'Fallback Sources', cards: groupedCards.value.stale },
    { key: 'error' as GroupKey, title: 'Error Sources', cards: groupedCards.value.error }
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

const clockPrimary = computed(() => formatClockPrimary(mainClockState.value.ms));

const clockSecondary = computed(() => {
  if (mainClockState.value.ms === null) {
    return '-- ms · Local Offset --';
  }

  return `${formatMillis(mainClockState.value.ms)} · Local Offset ${formatSignedMs(mainClockState.value.offsetMs)}`;
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
    return 'Calibrating';
  }

  if (calibrationMode.value === 'smooth') {
    return 'Smooth Correction';
  }

  return 'Locked';
});

const calibrationModeClass = computed(() => `mode-${calibrationMode.value}`);

const generatedAtText = computed(() => formatTimestampDetailed(aggregate.value?.generatedAtMs ?? null));

const nextCalibrationText = computed(() => {
  if (!autoCalibration.value) {
    return 'Auto calibration is off';
  }

  if (calibrationAtMs.value === null) {
    return 'Waiting for first calibration';
  }

  const ms = Math.max(0, calibrationIntervalMs.value - (Date.now() - calibrationAtMs.value));
  return `Next calibration in ${formatCountdown(ms)}`;
});

const calibrationRemainingMs = computed(() => {
  if (!autoCalibration.value || calibrationAtMs.value === null) {
    return 0;
  }

  return Math.max(0, calibrationIntervalMs.value - (Date.now() - calibrationAtMs.value));
});

const calibrationProgress = computed(() => {
  if (!autoCalibration.value || calibrationAtMs.value === null) {
    return 0;
  }

  const elapsed = calibrationIntervalMs.value - calibrationRemainingMs.value;
  return Math.max(0, Math.min(100, (elapsed / calibrationIntervalMs.value) * 100));
});

const ringStyle = computed(() => {
  return {
    '--progress': `${calibrationProgress.value}`
  } as Record<string, string>;
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

function sourceStatusLabel(status: TimeSourceData['status']) {
  if (status === 'ok') {
    return 'OK';
  }

  if (status === 'stale') {
    return 'STALE';
  }

  return 'ERROR';
}

function sourceStatusClass(status: TimeSourceData['status']) {
  return `status-${status}`;
}

function formatClockPrimary(ms: number | null): string {
  if (ms === null) {
    return showMilliseconds.value ? '--:--:--.--' : '--:--:--';
  }

  const time = new Date(ms).toLocaleTimeString('zh-CN', {
    hour12: false,
    timeZone: 'Asia/Shanghai'
  });
  if (!showMilliseconds.value) {
    return time;
  }

  const centiseconds = String(Math.floor((Math.abs(Math.trunc(ms)) % 1000) / 10)).padStart(2, '0');
  return `${time}.${centiseconds}`;
}

function formatMillis(ms: number | null): string {
  if (ms === null) {
    return '--- ms';
  }

  const absMs = Math.abs(Math.trunc(ms));
  return `${String(absMs % 1000).padStart(3, '0')} ms`;
}

function formatSignedMs(ms: number | null): string {
  if (ms === null) {
    return '--';
  }

  const sign = ms >= 0 ? '+' : '-';
  return `${sign}${Math.abs(Math.trunc(ms))} ms`;
}

function formatLatency(ms: number | null): string {
  if (ms === null) {
    return '--';
  }

  return `${Math.trunc(ms)} ms`;
}

function formatTimestampDetailed(ms: number | null): string {
  if (ms === null) {
    return '--';
  }

  const date = new Date(ms);
  const head = date.toLocaleString('zh-CN', {
    hour12: false,
    timeZone: 'Asia/Shanghai'
  });
  const tail = String(Math.abs(Math.trunc(ms)) % 1000).padStart(3, '0');
  return `${head}.${tail}`;
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

  if (autoCalibration.value) {
    startAutoCalibrationTimer();
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
});

onBeforeUnmount(() => {
  stopDisplayTimer();
  stopAutoCalibrationTimer();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<template>
  <main class="time-layout">
    <section class="panel hero-panel">
      <div class="hero-top">
        <p class="kicker">OpenRealm Time Console</p>
        <span class="mode-pill" :class="calibrationModeClass" data-testid="calibration-mode">
          {{ calibrationModeLabel }}
        </span>
      </div>

      <div class="hero-clock-zone">
        <div class="clock-text-wrap">
          <p class="main-clock" data-testid="main-clock-primary">{{ clockPrimary }}</p>
          <p class="main-clock-sub" data-testid="main-clock-secondary">{{ clockSecondary }}</p>
          <div class="calibration-meta">
            <span>Last calibration: {{ generatedAtText }}</span>
            <span data-testid="next-calibration">{{ nextCalibrationText }}</span>
          </div>
        </div>

        <div class="ring-wrap">
          <div class="ring-progress" :style="ringStyle" aria-hidden="true">
            <div class="ring-inner">
              <p>Cycle</p>
              <strong>{{ Math.round(calibrationProgress) }}%</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="controls-grid">
        <div class="control-card">
          <p class="control-title">Calibration</p>
          <div class="action-row">
            <button
              type="button"
              class="pill-btn"
              :class="autoCalibration ? 'is-active' : ''"
              data-testid="auto-calibration-toggle"
              @click="autoCalibration = !autoCalibration"
            >
              {{ autoCalibration ? 'Auto: ON' : 'Auto: OFF' }}
            </button>
            <button
              type="button"
              class="pill-btn"
              :disabled="loading"
              data-testid="manual-calibrate"
              @click="calibrateNow('manual')"
            >
              {{ loading ? 'Calibrating...' : 'Calibrate Now' }}
            </button>
          </div>
        </div>

        <div class="control-card">
          <p class="control-title">Refresh interval (min 10s)</p>
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
          <p class="control-title">Group filter</p>
          <div class="group-row">
            <button
              type="button"
              class="group-btn"
              :class="groupFilter === 'all' ? 'is-active' : ''"
              data-testid="filter-all"
              @click="setGroupFilter('all')"
            >
              All
            </button>
            <button
              type="button"
              class="group-btn"
              :class="groupFilter === 'ok' ? 'is-active' : ''"
              data-testid="filter-ok"
              @click="setGroupFilter('ok')"
            >
              OK
            </button>
            <button
              type="button"
              class="group-btn"
              :class="groupFilter === 'stale' ? 'is-active' : ''"
              data-testid="filter-stale"
              @click="setGroupFilter('stale')"
            >
              STALE
            </button>
            <button
              type="button"
              class="group-btn"
              :class="groupFilter === 'error' ? 'is-active' : ''"
              data-testid="filter-error"
              @click="setGroupFilter('error')"
            >
              ERROR
            </button>
          </div>
        </div>

        <div class="control-card">
          <p class="control-title">Time display</p>
          <div class="action-row">
            <button
              type="button"
              class="pill-btn"
              :class="showMilliseconds ? 'is-active' : ''"
              data-testid="millis-toggle"
              @click="showMilliseconds = !showMilliseconds"
            >
              {{ showMilliseconds ? 'Milliseconds: ON' : 'Milliseconds: OFF' }}
            </button>
          </div>
        </div>

        <div class="control-card">
          <p class="control-title">Main clock source</p>
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
      </div>
    </section>

    <section class="summary-grid">
      <article class="panel summary-card">
        <p>Healthy</p>
        <strong>{{ summaryStats.okCount }}</strong>
      </article>
      <article class="panel summary-card">
        <p>Fallback</p>
        <strong>{{ summaryStats.staleCount }}</strong>
      </article>
      <article class="panel summary-card">
        <p>Error</p>
        <strong>{{ summaryStats.errorCount }}</strong>
      </article>
      <article class="panel summary-card">
        <p>Avg Latency</p>
        <strong>{{ formatLatency(summaryStats.avgLatency) }}</strong>
      </article>
    </section>

    <section v-for="group in visibleGroups" :key="group.key" class="group-section">
      <header class="group-head">
        <h2>{{ group.title }}</h2>
        <span class="group-count">{{ group.cards.length }} source(s)</span>
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
                <p class="source-time">{{ formatClockPrimary(item.estimatedMs) }}</p>
                <p class="source-subtime">
                  {{ formatMillis(item.estimatedMs) }} · Offset {{ formatSignedMs(item.offsetMs) }}
                </p>
              </div>
            </div>

            <span v-if="item.source" class="status-pill" :class="sourceStatusClass(item.source.status)">
              {{ sourceStatusLabel(item.source.status) }}
            </span>
          </header>

          <div class="source-metrics">
            <div>
              <span>Latency</span>
              <strong>{{ formatLatency(item.source?.latencyMs ?? null) }}</strong>
            </div>
            <div>
              <span>Fetched At</span>
              <strong>{{ formatTimestampDetailed(item.source?.fetchedAtMs ?? null) }}</strong>
            </div>
          </div>

          <p v-if="item.source?.error" class="error-text">{{ item.source.error }}</p>
        </article>
      </div>

      <article v-else class="panel empty-group">No source in this group</article>
    </section>

    <section class="panel dual-panel">
      <article class="dual-card">
        <h3>Latency ranking</h3>
        <div v-for="entry in latencyRanking" :key="entry.sourceKey" class="rank-row" data-testid="latency-item">
          <span>{{ entry.label }}</span>
          <strong>{{ formatLatency(entry.source?.latencyMs ?? null) }}</strong>
        </div>
      </article>
      <article class="dual-card">
        <h3>Offset ranking</h3>
        <div v-for="entry in offsetRanking" :key="`offset-${entry.sourceKey}`" class="rank-row">
          <span>{{ entry.label }}</span>
          <strong>{{ formatSignedMs(entry.offsetMs) }}</strong>
        </div>
      </article>
    </section>

    <section class="panel error-panel">
      <h3>Recent errors</h3>
      <p v-if="recentErrors.length === 0" class="quiet">No recent errors</p>
      <div v-else class="error-list">
        <p v-for="message in recentErrors" :key="message">{{ message }}</p>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  calibrateBaseline,
  estimateServerMs,
  getPerfNow,
  isSmoothActive,
  type ClockBaseline
} from './clock-engine';
import type { AggregateResponse, SourceKey, TimeSourceData } from './types';

const SOURCE_ORDER: SourceKey[] = ['taobao', 'meituan', 'suning'];

const SOURCE_META: Record<SourceKey, { label: string; logo: string }> = {
  taobao: { label: '淘宝', logo: 'T' },
  meituan: { label: '美团', logo: 'M' },
  suning: { label: '苏宁', logo: 'S' }
};

const DISPLAY_TICK_MS = 250;
const CALIBRATION_INTERVAL_MS = 10_000;
const MAX_ERROR_LOGS = 10;
const CALIBRATION_CONFIG = {
  driftThresholdMs: 120,
  smoothDurationMs: 700
};

const aggregate = ref<AggregateResponse | null>(null);
const loading = ref(false);
const autoCalibration = ref(true);
const recentErrors = ref<string[]>([]);
const renderPerfNow = ref(getPerfNow());
const calibrationAtMs = ref<number | null>(null);
const clockBaselines = ref<Record<SourceKey, ClockBaseline | null>>(createEmptyBaselines());

let displayTimer: number | null = null;
let autoCalibrationTimer: number | null = null;
let inFlightCalibration: Promise<void> | null = null;

const sourceCards = computed(() => {
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
      logo: SOURCE_META[sourceKey].logo,
      source,
      baseline,
      estimatedMs,
      offsetMs
    };
  });
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

const clockPrimary = computed(() => {
  return formatClockPrimary(referenceTimeMs.value);
});

const clockSecondary = computed(() => {
  if (referenceTimeMs.value === null) {
    return '-- ms · 本地偏移 --';
  }

  return `${formatMillis(referenceTimeMs.value)} · 本地偏移 ${formatSignedMs(referenceOffsetMs.value)}`;
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

  if (hasSmoothing) {
    return 'smooth';
  }

  return 'locked';
});

const calibrationModeLabel = computed(() => {
  if (calibrationMode.value === 'calibrating') {
    return '校准中';
  }
  if (calibrationMode.value === 'smooth') {
    return '平滑纠偏';
  }
  return '稳定';
});

const calibrationModeClass = computed(() => {
  return `mode-${calibrationMode.value}`;
});

const generatedAtText = computed(() => {
  return formatTimestampDetailed(aggregate.value?.generatedAtMs ?? null);
});

const nextCalibrationText = computed(() => {
  if (!autoCalibration.value) {
    return '自动校准已关闭';
  }

  if (calibrationAtMs.value === null) {
    return '等待首次校准';
  }

  const ms = Math.max(0, CALIBRATION_INTERVAL_MS - (Date.now() - calibrationAtMs.value));
  return `下次校准 ${formatCountdown(ms)}`;
});

const calibrationProgress = computed(() => {
  if (!autoCalibration.value || calibrationAtMs.value === null) {
    return 0;
  }

  const elapsed = Date.now() - calibrationAtMs.value;
  const raw = (elapsed / CALIBRATION_INTERVAL_MS) * 100;
  return Math.max(0, Math.min(100, raw));
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

function sourceStatusLabel(status: TimeSourceData['status']) {
  if (status === 'ok') {
    return '正常';
  }
  if (status === 'stale') {
    return '过期回退';
  }
  return '失败';
}

function sourceStatusClass(status: TimeSourceData['status']) {
  return `status-${status}`;
}

async function calibrateNow(reason: 'manual' | 'auto' | 'initial' | 'visible' = 'manual') {
  if (inFlightCalibration) {
    await inFlightCalibration;
    return;
  }

  const task = (async () => {
    loading.value = true;
    try {
      const response = await fetch('/api/time/aggregate', {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as AggregateResponse;
      aggregate.value = payload;
      applyCalibration(payload);
      collectSourceErrors(payload, reason);
    } catch (error) {
      const message = error instanceof Error ? error.message : '请求失败';
      pushError(`校准失败: ${message}`);
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

    const detail = source.error ?? '未知错误';
    pushError(`${SOURCE_META[sourceKey].label}(${reason}): ${detail}`);
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
  }, CALIBRATION_INTERVAL_MS);
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

watch(autoCalibration, (enabled) => {
  if (enabled) {
    startAutoCalibrationTimer();
    return;
  }

  stopAutoCalibrationTimer();
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

function createEmptyBaselines(): Record<SourceKey, ClockBaseline | null> {
  return {
    taobao: null,
    meituan: null,
    suning: null
  };
}

function formatClockPrimary(ms: number | null): string {
  if (ms === null) {
    return '--:--:--';
  }

  return new Date(ms).toLocaleTimeString('zh-CN', {
    hour12: false,
    timeZone: 'Asia/Shanghai'
  });
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
</script>

<template>
  <main class="time-layout">
    <section class="panel hero-panel">
      <div class="hero-top">
        <p class="kicker">Time Command Center</p>
        <span class="mode-pill" :class="calibrationModeClass" data-testid="calibration-mode">
          {{ calibrationModeLabel }}
        </span>
      </div>

      <div class="main-clock-wrap">
        <p class="main-clock" data-testid="main-clock-primary">{{ clockPrimary }}</p>
        <p class="main-clock-sub" data-testid="main-clock-secondary">{{ clockSecondary }}</p>
      </div>

      <div class="hero-controls">
        <label class="toggle-switch">
          <input v-model="autoCalibration" type="checkbox" data-testid="auto-calibration-toggle" />
          <span>每 10 秒自动校准</span>
        </label>

        <button
          class="action-btn"
          type="button"
          :disabled="loading"
          data-testid="manual-calibrate"
          @click="calibrateNow('manual')"
        >
          {{ loading ? '校准中...' : '立即校准' }}
        </button>
      </div>

      <div class="calibration-meta">
        <span>最近校准: {{ generatedAtText }}</span>
        <span data-testid="next-calibration">{{ nextCalibrationText }}</span>
      </div>

      <div class="calibration-strip">
        <div class="calibration-progress" :style="{ width: `${calibrationProgress}%` }"></div>
      </div>
    </section>

    <section class="source-grid">
      <article v-for="item in sourceCards" :key="item.sourceKey" class="panel source-card">
        <header class="source-header">
          <div class="source-brand">
            <div class="brand-icon" :class="`brand-${item.sourceKey}`" aria-hidden="true">{{ item.logo }}</div>
            <div>
              <p class="source-name" data-testid="source-title">{{ item.label }}</p>
              <p class="source-time">{{ formatClockPrimary(item.estimatedMs) }}</p>
              <p class="source-subtime">
                {{ formatMillis(item.estimatedMs) }} · 偏移 {{ formatSignedMs(item.offsetMs) }}
              </p>
            </div>
          </div>

          <span
            v-if="item.source"
            class="status-pill"
            :class="sourceStatusClass(item.source.status)"
          >
            {{ sourceStatusLabel(item.source.status) }}
          </span>
          <span v-else class="status-pill status-error">等待数据</span>
        </header>

        <dl class="source-metrics">
          <div>
            <dt>请求耗时</dt>
            <dd>{{ formatLatency(item.source?.latencyMs ?? null) }}</dd>
          </div>
          <div>
            <dt>最近获取</dt>
            <dd>{{ formatTimestampDetailed(item.source?.fetchedAtMs ?? null) }}</dd>
          </div>
        </dl>

        <p v-if="item.source?.error" class="error-text">{{ item.source.error }}</p>
      </article>
    </section>

    <section class="panel compact-panel">
      <h2>响应耗时排行</h2>
      <ol>
        <li v-for="entry in latencyRanking" :key="entry.sourceKey" data-testid="latency-item">
          <span>{{ entry.label }}</span>
          <strong>{{ formatLatency(entry.source?.latencyMs ?? null) }}</strong>
        </li>
      </ol>
    </section>

    <section class="panel compact-panel">
      <h2>最近错误提示</h2>
      <p v-if="recentErrors.length === 0" class="quiet">暂无错误</p>
      <ul v-else class="error-list">
        <li v-for="message in recentErrors" :key="message">{{ message }}</li>
      </ul>
    </section>
  </main>
</template>

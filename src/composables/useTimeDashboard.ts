import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { calibrateBaseline, estimateServerMs, getPerfNow, isSmoothActive, type ClockBaseline } from '../clock-engine';
import type { AggregateResponse, SourceKey, SourceStatus, TimeSourceData } from '../types';
import {
  CALIBRATION_CONFIG,
  DISPLAY_TICK_MS,
  INTERVAL_STEP_SEC,
  MAIN_CLOCK_SOURCE_OPTIONS,
  MAX_ERROR_LOGS,
  MAX_INTERVAL_SEC,
  MIN_INTERVAL_SEC,
  SOURCE_META,
  SOURCE_ORDER,
  type GroupFilter,
  type MainClockSource
} from '../constants/time-dashboard';
import {
  clamp,
  formatClockTime,
  formatCountdown,
  formatLatency,
  formatMillisecondFraction,
  formatMillis,
  formatSignedMs,
  formatTimestampDetailedParts
} from '../utils/time-format';
import { usePictureInPictureClock } from './usePictureInPictureClock';

export type SourceCard = {
  sourceKey: SourceKey;
  label: string;
  icon: string;
  source: TimeSourceData | null;
  baseline: ClockBaseline | null;
  estimatedMs: number | null;
  offsetMs: number | null;
  status: SourceStatus;
};

export function useTimeDashboard() {
  const aggregate = ref<AggregateResponse | null>(null);
  const loading = ref(false);
  const autoCalibration = ref(true);
  const showMilliseconds = ref(true);
  const millisecondDigits = ref(1);
  const mobileSettingsExpanded = ref(false);
  const calibrationIntervalSec = ref<number>(10);
  const groupFilter = ref<GroupFilter>('all');
  const mainClockSource = ref<MainClockSource>('meituan');
  const recentErrors = ref<string[]>([]);
  const renderPerfNow = ref(getPerfNow());
  const calibrationAtMs = ref<number | null>(null);
  const clockBaselines = ref<Record<SourceKey, ClockBaseline | null>>(createEmptyBaselines());

  let displayTimer: number | null = null;
  let autoCalibrationTimer: number | null = null;
  let inFlightCalibration: Promise<void> | null = null;

  const calibrationIntervalMs = computed(() => calibrationIntervalSec.value * 1000);

  const sourceCards = computed<SourceCard[]>(() => {
    return SOURCE_ORDER.map((sourceKey) => {
      const source = aggregate.value?.sources[sourceKey] ?? null;
      const baseline = clockBaselines.value[sourceKey];
      const estimatedMs = baseline ? estimateServerMs(baseline, renderPerfNow.value) : (source?.serverTimeMs ?? null);
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
    const groups: Record<SourceStatus, SourceCard[]> = { ok: [], stale: [], error: [] };
    for (const card of sourceCards.value) {
      groups[card.status].push(card);
    }
    return groups;
  });

  const visibleGroups = computed(() => {
    const allGroups = [
      { key: 'ok' as const, title: '正常数据源', cards: groupedCards.value.ok },
      { key: 'stale' as const, title: '备用数据源', cards: groupedCards.value.stale },
      { key: 'error' as const, title: '错误数据源', cards: groupedCards.value.error }
    ];
    return groupFilter.value === 'all' ? allGroups : allGroups.filter((group) => group.key === groupFilter.value);
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

    return { okCount, staleCount, errorCount, avgLatency: latencyCount > 0 ? Math.round(latencyTotal / latencyCount) : null };
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
    return values.length % 2 === 1 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2);
  });

  const referenceOffsetMs = computed(() =>
    referenceTimeMs.value === null ? null : Math.trunc(referenceTimeMs.value - Date.now())
  );

  const mainClockState = computed(() => {
    if (mainClockSource.value === 'reference') {
      return { ms: referenceTimeMs.value, offsetMs: referenceOffsetMs.value };
    }

    const selected = sourceCards.value.find((item) => item.sourceKey === mainClockSource.value) ?? null;
    return { ms: selected?.estimatedMs ?? null, offsetMs: selected?.offsetMs ?? null };
  });

  const clockPrimaryParts = computed(() => ({
    time: formatClockTime(mainClockState.value.ms),
    fraction: showMilliseconds.value ? formatMillisecondFraction(mainClockState.value.ms, millisecondDigits.value) : null
  }));

  const clockSecondary = computed(() => {
    if (mainClockState.value.ms === null) {
      return null;
    }

    return {
      millis: formatMillis(mainClockState.value.ms, millisecondDigits.value),
      offset: formatSignedMs(mainClockState.value.offsetMs)
    };
  });

  const calibrationMode = computed<'calibrating' | 'smooth' | 'locked'>(() => {
    if (loading.value) {
      return 'calibrating';
    }

    const hasSmoothing = sourceCards.value.some((item) => item.baseline && isSmoothActive(item.baseline, renderPerfNow.value));
    return hasSmoothing ? 'smooth' : 'locked';
  });

  const calibrationModeLabel = computed(() =>
    calibrationMode.value === 'calibrating' ? '校准中' : calibrationMode.value === 'smooth' ? '平滑校正' : '已锁定'
  );

  const calibrationModeClass = computed(() => `mode-${calibrationMode.value}`);
  const generatedAtParts = computed(() => formatTimestampDetailedParts(aggregate.value?.generatedAtMs ?? null, millisecondDigits.value));

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

  const latencyRanking = computed(() =>
    sourceCards.value
      .filter((item) => item.source !== null)
      .slice()
      .sort((a, b) => (a.source?.latencyMs ?? Number.POSITIVE_INFINITY) - (b.source?.latencyMs ?? Number.POSITIVE_INFINITY))
  );

  const offsetRanking = computed(() =>
    sourceCards.value
      .filter((item) => item.offsetMs !== null)
      .slice()
      .sort((a, b) => Math.abs(b.offsetMs ?? 0) - Math.abs(a.offsetMs ?? 0))
  );

  async function calibrateNow(reason: 'manual' | 'auto' | 'initial' | 'visible' = 'manual') {
    if (inFlightCalibration) {
      await inFlightCalibration;
      return;
    }

    const task = (async () => {
      loading.value = true;
      try {
        const response = await fetch('/api/time/aggregate', { headers: { Accept: 'application/json' } });
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

      next[sourceKey] = calibrateBaseline(next[sourceKey], item.serverTimeMs, perfNow, wallNow, CALIBRATION_CONFIG);
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

      pushError(`${SOURCE_META[sourceKey].label} (${reason}): ${source.error ?? 'unknown_error'}`);
    }
  }

  function pushError(message: string) {
    const stamped = `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${message}`;
    recentErrors.value = [stamped, ...recentErrors.value].slice(0, MAX_ERROR_LOGS);
  }

  function startDisplayTimer() {
    stopDisplayTimer();
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
    stopAutoCalibrationTimer();
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

  const decreaseInterval = () => setCalibrationIntervalSec(calibrationIntervalSec.value - INTERVAL_STEP_SEC);
  const increaseInterval = () => setCalibrationIntervalSec(calibrationIntervalSec.value + INTERVAL_STEP_SEC);
  const setGroupFilter = (next: GroupFilter) => (groupFilter.value = next);
  const setMainClockSource = (next: MainClockSource) => (mainClockSource.value = next);
  const setMillisecondDigits = (next: number) => (millisecondDigits.value = clamp(Math.trunc(next), 1, 3));

  const pip = usePictureInPictureClock(computed(() => mainClockState.value.ms), pushError);

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
    pip.setupSupportFlags();
    if (autoCalibration.value) {
      startAutoCalibrationTimer();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onBeforeUnmount(() => {
    stopDisplayTimer();
    stopAutoCalibrationTimer();
    void pip.closePipClock();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  return {
    loading,
    autoCalibration,
    showMilliseconds,
    millisecondDigits,
    mobileSettingsExpanded,
    calibrationIntervalSec,
    groupFilter,
    mainClockSource,
    recentErrors,
    clockPrimaryParts,
    clockSecondary,
    calibrationModeLabel,
    calibrationModeClass,
    generatedAtParts,
    nextCalibrationText,
    summaryStats,
    visibleGroups,
    latencyRanking,
    offsetRanking,
    sourceCards,
    calibrateNow,
    decreaseInterval,
    increaseInterval,
    setCalibrationIntervalSec,
    setGroupFilter,
    setMainClockSource,
    setMillisecondDigits,
    formatLatency,
    formatSignedMs,
    formatMillis,
    formatMillisecondFraction,
    formatClockTime,
    formatTimestampDetailedParts,
    sourceStatusLabel,
    sourceStatusClass,
    MAIN_CLOCK_SOURCE_OPTIONS,
    pip
  };
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

function createEmptyBaselines(): Record<SourceKey, ClockBaseline | null> {
  return { taobao: null, meituan: null, suning: null };
}

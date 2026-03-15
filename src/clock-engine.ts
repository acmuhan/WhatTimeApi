export type DriftCorrectionMode = 'idle' | 'smooth' | 'instant';

export interface CalibrationConfig {
  driftThresholdMs: number;
  smoothDurationMs: number;
}

export interface ClockBaseline {
  anchorServerMs: number;
  anchorPerfNow: number;
  smoothDriftMs: number;
  smoothStartPerfNow: number;
  smoothDurationMs: number;
  lastDriftMs: number;
  lastCalibrationAtMs: number;
  correctionMode: DriftCorrectionMode;
}

const DEFAULT_CONFIG: CalibrationConfig = {
  driftThresholdMs: 120,
  smoothDurationMs: 700
};

export function getPerfNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

export function estimateServerMs(baseline: ClockBaseline, perfNow: number): number {
  const base = baseline.anchorServerMs + (perfNow - baseline.anchorPerfNow);

  if (baseline.correctionMode !== 'smooth') {
    return base;
  }

  const progress = smoothProgress(perfNow, baseline.smoothStartPerfNow, baseline.smoothDurationMs);
  return base + baseline.smoothDriftMs * progress;
}

export function isSmoothActive(baseline: ClockBaseline, perfNow: number): boolean {
  if (baseline.correctionMode !== 'smooth') {
    return false;
  }

  return smoothProgress(perfNow, baseline.smoothStartPerfNow, baseline.smoothDurationMs) < 1;
}

export function calibrateBaseline(
  previous: ClockBaseline | null,
  calibrationServerMs: number,
  perfNow: number,
  wallNow: number,
  config: CalibrationConfig = DEFAULT_CONFIG
): ClockBaseline {
  if (!previous) {
    return {
      anchorServerMs: calibrationServerMs,
      anchorPerfNow: perfNow,
      smoothDriftMs: 0,
      smoothStartPerfNow: perfNow,
      smoothDurationMs: config.smoothDurationMs,
      lastDriftMs: 0,
      lastCalibrationAtMs: wallNow,
      correctionMode: 'instant'
    };
  }

  const estimatedNow = estimateServerMs(previous, perfNow);
  const driftMs = calibrationServerMs - estimatedNow;

  if (Math.abs(driftMs) >= config.driftThresholdMs) {
    return {
      anchorServerMs: calibrationServerMs,
      anchorPerfNow: perfNow,
      smoothDriftMs: 0,
      smoothStartPerfNow: perfNow,
      smoothDurationMs: config.smoothDurationMs,
      lastDriftMs: driftMs,
      lastCalibrationAtMs: wallNow,
      correctionMode: 'instant'
    };
  }

  return {
    anchorServerMs: estimatedNow,
    anchorPerfNow: perfNow,
    smoothDriftMs: driftMs,
    smoothStartPerfNow: perfNow,
    smoothDurationMs: config.smoothDurationMs,
    lastDriftMs: driftMs,
    lastCalibrationAtMs: wallNow,
    correctionMode: 'smooth'
  };
}

function smoothProgress(perfNow: number, startPerfNow: number, durationMs: number): number {
  if (durationMs <= 0) {
    return 1;
  }

  const raw = (perfNow - startPerfNow) / durationMs;
  return clamp(raw, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

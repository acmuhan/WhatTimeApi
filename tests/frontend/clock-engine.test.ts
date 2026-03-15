import { describe, expect, it } from 'vitest';
import { calibrateBaseline, estimateServerMs, isSmoothActive, type ClockBaseline } from '../../src/clock-engine';

describe('clock-engine', () => {
  it('keeps time increasing after first calibration', () => {
    const baseline = calibrateBaseline(null, 100_000, 1_000, 50_000, {
      driftThresholdMs: 120,
      smoothDurationMs: 700
    });

    const t1 = estimateServerMs(baseline, 1_250);
    const t2 = estimateServerMs(baseline, 1_850);

    expect(t1).toBe(100_250);
    expect(t2).toBe(100_850);
  });

  it('uses smooth correction for small drift', () => {
    const first = calibrateBaseline(null, 100_000, 1_000, 50_000, {
      driftThresholdMs: 120,
      smoothDurationMs: 1_000
    });

    const second = calibrateBaseline(first, 100_560, 1_500, 50_500, {
      driftThresholdMs: 120,
      smoothDurationMs: 1_000
    });

    expect(second.correctionMode).toBe('smooth');
    expect(isSmoothActive(second, 1_900)).toBe(true);

    const midway = estimateServerMs(second, 2_000);
    expect(midway).toBe(101_030);

    const finished = estimateServerMs(second, 2_500);
    expect(finished).toBe(101_560);
  });

  it('uses instant correction for large drift', () => {
    const first = calibrateBaseline(null, 200_000, 10_000, 90_000, {
      driftThresholdMs: 120,
      smoothDurationMs: 700
    });

    const second = calibrateBaseline(first, 201_000, 10_500, 90_500, {
      driftThresholdMs: 120,
      smoothDurationMs: 700
    });

    expect(second.correctionMode).toBe('instant');
    expect(second.anchorServerMs).toBe(201_000);
    expect(estimateServerMs(second, 10_750)).toBe(201_250);
  });

  it('marks smooth mode inactive after duration', () => {
    const state: ClockBaseline = {
      anchorServerMs: 100_000,
      anchorPerfNow: 1_000,
      smoothDriftMs: 60,
      smoothStartPerfNow: 1_500,
      smoothDurationMs: 500,
      lastDriftMs: 60,
      lastCalibrationAtMs: 2_000,
      correctionMode: 'smooth'
    };

    expect(isSmoothActive(state, 1_800)).toBe(true);
    expect(isSmoothActive(state, 2_100)).toBe(false);
  });
});

<script setup lang="ts">
import {
  INTERVAL_PRESETS,
  MILLISECOND_DIGIT_OPTIONS,
  MAIN_CLOCK_SOURCE_OPTIONS,
  type GroupFilter,
  type MainClockSource
} from '../constants/time-dashboard';

defineProps<{
  calibrationModeLabel: string;
  calibrationModeClass: string;
  clockPrimaryParts: { time: string; fraction: string | null };
  clockSecondary: { millis: string; offset: string } | null;
  generatedAtParts: { head: string; tail: string | null };
  nextCalibrationText: string;
  autoCalibration: boolean;
  loading: boolean;
  mainClockSource: MainClockSource;
  pipSupported: boolean;
  pipActive: boolean;
  pipModeLabel: string;
  mobileSettingsExpanded: boolean;
  calibrationIntervalSec: number;
  groupFilter: GroupFilter;
  showMilliseconds: boolean;
  millisecondDigits: number;
}>();

const emit = defineEmits<{
  toggleAutoCalibration: [];
  calibrateNow: [];
  setMainClockSource: [value: MainClockSource];
  togglePip: [];
  toggleMobileSettings: [];
  decreaseInterval: [];
  increaseInterval: [];
  setCalibrationIntervalSec: [value: number];
  setGroupFilter: [value: GroupFilter];
  toggleMilliseconds: [];
  setMillisecondDigits: [value: number];
}>();
</script>

<template>
  <section class="hero-panel">
    <div class="hero-panel__header">
      <div>
        <p class="eyebrow">REFERENCE CLOCK</p>
        <h2>主时间读数</h2>
      </div>
      <span class="mode-pill" :class="calibrationModeClass" data-testid="calibration-mode">{{ calibrationModeLabel }}</span>
    </div>

    <div class="hero-panel__display">
      <div class="hero-panel__time-block">
        <p class="hero-panel__source">SOURCE · {{ MAIN_CLOCK_SOURCE_OPTIONS.find((option) => option.key === mainClockSource)?.label ?? '未知' }}</p>
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
      </div>

      <div class="hero-panel__meta-rail">
        <div class="meta-block">
          <span>LAST CAL</span>
          <strong>
            {{ generatedAtParts.head }}
            <template v-if="generatedAtParts.tail !== null">.<span class="ms-accent">{{ generatedAtParts.tail }}</span></template>
          </strong>
        </div>
        <div class="meta-block">
          <span>NEXT CAL</span>
          <strong data-testid="next-calibration">{{ nextCalibrationText }}</strong>
        </div>
        <div class="meta-block">
          <span>PIP</span>
          <strong>{{ pipActive ? '运行中' : pipSupported ? '可开启' : '不支持' }}</strong>
        </div>
      </div>
    </div>

    <div class="control-zone">
      <div class="action-strip">
        <button type="button" class="speed-button speed-button--ghost" :class="autoCalibration ? 'is-active' : ''" data-testid="auto-calibration-toggle" @click="emit('toggleAutoCalibration')">{{ autoCalibration ? '自动: 开启' : '自动: 关闭' }}</button>
        <button type="button" class="speed-button speed-button--solid" :disabled="loading" data-testid="manual-calibrate" @click="emit('calibrateNow')">{{ loading ? '校准中...' : '立即校准' }}</button>
        <button type="button" class="speed-button speed-button--ghost" :class="pipActive ? 'is-active' : ''" :disabled="!pipSupported && !pipActive" data-testid="pip-toggle" @click="emit('togglePip')">{{ !pipSupported && !pipActive ? '画中画: 不支持' : pipActive ? '画中画: 关闭' : '画中画: 开启' }}</button>
      </div>

      <div class="control-row">
        <label class="control-label">主时钟源</label>
        <div class="track-switch">
          <button
            v-for="option in MAIN_CLOCK_SOURCE_OPTIONS"
            :key="option.key"
            type="button"
            class="track-switch__button"
            :class="mainClockSource === option.key ? 'is-active' : ''"
            :data-testid="`clock-source-${option.key}`"
            @click="emit('setMainClockSource', option.key)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="control-row">
        <label class="control-label">刷新间隔</label>
        <div class="control-inline">
          <div class="stepper-control">
            <button type="button" class="stepper-control__button" data-testid="interval-dec" @click="emit('decreaseInterval')">−</button>
            <span class="interval-value" data-testid="interval-value">{{ calibrationIntervalSec }}s</span>
            <button type="button" class="stepper-control__button" data-testid="interval-inc" @click="emit('increaseInterval')">+</button>
          </div>
          <div class="track-switch track-switch--compact">
            <button v-for="preset in INTERVAL_PRESETS" :key="preset" type="button" class="track-switch__button" :class="calibrationIntervalSec === preset ? 'is-active' : ''" :data-testid="`preset-${preset}`" @click="emit('setCalibrationIntervalSec', preset)">{{ preset }}s</button>
          </div>
        </div>
      </div>
    </div>

    <button type="button" class="settings-toggle" data-testid="settings-toggle" @click="emit('toggleMobileSettings')">{{ mobileSettingsExpanded ? '收起更多设置' : '更多设置' }}</button>

    <div class="sub-controls" :class="{ 'is-expanded': mobileSettingsExpanded }">
      <div class="control-row">
        <label class="control-label">分组筛选</label>
        <div class="track-switch">
          <button type="button" class="track-switch__button" :class="groupFilter === 'all' ? 'is-active' : ''" data-testid="filter-all" @click="emit('setGroupFilter', 'all')">全部</button>
          <button type="button" class="track-switch__button" :class="groupFilter === 'ok' ? 'is-active' : ''" data-testid="filter-ok" @click="emit('setGroupFilter', 'ok')">正常</button>
          <button type="button" class="track-switch__button" :class="groupFilter === 'stale' ? 'is-active' : ''" data-testid="filter-stale" @click="emit('setGroupFilter', 'stale')">过期</button>
          <button type="button" class="track-switch__button" :class="groupFilter === 'error' ? 'is-active' : ''" data-testid="filter-error" @click="emit('setGroupFilter', 'error')">错误</button>
        </div>
      </div>

      <div class="control-row control-row--last">
        <label class="control-label">毫秒显示</label>
        <div class="control-inline">
          <button type="button" class="speed-button speed-button--ghost" :class="showMilliseconds ? 'is-active' : ''" data-testid="millis-toggle" @click="emit('toggleMilliseconds')">{{ showMilliseconds ? '毫秒: 显示' : '毫秒: 隐藏' }}</button>
          <div class="track-switch track-switch--compact">
            <button v-for="digits in MILLISECOND_DIGIT_OPTIONS" :key="digits" type="button" class="track-switch__button" :class="millisecondDigits === digits ? 'is-active' : ''" :data-testid="`millis-digits-${digits}`" @click="emit('setMillisecondDigits', digits)">{{ digits }}位</button>
          </div>
          <span class="support-text">PiP 模式：{{ pipModeLabel }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

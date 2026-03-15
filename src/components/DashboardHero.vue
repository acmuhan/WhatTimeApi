<script setup lang="ts">
import { INTERVAL_PRESETS, MILLISECOND_DIGIT_OPTIONS, MAIN_CLOCK_SOURCE_OPTIONS, type GroupFilter, type MainClockSource } from '../constants/time-dashboard';

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
  <section class="panel hero-panel">
    <div class="hero-top">
      <p class="kicker">OpenRealm 时间控制台</p>
      <span class="mode-pill" :class="calibrationModeClass" data-testid="calibration-mode">{{ calibrationModeLabel }}</span>
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
          <button type="button" class="pill-btn" :class="autoCalibration ? 'is-active' : ''" data-testid="auto-calibration-toggle" @click="emit('toggleAutoCalibration')">{{ autoCalibration ? '自动: 开启' : '自动: 关闭' }}</button>
          <button type="button" class="pill-btn" :disabled="loading" data-testid="manual-calibrate" @click="emit('calibrateNow')">{{ loading ? '校准中...' : '立即校准' }}</button>
        </div>
      </div>

      <div class="control-card">
        <p class="control-title">主时钟源</p>
        <div class="group-row">
          <button v-for="option in MAIN_CLOCK_SOURCE_OPTIONS" :key="option.key" type="button" class="group-btn" :class="mainClockSource === option.key ? 'is-active' : ''" :data-testid="`clock-source-${option.key}`" @click="emit('setMainClockSource', option.key)">{{ option.label }}</button>
        </div>
      </div>

      <div class="control-card">
        <p class="control-title">画中画（{{ pipModeLabel }}）</p>
        <div class="action-row">
          <button type="button" class="pill-btn" :class="pipActive ? 'is-active' : ''" :disabled="!pipSupported && !pipActive" data-testid="pip-toggle" @click="emit('togglePip')">{{ !pipSupported && !pipActive ? '画中画: 不支持' : (pipActive ? '画中画: 关闭' : '画中画: 开启') }}</button>
        </div>
      </div>
    </div>

    <button type="button" class="settings-toggle" data-testid="settings-toggle" @click="emit('toggleMobileSettings')">{{ mobileSettingsExpanded ? '收起设置' : '更多设置' }}</button>

    <div class="controls-grid controls-grid-extra" :class="{ 'is-expanded': mobileSettingsExpanded }">
      <div class="control-card">
        <p class="control-title">刷新间隔 (最小10秒)</p>
        <div class="interval-box">
          <button type="button" class="icon-btn" data-testid="interval-dec" @click="emit('decreaseInterval')">-</button>
          <span class="interval-value" data-testid="interval-value">{{ calibrationIntervalSec }}s</span>
          <button type="button" class="icon-btn" data-testid="interval-inc" @click="emit('increaseInterval')">+</button>
        </div>
        <div class="preset-row">
          <button v-for="preset in INTERVAL_PRESETS" :key="preset" type="button" class="preset-btn" :class="calibrationIntervalSec === preset ? 'is-active' : ''" :data-testid="`preset-${preset}`" @click="emit('setCalibrationIntervalSec', preset)">{{ preset }}s</button>
        </div>
      </div>

      <div class="control-card">
        <p class="control-title">分组筛选</p>
        <div class="group-row">
          <button type="button" class="group-btn" :class="groupFilter === 'all' ? 'is-active' : ''" data-testid="filter-all" @click="emit('setGroupFilter', 'all')">全部</button>
          <button type="button" class="group-btn" :class="groupFilter === 'ok' ? 'is-active' : ''" data-testid="filter-ok" @click="emit('setGroupFilter', 'ok')">正常</button>
          <button type="button" class="group-btn" :class="groupFilter === 'stale' ? 'is-active' : ''" data-testid="filter-stale" @click="emit('setGroupFilter', 'stale')">过期</button>
          <button type="button" class="group-btn" :class="groupFilter === 'error' ? 'is-active' : ''" data-testid="filter-error" @click="emit('setGroupFilter', 'error')">错误</button>
        </div>
      </div>

      <div class="control-card">
        <p class="control-title">时间显示</p>
        <div class="action-row">
          <button type="button" class="pill-btn" :class="showMilliseconds ? 'is-active' : ''" data-testid="millis-toggle" @click="emit('toggleMilliseconds')">{{ showMilliseconds ? '毫秒: 显示' : '毫秒: 隐藏' }}</button>
        </div>
        <div class="preset-row">
          <button v-for="digits in MILLISECOND_DIGIT_OPTIONS" :key="digits" type="button" class="preset-btn" :class="millisecondDigits === digits ? 'is-active' : ''" :data-testid="`millis-digits-${digits}`" @click="emit('setMillisecondDigits', digits)">{{ digits }}位</button>
        </div>
      </div>
    </div>
  </section>
</template>

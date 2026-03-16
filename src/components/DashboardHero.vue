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
    <div class="hero-headline">
      <div>
        <p class="hero-kicker">Reference Time</p>
        <h2>当前时间</h2>
      </div>
      <span class="mode-pill" :class="calibrationModeClass" data-testid="calibration-mode">{{ calibrationModeLabel }}</span>
    </div>

    <div class="hero-stage">
      <div class="hero-stage__primary">
        <p class="hero-stage__source">主时钟源 · {{ MAIN_CLOCK_SOURCE_OPTIONS.find((option) => option.key === mainClockSource)?.label ?? '未知' }}</p>
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

      <div class="hero-stage__meta">
        <div class="meta-line">
          <span>上次校准</span>
          <strong>
            {{ generatedAtParts.head }}
            <template v-if="generatedAtParts.tail !== null">.<span class="ms-accent">{{ generatedAtParts.tail }}</span></template>
          </strong>
        </div>
        <div class="meta-line">
          <span>下次校准</span>
          <strong data-testid="next-calibration">{{ nextCalibrationText }}</strong>
        </div>
        <div class="meta-line">
          <span>画中画</span>
          <strong>{{ pipActive ? '运行中' : pipSupported ? '可开启' : '不支持' }}</strong>
        </div>
      </div>
    </div>

    <div class="control-sections">
      <div class="control-line">
        <label class="line-label">操作</label>
        <div class="line-actions">
          <button type="button" class="pill-btn pill-btn--secondary" :class="autoCalibration ? 'is-active' : ''" data-testid="auto-calibration-toggle" @click="emit('toggleAutoCalibration')">{{ autoCalibration ? '自动: 开启' : '自动: 关闭' }}</button>
          <button type="button" class="pill-btn pill-btn--primary" :disabled="loading" data-testid="manual-calibrate" @click="emit('calibrateNow')">{{ loading ? '校准中...' : '立即校准' }}</button>
          <button type="button" class="pill-btn pill-btn--secondary" :class="pipActive ? 'is-active' : ''" :disabled="!pipSupported && !pipActive" data-testid="pip-toggle" @click="emit('togglePip')">{{ !pipSupported && !pipActive ? '画中画: 不支持' : pipActive ? '画中画: 关闭' : '画中画: 开启' }}</button>
        </div>
      </div>

      <div class="control-line">
        <label class="line-label">主时钟源</label>
        <div class="line-actions line-actions--segmented">
          <button
            v-for="option in MAIN_CLOCK_SOURCE_OPTIONS"
            :key="option.key"
            type="button"
            class="group-btn"
            :class="mainClockSource === option.key ? 'is-active' : ''"
            :data-testid="`clock-source-${option.key}`"
            @click="emit('setMainClockSource', option.key)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="control-line">
        <label class="line-label">刷新间隔</label>
        <div class="line-actions line-actions--wrap">
          <div class="interval-box">
            <button type="button" class="icon-btn icon-btn--step" data-testid="interval-dec" @click="emit('decreaseInterval')">−</button>
            <span class="interval-value" data-testid="interval-value">{{ calibrationIntervalSec }}s</span>
            <button type="button" class="icon-btn icon-btn--step" data-testid="interval-inc" @click="emit('increaseInterval')">+</button>
          </div>
          <div class="inline-presets">
            <button v-for="preset in INTERVAL_PRESETS" :key="preset" type="button" class="preset-btn" :class="calibrationIntervalSec === preset ? 'is-active' : ''" :data-testid="`preset-${preset}`" @click="emit('setCalibrationIntervalSec', preset)">{{ preset }}s</button>
          </div>
        </div>
      </div>
    </div>

    <button type="button" class="settings-toggle" data-testid="settings-toggle" @click="emit('toggleMobileSettings')">{{ mobileSettingsExpanded ? '收起高级设置' : '展开高级设置' }}</button>

    <div class="sub-controls" :class="{ 'is-expanded': mobileSettingsExpanded }">
      <div class="control-line">
        <label class="line-label">分组筛选</label>
        <div class="line-actions line-actions--segmented">
          <button type="button" class="group-btn" :class="groupFilter === 'all' ? 'is-active' : ''" data-testid="filter-all" @click="emit('setGroupFilter', 'all')">全部</button>
          <button type="button" class="group-btn" :class="groupFilter === 'ok' ? 'is-active' : ''" data-testid="filter-ok" @click="emit('setGroupFilter', 'ok')">正常</button>
          <button type="button" class="group-btn" :class="groupFilter === 'stale' ? 'is-active' : ''" data-testid="filter-stale" @click="emit('setGroupFilter', 'stale')">过期</button>
          <button type="button" class="group-btn" :class="groupFilter === 'error' ? 'is-active' : ''" data-testid="filter-error" @click="emit('setGroupFilter', 'error')">错误</button>
        </div>
      </div>

      <div class="control-line control-line--last">
        <label class="line-label">毫秒显示</label>
        <div class="line-actions line-actions--wrap">
          <button type="button" class="pill-btn" :class="showMilliseconds ? 'is-active' : ''" data-testid="millis-toggle" @click="emit('toggleMilliseconds')">{{ showMilliseconds ? '毫秒: 显示' : '毫秒: 隐藏' }}</button>
          <div class="inline-presets">
            <button v-for="digits in MILLISECOND_DIGIT_OPTIONS" :key="digits" type="button" class="preset-btn" :class="millisecondDigits === digits ? 'is-active' : ''" :data-testid="`millis-digits-${digits}`" @click="emit('setMillisecondDigits', digits)">{{ digits }}位</button>
          </div>
          <span class="support-text">PiP 模式：{{ pipModeLabel }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

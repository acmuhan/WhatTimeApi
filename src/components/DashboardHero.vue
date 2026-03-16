<script setup lang="ts">
import {
  INTERVAL_PRESETS,
  MILLISECOND_DIGIT_OPTIONS,
  type GroupFilter,
  type MainClockSource
} from '../constants/time-dashboard';
import type { DashboardCopy, DashboardLocale, DashboardTheme } from '../composables/useDashboardUi';

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
  sourceOptions: ReadonlyArray<{ key: MainClockSource; label: string }>;
  copy: DashboardCopy;
  theme: DashboardTheme;
  locale: DashboardLocale;
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
  toggleTheme: [];
  toggleLocale: [];
}>();
</script>

<template>
  <section class="hero-panel">
    <div class="hero-panel__header">
      <div>
        <p class="eyebrow">{{ copy.hero.eyebrow }}</p>
        <h2>{{ copy.hero.title }}</h2>
      </div>

      <div class="hero-panel__header-side">
        <div class="hero-panel__toggles">
          <button type="button" class="speed-button speed-button--ghost speed-button--micro" @click="emit('toggleTheme')">
            {{ copy.hero.themeLabel }} · {{ theme === 'dark' ? copy.hero.themeDark : copy.hero.themeLight }}
          </button>
          <button type="button" class="speed-button speed-button--ghost speed-button--micro" @click="emit('toggleLocale')">
            {{ copy.hero.languageLabel }} · {{ locale === 'zh' ? copy.hero.languageZh : copy.hero.languageEn }}
          </button>
        </div>
        <span class="mode-pill" :class="calibrationModeClass" data-testid="calibration-mode">{{ calibrationModeLabel }}</span>
      </div>
    </div>

    <div class="hero-panel__display">
      <div class="hero-panel__time-block">
        <div class="hero-panel__speedline" aria-hidden="true">
          <span class="hero-panel__speedline-badge">{{ copy.hero.speedlineBadge }}</span>
          <span class="hero-panel__speedline-track">
            <i />
            <i />
            <i />
          </span>
          <span class="hero-panel__speedline-copy">{{ copy.hero.speedlineCopy }}</span>
        </div>
        <p class="hero-panel__source">{{ copy.hero.sourcePrefix }} {{ sourceOptions.find((option) => option.key === mainClockSource)?.label ?? copy.hero.sourceUnknown }}</p>
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
            <span> · {{ copy.hero.offsetPrefix }} {{ clockSecondary.offset }}</span>
          </template>
          <template v-else>{{ copy.hero.offsetEmpty }}</template>
        </p>
      </div>

      <div class="hero-panel__meta-rail">
        <div class="meta-block">
          <span>{{ copy.hero.metaLastCal }}</span>
          <strong>
            {{ generatedAtParts.head }}
            <template v-if="generatedAtParts.tail !== null">.<span class="ms-accent">{{ generatedAtParts.tail }}</span></template>
          </strong>
        </div>
        <div class="meta-block">
          <span>{{ copy.hero.metaNextCal }}</span>
          <strong data-testid="next-calibration">{{ nextCalibrationText }}</strong>
        </div>
        <div class="meta-block">
          <span>{{ copy.hero.metaPip }}</span>
          <strong>{{ pipActive ? copy.hero.pipRunning : pipSupported ? copy.hero.pipAvailable : copy.hero.pipUnsupported }}</strong>
        </div>
      </div>
    </div>

    <div class="control-zone">
      <div class="action-strip">
        <button type="button" class="speed-button speed-button--ghost" :class="autoCalibration ? 'is-active' : ''" data-testid="auto-calibration-toggle" @click="emit('toggleAutoCalibration')">{{ autoCalibration ? copy.hero.autoOn : copy.hero.autoOff }}</button>
        <button type="button" class="speed-button speed-button--solid" :disabled="loading" data-testid="manual-calibrate" @click="emit('calibrateNow')">{{ loading ? copy.hero.calibrating : copy.hero.calibrateNow }}</button>
        <button type="button" class="speed-button speed-button--ghost" :class="pipActive ? 'is-active' : ''" :disabled="!pipSupported && !pipActive" data-testid="pip-toggle" @click="emit('togglePip')">{{ !pipSupported && !pipActive ? copy.hero.pipUnsupportedAction : pipActive ? copy.hero.pipClose : copy.hero.pipOpen }}</button>
      </div>

      <div class="control-row">
        <label class="control-label">{{ copy.hero.sourceControl }}</label>
        <div class="track-switch">
          <button
            v-for="option in sourceOptions"
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
        <label class="control-label">{{ copy.hero.intervalControl }}</label>
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

    <button type="button" class="settings-toggle" data-testid="settings-toggle" @click="emit('toggleMobileSettings')">{{ mobileSettingsExpanded ? copy.hero.settingsLess : copy.hero.settingsMore }}</button>

    <div class="sub-controls" :class="{ 'is-expanded': mobileSettingsExpanded }">
      <div class="control-row">
        <label class="control-label">{{ copy.hero.filterControl }}</label>
        <div class="track-switch">
          <button type="button" class="track-switch__button" :class="groupFilter === 'all' ? 'is-active' : ''" data-testid="filter-all" @click="emit('setGroupFilter', 'all')">{{ copy.hero.filters.all }}</button>
          <button type="button" class="track-switch__button" :class="groupFilter === 'ok' ? 'is-active' : ''" data-testid="filter-ok" @click="emit('setGroupFilter', 'ok')">{{ copy.hero.filters.ok }}</button>
          <button type="button" class="track-switch__button" :class="groupFilter === 'stale' ? 'is-active' : ''" data-testid="filter-stale" @click="emit('setGroupFilter', 'stale')">{{ copy.hero.filters.stale }}</button>
          <button type="button" class="track-switch__button" :class="groupFilter === 'error' ? 'is-active' : ''" data-testid="filter-error" @click="emit('setGroupFilter', 'error')">{{ copy.hero.filters.error }}</button>
        </div>
      </div>

      <div class="control-row control-row--last">
        <label class="control-label">{{ copy.hero.millisControl }}</label>
        <div class="control-inline">
          <button type="button" class="speed-button speed-button--ghost" :class="showMilliseconds ? 'is-active' : ''" data-testid="millis-toggle" @click="emit('toggleMilliseconds')">{{ showMilliseconds ? copy.hero.millisShow : copy.hero.millisHide }}</button>
          <div class="track-switch track-switch--compact">
            <button v-for="digits in MILLISECOND_DIGIT_OPTIONS" :key="digits" type="button" class="track-switch__button" :class="millisecondDigits === digits ? 'is-active' : ''" :data-testid="`millis-digits-${digits}`" @click="emit('setMillisecondDigits', digits)">{{ locale === 'zh' ? `${digits}位` : `${digits} d` }}</button>
          </div>
          <span class="support-text">{{ copy.hero.pipModePrefix }}{{ pipModeLabel }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

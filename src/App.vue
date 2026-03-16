<script setup lang="ts">
import { computed } from 'vue';
import DashboardHero from './components/DashboardHero.vue';
import ErrorLogPanel from './components/ErrorLogPanel.vue';
import RankingsPanel from './components/RankingsPanel.vue';
import SourceGroups from './components/SourceGroups.vue';
import TelemetryCharts from './components/TelemetryCharts.vue';
import { useTimeDashboard } from './composables/useTimeDashboard';
import { useDashboardUi } from './composables/useDashboardUi';
import type { SourceKey } from './types';

const {
  calibrationModeLabel,
  calibrationModeClass,
  clockPrimaryParts,
  clockSecondary,
  generatedAtParts,
  nextCalibrationText,
  autoCalibration,
  loading,
  mainClockSource,
  mobileSettingsExpanded,
  calibrationIntervalSec,
  groupFilter,
  showMilliseconds,
  millisecondDigits,
  summaryStats,
  visibleGroups,
  latencyRanking,
  offsetRanking,
  sourceCards,
  recentErrors,
  calibrateNow,
  setMainClockSource,
  decreaseInterval,
  increaseInterval,
  setCalibrationIntervalSec,
  setGroupFilter,
  setMillisecondDigits,
  formatClockTime,
  formatMillisecondFraction,
  formatMillis,
  formatSignedMs,
  formatLatency,
  formatTimestampDetailedParts,
  sourceStatusClass,
  pip
} = useTimeDashboard();

const { pipSupported, pipActive, pipModeLabel, togglePipClock } = pip;

const { theme, locale, copy, mainClockSourceOptions, sourceLabel, statusLabel, toggleTheme, toggleLocale } = useDashboardUi();

const localizedVisibleGroups = computed(() =>
  visibleGroups.value.map((group) => ({
    ...group,
    title: copy.value.groups[group.key].title
  }))
);

const activeSourceKey = computed<SourceKey>(() => (mainClockSource.value === 'reference' ? 'meituan' : mainClockSource.value));
</script>

<template>
  <main class="velocity-page">
    <div class="velocity-page__noise" aria-hidden="true" />
    <div class="velocity-page__flare velocity-page__flare--a" aria-hidden="true" />
    <div class="velocity-page__flare velocity-page__flare--b" aria-hidden="true" />

    <section class="velocity-shell">
      <section class="velocity-stage">
        <DashboardHero
          :calibration-mode-label="calibrationModeLabel"
          :calibration-mode-class="calibrationModeClass"
          :clock-primary-parts="clockPrimaryParts"
          :clock-secondary="clockSecondary"
          :generated-at-parts="generatedAtParts"
          :next-calibration-text="nextCalibrationText"
          :auto-calibration="autoCalibration"
          :loading="loading"
          :main-clock-source="mainClockSource"
          :pip-supported="pipSupported"
          :pip-active="pipActive"
          :pip-mode-label="pipModeLabel"
          :mobile-settings-expanded="mobileSettingsExpanded"
          :calibration-interval-sec="calibrationIntervalSec"
          :group-filter="groupFilter"
          :show-milliseconds="showMilliseconds"
          :millisecond-digits="millisecondDigits"
          :source-options="mainClockSourceOptions"
          :copy="copy"
          :theme="theme"
          :locale="locale"
          @toggle-auto-calibration="autoCalibration = !autoCalibration"
          @calibrate-now="calibrateNow('manual')"
          @set-main-clock-source="setMainClockSource"
          @toggle-pip="togglePipClock"
          @toggle-mobile-settings="mobileSettingsExpanded = !mobileSettingsExpanded"
          @decrease-interval="decreaseInterval"
          @increase-interval="increaseInterval"
          @set-calibration-interval-sec="setCalibrationIntervalSec"
          @set-group-filter="setGroupFilter"
          @toggle-milliseconds="showMilliseconds = !showMilliseconds"
          @set-millisecond-digits="setMillisecondDigits"
          @toggle-theme="toggleTheme"
          @toggle-locale="toggleLocale"
        />
      </section>

      <section class="velocity-kpis" aria-label="summary">
        <article class="velocity-kpi velocity-kpi--primary">
          <span>{{ copy.summary.avgLatency }}</span>
          <strong>{{ formatLatency(summaryStats.avgLatency) }}</strong>
        </article>
        <article class="velocity-kpi">
          <span>{{ copy.summary.ok }}</span>
          <strong>{{ summaryStats.okCount }}</strong>
        </article>
        <article class="velocity-kpi">
          <span>{{ copy.summary.stale }}</span>
          <strong>{{ summaryStats.staleCount }}</strong>
        </article>
        <article class="velocity-kpi">
          <span>{{ copy.summary.error }}</span>
          <strong>{{ summaryStats.errorCount }}</strong>
        </article>
      </section>

      <section class="velocity-surface velocity-surface--charts">
        <TelemetryCharts
          :source-cards="sourceCards"
          :copy="copy"
          :source-label="sourceLabel"
          :status-label="statusLabel"
          :active-source-key="activeSourceKey"
          :main-clock-source="mainClockSource"
        />
      </section>

      <section class="velocity-section-head">
        <p class="eyebrow">{{ copy.sourceFeed.eyebrow }}</p>
        <h2>{{ copy.sourceFeed.title }}</h2>
      </section>

      <section class="velocity-grid">
        <div class="velocity-grid__main velocity-surface velocity-surface--main">
          <SourceGroups
            :groups="localizedVisibleGroups"
            :copy="copy"
            :source-label="sourceLabel"
            :status-label="statusLabel"
            :show-milliseconds="showMilliseconds"
            :millisecond-digits="millisecondDigits"
            :format-clock-time="formatClockTime"
            :format-millisecond-fraction="formatMillisecondFraction"
            :format-millis="formatMillis"
            :format-signed-ms="formatSignedMs"
            :format-latency="formatLatency"
            :format-timestamp-detailed-parts="formatTimestampDetailedParts"
            :source-status-class="sourceStatusClass"
          />
        </div>

        <aside class="velocity-grid__side">
          <div class="velocity-surface velocity-surface--side">
            <RankingsPanel
              :latency-ranking="latencyRanking"
              :offset-ranking="offsetRanking"
              :copy="copy"
              :source-label="sourceLabel"
              :format-latency="formatLatency"
              :format-signed-ms="formatSignedMs"
            />
          </div>
          <div class="velocity-surface velocity-surface--side">
            <ErrorLogPanel :recent-errors="recentErrors" :copy="copy" />
          </div>
        </aside>
      </section>
    </section>
  </main>
</template>

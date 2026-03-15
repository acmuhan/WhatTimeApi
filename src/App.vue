<script setup lang="ts">
import DashboardHero from './components/DashboardHero.vue';
import ErrorLogPanel from './components/ErrorLogPanel.vue';
import RankingsPanel from './components/RankingsPanel.vue';
import SourceGroups from './components/SourceGroups.vue';
import { useTimeDashboard } from './composables/useTimeDashboard';

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
  sourceStatusLabel,
  sourceStatusClass,
  pip
} = useTimeDashboard();

const { pipSupported, pipActive, pipModeLabel, togglePipClock } = pip;
</script>

<template>
  <main class="time-layout">
    <div class="bg-orb bg-orb-a" aria-hidden="true" />
    <div class="bg-orb bg-orb-b" aria-hidden="true" />

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
    />

    <section class="summary-grid">
      <article class="panel summary-card">
        <p>平均延迟</p>
        <strong>{{ formatLatency(summaryStats.avgLatency) }}</strong>
      </article>
    </section>

    <SourceGroups
      :groups="visibleGroups"
      :show-milliseconds="showMilliseconds"
      :millisecond-digits="millisecondDigits"
      :format-clock-time="formatClockTime"
      :format-millisecond-fraction="formatMillisecondFraction"
      :format-millis="formatMillis"
      :format-signed-ms="formatSignedMs"
      :format-latency="formatLatency"
      :format-timestamp-detailed-parts="formatTimestampDetailedParts"
      :source-status-label="sourceStatusLabel"
      :source-status-class="sourceStatusClass"
    />

    <RankingsPanel
      :latency-ranking="latencyRanking"
      :offset-ranking="offsetRanking"
      :format-latency="formatLatency"
      :format-signed-ms="formatSignedMs"
    />

    <ErrorLogPanel :recent-errors="recentErrors" />
  </main>
</template>

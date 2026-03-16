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
  <main class="velocity-page">
    <div class="velocity-page__noise" aria-hidden="true" />
    <div class="velocity-page__flare velocity-page__flare--a" aria-hidden="true" />
    <div class="velocity-page__flare velocity-page__flare--b" aria-hidden="true" />

    <section class="velocity-shell">
      <header class="velocity-intro">
        <p class="eyebrow">WHATTIME // SPEED VIEW</p>
        <h1>时间，应该像速度一样一眼就到。</h1>
        <p class="velocity-intro__copy">
          重新设计成速度优先的读数界面。更强对比、更少装饰、更快扫读，把主时钟、延迟、偏差和状态压进一条干净的视觉轨道里。
        </p>
      </header>

      <section class="velocity-kpis" aria-label="summary">
        <article class="velocity-kpi velocity-kpi--primary">
          <span>AVG LATENCY</span>
          <strong>{{ formatLatency(summaryStats.avgLatency) }}</strong>
        </article>
        <article class="velocity-kpi">
          <span>OK</span>
          <strong>{{ summaryStats.okCount }}</strong>
        </article>
        <article class="velocity-kpi">
          <span>STALE</span>
          <strong>{{ summaryStats.staleCount }}</strong>
        </article>
        <article class="velocity-kpi">
          <span>ERROR</span>
          <strong>{{ summaryStats.errorCount }}</strong>
        </article>
      </section>

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
      </section>

      <section class="velocity-section-head">
        <p class="eyebrow">SOURCE FEED</p>
        <h2>所有时间源，全部进主赛道。</h2>
      </section>

      <section class="velocity-grid">
        <div class="velocity-grid__main velocity-surface velocity-surface--main">
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
        </div>

        <aside class="velocity-grid__side">
          <div class="velocity-surface velocity-surface--side">
            <RankingsPanel
              :latency-ranking="latencyRanking"
              :offset-ranking="offsetRanking"
              :format-latency="formatLatency"
              :format-signed-ms="formatSignedMs"
            />
          </div>
          <div class="velocity-surface velocity-surface--side">
            <ErrorLogPanel :recent-errors="recentErrors" />
          </div>
        </aside>
      </section>
    </section>
  </main>
</template>

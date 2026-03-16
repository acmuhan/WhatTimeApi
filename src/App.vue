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
    <div class="ambient ambient-a" aria-hidden="true" />
    <div class="ambient ambient-b" aria-hidden="true" />

    <section class="shell">
      <header class="page-header">
        <div class="page-header__copy">
          <p class="page-kicker">WhatTimeApi</p>
          <h1>时间控制台</h1>
          <p class="page-subtitle">更安静、更精确的多源时间界面。重点只留给时间本身。</p>
        </div>

        <div class="page-header__meta">
          <span class="meta-pill">{{ autoCalibration ? '自动校准' : '手动模式' }}</span>
          <span class="meta-pill">{{ calibrationIntervalSec }}s</span>
        </div>
      </header>

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

      <section class="overview-strip" aria-label="summary">
        <article class="overview-item overview-item--primary">
          <span>平均延迟</span>
          <strong>{{ formatLatency(summaryStats.avgLatency) }}</strong>
        </article>
        <article class="overview-item">
          <span>正常源</span>
          <strong>{{ summaryStats.okCount }}</strong>
        </article>
        <article class="overview-item">
          <span>回退源</span>
          <strong>{{ summaryStats.staleCount }}</strong>
        </article>
        <article class="overview-item">
          <span>错误源</span>
          <strong>{{ summaryStats.errorCount }}</strong>
        </article>
      </section>

      <section class="content-grid">
        <div class="content-main">
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

        <aside class="content-side">
          <RankingsPanel
            :latency-ranking="latencyRanking"
            :offset-ranking="offsetRanking"
            :format-latency="formatLatency"
            :format-signed-ms="formatSignedMs"
          />
          <ErrorLogPanel :recent-errors="recentErrors" />
        </aside>
      </section>
    </section>
  </main>
</template>

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
  sourceCards,
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
    <div class="bg-halo bg-halo-a" aria-hidden="true" />
    <div class="bg-halo bg-halo-b" aria-hidden="true" />
    <div class="grid-scan" aria-hidden="true" />

    <header class="panel command-header">
      <div class="command-header__copy">
        <p class="command-header__eyebrow">OPENREALM · CHRONOGRAPH ARRAY</p>
        <h1>多源时间观测站</h1>
        <p class="command-header__desc">
          把淘宝、美团、苏宁的时间信号拉到同一张仪表台上，盯住漂移、延迟和回退状态。
        </p>
      </div>

      <div class="command-header__meta">
        <article class="meta-chip">
          <span>追踪源</span>
          <strong>{{ sourceCards.length }}</strong>
        </article>
        <article class="meta-chip">
          <span>刷新节奏</span>
          <strong>{{ calibrationIntervalSec }}s</strong>
        </article>
        <article class="meta-chip" :class="autoCalibration ? 'is-live' : 'is-hold'">
          <span>校准模式</span>
          <strong>{{ autoCalibration ? 'AUTO LOOP' : 'MANUAL HOLD' }}</strong>
        </article>
      </div>
    </header>

    <section class="hero-grid">
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

      <aside class="panel signal-rail">
        <div class="signal-rail__header">
          <div>
            <p class="signal-rail__eyebrow">Signal Rail</p>
            <h2>源状态快览</h2>
          </div>
          <span class="signal-rail__hint">按固定顺序监视每一路时间源</span>
        </div>

        <div class="signal-rail__cards">
          <article
            v-for="item in sourceCards"
            :key="item.sourceKey"
            class="rail-card"
            :class="`rail-card--${item.status}`"
          >
            <div class="rail-card__head">
              <div>
                <p>{{ item.label }}</p>
                <strong>{{ item.source ? sourceStatusLabel(item.source.status) : '错误' }}</strong>
              </div>
              <span class="rail-card__latency">{{ formatLatency(item.source?.latencyMs ?? null) }}</span>
            </div>

            <p class="rail-card__time">
              <span>{{ formatClockTime(item.estimatedMs) }}</span>
              <template v-if="showMilliseconds">
                <span>.</span>
                <span class="ms-accent">{{ formatMillisecondFraction(item.estimatedMs, millisecondDigits) }}</span>
              </template>
            </p>

            <div class="rail-card__metrics">
              <span>偏差 {{ formatSignedMs(item.offsetMs) }}</span>
              <span>
                抓取
                {{ formatTimestampDetailedParts(item.source?.fetchedAtMs ?? null, millisecondDigits).head }}
              </span>
            </div>
          </article>
        </div>
      </aside>
    </section>

    <section class="summary-grid">
      <article class="panel summary-card summary-card--accent">
        <p>平均延迟</p>
        <strong>{{ formatLatency(summaryStats.avgLatency) }}</strong>
        <span>基于当前成功返回的时间源计算</span>
      </article>

      <article class="panel summary-card summary-card--ok">
        <p>正常源</p>
        <strong>{{ summaryStats.okCount }}</strong>
        <span>信号稳定，可作为主时钟参考</span>
      </article>

      <article class="panel summary-card summary-card--stale">
        <p>回退源</p>
        <strong>{{ summaryStats.staleCount }}</strong>
        <span>当前请求失手，但保留最近一次成功值</span>
      </article>

      <article class="panel summary-card summary-card--error">
        <p>错误源</p>
        <strong>{{ summaryStats.errorCount }}</strong>
        <span>没有可用历史值，建议立刻关注</span>
      </article>
    </section>

    <section class="content-grid">
      <div class="content-grid__main">
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

      <div class="content-grid__side">
        <RankingsPanel
          :latency-ranking="latencyRanking"
          :offset-ranking="offsetRanking"
          :format-latency="formatLatency"
          :format-signed-ms="formatSignedMs"
        />

        <ErrorLogPanel :recent-errors="recentErrors" />
      </div>
    </section>
  </main>
</template>

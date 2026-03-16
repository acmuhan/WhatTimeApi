<script setup lang="ts">
import type { SourceCard } from '../composables/useTimeDashboard';
import type { DashboardCopy } from '../composables/useDashboardUi';
import type { SourceKey } from '../types';

defineProps<{
  groups: Array<{ key: 'ok' | 'stale' | 'error'; title: string; cards: SourceCard[] }>;
  copy: DashboardCopy;
  sourceLabel: (sourceKey: SourceKey) => string;
  statusLabel: (status: 'ok' | 'stale' | 'error') => string;
  showMilliseconds: boolean;
  formatClockTime: (ms: number | null) => string;
  formatMillisecondFraction: (ms: number | null, digits: number) => string;
  formatMillis: (ms: number | null, digits: number) => string;
  formatSignedMs: (ms: number | null) => string;
  formatLatency: (ms: number | null) => string;
  formatTimestampDetailedParts: (ms: number | null, digits: number) => { head: string; tail: string | null };
  sourceStatusClass: (status: 'ok' | 'stale' | 'error') => string;
  millisecondDigits: number;
}>();
</script>

<template>
  <section v-for="group in groups" :key="group.key" class="group-section">
    <header class="group-head">
      <div>
        <p class="eyebrow">{{ copy.groups[group.key].eyebrow }}</p>
        <h2>{{ group.title }}</h2>
      </div>
      <span class="group-count">{{ group.cards.length }} {{ copy.groups.countSuffix }}</span>
    </header>

    <div v-if="group.cards.length > 0" class="source-list">
      <article v-for="item in group.cards" :key="item.sourceKey" class="source-row">
        <div class="source-row__brand">
          <div class="brand-icon"><img class="brand-icon-image" :src="item.icon" :alt="`${sourceLabel(item.sourceKey)} icon`" loading="lazy" /></div>
          <div>
            <p class="source-name" data-testid="source-title">{{ sourceLabel(item.sourceKey) }}</p>
            <p class="source-tag">{{ item.sourceKey }}</p>
          </div>
        </div>

        <div class="source-row__time">
          <p class="source-time">
            <span>{{ formatClockTime(item.estimatedMs) }}</span>
            <template v-if="showMilliseconds">
              <span>.</span>
              <span class="ms-accent">{{ formatMillisecondFraction(item.estimatedMs, millisecondDigits) }}</span>
            </template>
          </p>
          <p class="source-subtime"><span class="ms-accent">{{ formatMillis(item.estimatedMs, millisecondDigits) }}</span><span> · {{ copy.charts.offsetLabel }} {{ formatSignedMs(item.offsetMs) }}</span></p>
        </div>

        <div class="source-row__metrics">
          <div class="metric-cell">
            <span>{{ copy.charts.statusLabel }}</span>
            <strong class="status-pill" :class="sourceStatusClass(item.source?.status ?? 'error')">{{ statusLabel(item.source?.status ?? 'error') }}</strong>
          </div>
          <div class="metric-cell">
            <span>{{ copy.charts.latencyLabel }}</span>
            <strong>{{ formatLatency(item.source?.latencyMs ?? null) }}</strong>
          </div>
          <div class="metric-cell">
            <span>{{ copy.hero.metaLastCal }}</span>
            <strong>
              <span>{{ formatTimestampDetailedParts(item.source?.fetchedAtMs ?? null, millisecondDigits).head }}</span>
              <template v-if="formatTimestampDetailedParts(item.source?.fetchedAtMs ?? null, millisecondDigits).tail !== null">
                <span>.</span>
                <span class="ms-accent">{{ formatTimestampDetailedParts(item.source?.fetchedAtMs ?? null, millisecondDigits).tail }}</span>
              </template>
            </strong>
          </div>
        </div>

        <p v-if="item.source?.error" class="error-text">{{ item.source.error }}</p>
      </article>
    </div>

    <article v-else class="empty-group">{{ copy.groups.empty }}</article>
  </section>
</template>

<script setup lang="ts">
import type { SourceCard } from '../composables/useTimeDashboard';
import type { DashboardCopy } from '../composables/useDashboardUi';
import type { SourceKey } from '../types';

defineProps<{
  latencyRanking: SourceCard[];
  offsetRanking: SourceCard[];
  copy: DashboardCopy;
  sourceLabel: (sourceKey: SourceKey) => string;
  formatLatency: (ms: number | null) => string;
  formatSignedMs: (ms: number | null) => string;
}>();
</script>

<template>
  <section class="sidebar-section">
    <article class="sidebar-block">
      <div class="side-card__head">
        <p class="eyebrow">{{ copy.rankings.latencyEyebrow }}</p>
        <h3>{{ copy.rankings.latencyTitle }}</h3>
      </div>
      <div v-for="(entry, index) in latencyRanking" :key="entry.sourceKey" class="rank-row" data-testid="latency-item">
        <div class="rank-row__label">
          <span class="rank-index">{{ index + 1 }}</span>
          <span>{{ sourceLabel(entry.sourceKey) }}</span>
        </div>
        <strong class="rank-value">{{ formatLatency(entry.source?.latencyMs ?? null) }}</strong>
      </div>
    </article>

    <article class="sidebar-block">
      <div class="side-card__head">
        <p class="eyebrow">{{ copy.rankings.offsetEyebrow }}</p>
        <h3>{{ copy.rankings.offsetTitle }}</h3>
      </div>
      <div v-for="(entry, index) in offsetRanking" :key="`offset-${entry.sourceKey}`" class="rank-row">
        <div class="rank-row__label">
          <span class="rank-index">{{ index + 1 }}</span>
          <span>{{ sourceLabel(entry.sourceKey) }}</span>
        </div>
        <strong class="rank-value">{{ formatSignedMs(entry.offsetMs) }}</strong>
      </div>
    </article>
  </section>
</template>

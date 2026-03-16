<script setup lang="ts">
import type { SourceCard } from '../composables/useTimeDashboard';

defineProps<{
  latencyRanking: SourceCard[];
  offsetRanking: SourceCard[];
  formatLatency: (ms: number | null) => string;
  formatSignedMs: (ms: number | null) => string;
}>();
</script>

<template>
  <section class="sidebar-section">
    <article class="sidebar-block">
      <div class="side-card__head">
        <p>Latency</p>
        <h3>延迟排名</h3>
      </div>
      <div v-for="(entry, index) in latencyRanking" :key="entry.sourceKey" class="rank-row" data-testid="latency-item">
        <span>{{ index + 1 }} · {{ entry.label }}</span>
        <strong>{{ formatLatency(entry.source?.latencyMs ?? null) }}</strong>
      </div>
    </article>

    <article class="sidebar-block">
      <div class="side-card__head">
        <p>Offset</p>
        <h3>偏差排名</h3>
      </div>
      <div v-for="(entry, index) in offsetRanking" :key="`offset-${entry.sourceKey}`" class="rank-row">
        <span>{{ index + 1 }} · {{ entry.label }}</span>
        <strong>{{ formatSignedMs(entry.offsetMs) }}</strong>
      </div>
    </article>
  </section>
</template>

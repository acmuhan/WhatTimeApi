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
  <section class="panel dual-panel">
    <article class="dual-card">
      <h3>延迟排名</h3>
      <div v-for="entry in latencyRanking" :key="entry.sourceKey" class="rank-row" data-testid="latency-item">
        <span>{{ entry.label }}</span>
        <strong>{{ formatLatency(entry.source?.latencyMs ?? null) }}</strong>
      </div>
    </article>
    <article class="dual-card">
      <h3>偏差排名</h3>
      <div v-for="entry in offsetRanking" :key="`offset-${entry.sourceKey}`" class="rank-row">
        <span>{{ entry.label }}</span>
        <strong>{{ formatSignedMs(entry.offsetMs) }}</strong>
      </div>
    </article>
  </section>
</template>

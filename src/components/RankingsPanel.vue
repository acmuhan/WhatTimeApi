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
  <section class="panel dual-panel rankings-panel">
    <article class="dual-card">
      <div class="panel-heading">
        <p>Latency Ladder</p>
        <h3>延迟排名</h3>
      </div>

      <div v-for="(entry, index) in latencyRanking" :key="entry.sourceKey" class="rank-row" data-testid="latency-item">
        <div class="rank-label-wrap">
          <span class="rank-badge">{{ index + 1 }}</span>
          <span>{{ entry.label }}</span>
        </div>
        <strong>{{ formatLatency(entry.source?.latencyMs ?? null) }}</strong>
      </div>
    </article>

    <article class="dual-card">
      <div class="panel-heading">
        <p>Offset Watch</p>
        <h3>偏差排名</h3>
      </div>

      <div v-for="(entry, index) in offsetRanking" :key="`offset-${entry.sourceKey}`" class="rank-row">
        <div class="rank-label-wrap">
          <span class="rank-badge">{{ index + 1 }}</span>
          <span>{{ entry.label }}</span>
        </div>
        <strong>{{ formatSignedMs(entry.offsetMs) }}</strong>
      </div>
    </article>
  </section>
</template>

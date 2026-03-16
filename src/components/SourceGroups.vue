<script setup lang="ts">
import type { SourceCard } from '../composables/useTimeDashboard';

defineProps<{
  groups: Array<{ key: 'ok' | 'stale' | 'error'; title: string; cards: SourceCard[] }>;
  showMilliseconds: boolean;
  formatClockTime: (ms: number | null) => string;
  formatMillisecondFraction: (ms: number | null, digits: number) => string;
  formatMillis: (ms: number | null, digits: number) => string;
  formatSignedMs: (ms: number | null) => string;
  formatLatency: (ms: number | null) => string;
  formatTimestampDetailedParts: (ms: number | null, digits: number) => { head: string; tail: string | null };
  sourceStatusLabel: (status: 'ok' | 'stale' | 'error') => string;
  sourceStatusClass: (status: 'ok' | 'stale' | 'error') => string;
  millisecondDigits: number;
}>();
</script>

<template>
  <section v-for="group in groups" :key="group.key" class="group-section">
    <header class="group-head">
      <div>
        <p class="group-overline">
          {{ group.key === 'ok' ? 'PRIMARY SIGNALS' : group.key === 'stale' ? 'FALLBACK HOLD' : 'FAULT WATCH' }}
        </p>
        <h2>{{ group.title }}</h2>
      </div>
      <span class="group-count">{{ group.cards.length }} 个数据源</span>
    </header>

    <div v-if="group.cards.length > 0" class="source-grid">
      <article
        v-for="(item, index) in group.cards"
        :key="item.sourceKey"
        class="panel source-card"
        :class="[`source-card--${item.status}`]"
        :style="{ animationDelay: `${index * 70}ms` }"
      >
        <div class="source-card__wash" aria-hidden="true" />

        <header class="source-header">
          <div class="source-brand">
            <span class="source-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="brand-icon">
              <img class="brand-icon-image" :src="item.icon" :alt="`${item.label} icon`" loading="lazy" />
            </div>
            <div>
              <p class="source-name" data-testid="source-title">{{ item.label }}</p>
              <p class="source-label-muted">{{ item.sourceKey.toUpperCase() }}</p>
            </div>
          </div>
          <span v-if="item.source" class="status-pill" :class="sourceStatusClass(item.source.status)">
            {{ sourceStatusLabel(item.source.status) }}
          </span>
        </header>

        <div class="source-body">
          <p class="source-time">
            <span>{{ formatClockTime(item.estimatedMs) }}</span>
            <template v-if="showMilliseconds">
              <span>.</span>
              <span class="ms-accent">{{ formatMillisecondFraction(item.estimatedMs, millisecondDigits) }}</span>
            </template>
          </p>

          <p class="source-subtime">
            <span class="ms-accent">{{ formatMillis(item.estimatedMs, millisecondDigits) }}</span>
            <span> · 偏差 {{ formatSignedMs(item.offsetMs) }}</span>
          </p>

          <div class="source-metrics">
            <div>
              <span>延迟</span>
              <strong>{{ formatLatency(item.source?.latencyMs ?? null) }}</strong>
            </div>
            <div>
              <span>抓取时间</span>
              <strong>
                <span>{{ formatTimestampDetailedParts(item.source?.fetchedAtMs ?? null, millisecondDigits).head }}</span>
                <template v-if="formatTimestampDetailedParts(item.source?.fetchedAtMs ?? null, millisecondDigits).tail !== null">
                  <span>.</span>
                  <span class="ms-accent">{{ formatTimestampDetailedParts(item.source?.fetchedAtMs ?? null, millisecondDigits).tail }}</span>
                </template>
              </strong>
            </div>
            <div>
              <span>同步状态</span>
              <strong>{{ item.baseline ? '平滑跟踪' : '原始读数' }}</strong>
            </div>
          </div>
        </div>

        <p v-if="item.source?.error" class="error-text">{{ item.source.error }}</p>
      </article>
    </div>

    <article v-else class="panel empty-group">当前分组暂无数据源，先去别的分区看看。</article>
  </section>
</template>

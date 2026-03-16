<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { MainClockSource } from '../constants/time-dashboard';
import type { SourceCard } from '../composables/useTimeDashboard';
import type { DashboardCopy } from '../composables/useDashboardUi';
import type { SourceKey } from '../types';

type ChartMode = 'compare' | 'focus';
type ChartMetric = 'latency' | 'offset';

type ChartEntry = {
  sourceKey: SourceKey;
  status: SourceCard['status'];
  value: number | null;
  percent: number;
};

const props = defineProps<{
  sourceCards: SourceCard[];
  copy: DashboardCopy;
  sourceLabel: (sourceKey: SourceKey) => string;
  statusLabel: (status: 'ok' | 'stale' | 'error') => string;
  activeSourceKey: SourceKey;
  mainClockSource: MainClockSource;
}>();

const chartMode = ref<ChartMode>('compare');
const chartMetric = ref<ChartMetric>('latency');
const focusedSourceKey = ref<SourceKey>(props.activeSourceKey);

watch(
  () => props.activeSourceKey,
  (next) => {
    focusedSourceKey.value = next;
  }
);

const sourceOptions = computed(() => props.sourceCards.map((item) => item.sourceKey));

const compareEntries = computed<ChartEntry[]>(() => {
  const rawValues = props.sourceCards.map((item) => metricValue(item, chartMetric.value));
  const maxValue = Math.max(...rawValues.map((value) => value ?? 0), 1);

  return props.sourceCards.map((item) => {
    const value = metricValue(item, chartMetric.value);
    return {
      sourceKey: item.sourceKey,
      status: item.status,
      value,
      percent: value === null ? 8 : Math.max(12, Math.round((value / maxValue) * 100))
    };
  });
});

const focusedCard = computed(() => {
  return props.sourceCards.find((item) => item.sourceKey === focusedSourceKey.value) ?? props.sourceCards[0] ?? null;
});

const focusGaugePercent = computed(() => {
  if (!focusedCard.value) {
    return 0;
  }

  const value = metricValue(focusedCard.value, chartMetric.value);
  if (value === null) {
    return 8;
  }

  const peerMax = Math.max(...compareEntries.value.map((item) => item.value ?? 0), 1);
  return Math.max(10, Math.min(100, Math.round((value / peerMax) * 100)));
});

const focusCircumference = 2 * Math.PI * 54;
const focusDashOffset = computed(() => focusCircumference * (1 - focusGaugePercent.value / 100));

const focusFreshness = computed(() => {
  if (!focusedCard.value?.source) {
    return null;
  }
  return Math.max(0, Date.now() - focusedCard.value.source.fetchedAtMs);
});

const compareHeadlineValue = computed(() => {
  const values = compareEntries.value.map((item) => item.value).filter((value): value is number => value !== null);
  if (values.length === 0) {
    return props.copy.charts.noData;
  }

  const best = Math.min(...values);
  return formatMetric(best, chartMetric.value);
});

const activeCard = computed(() => props.sourceCards.find((item) => item.sourceKey === props.activeSourceKey) ?? null);

function metricValue(item: SourceCard, metric: ChartMetric) {
  if (metric === 'latency') {
    return item.source?.latencyMs ?? null;
  }
  return item.offsetMs === null ? null : Math.abs(item.offsetMs);
}

function formatMetric(value: number | null, metric: ChartMetric) {
  if (value === null || Number.isNaN(value)) {
    return '--';
  }
  if (metric === 'latency') {
    return `${Math.round(value)} ms`;
  }
  return `${Math.round(value)} ms`;
}

function formatFreshness(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return '--';
  }
  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }
  return `${(value / 1000).toFixed(1)} s`;
}
</script>

<template>
  <section class="telemetry-panel">
    <div class="telemetry-panel__header">
      <div class="telemetry-panel__copy">
        <p class="eyebrow">{{ copy.charts.eyebrow }}</p>
        <h3>{{ copy.charts.title }}</h3>
        <p class="telemetry-panel__note">{{ chartMode === 'compare' ? copy.charts.compareCaption : copy.charts.focusCaption }}</p>
      </div>

      <div class="telemetry-panel__actions">
        <div class="track-switch track-switch--compact">
          <button type="button" class="track-switch__button" :class="chartMode === 'compare' ? 'is-active' : ''" @click="chartMode = 'compare'">{{ copy.charts.compareTab }}</button>
          <button type="button" class="track-switch__button" :class="chartMode === 'focus' ? 'is-active' : ''" @click="chartMode = 'focus'">{{ copy.charts.focusTab }}</button>
        </div>
        <div class="track-switch track-switch--compact">
          <button type="button" class="track-switch__button" :class="chartMetric === 'latency' ? 'is-active' : ''" @click="chartMetric = 'latency'">{{ copy.charts.latencyMetric }}</button>
          <button type="button" class="track-switch__button" :class="chartMetric === 'offset' ? 'is-active' : ''" @click="chartMetric = 'offset'">{{ copy.charts.offsetMetric }}</button>
        </div>
      </div>
    </div>

    <div class="telemetry-grid">
      <article class="telemetry-card telemetry-card--canvas">
        <template v-if="chartMode === 'compare'">
          <div class="telemetry-card__head">
            <div>
              <p class="eyebrow">{{ copy.charts.compareHeadline }}</p>
              <h4>{{ compareHeadlineValue }}</h4>
            </div>
            <p class="telemetry-card__subline">{{ copy.charts.compareSubline }}</p>
          </div>

          <div v-if="compareEntries.length > 0" class="chart-barboard">
            <div v-for="(entry, index) in compareEntries" :key="entry.sourceKey" class="chart-bar">
              <span class="chart-bar__value">{{ formatMetric(entry.value, chartMetric) }}</span>
              <div class="chart-bar__track">
                <span class="chart-bar__fill" :class="`is-${entry.status}`" :style="{ height: `${entry.percent}%`, animationDelay: `${index * 80}ms` }" />
              </div>
              <div class="chart-bar__label">
                <strong>{{ sourceLabel(entry.sourceKey) }}</strong>
                <span>{{ statusLabel(entry.status) }}</span>
              </div>
            </div>
          </div>

          <p v-else class="quiet">{{ copy.charts.noData }}</p>
        </template>

        <template v-else>
          <div class="telemetry-card__head telemetry-card__head--focus">
            <div>
              <p class="eyebrow">{{ copy.charts.focusSourceLabel }}</p>
              <h4>{{ focusedCard ? sourceLabel(focusedCard.sourceKey) : '--' }}</h4>
            </div>
            <div class="track-switch track-switch--compact">
              <button
                v-for="sourceKey in sourceOptions"
                :key="sourceKey"
                type="button"
                class="track-switch__button"
                :class="focusedSourceKey === sourceKey ? 'is-active' : ''"
                @click="focusedSourceKey = sourceKey"
              >
                {{ sourceLabel(sourceKey) }}
              </button>
            </div>
          </div>

          <div v-if="focusedCard" class="focus-stage">
            <div class="focus-gauge">
              <svg viewBox="0 0 140 140" class="focus-gauge__svg" aria-hidden="true">
                <circle cx="70" cy="70" r="54" class="focus-gauge__ring" />
                <circle
                  cx="70"
                  cy="70"
                  r="54"
                  class="focus-gauge__progress"
                  :stroke-dasharray="focusCircumference"
                  :stroke-dashoffset="focusDashOffset"
                />
              </svg>
              <div class="focus-gauge__content">
                <span>{{ chartMetric === 'latency' ? copy.charts.latencyMetric : copy.charts.offsetMetric }}</span>
                <strong>{{ formatMetric(metricValue(focusedCard, chartMetric), chartMetric) }}</strong>
              </div>
            </div>

            <div class="focus-metrics">
              <div class="focus-metric">
                <span>{{ copy.charts.statusLabel }}</span>
                <strong>{{ statusLabel(focusedCard.status) }}</strong>
              </div>
              <div class="focus-metric">
                <span>{{ copy.charts.latencyLabel }}</span>
                <strong>{{ formatMetric(focusedCard.source?.latencyMs ?? null, 'latency') }}</strong>
              </div>
              <div class="focus-metric">
                <span>{{ copy.charts.offsetLabel }}</span>
                <strong>{{ formatMetric(focusedCard.offsetMs === null ? null : Math.abs(focusedCard.offsetMs), 'offset') }}</strong>
              </div>
              <div class="focus-metric">
                <span>{{ copy.charts.freshnessLabel }}</span>
                <strong>{{ formatFreshness(focusFreshness) }}</strong>
              </div>
            </div>
          </div>

          <p v-else class="quiet">{{ copy.charts.noData }}</p>
        </template>
      </article>

      <aside class="telemetry-card telemetry-card--insight">
        <div class="insight-pill">
          <span>{{ copy.charts.latencyMetric }}</span>
          <strong>{{ formatMetric(activeCard?.source?.latencyMs ?? null, 'latency') }}</strong>
        </div>
        <div class="insight-pill">
          <span>{{ copy.charts.offsetMetric }}</span>
          <strong>{{ formatMetric(activeCard?.offsetMs === null || !activeCard ? null : Math.abs(activeCard.offsetMs), 'offset') }}</strong>
        </div>
        <div class="insight-pill">
          <span>{{ copy.charts.focusSourceLabel }}</span>
          <strong>{{ sourceLabel(activeSourceKey) }}</strong>
        </div>
      </aside>
    </div>
  </section>
</template>

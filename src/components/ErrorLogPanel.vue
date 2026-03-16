<script setup lang="ts">
import type { DashboardCopy } from '../composables/useDashboardUi';

defineProps<{ recentErrors: string[]; copy: DashboardCopy }>();
</script>

<template>
  <section class="sidebar-block error-panel">
    <div class="side-card__head">
      <p class="eyebrow">{{ copy.errors.eyebrow }}</p>
      <h3>{{ copy.errors.title }}</h3>
    </div>
    <p v-if="recentErrors.length === 0" class="quiet">{{ copy.errors.empty }}</p>
    <div v-else class="error-list">
      <p v-for="(message, index) in recentErrors" :key="message" class="error-list__row">
        <span class="error-index">{{ String(index + 1).padStart(2, '0') }}</span>
        <span>{{ message }}</span>
      </p>
    </div>
  </section>
</template>

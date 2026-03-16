<script setup lang="ts">
defineProps<{ recentErrors: string[] }>();
</script>

<template>
  <section class="sidebar-block error-panel">
    <div class="side-card__head">
      <p class="eyebrow">Logs</p>
      <h3>最近错误</h3>
    </div>
    <p v-if="recentErrors.length === 0" class="quiet">暂无错误。</p>
    <div v-else class="error-list">
      <p v-for="(message, index) in recentErrors" :key="message" class="error-list__row">
        <span class="error-index">{{ String(index + 1).padStart(2, '0') }}</span>
        <span>{{ message }}</span>
      </p>
    </div>
  </section>
</template>

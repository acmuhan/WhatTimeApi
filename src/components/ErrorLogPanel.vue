<script setup lang="ts">
defineProps<{ recentErrors: string[] }>();
</script>

<template>
  <section class="panel error-panel">
    <div class="panel-heading">
      <p>System Trace</p>
      <h3>最近错误</h3>
    </div>

    <p v-if="recentErrors.length === 0" class="quiet">暂无错误，当前时间阵列运行稳定。</p>
    <div v-else class="error-list">
      <p v-for="(message, index) in recentErrors" :key="message">
        <span class="error-index">#{{ String(index + 1).padStart(2, '0') }}</span>
        <span>{{ message }}</span>
      </p>
    </div>
  </section>
</template>

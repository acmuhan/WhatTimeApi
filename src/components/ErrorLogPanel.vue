<script setup lang="ts">
defineProps<{ recentErrors: string[] }>();
</script>

<template>
  <section class="panel error-panel">
    <h3>最近错误</h3>
    <p v-if="recentErrors.length === 0" class="quiet">暂无错误</p>
    <div v-else class="error-list"><p v-for="message in recentErrors" :key="message">{{ message }}</p></div>
  </section>
</template>

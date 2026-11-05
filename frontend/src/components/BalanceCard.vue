<script setup>
defineProps({
  title: String,
  amount: [Number, String]
})
</script>

<template>
  <div class="balance-card">
    <span>{{ title }}</span>
    <h1>{{ amount }} CHF</h1>
  </div>
</template>

<style scoped>
.balance-card { background: var(--code-bg); border: 1px solid var(--border); color: var(--text-h); padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: var(--shadow); }
.balance-card span { font-size: 0.9rem; color: var(--text); }
.balance-card h1 { margin: 0.5rem 0 0 0; font-size: 2.5rem; color: var(--text-h); }
</style>
<script setup>
defineProps({
  title: String,
  amount: [Number, String],
  unallocated: [Number, String]
})
</script>

<template>
  <div class="balance-card">
    <span>{{ title }}</span>
    <h1>{{ amount }} CHF</h1>
    <small class="unallocated">
      Unallocated on account: <strong>{{ unallocated }} CHF</strong>
    </small>
  </div>
</template>

<style scoped>
.balance-card {
  background: var(--code-bg);
  border: 1px solid var(--border);
  color: var(--text-h);
  padding: 1.5rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.balance-card span {
  font-size: 0.9rem;
  color: var(--text);
}

.balance-card h1 {
  margin: 0.25rem 0;
  font-size: 2.5rem;
  color: var(--text-h);
}

.unallocated {
  font-size: 0.85rem;
  color: var(--text);
}

.unallocated strong {
  color: var(--accent);
}
</style>
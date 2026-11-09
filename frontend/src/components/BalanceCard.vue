<script setup>
defineProps({
  title: String,
  amount: [Number, String],
  unallocated: [Number, String],
  savings: [Number, String]
})
</script>

<template>
  <div class="balance-card">
    <span>{{ title }}</span>
    <h1>{{ amount }} CHF</h1>
    <div class="sub-balances">
      <small class="unallocated">
        Unallocated: <strong>{{ unallocated }} CHF</strong>
      </small>
      <small v-if="Number(savings) !== 0" class="savings-pill">
        🏦 Épargne: <strong>{{ savings }} CHF</strong>
      </small>
    </div>
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

.sub-balances {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.15rem;
}

.unallocated,
.savings-pill {
  font-size: 0.85rem;
  color: var(--text);
}

.unallocated strong {
  color: var(--accent);
}

.savings-pill strong {
  color: #10b981;
}
</style>
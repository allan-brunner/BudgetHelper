<script setup>
import { computed } from 'vue'

const props = defineProps({
  transactions: Array,
  accounts: Array,
  pockets: Array,
  activeView: String // 'shared', or specific account id
})

// Helper functions to get display names from IDs
const getAccountName = (id) => props.accounts.find(a => a.id === id)?.name || id
const getPocketName = (id) => {
  if (!id || id === 'unallocated') return 'Main Account'
  return props.pockets.find(p => p.id === id)?.name || id
}

// Filter transactions based on the active AccountTab view
const filteredTransactions = computed(() => {
  if (!props.transactions) return []
  return props.transactions.filter(tx =>
    props.activeView === 'shared' ? true : tx.accountId === props.activeView
  )
})
</script>

<template>
  <div class="transaction-list">
    <div v-if="filteredTransactions.length === 0" class="empty-state">
      No transactions found.
    </div>

    <div v-for="tx in filteredTransactions" :key="tx.id" class="tx-item">
      <div class="tx-left">
        <strong>{{ tx.label }}</strong>
        <small>
          {{ getAccountName(tx.accountId) }} • {{ getPocketName(tx.pocketId) }} • {{ tx.date }}
        </small>
      </div>
      <div class="tx-right" :class="tx.type">
        {{ tx.type === 'credit' ? '+' : '-' }}{{ tx.amount.toFixed(2) }} CHF
      </div>
    </div>
  </div>
</template>

<style scoped>
.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-bottom: 5rem;
}

.empty-state {
  text-align: center;
  color: var(--text);
  padding: 2rem 0;
}

.tx-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.tx-left {
  display: flex;
  flex-direction: column;
}

.tx-left strong {
  color: var(--text-h);
  font-size: 1rem;
}

.tx-left small {
  color: var(--text);
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.tx-right {
  font-weight: bold;
  font-size: 1.1rem;
}

.tx-right.credit {
  color: #10b981;
}

.tx-right.debit {
  color: var(--text-h);
}
</style>
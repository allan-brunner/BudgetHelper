<script setup>
import { computed } from 'vue'

const props = defineProps({
  transactions: Array,
  accounts: Array,
  pockets: Array,
  activeView: String
})

const emit = defineEmits(['updated'])

const getAccountName = (id) => props.accounts.find(a => a.id === id)?.name || id
const getPocketName = (id) => {
  if (!id || id === 'unallocated') return 'Main Account'
  return props.pockets.find(p => p.id === id)?.name || id
}

const filteredTransactions = computed(() => {
  if (!props.transactions) return []
  return props.transactions.filter(tx =>
    props.activeView === 'shared' ? true : tx.accountId === props.activeView
  )
})

async function deleteTx(id) {
  const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
  if (res.ok) {
    emit('updated')
  }
}
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
      <div class="tx-actions">
        <div class="tx-right" :class="tx.type">
          {{ tx.type === 'credit' ? '+' : '-' }}{{ tx.amount.toFixed(2) }} CHF
        </div>
        <button v-if="tx.id" class="delete-btn" @click="deleteTx(tx.id)" title="Delete transaction">
          ✕
        </button>
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
  gap: 0.5rem;
}

.tx-left {
  display: flex;
  flex-direction: column;
  min-width: 0;
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

.tx-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.tx-right {
  font-weight: bold;
  font-size: 1.05rem;
}

.tx-right.credit {
  color: #10b981;
}

.tx-right.debit {
  color: var(--text-h);
}

.delete-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 6px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  color: #ef4444;
  border-color: #ef4444;
}
</style>
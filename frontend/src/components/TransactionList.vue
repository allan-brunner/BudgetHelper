<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  transactions: Array,
  accounts: Array,
  pockets: Array,
  activeView: String,
  cycleStart: String
})

const emit = defineEmits(['updated'])

const periodFilter = ref('cycle') // 'cycle' or 'all'
const pocketFilter = ref('all') // 'all', 'unallocated', or pocket.id

const getAccountName = (id) => props.accounts.find(a => a.id === id)?.name || id
const getPocketName = (id) => {
  if (!id || id === 'unallocated') return 'Main Account'
  return props.pockets.find(p => p.id === id)?.name || id
}

const filteredTransactions = computed(() => {
  if (!props.transactions) return []
  return props.transactions.filter(tx => {
    const matchAccount = props.activeView === 'shared' ? true : tx.accountId === props.activeView
    const matchPeriod = periodFilter.value === 'all' || !props.cycleStart
      ? true
      : tx.date >= props.cycleStart
    const matchPocket = pocketFilter.value === 'all'
      ? true
      : tx.pocketId === pocketFilter.value

    return matchAccount && matchPeriod && matchPocket
  })
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
    <!-- Filter Controls -->
    <div class="filters-bar">
      <div class="toggle-group">
        <button type="button" :class="{ active: periodFilter === 'cycle' }" @click="periodFilter = 'cycle'">
          This Cycle
        </button>
        <button type="button" :class="{ active: periodFilter === 'all' }" @click="periodFilter = 'all'">
          All Time
        </button>
      </div>

      <select v-model="pocketFilter" class="pocket-filter">
        <option value="all">All Pockets</option>
        <option value="unallocated">Main Account</option>
        <option v-for="p in pockets" :key="p.id" :value="p.id">
          {{ p.name }}
        </option>
      </select>
    </div>

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

.filters-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  background: var(--code-bg);
  padding: 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.toggle-group {
  display: flex;
  background: var(--border);
  border-radius: 6px;
  padding: 2px;
  flex-shrink: 0;
}

.toggle-group button {
  border: none;
  background: transparent;
  padding: 0.35rem 0.65rem;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 4px;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-group button.active {
  background: var(--accent);
  color: #fff;
}

.pocket-filter {
  flex: 1;
  min-width: 0;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-h);
  font-size: 0.85rem;
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
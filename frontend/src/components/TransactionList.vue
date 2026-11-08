<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  transactions: Array,
  accounts: Array,
  pockets: Array,
  activeView: String,
  cycleStart: String,
  initialPocket: {
    type: String,
    default: 'all'
  }
})

const emit = defineEmits(['updated'])

const periodFilter = ref('cycle') // 'cycle' or 'all'
const pocketFilter = ref(props.initialPocket || 'all')
const searchQuery = ref('')

// Sync dropdown whenever user taps a pocket card from the Dashboard
watch(() => props.initialPocket, (newVal) => {
  if (newVal) pocketFilter.value = newVal
}, { immediate: true })

const getAccountName = (id) => props.accounts.find(a => a.id === id)?.name || id
const getPocketName = (id) => {
  if (!id || id === 'unallocated') return 'Main Account'
  return props.pockets.find(p => p.id === id)?.name || id
}

const filteredTransactions = computed(() => {
  if (!props.transactions) return []
  const query = searchQuery.value.trim().toLowerCase()

  return props.transactions.filter(tx => {
    const matchAccount = props.activeView === 'shared' ? true : tx.accountId === props.activeView
    const matchPeriod = periodFilter.value === 'all' || !props.cycleStart
      ? true
      : tx.date >= props.cycleStart
    const matchPocket = pocketFilter.value === 'all'
      ? true
      : tx.pocketId === pocketFilter.value
    const matchSearch = !query
      ? true
      : tx.label.toLowerCase().includes(query) ||
      getPocketName(tx.pocketId).toLowerCase().includes(query)

    return matchAccount && matchPeriod && matchPocket && matchSearch
  })
})

// Calculate live totals for the filtered list
const summaryTotals = computed(() => {
  let spent = 0
  let added = 0

  for (const tx of filteredTransactions.value) {
    if (tx.type === 'credit') {
      added += Number(tx.amount)
    } else {
      spent += Number(tx.amount)
    }
  }

  return {
    spent: spent.toFixed(2),
    added: added.toFixed(2),
    net: (added - spent).toFixed(2)
  }
})

async function revealTx(id) {
  const res = await fetch(`/api/transactions/${id}/reveal`, { method: 'PATCH' })
  if (res.ok) {
    emit('updated')
  }
}

async function deleteTx(id) {
  const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
  if (res.ok) {
    emit('updated')
  }
}
</script>

<template>
  <div class="transaction-list">
    <!-- Filter & Search Controls -->
    <div class="filters-card">
      <div class="filters-row">
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

      <!-- Search Input -->
      <div class="search-row">
        <input v-model="searchQuery" type="text" placeholder="Search label (e.g. Groceries, Migros)..."
          class="search-input" />
        <button v-if="searchQuery" type="button" class="clear-btn" @click="searchQuery = ''">
          ✕
        </button>
      </div>

      <!-- Totals Bar -->
      <div class="totals-bar">
        <span>Out: <strong class="spent">-{{ summaryTotals.spent }} CHF</strong></span>
        <span>In: <strong class="added">+{{ summaryTotals.added }} CHF</strong></span>
        <span>Net: <strong>{{ summaryTotals.net }} CHF</strong></span>
      </div>
    </div>

    <div v-if="filteredTransactions.length === 0" class="empty-state">
      No transactions found.
    </div>

    <div v-for="tx in filteredTransactions" :key="tx.id" class="tx-item">
      <div class="tx-left">
        <div class="tx-title-row">
          <strong>{{ tx.label }}</strong>
          <span v-if="tx.isSecret" class="secret-badge">🎁 Secret</span>
        </div>
        <small>
          {{ getAccountName(tx.accountId) }} • {{ getPocketName(tx.pocketId) }} • {{ tx.date }}
        </small>
      </div>
      <div class="tx-actions">
        <div class="tx-right" :class="tx.type">
          {{ tx.type === 'credit' ? '+' : '-' }}{{ tx.amount.toFixed(2) }} CHF
        </div>
        <button v-if="tx.isSecret" type="button" class="reveal-btn" @click="revealTx(tx.id)"
          title="Reveal gift to partner">
          🔓
        </button>
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

.filters-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--code-bg);
  padding: 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--border);
}

.filters-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
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

.search-row {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  min-width: 0;
  padding: 0.5rem 2rem 0.5rem 0.65rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-h);
  font-size: 0.85rem;
}

.clear-btn {
  position: absolute;
  right: 0.4rem;
  background: transparent;
  border: none;
  color: var(--text);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.25rem;
}

.totals-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--text);
  padding-top: 0.25rem;
  border-top: 1px solid var(--border);
}

.totals-bar strong {
  color: var(--text-h);
}

.totals-bar strong.spent {
  color: #ef4444;
}

.totals-bar strong.added {
  color: #10b981;
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

.tx-title-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.secret-badge {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: var(--accent-bg);
  color: var(--accent);
  font-weight: 600;
}

.reveal-btn {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
}

.reveal-btn:hover {
  border-color: var(--accent);
  background: var(--accent-bg);
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
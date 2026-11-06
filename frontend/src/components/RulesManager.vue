<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  rules: Array,
  accounts: Array,
  pockets: Array,
  activeView: String
})

const emit = defineEmits(['updated'])

const accountId = ref(props.activeView === 'shared' ? props.accounts[0]?.id : props.activeView)
const pocketId = ref(props.pockets[0]?.id || '')
const frequency = ref('monthly')
const amount = ref('')

// Keep account selector synced when switching top tabs
watch(() => props.activeView, (newVal) => {
  if (newVal !== 'shared') accountId.value = newVal
})

const getAccountName = (id) => props.accounts.find(a => a.id === id)?.name || id
const getPocketName = (id) => props.pockets.find(p => p.id === id)?.name || id

const filteredRules = computed(() => {
  if (!props.rules) return []
  return props.rules.filter(r =>
    props.activeView === 'shared' ? true : r.accountId === props.activeView
  )
})

async function addRule() {
  if (!amount.value || !pocketId.value || !accountId.value) return

  const res = await fetch('/api/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: accountId.value,
      pocketId: pocketId.value,
      amount: parseFloat(amount.value),
      frequency: frequency.value
    })
  })

  if (res.ok) {
    amount.value = ''
    emit('updated')
  }
}

async function deleteRule(id) {
  const res = await fetch(`/api/rules/${id}`, { method: 'DELETE' })
  if (res.ok) {
    emit('updated')
  }
}
</script>

<template>
  <div class="rules-manager">
    <!-- Add Rule Form -->
    <form class="rule-form" @submit.prevent="addRule">
      <h3>New Budget Rule</h3>
      <div class="row">
        <select v-if="activeView === 'shared'" v-model="accountId">
          <option v-for="acc in accounts" :key="acc.id" :value="acc.id">
            {{ acc.name }}
          </option>
        </select>
        <select v-model="pocketId">
          <option v-for="p in pockets" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
      </div>

      <div class="row">
        <select v-model="frequency">
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <input v-model="amount" type="number" step="0.01" placeholder="Amount (CHF)" required />
      </div>

      <button type="submit">Add Rule</button>
    </form>

    <!-- Active Rules List -->
    <div class="rules-list">
      <div v-if="filteredRules.length === 0" class="empty-state">
        No rules configured for this view.
      </div>

      <div v-for="(rule, idx) in filteredRules" :key="rule.id ?? idx" class="rule-item">
        <div class="rule-info">
          <strong>{{ getPocketName(rule.pocketId) }}</strong>
          <small>{{ getAccountName(rule.accountId) }} • {{ rule.frequency }}</small>
        </div>
        <div class="rule-actions">
          <span class="rule-amount">{{ Number(rule.amount).toFixed(2) }} CHF</span>
          <button v-if="rule.id" class="delete-btn" @click="deleteRule(rule.id)" title="Delete rule">
            ✕
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rules-manager {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 5rem;
}

.rule-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--code-bg);
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid var(--border);
}

.rule-form h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  color: var(--text-h);
  text-align: left;
}

.rule-form .row {
  display: flex;
  gap: 0.5rem;
}

.rule-form input,
.rule-form select,
.rule-form button {
  flex: 1;
  min-width: 0;
  padding: 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-h);
}

.rule-form button {
  background: var(--accent);
  color: white;
  border: none;
  font-weight: bold;
  cursor: pointer;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.empty-state {
  text-align: center;
  color: var(--text);
  padding: 2rem 0;
}

.rule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.rule-info {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.rule-info strong {
  color: var(--text-h);
}

.rule-info small {
  color: var(--text);
  font-size: 0.8rem;
  margin-top: 0.25rem;
  text-transform: capitalize;
}

.rule-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.rule-amount {
  font-weight: bold;
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
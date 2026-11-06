<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  accounts: Array,
  pockets: Array,
  activeView: String
})

const emit = defineEmits(['added'])

const type = ref('debit') // 'debit', 'credit', or 'transfer'
const amount = ref('')
const label = ref('')
const pocketId = ref('unallocated')
const targetPocketId = ref(props.pockets[0]?.id || 'unallocated')
const accountId = ref(props.activeView === 'shared' ? props.accounts[0]?.id : props.activeView)

watch(() => props.activeView, (newVal) => {
  if (newVal !== 'shared') accountId.value = newVal
})

// Prevent source and destination from being identical when switching to transfer
watch([type, pocketId], () => {
  if (type.value === 'transfer' && pocketId.value === targetPocketId.value) {
    targetPocketId.value = pocketId.value === 'unallocated'
      ? (props.pockets[0]?.id || '')
      : 'unallocated'
  }
})

async function submitTx() {
  if (!amount.value || !pocketId.value) return
  if (type.value === 'transfer' && (!targetPocketId.value || pocketId.value === targetPocketId.value)) return

  const defaultLabel = type.value === 'transfer'
    ? 'Transfer'
    : (pocketId.value === 'unallocated' ? 'Account Entry' : 'Quick Entry')

  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: accountId.value,
      pocketId: pocketId.value,
      targetPocketId: type.value === 'transfer' ? targetPocketId.value : undefined,
      type: type.value,
      amount: parseFloat(amount.value),
      label: label.value || defaultLabel
    })
  })

  if (res.ok) {
    amount.value = ''
    label.value = ''
    emit('added')
  }
}
</script>

<template>
  <form class="quick-add" @submit.prevent="submitTx">
    <!-- Styled -, +, -> toggle buttons -->
    <div class="type-selector">
      <button type="button" class="type-btn debit" :class="{ active: type === 'debit' }" @click="type = 'debit'">
        −
      </button>
      <button type="button" class="type-btn credit" :class="{ active: type === 'credit' }" @click="type = 'credit'">
        +
      </button>
      <button type="button" class="type-btn transfer" :class="{ active: type === 'transfer' }"
        @click="type = 'transfer'">
        →
      </button>
    </div>

    <!-- Single bucket selector for + or - -->
    <div v-if="type !== 'transfer'" class="row">
      <select v-model="pocketId">
        <option value="unallocated">Main Account</option>
        <option v-for="p in pockets" :key="p.id" :value="p.id">
          {{ p.name }}
        </option>
      </select>
    </div>

    <!-- From -> To selectors for transfers -->
    <div v-else class="row transfer-row">
      <select v-model="pocketId">
        <option value="unallocated">Main Account</option>
        <option v-for="p in pockets" :key="p.id" :value="p.id">
          {{ p.name }}
        </option>
      </select>
      <span class="arrow">→</span>
      <select v-model="targetPocketId">
        <option value="unallocated" :disabled="pocketId === 'unallocated'">Main Account</option>
        <option v-for="p in pockets" :key="p.id" :value="p.id" :disabled="pocketId === p.id">
          {{ p.name }}
        </option>
      </select>
    </div>

    <div class="row">
      <select v-if="activeView === 'shared'" v-model="accountId">
        <option v-for="acc in accounts" :key="acc.id" :value="acc.id">
          {{ acc.name }}
        </option>
      </select>
      <input v-model="amount" type="number" step="0.01" placeholder="Amount (CHF)" required />
    </div>

    <input v-model="label" type="text" placeholder="Label (e.g. Salary, Groceries)" />
    <button type="submit" class="submit-btn">
      {{ type === 'transfer' ? 'Transfer' : 'Save' }}
    </button>
  </form>
</template>

<style scoped>
.quick-add {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--code-bg);
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid var(--border);
}

.type-selector {
  display: flex;
  gap: 0.5rem;
}

.type-btn {
  flex: 1;
  padding: 0.5rem;
  font-size: 1.35rem;
  font-weight: bold;
  line-height: 1;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
}

.type-btn.debit.active {
  background: #ef4444;
  color: #fff;
  border-color: #ef4444;
}

.type-btn.credit.active {
  background: #10b981;
  color: #fff;
  border-color: #10b981;
}

.type-btn.transfer.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.quick-add .row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.arrow {
  color: var(--text);
  font-weight: bold;
  flex-shrink: 0;
}

.quick-add input,
.quick-add select {
  flex: 1;
  min-width: 0;
  padding: 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-h);
}

.submit-btn {
  padding: 0.65rem;
  border-radius: 6px;
  background: var(--accent);
  color: white;
  border: none;
  font-weight: bold;
  cursor: pointer;
}
</style>
<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  accounts: Array,
  pockets: Array,
  activeView: String
})

const emit = defineEmits(['added'])

const type = ref('debit') // 'debit', 'credit', or 'allocate'
const amount = ref('')
const label = ref('')
const pocketId = ref('unallocated')
const accountId = ref(props.activeView === 'shared' ? props.accounts[0]?.id : props.activeView)

watch(() => props.activeView, (newVal) => {
  if (newVal !== 'shared') accountId.value = newVal
})

// Force a valid pocket selection when moving money into a pocket
watch(type, (newType) => {
  if (newType === 'allocate' && pocketId.value === 'unallocated') {
    pocketId.value = props.pockets[0]?.id || ''
  }
})

async function submitTx() {
  if (!amount.value || !pocketId.value) return
  const numAmount = parseFloat(amount.value)

  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: accountId.value,
      pocketId: pocketId.value,
      type: type.value,
      amount: numAmount,
      label: label.value || (pocketId.value === 'unallocated' ? 'Account Entry' : 'Quick Entry')
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
    <div class="row">
      <select v-model="type">
        <option value="debit">Debit (-)</option>
        <option value="credit">Credit (+)</option>
        <option value="allocate">Move to Pocket (→)</option>
      </select>
      <select v-model="pocketId">
        <option v-if="type !== 'allocate'" value="unallocated">
          No Pocket (Account)
        </option>
        <option v-for="p in pockets" :key="p.id" :value="p.id">
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
      <input v-model="amount" type="number" step="0.01" placeholder="Amount" required />
    </div>

    <input v-model="label" type="text" placeholder="Label (e.g. Salary, Groceries)" />
    <button type="submit">
      {{ type === 'allocate' ? 'Move Money' : 'Add Row' }}
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

.quick-add .row {
  display: flex;
  gap: 0.5rem;
}

.quick-add input,
.quick-add select,
.quick-add button {
  flex: 1;
  min-width: 0;
  padding: 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-h);
}

.quick-add button {
  background: var(--accent);
  color: white;
  border: none;
  font-weight: bold;
  cursor: pointer;
}
</style>
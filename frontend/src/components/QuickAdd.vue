<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  accounts: Array,
  pockets: Array,
  activeView: String
})

const emit = defineEmits(['added'])

const type = ref('debit')
const amount = ref('')
const label = ref('')
const pocketId = ref(props.pockets[0]?.id || '')
const accountId = ref(props.activeView === 'shared' ? props.accounts[0]?.id : props.activeView)

// If user changes tabs in App.vue, auto-select their account in the form
watch(() => props.activeView, (newVal) => {
  if (newVal !== 'shared') accountId.value = newVal
})

async function submitTx() {
  if (!amount.value || !pocketId.value) return

  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: accountId.value,
      pocketId: pocketId.value,
      type: type.value,
      amount: parseFloat(amount.value),
      label: label.value || 'Quick Entry'
    })
  })

  if (res.ok) {
    amount.value = ''
    label.value = ''
    emit('added') // Tells App.vue to refresh data
  }
}
</script>

<template>
  <form class="quick-add" @submit.prevent="submitTx">
    <div class="row">
      <select v-model="type">
        <option value="debit">Debit (-)</option>
        <option value="credit">Credit (+)</option>
      </select>
      <select v-model="pocketId">
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

    <input v-model="label" type="text" placeholder="Label (e.g. Groceries)" />
    <button type="submit">Add Row</button>
  </form>
</template>

<style scoped>
.quick-add { display: flex; flex-direction: column; gap: 0.5rem; background: var(--code-bg); padding: 1rem; border-radius: 12px; border: 1px solid var(--border); }
.quick-add .row { display: flex; gap: 0.5rem; }
.quick-add input, .quick-add select, .quick-add button { flex: 1; padding: 0.6rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text-h); }
.quick-add button { background: var(--accent); color: white; border: none; font-weight: bold; cursor: pointer; }
</style>
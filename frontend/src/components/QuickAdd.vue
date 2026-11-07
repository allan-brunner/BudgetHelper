<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  accounts: Array,
  pockets: Array,
  activeView: String
})

const emit = defineEmits(['added'])

const type = ref('debit') // 'debit', 'credit', 'transfer', or 'split'
const amount = ref('')
const label = ref('')
const pocketId = ref('unallocated')

// Source & Destination for Transfers
const accountId = ref(props.activeView === 'shared' ? props.accounts[0]?.id : props.activeView)
const targetAccountId = ref(props.accounts[1]?.id || props.accounts[0]?.id)
const targetPocketId = ref(props.pockets[0]?.id || 'unallocated')

// Split Bill State ('50/50' or 'custom')
const splitMode = ref('50/50')
const customShare1 = ref('')
const customShare2 = ref('')

const acc1 = computed(() => props.accounts?.[0] || { id: 'acc1', name: 'Account 1' })
const acc2 = computed(() => props.accounts?.[1] || { id: 'acc2', name: 'Account 2' })

watch(() => props.activeView, (newVal) => {
  if (newVal !== 'shared') accountId.value = newVal
})

// Keep transfer destination valid when source changes
watch([type, accountId, pocketId], () => {
  if (type.value === 'transfer' && accountId.value === targetAccountId.value && pocketId.value === targetPocketId.value) {
    if (pocketId.value === 'unallocated' && props.pockets?.length) {
      targetPocketId.value = props.pockets[0].id
    } else {
      targetPocketId.value = 'unallocated'
    }
  }
})

// Auto-calculate 50/50 split shares (handles odd cents without rounding loss)
const halfShares = computed(() => {
  const total = parseFloat(amount.value) || 0
  const first = Math.round((total / 2) * 100) / 100
  const second = Math.round((total - first) * 100) / 100
  return { first, second }
})

// Sync custom split inputs with total amount
function onTotalAmountInput() {
  if (type.value === 'split' && splitMode.value === 'custom') {
    const total = parseFloat(amount.value) || 0
    const s1 = parseFloat(customShare1.value) || 0
    if (total >= s1) {
      customShare2.value = (Math.round((total - s1) * 100) / 100).toString()
    }
  }
}

function onShare1Input() {
  const total = parseFloat(amount.value) || 0
  const s1 = parseFloat(customShare1.value) || 0
  if (total > 0) {
    customShare2.value = Math.max(0, Math.round((total - s1) * 100) / 100).toString()
  } else {
    const s2 = parseFloat(customShare2.value) || 0
    amount.value = (Math.round((s1 + s2) * 100) / 100).toString()
  }
}

function onShare2Input() {
  const total = parseFloat(amount.value) || 0
  const s2 = parseFloat(customShare2.value) || 0
  if (total > 0) {
    customShare1.value = Math.max(0, Math.round((total - s2) * 100) / 100).toString()
  } else {
    const s1 = parseFloat(customShare1.value) || 0
    amount.value = (Math.round((s1 + s2) * 100) / 100).toString()
  }
}

async function submitTx() {
  if (!pocketId.value) return

  // 1. Submit Split Bill
  if (type.value === 'split') {
    const share1 = splitMode.value === '50/50' ? halfShares.value.first : (parseFloat(customShare1.value) || 0)
    const share2 = splitMode.value === '50/50' ? halfShares.value.second : (parseFloat(customShare2.value) || 0)

    if (share1 <= 0 && share2 <= 0) return

    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'split',
        pocketId: pocketId.value,
        label: label.value || 'Shared Bill',
        splits: [
          { accountId: acc1.value.id, amount: share1 },
          { accountId: acc2.value.id, amount: share2 }
        ]
      })
    })

    if (res.ok) {
      amount.value = ''
      customShare1.value = ''
      customShare2.value = ''
      label.value = ''
      emit('added')
    }
    return
  }

  // 2. Submit Debit, Credit, or Transfer
  if (!amount.value) return
  if (
    type.value === 'transfer' &&
    accountId.value === targetAccountId.value &&
    pocketId.value === targetPocketId.value
  ) {
    return
  }

  const defaultLabel = type.value === 'transfer'
    ? 'Transfer'
    : (pocketId.value === 'unallocated' ? 'Account Entry' : 'Quick Entry')

  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: accountId.value,
      pocketId: pocketId.value,
      targetAccountId: type.value === 'transfer' ? targetAccountId.value : undefined,
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
    <!-- Styled -, +, ->, ÷ toggle buttons -->
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
      <button type="button" class="type-btn split" :class="{ active: type === 'split' }" @click="type = 'split'"
        title="Split Bill">
        ÷
      </button>
    </div>

    <!-- Standard + or - Pocket Selector -->
    <div v-if="type === 'debit' || type === 'credit'" class="row">
      <select v-if="activeView === 'shared'" v-model="accountId">
        <option v-for="acc in accounts" :key="acc.id" :value="acc.id">
          {{ acc.name }}
        </option>
      </select>
      <select v-model="pocketId">
        <option value="unallocated">Main Account</option>
        <option v-for="p in pockets" :key="p.id" :value="p.id">
          {{ p.name }}
        </option>
      </select>
    </div>

    <!-- Transfer Mode: From (Account + Pocket) -> To (Account + Pocket) -->
    <template v-else-if="type === 'transfer'">
      <div class="row">
        <span class="row-tag">From</span>
        <select v-model="accountId">
          <option v-for="acc in accounts" :key="acc.id" :value="acc.id">
            {{ acc.name }}
          </option>
        </select>
        <select v-model="pocketId">
          <option value="unallocated">Main Account</option>
          <option v-for="p in pockets" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
      </div>

      <div class="row">
        <span class="row-tag">To</span>
        <select v-model="targetAccountId">
          <option v-for="acc in accounts" :key="acc.id" :value="acc.id">
            {{ acc.name }}
          </option>
        </select>
        <select v-model="targetPocketId">
          <option value="unallocated" :disabled="accountId === targetAccountId && pocketId === 'unallocated'">
            Main Account
          </option>
          <option v-for="p in pockets" :key="p.id" :value="p.id"
            :disabled="accountId === targetAccountId && pocketId === p.id">
            {{ p.name }}
          </option>
        </select>
      </div>
    </template>

    <template v-else-if="type === 'split'">
      <div class="row">
        <select v-model="pocketId">
          <option value="unallocated">Main Account</option>
          <option v-for="p in pockets" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
        <div class="split-mode-toggle">
          <button type="button" :class="{ active: splitMode === '50/50' }" @click="splitMode = '50/50'">
            50/50
          </button>
          <button type="button" :class="{ active: splitMode === 'custom' }" @click="splitMode = 'custom'">
            Custom
          </button>
        </div>
      </div>
    </template>

    <!-- Total Amount Row -->
    <div class="row">
      <input v-model="amount" type="number" step="0.01"
        :placeholder="type === 'split' ? 'Total Bill (CHF)' : 'Amount (CHF)'"
        :required="type !== 'split' || splitMode === '50/50'" @input="onTotalAmountInput" />
    </div>

    <!-- Split Preview (50/50) or Custom Share Inputs -->
    <div v-if="type === 'split' && splitMode === '50/50'" class="split-preview">
      <span>{{ acc1.name }}: <strong>{{ halfShares.first.toFixed(2) }} CHF</strong></span>
      <span>•</span>
      <span>{{ acc2.name }}: <strong>{{ halfShares.second.toFixed(2) }} CHF</strong></span>
    </div>

    <div v-else-if="type === 'split' && splitMode === 'custom'" class="row">
      <input v-model="customShare1" type="number" step="0.01" :placeholder="`${acc1.name} (CHF)`"
        @input="onShare1Input" />
      <input v-model="customShare2" type="number" step="0.01" :placeholder="`${acc2.name} (CHF)`"
        @input="onShare2Input" />
    </div>

    <input v-model="label" type="text" placeholder="Label (e.g. Groceries, Rent, Reimbursement)" />
    <button type="submit" class="submit-btn">
      {{ type === 'transfer' ? 'Transfer' : (type === 'split' ? 'Split Bill' : 'Save') }}
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
  min-width: 0;
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

.type-btn.transfer.active,
.type-btn.split.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.quick-add .row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.row-tag {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  width: 2.5rem;
  text-align: left;
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

.split-mode-toggle {
  display: flex;
  background: var(--border);
  border-radius: 6px;
  padding: 2px;
  flex-shrink: 0;
}

.split-mode-toggle button {
  border: none;
  background: transparent;
  padding: 0.4rem 0.65rem;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 4px;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
}

.split-mode-toggle button.active {
  background: var(--accent);
  color: #fff;
}

.split-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text);
  padding: 0.25rem 0;
}

.split-preview strong {
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
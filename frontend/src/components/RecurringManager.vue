<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
    recurring: Array,
    accounts: Array,
    pockets: Array,
    activeView: String
})

const emit = defineEmits(['updated'])

const todayStr = new Date().toISOString().split('T')[0]

const type = ref('debit') // 'debit', 'credit', or 'transfer'
const accountId = ref(props.activeView === 'shared' ? props.accounts[0]?.id : props.activeView)
const pocketId = ref('unallocated')
const targetPocketId = ref(props.pockets[0]?.id || 'unallocated')
const frequency = ref('monthly')
const nextDate = ref(todayStr)
const amount = ref('')
const label = ref('')
const applyRules = ref(false)

watch(() => props.activeView, (newVal) => {
    if (newVal !== 'shared') accountId.value = newVal
})

watch([type, pocketId], () => {
    if (type.value === 'transfer' && pocketId.value === targetPocketId.value) {
        targetPocketId.value = pocketId.value === 'unallocated'
            ? (props.pockets[0]?.id || '')
            : 'unallocated'
    }
})

const getAccountName = (id) => props.accounts.find(a => a.id === id)?.name || id
const getPocketName = (id) => {
    if (!id || id === 'unallocated') return 'Main Account'
    return props.pockets.find(p => p.id === id)?.name || id
}

const formatFrequency = (freq) => {
    const map = {
        weekly: 'Weekly',
        monthly: 'Monthly',
        semester: 'Semester (6m)',
        yearly: 'Yearly'
    }
    return map[freq] || freq
}

const getDaysRemaining = (dateStr) => {
    const today = new Date(todayStr)
    const target = new Date(dateStr)
    const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    return `in ${diffDays}d`
}

// Filtered by active account tab and sorted by nearest nextDate
const filteredRecurring = computed(() => {
    if (!props.recurring) return []
    return props.recurring
        .filter(item => props.activeView === 'shared' ? true : item.accountId === props.activeView)
        .slice()
        .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
})

async function addRecurring() {
    if (!amount.value || !pocketId.value || !accountId.value || !nextDate.value) return
    if (type.value === 'transfer' && (!targetPocketId.value || pocketId.value === targetPocketId.value)) return

    const defaultLabel = type.value === 'credit'
        ? 'Salary / Income'
        : (type.value === 'transfer' ? 'Auto Transfer' : 'Subscription')

    const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            accountId: accountId.value,
            pocketId: pocketId.value,
            targetPocketId: type.value === 'transfer' ? targetPocketId.value : null,
            type: type.value,
            amount: parseFloat(amount.value),
            label: label.value || defaultLabel,
            frequency: frequency.value,
            nextDate: nextDate.value,
            applyRules: (type.value === 'credit' && pocketId.value === 'unallocated') ? applyRules.value : false
        })
    })

    if (res.ok) {
        amount.value = ''
        label.value = ''
        emit('updated')
    }
}

async function triggerRecurring(id) {
    const res = await fetch(`/api/recurring/${id}/trigger`, { method: 'POST' })
    if (res.ok) {
        emit('updated')
    }
}

async function deleteRecurring(id) {
    const res = await fetch(`/api/recurring/${id}`, { method: 'DELETE' })
    if (res.ok) {
        emit('updated')
    }
}
</script>

<template>
    <div class="recurring-manager">
        <form class="recurring-form" @submit.prevent="addRecurring">
            <h3>New Automatic Transaction</h3>

            <!-- -, +, -> Toggle -->
            <div class="type-selector">
                <button type="button" class="type-btn debit" :class="{ active: type === 'debit' }"
                    @click="type = 'debit'">
                    −
                </button>
                <button type="button" class="type-btn credit" :class="{ active: type === 'credit' }"
                    @click="type = 'credit'">
                    +
                </button>
                <button type="button" class="type-btn transfer" :class="{ active: type === 'transfer' }"
                    @click="type = 'transfer'">
                    →
                </button>
            </div>

            <!-- Pocket Selector -->
            <div v-if="type !== 'transfer'" class="row">
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

            <!-- Transfer From -> To -->
            <template v-else>
                <div v-if="activeView === 'shared'" class="row">
                    <select v-model="accountId">
                        <option v-for="acc in accounts" :key="acc.id" :value="acc.id">
                            {{ acc.name }}
                        </option>
                    </select>
                </div>
                <div class="row">
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
            </template>

            <!-- Frequency & Trigger Date -->
            <div class="row">
                <select v-model="frequency">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="semester">Semester (6m)</option>
                    <option value="yearly">Yearly</option>
                </select>
                <input v-model="nextDate" type="date" required />
            </div>

            <!-- Amount & Label -->
            <div class="row">
                <input v-model="amount" type="number" step="0.01" placeholder="Amount (CHF)" required />
                <input v-model="label" type="text" placeholder="Label (e.g. Salary, Netflix)" />
            </div>

            <label v-if="type === 'credit' && pocketId === 'unallocated'" class="rule-checkbox">
                <input v-model="applyRules" type="checkbox" />
                <span>Auto-apply monthly pocket rules when received</span>
            </label>

            <button type="submit" class="submit-btn">Schedule Transaction</button>
        </form>

        <!-- Scheduled List Sorted by Nearest Date -->
        <div class="recurring-list">
            <div v-if="filteredRecurring.length === 0" class="empty-state">
                No automatic transactions scheduled.
            </div>

            <div v-for="item in filteredRecurring" :key="item.id" class="recurring-item">
                <div class="recurring-left">
                    <div class="title-row">
                        <strong>{{ item.label }}</strong>
                        <span class="date-badge">{{ item.nextDate }} ({{ getDaysRemaining(item.nextDate) }})</span>
                        <span v-if="item.applyRules" class="date-badge">+ Rules</span>
                    </div>
                    <small>
                        {{ getAccountName(item.accountId) }} •
                        <template v-if="item.type === 'transfer'">
                            {{ getPocketName(item.pocketId) }} → {{ getPocketName(item.targetPocketId) }}
                        </template>
                        <template v-else>
                            {{ getPocketName(item.pocketId) }}
                        </template>
                        • {{ formatFrequency(item.frequency) }}
                    </small>
                </div>

                <div class="recurring-actions">
                    <span class="recurring-amount" :class="item.type">
                        {{ item.type === 'credit' ? '+' : (item.type === 'debit' ? '-' : '→ ') }}{{
                            Number(item.amount).toFixed(2) }} CHF
                    </span>
                    <button type="button" class="trigger-btn" @click="triggerRecurring(item.id)"
                        title="Trigger today & skip next occurrence">
                        ▶
                    </button>
                    <button type="button" class="delete-btn" @click="deleteRecurring(item.id)"
                        title="Delete scheduled transaction">
                        ✕
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.recurring-manager {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding-bottom: 5rem;
}

.recurring-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--code-bg);
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid var(--border);
}

.recurring-form h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
    color: var(--text-h);
    text-align: left;
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

.recurring-form .row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.arrow {
    color: var(--text);
    font-weight: bold;
    flex-shrink: 0;
}

.recurring-form input,
.recurring-form select {
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

.recurring-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.empty-state {
    text-align: center;
    color: var(--text);
    padding: 2rem 0;
}

.recurring-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    gap: 0.5rem;
}

.recurring-left {
    display: flex;
    flex-direction: column;
    text-align: left;
    min-width: 0;
}

.title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.recurring-left strong {
    color: var(--text-h);
    font-size: 1rem;
}

.date-badge {
    font-size: 0.75rem;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    background: var(--accent-bg);
    color: var(--accent);
    font-weight: 600;
}

.recurring-left small {
    color: var(--text);
    font-size: 0.8rem;
    margin-top: 0.25rem;
}

.recurring-actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-shrink: 0;
}

.recurring-amount {
    font-weight: bold;
    font-size: 1rem;
    color: var(--text-h);
}

.recurring-amount.credit {
    color: #10b981;
}

.recurring-amount.transfer {
    color: var(--accent);
}

.trigger-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--accent);
    border-radius: 6px;
    width: 28px;
    height: 28px;
    font-size: 0.75rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.trigger-btn:hover,
.trigger-btn:active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
}

.rule-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-h);
    cursor: pointer;
    user-select: none;
    padding: 0.15rem 0;
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
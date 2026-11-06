<script setup>
import { ref, computed } from 'vue'
import PinPad from './components/PinPad.vue'
import AccountTabs from './components/AccountTabs.vue'
import BalanceCard from './components/BalanceCard.vue'
import PocketGrid from './components/PocketGrid.vue'
import QuickAdd from './components/QuickAdd.vue'
import TransactionList from './components/TransactionList.vue'
import RulesManager from './components/RulesManager.vue'

const isAuthenticated = ref(false)
const budgetData = ref(null)
const activeView = ref('shared')
const timeframe = ref('week') // 'week' or 'month'
const currentPage = ref('dashboard')

const CYCLE_START_DAY = 20

// Date Math for Custom Cycle
const cycleInfo = computed(() => {
  const today = new Date()
  let startMonth = today.getMonth()
  let startYear = today.getFullYear()

  // If today is before the 20th, the cycle started last month
  if (today.getDate() < CYCLE_START_DAY) {
    startMonth -= 1
    if (startMonth < 0) {
      startMonth = 11
      startYear -= 1
    }
  }

  const cycleStart = new Date(startYear, startMonth, CYCLE_START_DAY)

  // Calculate next cycle start
  const nextMonth = startMonth === 11 ? 0 : startMonth + 1
  const nextYear = startMonth === 11 ? startYear + 1 : startYear
  const cycleEnd = new Date(nextYear, nextMonth, CYCLE_START_DAY)

  const daysInCycle = (cycleEnd - cycleStart) / (1000 * 60 * 60 * 24)
  const daysElapsed = (today - cycleStart) / (1000 * 60 * 60 * 24)

  const currentWeekIndex = Math.floor(daysElapsed / 7) + 1
  const totalWeeks = daysInCycle / 7
  const weeksRemaining = Math.max(0, Math.ceil(totalWeeks - currentWeekIndex))

  return { currentWeekIndex, totalWeeks, weeksRemaining, daysInCycle }
})

async function handleLoginSuccess() {
  isAuthenticated.value = true
  // Mocking the fetch for this example
  const res = await fetch('/api/budget')
  budgetData.value = await res.json()
}

const currentDisplayBalance = computed(() => {
  if (!budgetData.value) return '0.00'
  const relevantBalances = budgetData.value.pocketBalances.filter(b =>
    activeView.value === 'shared' ? true : b.accountId === activeView.value
  )
  return relevantBalances.reduce((sum, b) => sum + b.balance, 0).toFixed(2)
})

const unallocatedBalance = computed(() => {
  if (!budgetData.value) return '0.00'
  const relevantBalances = budgetData.value.pocketBalances.filter(b =>
    (!b.pocketId || b.pocketId === 'unallocated') &&
    (activeView.value === 'shared' ? true : b.accountId === activeView.value)
  )
  return relevantBalances.reduce((sum, b) => sum + b.balance, 0).toFixed(2)
})

const balanceTitle = computed(() => {
  return activeView.value === 'shared' ? 'Total Couple Balance' : 'Personal Balance'
})

// Dynamic Targets & Predictions
const displayPockets = computed(() => {
  if (!budgetData.value) return []

  return budgetData.value.pockets.map(pocket => {
    // Current Balance
    const balances = budgetData.value.pocketBalances.filter(b =>
      b.pocketId === pocket.id &&
      (activeView.value === 'shared' || b.accountId === activeView.value)
    )
    const currentBalance = balances.reduce((sum, b) => sum + b.balance, 0)

    // Expected Rules
    const rules = budgetData.value.budgetRules.filter(r =>
      r.pocketId === pocket.id &&
      (activeView.value === 'shared' || r.accountId === activeView.value)
    )

    // Calculate Target based on timeframe toggle
    const target = rules.reduce((sum, rule) => {
      if (timeframe.value === 'week') {
        return sum + (rule.frequency === 'monthly' ? rule.amount / cycleInfo.value.totalWeeks : rule.amount)
      } else {
        return sum + (rule.frequency === 'weekly' ? rule.amount * cycleInfo.value.totalWeeks : rule.amount)
      }
    }, 0)

    // FIXED: Only weekly frequencies project upcoming expected money
    const upcomingPrediction = rules.reduce((sum, rule) => {
      if (rule.frequency === 'monthly') {
        return sum // Monthly budgets arrive all at once; 0 upcoming
      }
      return sum + (rule.amount * cycleInfo.value.weeksRemaining)
    }, 0)

    // Calculate percentages for the split progress bar
    const actualPercent = target > 0 ? (currentBalance / target) * 100 : 0
    const predictedPercent = target > 0 ? (upcomingPrediction / target) * 100 : 0

    return {
      ...pocket,
      balance: currentBalance,
      target,
      actualPercent,
      predictedPercent
    }
  })
})

// Function to refetch data when a transaction is added
async function refreshData() {
  const res = await fetch('/api/budget')
  budgetData.value = await res.json()
}
</script>

<template>
  <main class="mobile-container">
    <PinPad v-if="!isAuthenticated" @success="handleLoginSuccess" />

    <div v-else-if="budgetData" class="app-layout">

      <!-- Global Header -->
      <AccountTabs :accounts="budgetData.accounts" :activeView="activeView"
        @update:activeView="(val) => activeView = val" />

      <!-- Dashboard -->
      <section v-if="currentPage === 'dashboard'" class="page-content">
        <BalanceCard :title="balanceTitle" :amount="currentDisplayBalance" :unallocated="unallocatedBalance" />

        <div class="controls-row">
          <div class="cycle-info">
            <small>Week {{ cycleInfo.currentWeekIndex }} / {{ Math.ceil(cycleInfo.totalWeeks) }}</small>
          </div>
          <div class="toggle-group">
            <button :class="{ active: timeframe === 'week' }" @click="timeframe = 'week'">Week</button>
            <button :class="{ active: timeframe === 'month' }" @click="timeframe = 'month'">Month</button>
          </div>
        </div>

        <PocketGrid :pockets="displayPockets" />

        <QuickAdd :accounts="budgetData.accounts" :activeView="activeView" :pockets="budgetData.pockets"
          @added="refreshData" />
      </section>

      <!-- Transactions -->
      <section v-else-if="currentPage === 'transactions'" class="page-content">
        <TransactionList :transactions="budgetData.transactions" :accounts="budgetData.accounts"
          :pockets="budgetData.pockets" :activeView="activeView" @updated="refreshData" />
      </section>

      <section v-else-if="currentPage === 'rules'" class="page-content">
        <RulesManager :rules="budgetData.budgetRules" :accounts="budgetData.accounts" :pockets="budgetData.pockets"
          :activeView="activeView" @updated="refreshData" />
      </section>

      <!-- Bottom Navigation Bar -->
      <nav class="bottom-nav">
        <button :class="{ active: currentPage === 'dashboard' }" @click="currentPage = 'dashboard'">
          Dashboard
        </button>
        <button :class="{ active: currentPage === 'transactions' }" @click="currentPage = 'transactions'">
          Transactions
        </button>
        <button :class="{ active: currentPage === 'rules' }" @click="currentPage = 'rules'">
          Rules
        </button>
      </nav>

    </div>
  </main>
</template>

<style scoped>
.mobile-container {
  width: 100%;
  padding: 1.5rem 0;
  font-family: var(--sans);
  color: var(--text);
  display: flex;
  flex-direction: column;
}

.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Controls Row Styling */
.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--code-bg);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.cycle-info {
  color: var(--text-h);
  font-weight: 500;
}

.toggle-group {
  display: flex;
  background: var(--border);
  border-radius: 6px;
  padding: 2px;
}

.toggle-group button {
  border: none;
  background: transparent;
  padding: 0.25rem 0.75rem;
  font-size: 0.85rem;
  border-radius: 4px;
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-group button.active {
  background: var(--accent);
  color: #fff;
}

.app-layout {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  height: 100%;
}

.page-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 4rem;
}

/* Bottom Navigation */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  display: flex;
  background: var(--bg);
  border-top: 1px solid var(--border);
  padding: 0.5rem;
  gap: 0.5rem;
  box-sizing: border-box;
}

.bottom-nav button {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.bottom-nav button.active {
  background: var(--accent-bg);
  color: var(--accent);
}
</style>
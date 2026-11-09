<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PinPad from './components/PinPad.vue'
import AccountTabs from './components/AccountTabs.vue'
import BalanceCard from './components/BalanceCard.vue'
import PocketGrid from './components/PocketGrid.vue'
import QuickAdd from './components/QuickAdd.vue'
import TransactionList from './components/TransactionList.vue'
import RulesManager from './components/RulesManager.vue'
import PocketsManager from './components/PocketsManager.vue'
import RecurringManager from './components/RecurringManager.vue'

const isAuthenticated = ref(false)
const budgetData = ref(null)
const activeView = ref('shared')
const timeframe = ref('week') // 'week' or 'month'
const currentPage = ref('dashboard')
const historyPocketFilter = ref('all')
const myAccountId = ref(localStorage.getItem('budget_my_account') || '')
const hideMySecrets = ref(false) // Quick toggle when showing your screen to your partner

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

  const cycleStartStr = [
    cycleStart.getFullYear(),
    String(cycleStart.getMonth() + 1).padStart(2, '0'),
    String(cycleStart.getDate()).padStart(2, '0')
  ].join('-')

  return { currentWeekIndex, totalWeeks, weeksRemaining, daysInCycle, cycleStartStr }
})

async function handleLoginSuccess() {
  isAuthenticated.value = true
  const res = await fetch('/api/budget')
  if (res.ok) {
    budgetData.value = await res.json()
  } else {
    // If the session is ever invalidated, fall back to the PIN screen
    localStorage.removeItem('budget_auth_token')
    isAuthenticated.value = false
  }
}

function handleVisibilityRefresh() {
  if (document.visibilityState === 'visible' && isAuthenticated.value) {
    refreshData()
  }
}

onMounted(() => {
  if (localStorage.getItem('budget_auth_token')) {
    handleLoginSuccess()
  }
  document.addEventListener('visibilitychange', handleVisibilityRefresh)
  window.addEventListener('focus', handleVisibilityRefresh)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityRefresh)
  window.removeEventListener('focus', handleVisibilityRefresh)
})

function setMyAccount(id) {
  myAccountId.value = id
  localStorage.setItem('budget_my_account', id)
}

// Auto-initialize myAccountId to the first account if not set yet
const activeOwnerId = computed(() => {
  if (myAccountId.value) return myAccountId.value
  return budgetData.value?.accounts?.[0]?.id || ''
})

// Hide secret transactions belonging to the partner (or all secrets if Spoil-Guard is active)
const visibleTransactions = computed(() => {
  if (!budgetData.value?.transactions) return []
  return budgetData.value.transactions.filter(tx => {
    if (!tx.isSecret) return true
    if (hideMySecrets.value) return false
    return tx.accountId === activeOwnerId.value
  })
})

// Recompute pocketBalances from visibleTransactions so hidden gifts never drop the partner's visible balance
const visiblePocketBalances = computed(() => {
  const map = new Map()
  for (const tx of visibleTransactions.value) {
    const key = `${tx.accountId}::${tx.pocketId}`
    const prev = map.get(key) || { accountId: tx.accountId, pocketId: tx.pocketId, balance: 0 }
    prev.balance += tx.type === 'credit' ? Number(tx.amount) : -Number(tx.amount)
    map.set(key, prev)
  }
  return Array.from(map.values())
})

// Set of pocket IDs marked as Savings / Épargne
const savingsPocketIds = computed(() => {
  if (!budgetData.value?.pockets) return new Set()
  return new Set(
    budgetData.value.pockets
      .filter(p => Boolean(p.isSavings))
      .map(p => p.id)
  )
})

// Spendable balance (excludes Savings / Épargne pockets)
const currentDisplayBalance = computed(() => {
  if (!budgetData.value) return '0.00'
  const relevantBalances = visiblePocketBalances.value.filter(b =>
    !savingsPocketIds.value.has(b.pocketId) &&
    (activeView.value === 'shared' ? true : b.accountId === activeView.value)
  )
  return relevantBalances.reduce((sum, b) => sum + b.balance, 0).toFixed(2)
})

// Total accumulated in Savings / Épargne pockets
const savingsBalance = computed(() => {
  if (!budgetData.value) return '0.00'
  const relevantBalances = visiblePocketBalances.value.filter(b =>
    savingsPocketIds.value.has(b.pocketId) &&
    (activeView.value === 'shared' ? true : b.accountId === activeView.value)
  )
  return relevantBalances.reduce((sum, b) => sum + b.balance, 0).toFixed(2)
})

const unallocatedBalance = computed(() => {
  if (!budgetData.value) return '0.00'
  const relevantBalances = visiblePocketBalances.value.filter(b =>
    (!b.pocketId || b.pocketId === 'unallocated') &&
    (activeView.value === 'shared' ? true : b.accountId === activeView.value)
  )
  return relevantBalances.reduce((sum, b) => sum + b.balance, 0).toFixed(2)
})

const balanceTitle = computed(() => {
  return activeView.value === 'shared' ? 'Total Spendable Balance' : 'Personal Spendable Balance'
})

// Dynamic Targets & Predictions
const displayPockets = computed(() => {
  if (!budgetData.value) return []

  return budgetData.value.pockets.map(pocket => {
    const balances = visiblePocketBalances.value.filter(b =>
      b.pocketId === pocket.id &&
      (activeView.value === 'shared' || b.accountId === activeView.value)
    )
    const currentBalance = balances.reduce((sum, b) => sum + b.balance, 0)

    const rules = budgetData.value.budgetRules.filter(r =>
      r.pocketId === pocket.id &&
      (activeView.value === 'shared' || r.accountId === activeView.value)
    )

    // If a savings pocket has a fixed long-term goalAmount (e.g. 9000 CHF for school), use that as target
    const hasCustomGoal = Boolean(pocket.isSavings) && Number(pocket.goalAmount) > 0
    const ruleTarget = rules.reduce((sum, rule) => {
      if (timeframe.value === 'week') {
        return sum + (rule.frequency === 'monthly' ? rule.amount / cycleInfo.value.totalWeeks : rule.amount)
      } else {
        return sum + (rule.frequency === 'weekly' ? rule.amount * cycleInfo.value.totalWeeks : rule.amount)
      }
    }, 0)

    const target = hasCustomGoal ? Number(pocket.goalAmount) : ruleTarget

    const upcomingPrediction = rules.reduce((sum, rule) => {
      if (rule.frequency === 'monthly') {
        return sum
      }
      return sum + (rule.amount * cycleInfo.value.weeksRemaining)
    }, 0)

    const actualPercent = target > 0 ? Math.max(0, (currentBalance / target) * 100) : (currentBalance > 0 ? 100 : 0)
    const predictedPercent = target > 0 ? Math.max(0, (upcomingPrediction / target) * 100) : 0

    return {
      ...pocket,
      balance: currentBalance,
      target,
      actualPercent,
      predictedPercent
    }
  })
})

const pinnedPockets = computed(() => {
  return displayPockets.value.filter(p => Boolean(p.pinned))
})

function openPocketHistory(pocketId) {
  historyPocketFilter.value = pocketId
  currentPage.value = 'transactions'
}

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

      <!-- Phone Owner & Gift Spoil-Guard Bar -->
      <div class="privacy-bar">
        <div class="owner-select">
          <small>My phone:</small>
          <button v-for="acc in budgetData.accounts" :key="acc.id" type="button"
            :class="{ active: activeOwnerId === acc.id }" @click="setMyAccount(acc.id)">
            {{ acc.name }}
          </button>
        </div>

        <button type="button" class="spoil-guard-btn" :class="{ active: hideMySecrets }"
          @click="hideMySecrets = !hideMySecrets" title="Temporarily hide my secret gifts on this screen">
          🎁 {{ hideMySecrets ? 'Hidden' : 'Visible' }}
        </button>
      </div>

      <!-- Global Header -->
      <AccountTabs :accounts="budgetData.accounts" :activeView="activeView"
        @update:activeView="(val) => activeView = val" />

      <!-- Dashboard -->
      <section v-if="currentPage === 'dashboard'" class="page-content">
        <BalanceCard :title="balanceTitle" :amount="currentDisplayBalance" :unallocated="unallocatedBalance"
          :savings="savingsBalance" />

        <div class="controls-row">
          <div class="cycle-info">
            <small>Week {{ cycleInfo.currentWeekIndex }} / {{ Math.ceil(cycleInfo.totalWeeks) }}</small>
          </div>
          <div class="toggle-group">
            <button :class="{ active: timeframe === 'week' }" @click="timeframe = 'week'">Week</button>
            <button :class="{ active: timeframe === 'month' }" @click="timeframe = 'month'">Month</button>
          </div>
        </div>

        <PocketGrid :pockets="pinnedPockets" @select="openPocketHistory" />

        <QuickAdd :accounts="budgetData.accounts" :activeView="activeView" :pockets="budgetData.pockets"
          @added="refreshData" />
      </section>

      <!-- Transactions -->
      <section v-else-if="currentPage === 'transactions'" class="page-content">
        <TransactionList :transactions="visibleTransactions" :accounts="budgetData.accounts"
          :pockets="budgetData.pockets" :activeView="activeView" :cycleStart="cycleInfo.cycleStartStr"
          :initialPocket="historyPocketFilter" @updated="refreshData" />
      </section>

      <!-- Recurring / Automatic Transactions -->
      <section v-else-if="currentPage === 'recurring'" class="page-content">
        <RecurringManager :recurring="budgetData.recurringTransactions" :accounts="budgetData.accounts"
          :pockets="budgetData.pockets" :activeView="activeView" @updated="refreshData" />
      </section>

      <!-- Rules -->
      <section v-else-if="currentPage === 'rules'" class="page-content">
        <RulesManager :rules="budgetData.budgetRules" :accounts="budgetData.accounts" :pockets="budgetData.pockets"
          :activeView="activeView" @updated="refreshData" />
      </section>

      <!-- Pockets -->
      <section v-else-if="currentPage === 'pockets'" class="page-content">
        <PocketsManager :pockets="displayPockets" @updated="refreshData" />
      </section>

      <!-- Bottom Navigation Bar -->
      <nav class="bottom-nav">
        <button :class="{ active: currentPage === 'dashboard' }" @click="currentPage = 'dashboard'">
          Home
        </button>
        <button :class="{ active: currentPage === 'pockets' }" @click="currentPage = 'pockets'">
          Pockets
        </button>
        <button :class="{ active: currentPage === 'transactions' }"
          @click="historyPocketFilter = 'all'; currentPage = 'transactions'">
          History
        </button>
        <button :class="{ active: currentPage === 'recurring' }" @click="currentPage = 'recurring'">
          Auto
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

.privacy-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.owner-select {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.owner-select small {
  color: var(--text);
  margin-right: 0.15rem;
}

.owner-select button,
.spoil-guard-btn {
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--code-bg);
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.owner-select button.active {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}

.spoil-guard-btn.active {
  background: #ef4444;
  color: #fff;
  border-color: #ef4444;
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
  min-width: 0;
  padding: 0.6rem 0.15rem;
  font-size: 0.8rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.bottom-nav button.active {
  background: var(--accent-bg);
  color: var(--accent);
}
</style>
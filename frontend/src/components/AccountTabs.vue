<script setup>
defineProps({
  accounts: Array,
  activeView: String
})
defineEmits(['update:activeView'])
</script>

<template>
  <div class="account-tabs">
    <button 
      :class="{ active: activeView === 'shared' }" 
      @click="$emit('update:activeView', 'shared')">
      Shared
    </button>
    <button 
      v-for="acc in accounts" 
      :key="acc.id" 
      :class="{ active: activeView === acc.id }" 
      @click="$emit('update:activeView', acc.id)">
      {{ acc.name }}
    </button>
  </div>
</template>

<style scoped>
.account-tabs { display: flex; gap: 0.5rem; }
.account-tabs button { flex: 1; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; background: var(--code-bg); color: var(--text); font-weight: 500; cursor: pointer; transition: all 0.2s; }
.account-tabs button.active { background: var(--accent); color: #ffffff; border-color: var(--accent); }
</style>
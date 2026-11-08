<script setup>
defineProps({
  pockets: Array
})
defineEmits(['select'])
</script>

<template>
  <div class="pockets-grid">
    <div v-for="pocket in pockets" :key="pocket.id" class="pocket-card"
      :class="{ 'card-overspent': pocket.balance < 0 }" @click="$emit('select', pocket.id)">
      <div class="pocket-header">
        <small>{{ pocket.name }}</small>
        <strong :class="{ 'text-overspent': pocket.balance < 0 }">
          {{ pocket.balance.toFixed(2) }} <span class="target">/ {{ pocket.target.toFixed(0) }} CHF</span>
        </strong>
      </div>

      <!-- Split Progress Bar -->
      <div class="progress-bar-bg">
        <div class="progress-bar-fill"
          :style="{ width: (pocket.balance < 0 ? 100 : Math.min(pocket.actualPercent, 100)) + '%' }" :class="{
            overspent: pocket.balance < 0,
            surplus: pocket.balance >= 0 && pocket.actualPercent > 100
          }"></div>

        <div v-if="pocket.balance >= 0 && pocket.predictedPercent > 0 && pocket.actualPercent < 100"
          class="progress-bar-predicted"
          :style="{ width: Math.min(pocket.predictedPercent, 100 - pocket.actualPercent) + '%' }"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pockets-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.pocket-card {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--code-bg);
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.2s ease;
}

.pocket-card:active {
  transform: scale(0.98);
  border-color: var(--accent-border);
}

.pocket-card.card-overspent {
  border-color: rgba(239, 68, 68, 0.5);
}

.pocket-header {
  display: flex;
  flex-direction: column;
}

.pocket-header small {
  color: var(--text);
}

.pocket-header strong {
  font-size: 1.1rem;
  color: var(--text-h);
  margin-top: 0.25rem;
}

.pocket-header strong.text-overspent {
  color: #ef4444;
}

.target {
  font-size: 0.85rem;
  color: var(--text);
  font-weight: normal;
}

/* Split Progress Bar Styles */
.progress-bar-bg {
  display: flex;
  width: 100%;
  height: 6px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.progress-bar-fill.surplus {
  background: #10b981;
}

.progress-bar-fill.overspent {
  background: #ef4444;
}

/* The Dotted/Striped Prediction Bar */
.progress-bar-predicted {
  height: 100%;
  background: repeating-linear-gradient(45deg,
      var(--accent-border) 0px,
      var(--accent-border) 4px,
      transparent 4px,
      transparent 8px);
  transition: width 0.3s ease;
}
</style>
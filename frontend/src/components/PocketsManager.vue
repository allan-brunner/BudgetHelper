<script setup>
import { ref } from 'vue'

const props = defineProps({
    pockets: Array
})

const emit = defineEmits(['updated'])

const newPocketName = ref('')
const pinByDefault = ref(true)

async function addPocket() {
    if (!newPocketName.value.trim()) return

    const res = await fetch('/api/pockets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: newPocketName.value.trim(),
            pinned: pinByDefault.value
        })
    })

    if (res.ok) {
        newPocketName.value = ''
        pinByDefault.value = true
        emit('updated')
    }
}

async function togglePin(pocket) {
    const res = await fetch(`/api/pockets/${pocket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            pinned: !pocket.pinned
        })
    })

    if (res.ok) {
        emit('updated')
    }
}

async function deletePocket(id) {
    const res = await fetch(`/api/pockets/${id}`, { method: 'DELETE' })
    if (res.ok) {
        emit('updated')
    }
}
</script>

<template>
    <div class="pockets-manager">
        <!-- Add Pocket Form -->
        <form class="pocket-form" @submit.prevent="addPocket">
            <h3>New Pocket</h3>
            <div class="row">
                <input v-model="newPocketName" type="text" placeholder="Pocket name (e.g. Holidays, Rent)" required />
            </div>
            <label class="pin-checkbox">
                <input v-model="pinByDefault" type="checkbox" />
                <span>Pin to Dashboard</span>
            </label>
            <button type="submit">Add Pocket</button>
        </form>

        <!-- All Pockets List -->
        <div class="pockets-list">
            <div v-if="!pockets || pockets.length === 0" class="empty-state">
                No pockets created yet.
            </div>

            <div v-for="pocket in pockets" :key="pocket.id" class="pocket-item">
                <div class="pocket-top">
                    <div class="pocket-info">
                        <strong>{{ pocket.name }}</strong>
                        <span>
                            {{ pocket.balance.toFixed(2) }}
                            <small>/ {{ pocket.target.toFixed(0) }} CHF</small>
                        </span>
                    </div>

                    <div class="pocket-actions">
                        <button type="button" class="pin-btn" :class="{ active: pocket.pinned }"
                            @click="togglePin(pocket)"
                            :title="pocket.pinned ? 'Unpin from Dashboard' : 'Pin to Dashboard'">
                            {{ pocket.pinned ? 'Pinned' : 'Pin' }}
                        </button>
                        <button type="button" class="delete-btn" @click="deletePocket(pocket.id)" title="Delete pocket">
                            ✕
                        </button>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" :style="{ width: Math.min(pocket.actualPercent, 100) + '%' }"
                        :class="{ overspent: pocket.actualPercent > 100 }"></div>
                    <div v-if="pocket.predictedPercent > 0 && pocket.actualPercent < 100" class="progress-bar-predicted"
                        :style="{ width: Math.min(pocket.predictedPercent, 100 - pocket.actualPercent) + '%' }"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pockets-manager {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding-bottom: 5rem;
}

.pocket-form {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    background: var(--code-bg);
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid var(--border);
}

.pocket-form h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-h);
    text-align: left;
}

.pocket-form .row {
    display: flex;
    gap: 0.5rem;
}

.pocket-form input[type="text"] {
    flex: 1;
    min-width: 0;
    padding: 0.6rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text-h);
}

.pin-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--text-h);
    cursor: pointer;
    user-select: none;
}

.pocket-form button {
    padding: 0.65rem;
    border-radius: 6px;
    background: var(--accent);
    color: white;
    border: none;
    font-weight: bold;
    cursor: pointer;
}

.pockets-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.empty-state {
    text-align: center;
    color: var(--text);
    padding: 2rem 0;
}

.pocket-item {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    padding: 1rem;
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
}

.pocket-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
}

.pocket-info {
    display: flex;
    flex-direction: column;
    text-align: left;
    min-width: 0;
}

.pocket-info strong {
    color: var(--text-h);
    font-size: 1rem;
}

.pocket-info span {
    color: var(--text-h);
    font-weight: 600;
    font-size: 0.95rem;
    margin-top: 0.15rem;
}

.pocket-info small {
    color: var(--text);
    font-weight: normal;
}

.pocket-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
}

.pin-btn {
    padding: 0.35rem 0.65rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.pin-btn.active {
    background: var(--accent-bg);
    color: var(--accent);
    border-color: var(--accent-border);
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

.progress-bar-fill.overspent {
    background: #ef4444;
}

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
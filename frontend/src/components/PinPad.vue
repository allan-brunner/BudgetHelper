<script setup>
import { ref } from 'vue'

const emit = defineEmits(['success'])
const pin = ref('')
const pinLength = 4
const authError = ref('')

function pressKey(num) {
  if (pin.value.length < pinLength) {
    pin.value += num
    authError.value = ''
    if (pin.value.length === pinLength) {
      verifyPin()
    }
  }
}

function deleteKey() {
  pin.value = pin.value.slice(0, -1)
  authError.value = ''
}

async function verifyPin() {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: pin.value })
  })
  if (res.ok) {
    const data = await res.json()
    localStorage.setItem('budget_auth_token', data.token || 'authenticated')
    emit('success')
  } else {
    authError.value = 'Incorrect PIN'
    pin.value = ''
  }
}
</script>

<template>
  <section class="pin-screen">
    <h2>Enter PIN</h2>
    <div class="pin-dots">
      <div v-for="n in pinLength" :key="n" class="dot" :class="{ filled: pin.length >= n }"></div>
    </div>
    <p v-if="authError" class="error">{{ authError }}</p>

    <div class="keypad">
      <button v-for="n in 9" :key="n" class="key" @click="pressKey(n)">{{ n }}</button>
      <div class="key-spacer"></div>
      <button class="key" @click="pressKey(0)">0</button>
      <button class="key delete-key" @click="deleteKey">⌫</button>
    </div>
  </section>
</template>

<style scoped>
.pin-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 2rem;
}

.pin-screen h2 {
  color: var(--text-h);
}

.pin-dots {
  display: flex;
  gap: 1rem;
  margin: 1.5rem 0 2.5rem 0;
}

.dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--code-bg);
  border: 1px solid var(--border);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.dot.filled {
  background: var(--accent);
  border-color: var(--accent);
}

.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.key {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  font-size: 1.75rem;
  background: var(--code-bg);
  border: 1px solid var(--border);
  color: var(--text-h);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s, border-color 0.2s;
}

.key:active {
  background: var(--accent-bg);
  border-color: var(--accent-border);
}

.delete-key {
  background: transparent;
  border: none;
  color: var(--text);
}

.error {
  color: #ef4444;
  height: 1rem;
  margin-top: -1.5rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
</style>
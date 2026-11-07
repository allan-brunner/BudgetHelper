import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const originalFetch = window.fetch
window.fetch = async (url, options = {}) => {
  if (typeof url === 'string' && url.startsWith('/api')) {
    const token = localStorage.getItem('budget_auth_token')
    const headers = new Headers(options.headers || {})

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    options.headers = headers
  }

  const response = await originalFetch(url, options)

  // If a protected route returns Unauthorized, clear the stored token and reload to show PinPad
  if (response.status === 401 && typeof url === 'string' && !url.startsWith('/api/auth')) {
    localStorage.removeItem('budget_auth_token')
    window.location.reload()
  }

  return response
}

createApp(App).mount('#app')
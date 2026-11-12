import React from 'react'
import ReactDOM from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App'
import './styles.css'

// Capacitor serves the bundled UI from a local origin. Route only Worker API
// calls to production; keep Supabase SDK and all external requests untouched.
if (Capacitor.isNativePlatform()) {
  const nativeFetch = window.fetch.bind(window)
  const apiOrigin = 'https://aqui-net-hub.kobonaaquilas.workers.dev'

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input instanceof Request
          ? input.url
          : ''

    if (!rawUrl) return nativeFetch(input, init)

    try {
      const parsed = new URL(rawUrl, window.location.href)
      if (parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/')) {
        const target = apiOrigin + parsed.pathname + parsed.search
        return input instanceof Request
          ? nativeFetch(new Request(target, input), init)
          : nativeFetch(target, init)
      }
    } catch {
      // Preserve the browser's native error handling for malformed URLs.
    }

    return nativeFetch(input, init)
  }) as typeof window.fetch
}

if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('AQUI NET HUB offline support unavailable:', error)
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

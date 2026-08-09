import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Register PWA service worker.
// Uses a non-blocking banner instead of confirm() so it doesn't interrupt the user.
registerSW({
  onNeedRefresh() {
    // Show a dismissible update banner at the bottom of the screen
    const banner = document.createElement('div')
    banner.id = 'pwa-update-banner'
    banner.innerHTML = `
      <div style="
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
        background: #1e1b4b; color: #fff; padding: 12px 20px;
        display: flex; align-items: center; justify-content: space-between;
        font-family: system-ui, sans-serif; font-size: 14px;
        box-shadow: 0 -2px 12px rgba(0,0,0,0.25);
      ">
        <span>A new version is available.</span>
        <div style="display: flex; gap: 8px;">
          <button id="pwa-update-btn" style="
            background: #4f46e5; color: #fff; border: none; border-radius: 6px;
            padding: 6px 14px; cursor: pointer; font-size: 13px; font-weight: 600;
          ">Update now</button>
          <button id="pwa-dismiss-btn" style="
            background: transparent; color: #9ca3af; border: 1px solid #4b5563;
            border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px;
          ">Later</button>
        </div>
      </div>
    `
    document.body.appendChild(banner)

    document.getElementById('pwa-update-btn')?.addEventListener('click', () => {
      window.location.reload()
    })
    document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
      banner.remove()
    })
  },
  onOfflineReady() {
    // Show a brief "offline ready" toast
    const toast = document.createElement('div')
    toast.innerHTML = `
      <div style="
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: #065f46; color: #d1fae5; padding: 10px 20px;
        border-radius: 8px; font-family: system-ui, sans-serif; font-size: 13px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 9999;
        white-space: nowrap;
      ">
        ✓ App ready for offline use
      </div>
    `
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3500)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './iphone-pass2.css'
import './iphone-modal-fix.css'
import App from './App.jsx'
import PasswordRecovery from './PasswordRecovery.jsx'

const recoveryMode = new URLSearchParams(window.location.search).get('mode') === 'recovery'

function leaveRecovery() {
  window.history.replaceState({}, '', window.location.pathname || '/')
  window.location.reload()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {recoveryMode ? (
      <PasswordRecovery onComplete={leaveRecovery} onCancel={leaveRecovery} />
    ) : (
      <App />
    )}
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Quest service worker registration failed:', error)
    })
  })
}

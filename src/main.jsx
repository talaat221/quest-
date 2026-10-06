import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './iphone-pass2.css'
import './iphone-modal-fix.css'
import App from './App.jsx'
import PasswordRecovery from './PasswordRecovery.jsx'
import PrivacyNotice from './PrivacyNotice.jsx'
import TermsOfService from './TermsOfService.jsx'

function isRecoveryLocation() {
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const path = window.location.pathname.replace(/\/+$/, '') || '/'

  return (
    path === '/reset-password' ||
    search.get('mode') === 'recovery' ||
    search.get('type') === 'recovery' ||
    hash.get('type') === 'recovery'
  )
}

const recoveryMode = isRecoveryLocation()
const privacyMode = (window.location.pathname.replace(/\/+$/, '') || '/') === '/privacy'
const termsMode = (window.location.pathname.replace(/\/+$/, '') || '/') === '/terms'

function leaveRecovery() {
  window.history.replaceState({}, '', '/')
  window.location.reload()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {privacyMode ? (
      <PrivacyNotice />
    ) : termsMode ? (
      <TermsOfService />
    ) : recoveryMode ? (
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

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './iphone-pass2.css'
import './iphone-modal-fix.css'
import './pixel-home-real.css'
import './pixelHomeRealSafe.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Quest service worker registration failed:', error)
    })
  })
}

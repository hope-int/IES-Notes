import { StrictMode } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css'
import App from './App.jsx'

// Auto update PWA
registerSW({
  onNeedRefresh() {
    if (confirm('New update available! Reload now?')) {
      window.location.reload()
    }
  },
  onOfflineReady() {
    console.log('App ready for offline use')
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

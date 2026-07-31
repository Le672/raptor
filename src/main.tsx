import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { isElectronApp } from '@/lib/runtime'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 注册 Service Worker（仅生产环境浏览器，Electron file:// 下不支持）
if ('serviceWorker' in navigator && import.meta.env.PROD && !isElectronApp()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

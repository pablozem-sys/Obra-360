import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import { logError } from './lib/logger'
import App from './App.jsx'
import './index.css'

// Handlers globales — capturan lo que un try/catch de página no alcanza a
// atrapar: errores fuera del ciclo de render de React y promesas rechazadas
// sin .catch(). El ErrorBoundary de abajo cubre los throws DENTRO del render.
window.addEventListener('error', (event) => {
  logError(event.error ?? event.message, { origen: 'unhandled' })
})
window.addEventListener('unhandledrejection', (event) => {
  logError(event.reason, { origen: 'promise' })
})

// El auto-inject por defecto de vite-plugin-pwa solo registra el service
// worker, sin recargar la pestaña cuando hay una versión nueva activa —
// una pestaña ya abierta se queda corriendo el JS viejo para siempre hasta
// que el usuario cierra y reabre la app entera. registerSW() usa workbox-window
// y sí recarga automáticamente al detectar una actualización (registerType: 'autoUpdate').
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

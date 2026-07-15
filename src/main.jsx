import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import App from './App.jsx'
import './index.css'

// El auto-inject por defecto de vite-plugin-pwa solo registra el service
// worker, sin recargar la pestaña cuando hay una versión nueva activa —
// una pestaña ya abierta se queda corriendo el JS viejo para siempre hasta
// que el usuario cierra y reabre la app entera. registerSW() usa workbox-window
// y sí recarga automáticamente al detectar una actualización (registerType: 'autoUpdate').
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

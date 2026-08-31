import { useEffect } from 'react'
import { VITE_ENV, IS_PRODUCTION } from '../lib/supabase'

const LABELS = {
  staging: 'AMBIENTE DE PRUEBAS',
  local:   'AMBIENTE LOCAL',
}

// Banner fijo arriba de toda la app cuando NO se está en producción. Reserva
// su altura vía la variable CSS --env-banner-h (ver index.css), que Sidebar.jsx
// y el header mobile de AppLayout.jsx usan para no quedar tapados debajo.
export default function EnvironmentBanner() {
  useEffect(() => {
    document.documentElement.classList.toggle('has-env-banner', !IS_PRODUCTION)
    return () => document.documentElement.classList.remove('has-env-banner')
  }, [])

  if (IS_PRODUCTION) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 flex items-center justify-center px-3 text-center"
      style={{
        height: 'var(--env-banner-h)',
        zIndex: 9999,
        background: 'var(--red)',
        color: '#fff',
        fontFamily: 'DM Mono',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.12em',
      }}
    >
      ⚠ {LABELS[VITE_ENV] ?? `AMBIENTE ${VITE_ENV.toUpperCase()}`} — datos ficticios
    </div>
  )
}

import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'
import { logError } from '../lib/logger'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { crashed: false }
  }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error, info) {
    // info.componentStack no se envía — puede filtrar props con datos reales
    // (nombres, montos) en el árbol renderizado. Queda solo en consola local.
    logError(error, { origen: 'ui', operacion: 'render' })
    if (import.meta.env.DEV) console.error(error, info)
  }

  render() {
    if (!this.state.crashed) return this.props.children

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: 'var(--bg-base)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,69,96,0.3)' }}
        >
          <AlertTriangle size={28} style={{ color: 'var(--red)' }} />
        </div>
        <p className="font-display text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
          Algo salió mal
        </p>
        <h2 className="font-display font-bold text-xl mb-2" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
          La pantalla no pudo cargar
        </h2>
        <p className="text-sm mb-7 max-w-xs" style={{ color: 'var(--muted)' }}>
          Ya quedó registrado. Probá recargar — si sigue pasando, avisale al equipo.
        </p>
        <button onClick={() => window.location.reload()} className="btn-primary">
          Volver a intentar
        </button>
      </div>
    )
  }
}

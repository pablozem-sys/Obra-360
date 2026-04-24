import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { trabajadores } from '../data/mockData'

export default function AccesoTrabajador() {
  const navigate    = useNavigate()
  const { loginTrabajador } = useAuth()

  const handleSelect = (t) => {
    loginTrabajador(t)
    navigate('/trabajador/asistencia')
  }

  return (
    <div
      className="min-h-screen flex flex-col px-5 py-8"
      style={{ background: 'var(--bg-base)' }}
    >
      <button
        onClick={() => navigate('/')}
        className="btn-ghost -ml-2 mb-8 text-sm self-start"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft size={14} /> Volver
      </button>

      <div className="mb-8">
        <p
          className="font-display text-[11px] font-bold uppercase tracking-widest mb-2"
          style={{ color: 'var(--muted)' }}
        >
          Control Obras 360°
        </p>
        <h1
          className="font-display font-bold leading-tight"
          style={{ fontSize: 28, letterSpacing: '-0.04em', color: 'var(--text)' }}
        >
          ¿Quién eres?
        </h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
          Selecciona tu nombre para marcar asistencia
        </p>
      </div>

      <div className="space-y-3">
        {trabajadores.map(t => (
          <button
            key={t.id}
            onClick={() => handleSelect(t)}
            className="w-full text-left rounded-2xl p-5 transition-all duration-150 active:scale-[0.98] group flex items-center gap-4"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.background = 'var(--bg-elevated)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)' }}
          >
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-sm"
              style={{ background: 'var(--amber)', color: '#000', boxShadow: '0 0 16px var(--amber-glow)' }}
            >
              {t.avatar}
            </div>
            {/* Name */}
            <div className="flex-1">
              <p className="font-semibold text-base" style={{ color: 'var(--text)' }}>{t.nombre}</p>
              <p className="text-[12px] num" style={{ color: 'var(--muted)' }}>
                ${t.valorHora.toLocaleString('es-CL')}/hora
              </p>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--subtle)' }} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        ))}
      </div>
    </div>
  )
}

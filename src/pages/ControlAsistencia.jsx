import { useState } from 'react'
import { Users, Clock, DollarSign, Calendar, MapPin } from 'lucide-react'
import { registrosAsistencia, trabajadores, obras } from '../data/mockData'
import { formatCLP } from '../lib/helpers'

function formatHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
}

export default function ControlAsistencia() {
  const [filtroObra, setFiltroObra] = useState('all')
  const [filtroFecha, setFiltroFecha] = useState('')

  const filtered = registrosAsistencia.filter(r => {
    const matchObra  = filtroObra === 'all' || r.obraId === filtroObra
    const matchFecha = !filtroFecha || r.fecha === filtroFecha
    return matchObra && matchFecha
  })

  const totalHoras = filtered.filter(r => r.horasTrabajadas).reduce((s, r) => s + r.horasTrabajadas, 0)
  const totalCosto = filtered.filter(r => r.costoTotal).reduce((s, r) => s + r.costoTotal, 0)
  const enObra     = registrosAsistencia.filter(r => !r.salida).length

  // Costo por obra (para mostrar impacto en EERR)
  const costoPorObra = obras.map(o => {
    const regs  = registrosAsistencia.filter(r => r.obraId === o.id && r.costoTotal)
    const costo = regs.reduce((s, r) => s + r.costoTotal, 0)
    const horas = regs.reduce((s, r) => s + (r.horasTrabajadas || 0), 0)
    return { ...o, costoManoObra: costo, horasTotales: horas, nRegistros: regs.length }
  }).filter(o => o.costoManoObra > 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)', letterSpacing: '-0.04em' }}>
          Control de Asistencia
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          Registro y costos de mano de obra automáticos
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={13} style={{ color: 'var(--amber)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>En obra ahora</span>
          </div>
          <p className="num font-medium text-2xl" style={{ color: 'var(--amber)' }}>{enObra}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={13} style={{ color: 'var(--green)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Total horas</span>
          </div>
          <p className="num font-medium text-2xl" style={{ color: 'var(--green)' }}>{totalHoras.toFixed(1)}</p>
        </div>
        <div className="card p-4 col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={13} style={{ color: 'var(--text)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Costo mano de obra</span>
          </div>
          <p className="num font-medium text-2xl" style={{ color: 'var(--text)' }}>{formatCLP(totalCosto)}</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>Calculado automáticamente desde asistencia</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          className="select flex-1 min-w-[140px] max-w-[200px]"
          value={filtroObra}
          onChange={e => setFiltroObra(e.target.value)}
        >
          <option value="all">Todas las obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <input
          type="date"
          className="input flex-1 min-w-[140px] max-w-[180px]"
          value={filtroFecha}
          onChange={e => setFiltroFecha(e.target.value)}
        />
        {filtroFecha && (
          <button onClick={() => setFiltroFecha('')} className="btn-ghost text-sm" style={{ color: 'var(--muted)' }}>
            Limpiar
          </button>
        )}
      </div>

      {/* Records table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="section-title">Registros ({filtered.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                {['Trabajador', 'Obra', 'Fecha', 'Entrada', 'Salida', 'Horas', 'Costo'].map(h => (
                  <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const trab = trabajadores.find(t => t.id === r.trabajadorId)
                const obra = obras.find(o => o.id === r.obraId)
                const abierto = !r.salida
                return (
                  <tr key={r.id} className="table-row">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                          style={{ background: 'var(--amber)', color: '#000' }}
                        >
                          {trab?.avatar}
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{trab?.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-[12px] truncate block max-w-[130px]" style={{ color: 'var(--muted)' }}>{obra?.nombre}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="num text-[12px]" style={{ color: 'var(--muted)' }}>{formatFecha(r.entrada)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="num text-[13px] font-medium" style={{ color: 'var(--green)' }}>{formatHora(r.entrada)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {abierto ? (
                        <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--amber)', fontFamily: 'Unbounded' }}>
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--amber)' }} />
                          EN OBRA
                        </span>
                      ) : (
                        <span className="num text-[13px] font-medium" style={{ color: 'var(--red)' }}>{formatHora(r.salida)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="num text-[13px] font-semibold" style={{ color: abierto ? 'var(--muted)' : 'var(--amber)' }}>
                        {r.horasTrabajadas != null ? `${r.horasTrabajadas}h` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="num text-[13px] font-semibold" style={{ color: abierto ? 'var(--muted)' : 'var(--green)' }}>
                        {r.costoTotal != null ? formatCLP(r.costoTotal) : '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm" style={{ color: 'var(--muted)' }}>
                    Sin registros para este filtro
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Costo por obra */}
      {costoPorObra.length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-4">Mano de Obra por Obra</h2>
          <p className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>
            Estos costos se suman automáticamente a los egresos y EERR de cada obra.
          </p>
          <div className="space-y-3">
            {costoPorObra.map(o => (
              <div
                key={o.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{o.nombre}</p>
                  <p className="text-[11px] num" style={{ color: 'var(--muted)' }}>
                    {o.horasTotales.toFixed(1)} hrs · {o.nRegistros} turnos
                  </p>
                </div>
                <p className="num font-bold text-base" style={{ color: 'var(--green)' }}>
                  {formatCLP(o.costoManoObra)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

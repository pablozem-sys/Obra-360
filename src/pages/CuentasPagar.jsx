import { useState, useEffect } from 'react'
import { AlertTriangle, Clock, CheckCircle2, Loader2, CreditCard } from 'lucide-react'
import { getEgresosCredito, updateGasto } from '../lib/supabase'
import { formatCLP, CATEGORIAS_GASTO } from '../lib/helpers'

function calcFechaVencimiento(fechaStr, plazoMeses) {
  if (!fechaStr || !plazoMeses) return null
  const [y, m, d] = fechaStr.split('-').map(Number)
  return new Date(y, m - 1 + plazoMeses, d)
}

function deriveEstado(gasto) {
  if (gasto.estado === 'pagado') return 'pagado'
  const venc = calcFechaVencimiento(gasto.fecha, gasto.plazo_credito)
  if (!venc) return 'pendiente'
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  if (venc < hoy) return 'vencido'
  const diasRestantes = (venc - hoy) / (1000 * 60 * 60 * 24)
  if (diasRestantes <= 7) return 'proximo'
  return 'pendiente'
}

function formatFecha(date) {
  if (!date) return '—'
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const ESTADO_META = {
  pendiente: { label: 'Pendiente',         color: 'var(--amber)',  bg: 'var(--amber-dim)',  border: 'rgba(255,149,0,0.3)' },
  proximo:   { label: 'Próximo a vencer',  color: '#F97316',       bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' },
  vencido:   { label: 'Vencido',           color: 'var(--red)',    bg: 'var(--red-dim)',    border: 'rgba(255,69,96,0.3)' },
  pagado:    { label: 'Pagado',            color: 'var(--green)',  bg: 'var(--green-dim)', border: 'rgba(0,196,140,0.3)' },
}

const FILTROS = ['todos', 'pendiente', 'proximo', 'vencido', 'pagado']
const FILTRO_LABELS = { todos: 'Todos', pendiente: 'Pendiente', proximo: 'Próximo', vencido: 'Vencido', pagado: 'Pagado' }

export default function CuentasPagar() {
  const [creditos,  setCreditos]  = useState([])
  const [filtro,    setFiltro]    = useState('todos')
  const [loading,   setLoading]   = useState(true)
  const [marcando,  setMarcando]  = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000)
    getEgresosCredito()
      .then(setCreditos)
      .catch(() => setCreditos([]))
      .finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  const creditosConEstado = creditos.map(c => ({
    ...c,
    estadoDerived:    deriveEstado(c),
    fechaVencimiento: calcFechaVencimiento(c.fecha, c.plazo_credito),
  }))

  const filtered = filtro === 'todos'
    ? creditosConEstado
    : creditosConEstado.filter(c => c.estadoDerived === filtro)

  const totales = {
    pendiente: creditosConEstado.filter(c => c.estadoDerived === 'pendiente').reduce((s, c) => s + (c.monto ?? 0), 0),
    proximo:   creditosConEstado.filter(c => c.estadoDerived === 'proximo').reduce((s, c) => s + (c.monto ?? 0), 0),
    vencido:   creditosConEstado.filter(c => c.estadoDerived === 'vencido').reduce((s, c) => s + (c.monto ?? 0), 0),
  }

  const marcarPagado = async (id) => {
    setMarcando(id)
    setCreditos(prev => prev.map(c => c.id === id ? { ...c, estado: 'pagado' } : c))
    try {
      await updateGasto(id, { estado: 'pagado' })
    } catch {
      setCreditos(prev => prev.map(c => c.id === id ? { ...c, estado: 'pendiente' } : c))
    } finally {
      setMarcando(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Créditos</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Egresos tomados a crédito — vencimientos y estado de pago</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={13} style={{ color: 'var(--amber)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Pendiente</span>
          </div>
          <p className="font-display font-bold text-lg num" style={{ color: 'var(--amber)' }}>{formatCLP(totales.pendiente)}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{creditosConEstado.filter(c => c.estadoDerived === 'pendiente').length} créditos</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={13} style={{ color: '#F97316' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Próximo</span>
          </div>
          <p className="font-display font-bold text-lg num" style={{ color: '#F97316' }}>{formatCLP(totales.proximo)}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>Vence en ≤7 días</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={13} style={{ color: 'var(--red)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'Unbounded' }}>Vencido</span>
          </div>
          <p className="font-display font-bold text-lg num" style={{ color: 'var(--red)' }}>{formatCLP(totales.vencido)}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{creditosConEstado.filter(c => c.estadoDerived === 'vencido').length} créditos</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
            style={{
              background: filtro === f ? 'var(--amber)' : 'var(--bg-card)',
              color:  filtro === f ? '#0A0C1A' : 'var(--muted)',
              border: `1px solid ${filtro === f ? 'transparent' : 'var(--border)'}`,
              fontFamily: 'Unbounded',
            }}
          >
            {FILTRO_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                {['Fecha toma', 'Proveedor / Obra', 'Monto', 'Plazo', 'Vencimiento', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3"
                    style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const est = ESTADO_META[c.estadoDerived] ?? ESTADO_META.pendiente
                const cat = CATEGORIAS_GASTO[c.categoria]
                return (
                  <tr key={c.id} className="table-row">
                    <td className="px-5 py-3.5">
                      <span className="num text-[12px]" style={{ color: 'var(--muted)' }}>{c.fecha ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{c.proveedor ?? '—'}</p>
                      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                        {c.projects?.nombre ?? 'Sin obra'} · {cat?.label ?? c.categoria}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="num text-sm font-semibold" style={{ color: 'var(--text)' }}>{formatCLP(c.monto)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="num text-[12px]" style={{ color: 'var(--muted)' }}>
                        {c.plazo_credito ? `${c.plazo_credito} ${c.plazo_credito === 1 ? 'mes' : 'meses'}` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="num text-[12px] font-medium"
                        style={{ color: c.estadoDerived === 'vencido' ? 'var(--red)' : c.estadoDerived === 'proximo' ? '#F97316' : 'var(--muted)' }}
                      >
                        {formatFecha(c.fechaVencimiento)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold"
                        style={{ fontFamily: 'Unbounded', background: est.bg, color: est.color, border: `1px solid ${est.border}` }}
                      >
                        {est.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {c.estadoDerived !== 'pagado' && (
                        <button
                          onClick={() => marcarPagado(c.id)}
                          disabled={marcando === c.id}
                          className="text-xs font-semibold transition-colors disabled:opacity-50"
                          style={{ color: 'var(--green)', fontFamily: 'Unbounded' }}
                        >
                          {marcando === c.id ? '...' : 'Marcar pagado'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm" style={{ color: 'var(--subtle)' }}>
                    Sin créditos para este filtro
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

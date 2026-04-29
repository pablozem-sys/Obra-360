import { useState, useEffect } from 'react'
import { Wallet, Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import Badge from '../components/ui/Badge'
import { getCuentasCobrar, updateCuentaCobrar } from '../lib/supabase'
import { formatCLP, formatDate, ESTADOS_PAGO } from '../lib/helpers'

const FILTROS = ['todos', 'pendiente', 'vencido', 'cobrado']

export default function CuentasCobrar() {
  const [cxc, setCxc]       = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000)
    getCuentasCobrar()
      .then(setCxc)
      .catch(() => setCxc([]))
      .finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  const filtered = filtro === 'todos' ? cxc : cxc.filter(c => c.estado === filtro)

  const totales = {
    pendiente: cxc.filter(c => c.estado === 'pendiente').reduce((s, c) => s + (c.saldo_pendiente ?? 0), 0),
    vencido:   cxc.filter(c => c.estado === 'vencido').reduce((s, c) => s + (c.saldo_pendiente ?? 0), 0),
    cobrado:   cxc.filter(c => c.estado === 'cobrado').reduce((s, c) => s + (c.cobrado ?? 0), 0),
  }

  const marcarCobrado = async (id) => {
    const item = cxc.find(c => c.id === id)
    const updates = { estado: 'cobrado', cobrado: item?.monto_contrato ?? 0, saldo_pendiente: 0 }
    setCxc(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    try {
      await updateCuentaCobrar(id, updates)
    } catch {
      setCxc(prev => prev.map(c => c.id === id ? item : c))
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
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Cuentas por Cobrar</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Estado de cobros por cliente y obra</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} style={{ color: 'var(--amber)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Por cobrar</span>
          </div>
          <p className="font-display font-bold text-lg" style={{ color: 'var(--amber)' }}>{formatCLP(totales.pendiente)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{cxc.filter(c => c.estado === 'pendiente').length} clientes</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} style={{ color: 'var(--red)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Vencido</span>
          </div>
          <p className="font-display font-bold text-lg" style={{ color: 'var(--red)' }}>{formatCLP(totales.vencido)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{cxc.filter(c => c.estado === 'vencido').length} clientes</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Cobrado</span>
          </div>
          <p className="font-display font-bold text-lg" style={{ color: 'var(--green)' }}>{formatCLP(totales.cobrado)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{cxc.filter(c => c.estado === 'cobrado').length} clientes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {FILTROS.map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className="px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all duration-150"
            style={{
              background: filtro === f ? 'var(--amber)' : 'var(--bg-card)',
              color: filtro === f ? '#0A0C1A' : 'var(--muted)',
              border: `1px solid ${filtro === f ? 'transparent' : 'var(--border)'}`,
            }}
          >
            {f === 'todos' ? 'Todos' : ESTADOS_PAGO[f]?.label || f}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map(c => {
          const pctCobrado = c.monto_contrato > 0 ? ((c.cobrado ?? 0) / c.monto_contrato * 100).toFixed(0) : 0
          return (
            <div key={c.id} className="card p-5" style={{ borderColor: c.estado === 'vencido' ? 'rgba(255,69,96,0.3)' : undefined }}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge className={ESTADOS_PAGO[c.estado]?.color}>{ESTADOS_PAGO[c.estado]?.label || c.estado}</Badge>
                    {c.estado === 'vencido' && (
                      <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--red)' }}>
                        <AlertTriangle size={11} /> Vencido el {formatDate(c.fecha_compromiso)}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold" style={{ color: 'var(--text)' }}>{c.clients?.nombre ?? '—'}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{c.projects?.nombre ?? '—'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Saldo pendiente</p>
                  <p className="font-display font-bold text-xl" style={{ color: (c.saldo_pendiente ?? 0) > 0 ? 'var(--amber)' : 'var(--green)' }}>
                    {formatCLP(c.saldo_pendiente ?? 0)}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--muted)' }}>Cobrado: {formatCLP(c.cobrado ?? 0)}</span>
                  <span style={{ color: 'var(--muted)' }}>Contrato: {formatCLP(c.monto_contrato ?? 0)}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctCobrado}%`, background: 'var(--green)' }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium" style={{ color: 'var(--green)' }}>{pctCobrado}% cobrado</span>
                  <span style={{ color: 'var(--muted)' }}>Compromiso: {formatDate(c.fecha_compromiso)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{c.descripcion}</p>
                {c.estado !== 'cobrado' && (
                  <button onClick={() => marcarCobrado(c.id)} className="text-xs font-semibold transition-colors" style={{ color: 'var(--amber)' }}>
                    Marcar cobrado
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="card p-12 text-center">
            <Wallet size={28} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin registros para este filtro</p>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { AlertTriangle, Clock, CheckCircle2, FileText, Loader2 } from 'lucide-react'
import Badge from '../components/ui/Badge'
import { getCuentasPagar, updateCuentaPagar } from '../lib/supabase'
import { formatCLP, formatDate, ESTADOS_PAGO } from '../lib/helpers'

const FILTROS = ['todos', 'pendiente', 'vencido', 'pagado']

export default function CuentasPagar() {
  const [cxp, setCxp]       = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000)
    getCuentasPagar()
      .then(setCxp)
      .catch(() => setCxp([]))
      .finally(() => { clearTimeout(t); setLoading(false) })
  }, [])

  const filtered = filtro === 'todos' ? cxp : cxp.filter(c => c.estado === filtro)

  const totales = {
    pendiente: cxp.filter(c => c.estado === 'pendiente').reduce((s, c) => s + (c.monto ?? 0), 0),
    vencido:   cxp.filter(c => c.estado === 'vencido').reduce((s, c) => s + (c.monto ?? 0), 0),
    pagado:    cxp.filter(c => c.estado === 'pagado').reduce((s, c) => s + (c.monto ?? 0), 0),
  }

  const marcarPagado = async (id) => {
    setCxp(prev => prev.map(c => c.id === id ? { ...c, estado: 'pagado' } : c))
    try {
      await updateCuentaPagar(id, { estado: 'pagado' })
    } catch {
      setCxp(prev => prev.map(c => c.id === id ? { ...c, estado: 'pendiente' } : c))
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
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Cuentas por Pagar</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Control de pagos pendientes a proveedores</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} style={{ color: 'var(--amber)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Pendiente</span>
          </div>
          <p className="font-display font-bold text-lg" style={{ color: 'var(--amber)' }}>{formatCLP(totales.pendiente)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{cxp.filter(c => c.estado === 'pendiente').length} facturas</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} style={{ color: 'var(--red)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Vencido</span>
          </div>
          <p className="font-display font-bold text-lg" style={{ color: 'var(--red)' }}>{formatCLP(totales.vencido)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{cxp.filter(c => c.estado === 'vencido').length} facturas</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Pagado</span>
          </div>
          <p className="font-display font-bold text-lg" style={{ color: 'var(--green)' }}>{formatCLP(totales.pagado)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{cxp.filter(c => c.estado === 'pagado').length} facturas</p>
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
            {f === 'todos' ? 'Todos' : ESTADOS_PAGO[f]?.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                {['Proveedor', 'Obra', 'Monto', 'Vencimiento', 'Estado', 'Doc.', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="table-row">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{c.proveedor}</p>
                    <p className="text-xs truncate max-w-[160px]" style={{ color: 'var(--muted)' }}>{c.descripcion}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-xs truncate max-w-[140px] block" style={{ color: 'var(--muted)' }}>{c.projects?.nombre ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{formatCLP(c.monto)}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <span className={`text-xs ${c.estado === 'vencido' ? 'font-semibold' : ''}`} style={{ color: c.estado === 'vencido' ? 'var(--red)' : 'var(--muted)' }}>
                      {formatDate(c.fecha_vencimiento)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge className={ESTADOS_PAGO[c.estado]?.color}>{ESTADOS_PAGO[c.estado]?.label}</Badge>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    {c.documento_url ? (
                      <a href={c.documento_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--blue)' }}>
                        <FileText size={12} /> Ver
                      </a>
                    ) : <span className="text-xs" style={{ color: 'var(--subtle)' }}>—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {c.estado !== 'pagado' && (
                      <button onClick={() => marcarPagado(c.id)} className="text-xs font-semibold transition-colors" style={{ color: 'var(--amber)' }}>
                        Marcar pagado
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm" style={{ color: 'var(--subtle)' }}>
                    Sin registros para este filtro
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

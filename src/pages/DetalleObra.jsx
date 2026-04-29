import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MapPin, User, Calendar,
  Plus, Loader2, Eye, Download
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import { getObras, getGastos, getIngresos, getDocumentos } from '../lib/supabase'
import {
  formatCLP, formatDate,
  TIPOS_OBRA, ESTADOS_OBRA, CATEGORIAS_GASTO, TIPOS_DOC
} from '../lib/helpers'

export default function DetalleObra() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [obra,     setObra]     = useState(null)
  const [gastos,   setGastos]   = useState([])
  const [ingresos, setIngresos] = useState([])
  const [docs,     setDocs]     = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000)
    Promise.all([
      getObras().catch(() => []),
      getGastos(id).catch(() => []),
      getIngresos().catch(() => []),
      getDocumentos(id).catch(() => []),
    ]).then(([obras, g, ing, d]) => {
      setObra(obras.find(o => o.id === id) ?? null)
      setGastos(g)
      setIngresos(ing.filter(i => i.project_id === id))
      setDocs(d)
    }).finally(() => { clearTimeout(t); setLoading(false) })
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--amber)' }} />
    </div>
  )

  if (!obra) return (
    <div className="text-center py-20">
      <p style={{ color: 'var(--muted)' }}>Obra no encontrada</p>
      <button onClick={() => navigate('/obras')} className="btn-secondary mt-4 mx-auto">Volver</button>
    </div>
  )

  const totalGastos   = gastos.reduce((s, g) => s + (g.monto ?? 0), 0)
  const totalIngresos = ingresos.reduce((s, i) => s + (i.monto ?? 0), 0)
  const margen        = totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos * 100).toFixed(1) : 0
  const pctPresupuesto = obra.presupuesto > 0 ? Math.min((totalGastos / obra.presupuesto) * 100, 100).toFixed(0) : 0
  const sobrecosto    = obra.presupuesto > 0 && totalGastos > obra.presupuesto

  const gastosCat = gastos.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + (g.monto ?? 0)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div>
        <button onClick={() => navigate('/obras')} className="btn-ghost mb-4 -ml-1 text-sm" style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={15} /> Volver a obras
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {obra.tipo   && <Badge className={TIPOS_OBRA[obra.tipo]?.color}>{TIPOS_OBRA[obra.tipo]?.label}</Badge>}
              {obra.estado && <Badge className={ESTADOS_OBRA[obra.estado]?.color}>{ESTADOS_OBRA[obra.estado]?.label}</Badge>}
            </div>
            <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>{obra.nombre}</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{obra.clients?.nombre ?? '—'}</p>
          </div>
          <button onClick={() => navigate('/gastos/nuevo')} className="btn-primary text-sm flex-shrink-0">
            <Plus size={15} /> Gasto
          </button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={13} style={{ color: 'var(--muted)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Dirección</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text)' }}>{obra.direccion ?? '—'}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <User size={13} style={{ color: 'var(--muted)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Cliente</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text)' }}>{obra.clients?.nombre ?? '—'}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={13} style={{ color: 'var(--muted)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Fecha inicio</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text)' }}>{formatDate(obra.fecha_inicio)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={13} style={{ color: 'var(--muted)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Fecha término</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text)' }}>{formatDate(obra.fecha_termino)}</p>
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Presupuesto</p>
          <p className="font-display font-bold text-xl" style={{ color: 'var(--text)' }}>{formatCLP(obra.presupuesto ?? 0)}</p>
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: 'var(--muted)' }}>Ejecutado</span>
              <span className="font-semibold" style={{ color: sobrecosto ? 'var(--red)' : 'var(--muted)' }}>{pctPresupuesto}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pctPresupuesto}%`, background: sobrecosto ? 'var(--red)' : 'var(--amber)' }} />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Ingresos</p>
          <p className="font-display font-bold text-xl" style={{ color: 'var(--green)' }}>{formatCLP(totalIngresos)}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>{ingresos.length} cobros registrados</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Gastos</p>
          <p className="font-display font-bold text-xl" style={{ color: sobrecosto ? 'var(--red)' : 'var(--text)' }}>{formatCLP(totalGastos)}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>{gastos.length} gastos registrados</p>
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>Margen bruto</p>
          <p className="font-display font-bold text-xl" style={{ color: parseFloat(margen) > 20 ? 'var(--green)' : parseFloat(margen) > 0 ? 'var(--amber)' : 'var(--red)' }}>
            {margen}%
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>{formatCLP(totalIngresos - totalGastos)}</p>
        </div>
      </div>

      {/* Gastos por categoría */}
      {Object.keys(gastosCat).length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-4">Gastos por Categoría</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(gastosCat).map(([cat, monto]) => {
              const info = CATEGORIAS_GASTO[cat]
              const pct = totalGastos > 0 ? (monto / totalGastos * 100).toFixed(0) : 0
              return (
                <div key={cat} className="rounded-xl p-4" style={{ background: 'var(--bg-surface)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{info?.label ?? cat}</span>
                    <span className="text-xs font-semibold" style={{ color: info?.color }}>{pct}%</span>
                  </div>
                  <p className="font-display font-semibold text-sm" style={{ color: 'var(--text)' }}>{formatCLP(monto)}</p>
                  <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: info?.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Gastos list */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Registro de Gastos</h2>
          <button onClick={() => navigate('/gastos/nuevo')} className="btn-ghost text-sm" style={{ color: 'var(--amber)' }}>
            <Plus size={14} /> Agregar
          </button>
        </div>
        {gastos.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--subtle)' }}>Sin gastos registrados</p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Proveedor', 'Categoría', 'Monto', 'Fecha'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-2 text-xs font-semibold uppercase tracking-wider ${i === 2 ? 'text-right pr-4' : i === 0 ? 'text-left pr-4' : 'text-left pr-4 hidden sm:table-cell'}`}
                      style={{ color: 'var(--subtle)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gastos.map(g => {
                  const cat = CATEGORIAS_GASTO[g.categoria]
                  return (
                    <tr key={g.id} className="table-row">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color ?? '#64748B' }} />
                          <div>
                            <p className="text-sm" style={{ color: 'var(--text)' }}>{g.proveedor}</p>
                            {g.comentario && <p className="text-xs truncate max-w-[200px]" style={{ color: 'var(--muted)' }}>{g.comentario}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 hidden sm:table-cell">
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>{cat?.label ?? g.categoria}</span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{formatCLP(g.monto)}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>{formatDate(g.fecha)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Documentos */}
      {docs.length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-4">Documentos ({docs.length})</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {docs.map(d => {
              const info = TIPOS_DOC[d.tipo]
              return (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors group" style={{ background: 'var(--bg-surface)' }}>
                  <span className="text-xl">{info?.icon ?? '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{d.nombre}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{formatDate(d.fecha)}{d.tamaño ? ` · ${d.tamaño}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {info && <span className={`text-xs font-semibold ${info.color}`}>{info.label}</span>}
                    {d.archivo_url && (
                      <>
                        <a href={d.archivo_url} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg flex items-center justify-center ml-2" style={{ background: 'var(--bg-card)' }}>
                          <Eye size={13} style={{ color: 'var(--muted)' }} />
                        </a>
                        <a href={d.archivo_url} download className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-card)' }}>
                          <Download size={13} style={{ color: 'var(--muted)' }} />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

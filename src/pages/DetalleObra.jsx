import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MapPin, User, Calendar, Building2,
  TrendingUp, TrendingDown, FileText, Plus, DollarSign
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import { obras, gastos, ingresos, documentos } from '../data/mockData'
import {
  formatCLP, formatDate, calcGastosObra, calcIngresosObra,
  TIPOS_OBRA, ESTADOS_OBRA, CATEGORIAS_GASTO, TIPOS_DOC
} from '../lib/helpers'

export default function DetalleObra() {
  const { id } = useParams()
  const navigate = useNavigate()
  const obra = obras.find(o => o.id === id)

  if (!obra) return (
    <div className="text-center py-20">
      <p className="text-slate-400">Obra no encontrada</p>
      <button onClick={() => navigate('/obras')} className="btn-secondary mt-4 mx-auto">Volver</button>
    </div>
  )

  const obraGastos = gastos.filter(g => g.obraId === id)
  const obraIngresos = ingresos.filter(i => i.obraId === id)
  const obraDocs = documentos.filter(d => d.obraId === id)

  const totalGastos = obraGastos.reduce((s, g) => s + g.monto, 0)
  const totalIngresos = obraIngresos.reduce((s, i) => s + i.monto, 0)
  const margen = totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos * 100).toFixed(1) : 0
  const pctPresupuesto = Math.min((totalGastos / obra.presupuesto) * 100, 100).toFixed(0)
  const sobrecosto = totalGastos > obra.presupuesto

  const gastosCat = obraGastos.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + g.monto
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div>
        <button onClick={() => navigate('/obras')} className="btn-ghost mb-4 -ml-1 text-sm text-slate-400">
          <ArrowLeft size={15} /> Volver a obras
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className={TIPOS_OBRA[obra.tipo]?.color}>{TIPOS_OBRA[obra.tipo]?.label}</Badge>
              <Badge className={ESTADOS_OBRA[obra.estado]?.color}>{ESTADOS_OBRA[obra.estado]?.label}</Badge>
            </div>
            <h1 className="font-display font-bold text-2xl text-slate-100">{obra.nombre}</h1>
            <p className="text-slate-400 mt-1">{obra.cliente}</p>
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
            <MapPin size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">Dirección</span>
          </div>
          <p className="text-sm text-slate-200">{obra.direccion}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <User size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">Responsable</span>
          </div>
          <p className="text-sm text-slate-200">{obra.responsable}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">Fecha inicio</span>
          </div>
          <p className="text-sm text-slate-200">{formatDate(obra.fechaInicio)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">Fecha término</span>
          </div>
          <p className="text-sm text-slate-200">{formatDate(obra.fechaTermino)}</p>
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Presupuesto</p>
          <p className="font-display font-bold text-xl text-slate-100">{formatCLP(obra.presupuesto)}</p>
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500">Ejecutado</span>
              <span className={sobrecosto ? 'text-red-400 font-semibold' : 'text-slate-400'}>{pctPresupuesto}%</span>
            </div>
            <div className="h-1.5 bg-[#131629] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${sobrecosto ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${pctPresupuesto}%` }} />
            </div>
          </div>
        </div>
        <div className="card p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ingresos</p>
          <p className="font-display font-bold text-xl text-emerald-400">{formatCLP(totalIngresos)}</p>
          <p className="text-xs text-slate-500 mt-2">{obraIngresos.length} cobros registrados</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Gastos</p>
          <p className={`font-display font-bold text-xl ${sobrecosto ? 'text-red-400' : 'text-slate-100'}`}>{formatCLP(totalGastos)}</p>
          <p className="text-xs text-slate-500 mt-2">{obraGastos.length} gastos registrados</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Margen bruto</p>
          <p className={`font-display font-bold text-xl ${parseFloat(margen) > 20 ? 'text-emerald-400' : parseFloat(margen) > 0 ? 'text-amber-400' : 'text-red-400'}`}>
            {margen}%
          </p>
          <p className="text-xs text-slate-500 mt-2">{formatCLP(totalIngresos - totalGastos)}</p>
        </div>
      </div>

      {/* Gastos por categoría */}
      {Object.keys(gastosCat).length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-4">Gastos por Categoría</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(gastosCat).map(([cat, monto]) => {
              const info = CATEGORIAS_GASTO[cat]
              const pct = (monto / totalGastos * 100).toFixed(0)
              return (
                <div key={cat} className="bg-[#131629] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 font-medium">{info?.label}</span>
                    <span className="text-xs font-semibold" style={{ color: info?.color }}>{pct}%</span>
                  </div>
                  <p className="font-display font-semibold text-slate-100 text-sm">{formatCLP(monto)}</p>
                  <div className="mt-2 h-1 bg-[#1A1E35] rounded-full overflow-hidden">
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
          <button onClick={() => navigate('/gastos/nuevo')} className="btn-ghost text-sm text-amber-400">
            <Plus size={14} /> Agregar
          </button>
        </div>
        {obraGastos.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">Sin gastos registrados</p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-[#2A2E4A]">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Proveedor</th>
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Categoría</th>
                  <th className="text-right py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto</th>
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {obraGastos.map(g => {
                  const cat = CATEGORIAS_GASTO[g.categoria]
                  return (
                    <tr key={g.id} className="table-row">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color }} />
                          <div>
                            <p className="text-sm text-slate-200">{g.proveedor}</p>
                            {g.comentario && <p className="text-xs text-slate-500 truncate max-w-[200px]">{g.comentario}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 hidden sm:table-cell">
                        <span className="text-xs text-slate-400">{cat?.label}</span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-sm font-semibold text-slate-200">{formatCLP(g.monto)}</span>
                      </td>
                      <td className="py-3">
                        <span className="text-xs text-slate-500">{formatDate(g.fecha)}</span>
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
      {obraDocs.length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-4">Documentos ({obraDocs.length})</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {obraDocs.map(d => {
              const info = TIPOS_DOC[d.tipo]
              return (
                <div key={d.id} className="flex items-center gap-3 p-3 bg-[#131629] rounded-xl hover:bg-[#1A1E35] transition-colors cursor-pointer">
                  <span className="text-xl">{info?.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{d.nombre}</p>
                    <p className="text-xs text-slate-500">{formatDate(d.fecha)} · {d.tamaño}</p>
                  </div>
                  <span className={`text-xs font-semibold ${info?.color}`}>{info?.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

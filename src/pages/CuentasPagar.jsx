import { useState } from 'react'
import { AlertTriangle, Clock, CheckCircle2, FileText, Filter } from 'lucide-react'
import Badge from '../components/ui/Badge'
import { cuentasPagar as initialCxP, obras } from '../data/mockData'
import { formatCLP, formatDate, ESTADOS_PAGO } from '../lib/helpers'

const FILTROS = ['todos', 'pendiente', 'vencido', 'pagado']

export default function CuentasPagar() {
  const [cxp, setCxp] = useState(initialCxP)
  const [filtro, setFiltro] = useState('todos')

  const filtered = filtro === 'todos' ? cxp : cxp.filter(c => c.estado === filtro)

  const totales = {
    pendiente: cxp.filter(c => c.estado === 'pendiente').reduce((s, c) => s + c.monto, 0),
    vencido:   cxp.filter(c => c.estado === 'vencido').reduce((s, c) => s + c.monto, 0),
    pagado:    cxp.filter(c => c.estado === 'pagado').reduce((s, c) => s + c.monto, 0),
  }

  const marcarPagado = id => {
    setCxp(prev => prev.map(c => c.id === id ? { ...c, estado: 'pagado' } : c))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-100">Cuentas por Pagar</h1>
        <p className="text-slate-500 text-sm mt-0.5">Control de pagos pendientes a proveedores</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-amber-400" />
            <span className="text-xs text-slate-500 font-medium">Pendiente</span>
          </div>
          <p className="font-display font-bold text-lg text-amber-400">{formatCLP(totales.pendiente)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{cxp.filter(c => c.estado === 'pendiente').length} facturas</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-xs text-slate-500 font-medium">Vencido</span>
          </div>
          <p className="font-display font-bold text-lg text-red-400">{formatCLP(totales.vencido)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{cxp.filter(c => c.estado === 'vencido').length} facturas</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span className="text-xs text-slate-500 font-medium">Pagado</span>
          </div>
          <p className="font-display font-bold text-lg text-emerald-400">{formatCLP(totales.pagado)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{cxp.filter(c => c.estado === 'pagado').length} facturas</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {FILTROS.map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all duration-150 ${
              filtro === f ? 'bg-amber-500 text-slate-900' : 'bg-[#1A1E35] text-slate-400 hover:text-slate-200 border border-[#2A2E4A]'
            }`}
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
              <tr className="border-b border-[#2A2E4A] bg-[#131629]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Proveedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Obra</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Vencimiento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Doc.</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const obra = obras.find(o => o.id === c.obraId)
                return (
                  <tr key={c.id} className="table-row">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-slate-200">{c.proveedor}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[160px]">{c.descripcion}</p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-slate-400 truncate max-w-[140px] block">{obra?.nombre}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-semibold text-slate-200">{formatCLP(c.monto)}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <span className={`text-xs ${c.estado === 'vencido' ? 'text-red-400 font-semibold' : 'text-slate-400'}`}>
                        {formatDate(c.fechaVencimiento)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge className={ESTADOS_PAGO[c.estado]?.color}>{ESTADOS_PAGO[c.estado]?.label}</Badge>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      {c.documento ? (
                        <div className="flex items-center gap-1.5 text-xs text-blue-400">
                          <FileText size={12} /> <span className="truncate max-w-[100px]">{c.documento}</span>
                        </div>
                      ) : <span className="text-xs text-slate-600">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.estado !== 'pagado' && (
                        <button
                          onClick={() => marcarPagado(c.id)}
                          className="text-xs font-semibold text-amber-400 hover:text-amber-300 whitespace-nowrap transition-colors"
                        >
                          Marcar pagado
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500 text-sm">
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

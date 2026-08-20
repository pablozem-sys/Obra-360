import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, Pencil, Ban, RotateCcw, Trash2, Search } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { formatCLP } from '../../lib/helpers'
import {
  getCatalogoCompleto, createPartidaCatalogo, updatePartidaCatalogo,
  getDescuentoTramos, createDescuentoTramo, updateDescuentoTramo, deleteDescuentoTramo,
} from '../../lib/cotizador/api'

const PRODUCTO_INICIAL = {
  codigo: '', descripcion: '', familia: '', linea_producto: '',
  unidad_sugerida: '', costo_unitario_ref: '', cobertura_m2_caja: '', notas_internas: '',
}

const TRAMO_INICIAL = { familia: '', cantidad_desde: '', cantidad_hasta: '', porcentaje: '' }

export default function InventarioModal({ open, onClose }) {
  const [tab, setTab] = useState('productos')
  const [catalogo, setCatalogo] = useState([])
  const [tramos, setTramos] = useState([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    const [cat, tr] = await Promise.all([getCatalogoCompleto(), getDescuentoTramos()])
    setCatalogo(cat)
    setTramos(tr)
  }, [])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    cargar().finally(() => setLoading(false))
  }, [open, cargar])

  const familiasExistentes = [...new Set(catalogo.map((p) => p.familia).filter(Boolean))].sort()

  return (
    <Modal open={open} onClose={onClose} title="Inventario — mármoles y mosaicos" size="xl">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setTab('productos')}
          className="px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: tab === 'productos' ? 'var(--amber-dim)' : 'transparent', color: tab === 'productos' ? 'var(--amber)' : 'var(--muted)' }}
        >
          Productos
        </button>
        <button
          onClick={() => setTab('tramos')}
          className="px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: tab === 'tramos' ? 'var(--amber-dim)' : 'transparent', color: tab === 'tramos' ? 'var(--amber)' : 'var(--muted)' }}
        >
          Tramos de descuento
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--amber)' }} />
        </div>
      ) : tab === 'productos' ? (
        <TabProductos
          catalogo={catalogo}
          familiasExistentes={familiasExistentes}
          onCambio={(nueva) => setCatalogo(nueva)}
        />
      ) : (
        <TabTramos
          tramos={tramos}
          familiasExistentes={familiasExistentes}
          onCambio={(nuevos) => setTramos(nuevos)}
        />
      )}
    </Modal>
  )
}

function TabProductos({ catalogo, familiasExistentes, onCambio }) {
  const [busqueda, setBusqueda] = useState('')
  const [formAbierto, setFormAbierto] = useState(false)
  const [form, setForm] = useState(PRODUCTO_INICIAL)
  const [editandoId, setEditandoId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [formError, setFormError] = useState('')

  const filtrados = catalogo.filter((p) => {
    const q = busqueda.toLowerCase()
    return !q || p.descripcion.toLowerCase().includes(q) || (p.codigo ?? '').toLowerCase().includes(q)
  })

  const abrirNuevo = () => {
    setForm(PRODUCTO_INICIAL)
    setEditandoId(null)
    setFormError('')
    setFormAbierto(true)
  }

  const abrirEditar = (p) => {
    setForm({
      codigo: p.codigo ?? '', descripcion: p.descripcion ?? '', familia: p.familia ?? '',
      linea_producto: p.linea_producto ?? '', unidad_sugerida: p.unidad_sugerida ?? '',
      costo_unitario_ref: p.costo_unitario_ref ?? '', cobertura_m2_caja: p.cobertura_m2_caja ?? '',
      notas_internas: p.notas_internas ?? '',
    })
    setEditandoId(p.id)
    setFormError('')
    setFormAbierto(true)
  }

  const guardar = async () => {
    if (!form.descripcion.trim()) { setFormError('Ingresa el nombre del producto'); return }
    setGuardando(true)
    setFormError('')
    try {
      const payload = {
        codigo: form.codigo.trim() || null,
        descripcion: form.descripcion.trim(),
        familia: form.familia.trim() || null,
        linea_producto: form.linea_producto.trim() || null,
        unidad_sugerida: form.unidad_sugerida.trim() || null,
        costo_unitario_ref: form.costo_unitario_ref === '' ? null : Number(form.costo_unitario_ref),
        cobertura_m2_caja: form.cobertura_m2_caja === '' ? null : Number(form.cobertura_m2_caja),
        notas_internas: form.notas_internas.trim() || null,
      }
      if (editandoId) {
        const actualizado = await updatePartidaCatalogo(editandoId, payload)
        onCambio(catalogo.map((p) => (p.id === editandoId ? actualizado : p)))
      } else {
        const nuevo = await createPartidaCatalogo({ ...payload, activa: true })
        onCambio([...catalogo, nuevo])
      }
      setFormAbierto(false)
    } catch (err) {
      setFormError(err.message || 'Error al guardar el producto')
    } finally {
      setGuardando(false)
    }
  }

  const toggleActiva = async (p) => {
    const actualizado = await updatePartidaCatalogo(p.id, { activa: !p.activa })
    onCambio(catalogo.map((x) => (x.id === p.id ? actualizado : x)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--subtle)' }} />
          <input
            className="input pl-9"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <button onClick={abrirNuevo} className="btn-primary text-sm shrink-0">
          <Plus size={14} /> Nuevo producto
        </button>
      </div>

      {formAbierto && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {editandoId ? 'Editar producto' : 'Nuevo producto'}
          </p>
          {formError && <p className="text-xs" style={{ color: 'var(--red)' }}>{formError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Código</label>
              <input className="input" value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} />
            </div>
            <div>
              <label className="label">Nombre del producto *</label>
              <input className="input" value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div>
              <label className="label">Familia</label>
              <input className="input" list="familias-catalogo" value={form.familia} onChange={(e) => setForm((f) => ({ ...f, familia: e.target.value }))} />
              <datalist id="familias-catalogo">
                {familiasExistentes.map((f) => <option key={f} value={f} />)}
              </datalist>
            </div>
            <div>
              <label className="label">Línea de producto</label>
              <input className="input" value={form.linea_producto} onChange={(e) => setForm((f) => ({ ...f, linea_producto: e.target.value }))} placeholder="Ej: Niebla, Terrazas..." />
            </div>
            <div>
              <label className="label">Unidad</label>
              <input className="input" list="unidades-catalogo" value={form.unidad_sugerida} onChange={(e) => setForm((f) => ({ ...f, unidad_sugerida: e.target.value }))} placeholder="ML, CAJA, M2..." />
              <datalist id="unidades-catalogo">
                <option value="ML" /><option value="CAJA" /><option value="M2" /><option value="UN" /><option value="GL" /><option value="M3" />
              </datalist>
            </div>
            <div>
              <label className="label">Precio de referencia</label>
              <input
                type="number"
                className="input num"
                placeholder="Vacío = precio pendiente"
                value={form.costo_unitario_ref}
                onChange={(e) => setForm((f) => ({ ...f, costo_unitario_ref: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Cobertura m² por caja (solo si se vende por caja)</label>
              <input
                type="number"
                className="input num"
                value={form.cobertura_m2_caja}
                onChange={(e) => setForm((f) => ({ ...f, cobertura_m2_caja: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Notas internas</label>
              <input className="input" value={form.notas_internas} onChange={(e) => setForm((f) => ({ ...f, notas_internas: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setFormAbierto(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="btn-primary flex-1 justify-center disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
            <tr className="text-left" style={{ color: 'var(--subtle)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <th className="font-normal px-3 py-2">Código</th>
              <th className="font-normal px-3 py-2">Producto</th>
              <th className="font-normal px-3 py-2">Familia / línea</th>
              <th className="font-normal px-3 py-2">Unidad</th>
              <th className="font-normal px-3 py-2">Precio</th>
              <th className="font-normal px-3 py-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--border)', opacity: p.activa ? 1 : 0.45 }}>
                <td className="px-3 py-2 num" style={{ color: 'var(--muted)' }}>{p.codigo ?? '—'}</td>
                <td className="px-3 py-2" style={{ color: 'var(--text)' }}>{p.descripcion}</td>
                <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>
                  {[p.familia, p.linea_producto].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{p.unidad_sugerida ?? '—'}</td>
                <td className="px-3 py-2 num" style={{ color: 'var(--text)' }}>
                  {p.costo_unitario_ref != null ? formatCLP(p.costo_unitario_ref) : 'pendiente'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => abrirEditar(p)} title="Editar" style={{ color: 'var(--subtle)' }}><Pencil size={13} /></button>
                    <button onClick={() => toggleActiva(p)} title={p.activa ? 'Desactivar' : 'Reactivar'} style={{ color: p.activa ? 'var(--red)' : 'var(--green)' }}>
                      {p.activa ? <Ban size={13} /> : <RotateCcw size={13} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: 'var(--subtle)' }}>Sin productos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TabTramos({ tramos, familiasExistentes, onCambio }) {
  const [form, setForm] = useState(TRAMO_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [formError, setFormError] = useState('')

  const agregar = async () => {
    if (!form.familia.trim()) { setFormError('Elige una familia'); return }
    if (form.cantidad_desde === '' || form.porcentaje === '') { setFormError('Completa cantidad desde y porcentaje'); return }
    setGuardando(true)
    setFormError('')
    try {
      const nuevo = await createDescuentoTramo({
        familia: form.familia.trim(),
        cantidad_desde: Number(form.cantidad_desde),
        cantidad_hasta: form.cantidad_hasta === '' ? null : Number(form.cantidad_hasta),
        porcentaje: Number(form.porcentaje),
      })
      onCambio([...tramos, nuevo])
      setForm(TRAMO_INICIAL)
    } catch (err) {
      setFormError(err.message || 'Error al guardar el tramo')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este tramo?')) return
    await deleteDescuentoTramo(id)
    onCambio(tramos.filter((t) => t.id !== id))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        El descuento se calcula sobre la cantidad de cada línea individual (no el total de la
        cotización), buscando el tramo cuya familia y rango coincidan.
      </p>

      <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        {formError && <p className="text-xs" style={{ color: 'var(--red)' }}>{formError}</p>}
        <div className="grid grid-cols-4 gap-2 items-end">
          <div>
            <label className="label">Familia</label>
            <input className="input text-sm" list="familias-tramo" value={form.familia} onChange={(e) => setForm((f) => ({ ...f, familia: e.target.value }))} />
            <datalist id="familias-tramo">
              {familiasExistentes.map((f) => <option key={f} value={f} />)}
            </datalist>
          </div>
          <div>
            <label className="label">Desde (cantidad)</label>
            <input type="number" className="input num text-sm" value={form.cantidad_desde} onChange={(e) => setForm((f) => ({ ...f, cantidad_desde: e.target.value }))} />
          </div>
          <div>
            <label className="label">Hasta (vacío = sin tope)</label>
            <input type="number" className="input num text-sm" value={form.cantidad_hasta} onChange={(e) => setForm((f) => ({ ...f, cantidad_hasta: e.target.value }))} />
          </div>
          <div>
            <label className="label">% descuento</label>
            <input type="number" className="input num text-sm" value={form.porcentaje} onChange={(e) => setForm((f) => ({ ...f, porcentaje: e.target.value }))} />
          </div>
        </div>
        <button onClick={agregar} disabled={guardando} className="btn-primary text-sm disabled:opacity-50">
          <Plus size={13} /> Agregar tramo
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: 'var(--subtle)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <th className="font-normal px-3 py-2">Familia</th>
              <th className="font-normal px-3 py-2">Desde</th>
              <th className="font-normal px-3 py-2">Hasta</th>
              <th className="font-normal px-3 py-2">%</th>
              <th className="font-normal px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {tramos.map((t) => (
              <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="px-3 py-2" style={{ color: 'var(--text)' }}>{t.familia}</td>
                <td className="px-3 py-2 num" style={{ color: 'var(--muted)' }}>{t.cantidad_desde}</td>
                <td className="px-3 py-2 num" style={{ color: 'var(--muted)' }}>{t.cantidad_hasta ?? 'en adelante'}</td>
                <td className="px-3 py-2 num" style={{ color: 'var(--text)' }}>{t.porcentaje}%</td>
                <td className="px-3 py-2">
                  <button onClick={() => eliminar(t.id)} style={{ color: 'var(--red)' }}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
            {tramos.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center" style={{ color: 'var(--subtle)' }}>Sin tramos configurados todavía — el descuento no se aplica hasta que agregues alguno.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

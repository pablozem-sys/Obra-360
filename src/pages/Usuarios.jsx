import { useState, useEffect } from 'react'
import { Plus, Loader2, Pencil, AlertCircle, UserCircle2, ShieldCheck, Shield, Trash2, X } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { getUsuarios, createUsuario, updateUsuarioPerfil, deleteUsuario } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ROL_BADGE = {
  dueno:         { label: 'Dueño',    style: { background: 'rgba(255,149,0,0.12)',  color: 'var(--amber)', border: '1px solid rgba(255,149,0,0.25)' } },
  administrativo:{ label: 'Admin',    style: { background: 'rgba(107,138,255,0.12)', color: '#6B8AFF',     border: '1px solid rgba(107,138,255,0.25)' } },
}

const ROLES = ['dueno', 'administrativo']

const emptyForm = { nombre: '', email: '', password: '', rol: 'administrativo' }

export default function Usuarios() {
  const { user: me } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  // Modal crear
  const [showCreate, setShowCreate] = useState(false)
  const [form,       setForm]       = useState(emptyForm)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')

  // Modal editar
  const [editUser,    setEditUser]    = useState(null)
  const [editNombre,  setEditNombre]  = useState('')
  const [editRol,     setEditRol]     = useState('administrativo')
  const [editSaving,  setEditSaving]  = useState(false)
  const [editError,   setEditError]   = useState('')

  useEffect(() => {
    getUsuarios()
      .then(setUsuarios)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!form.nombre.trim())  { setError('Ingresa el nombre'); return }
    if (!form.email.trim())   { setError('Ingresa el email'); return }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }

    setSaving(true)
    setError('')
    try {
      await createUsuario(form)
      const lista = await getUsuarios()
      setUsuarios(lista)
      setShowCreate(false)
      setForm(emptyForm)
      setSuccess('Usuario creado. Debe confirmar su email para poder ingresar.')
      setTimeout(() => setSuccess(''), 6000)
    } catch (err) {
      setError(err.message || 'Error al crear usuario')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (u) => {
    setEditUser(u)
    setEditNombre(u.nombre ?? '')
    setEditRol(u.rol ?? 'administrativo')
    setEditError('')
  }

  const handleDelete = async (id) => {
    setDeleteError('')
    try {
      await deleteUsuario(id)
      setUsuarios(prev => prev.filter(u => u.id !== id))
    } catch (err) {
      setDeleteError(err.message || 'Error al eliminar usuario')
    } finally {
      setConfirmDeleteId(null)
    }
  }

  const handleEdit = async () => {
    if (!editNombre.trim()) { setEditError('Ingresa el nombre'); return }
    setEditSaving(true)
    setEditError('')
    try {
      const updated = await updateUsuarioPerfil(editUser.id, { nombre: editNombre.trim(), rol: editRol })
      setUsuarios(prev => prev.map(u => u.id === editUser.id ? { ...u, ...updated } : u))
      setEditUser(null)
    } catch (err) {
      setEditError(err.message || 'Error al guardar')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
            Usuarios
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Gestiona los perfiles con acceso al sistema
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setError(''); setForm(emptyForm) }}
          className="btn-primary text-sm"
        >
          <Plus size={15} /> Nuevo usuario
        </button>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(0,196,140,0.1)', border: '1px solid rgba(0,196,140,0.25)', color: 'var(--green)' }}>
          <ShieldCheck size={15} />
          {success}
        </div>
      )}

      {/* Delete error banner */}
      {deleteError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(255,69,96,0.1)', border: '1px solid rgba(255,69,96,0.25)', color: 'var(--red)' }}>
          <AlertCircle size={15} />
          {deleteError}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--amber)' }} />
        </div>
      ) : usuarios.length === 0 ? (
        <div className="card p-10 text-center">
          <UserCircle2 size={36} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                {['Usuario', 'Email', 'Rol', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left"
                    style={{ fontSize: 10, fontFamily: 'Unbounded', fontWeight: 600, color: 'var(--subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="table-row">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-black font-display"
                        style={{ background: 'var(--amber)', boxShadow: '0 0 12px var(--amber-glow)' }}
                      >
                        {u.avatar ?? (u.nombre?.slice(0, 2).toUpperCase() ?? '??')}
                      </div>
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{u.nombre}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm" style={{ color: 'var(--muted)' }}>{u.email}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className="text-[10px] font-bold px-2 py-1 rounded-lg"
                      style={{ fontFamily: 'Unbounded', ...ROL_BADGE[u.rol]?.style }}
                    >
                      {ROL_BADGE[u.rol]?.label ?? u.rol}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {confirmDeleteId === u.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs" style={{ color: 'var(--red)' }}>¿Eliminar?</span>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                          style={{ background: 'rgba(255,69,96,0.15)', color: 'var(--red)', border: '1px solid rgba(255,69,96,0.3)' }}
                        >Sí</button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-1 rounded-lg"
                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                        ><X size={11} style={{ color: 'var(--subtle)' }} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg transition-all hover:opacity-80"
                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                          title="Editar"
                        >
                          <Pencil size={12} style={{ color: 'var(--subtle)' }} />
                        </button>
                        {u.id !== me?.id && (
                          <button
                            onClick={() => setConfirmDeleteId(u.id)}
                            className="p-1.5 rounded-lg transition-all hover:opacity-80"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                            title="Eliminar"
                          >
                            <Trash2 size={12} style={{ color: 'var(--red)' }} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Crear usuario */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setError('') }} title="Nuevo Usuario">
        <div className="space-y-4">
          <div>
            <label className="label">Nombre completo *</label>
            <input className="input" placeholder="Ej: Juan Pérez"
              value={form.nombre} onChange={e => { setForm(p => ({ ...p, nombre: e.target.value })); setError('') }} autoFocus />
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" placeholder="correo@empresa.com"
              value={form.email} onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setError('') }} />
          </div>
          <div>
            <label className="label">Contraseña temporal *</label>
            <input type="password" className="input" placeholder="Mínimo 8 caracteres"
              value={form.password} onChange={e => { setForm(p => ({ ...p, password: e.target.value })); setError('') }} />
            <p className="text-xs mt-1.5" style={{ color: 'var(--subtle)' }}>
              El usuario podrá cambiarla después de ingresar.
            </p>
          </div>
          <div>
            <label className="label">Rol</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {ROLES.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, rol: r }))}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={form.rol === r ? {
                    background: 'var(--amber-dim)',
                    border: '1px solid rgba(255,149,0,0.35)',
                    color: 'var(--amber)',
                  } : {
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                  }}
                >
                  {r === 'dueno' ? <Shield size={14} /> : <ShieldCheck size={14} />}
                  {ROL_BADGE[r].label}
                </button>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--subtle)' }}>
              {form.rol === 'dueno'
                ? 'Acceso total, incluyendo finanzas y reportes.'
                : 'Acceso a obras, gastos y asistencia. Sin módulos financieros.'}
            </p>
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 mt-3">
            <AlertCircle size={13} style={{ color: 'var(--red)' }} />
            <p style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--red)' }}>{error}</p>
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={() => { setShowCreate(false); setError('') }} className="btn-secondary flex-1 justify-center">
            Cancelar
          </button>
          <button onClick={handleCreate} disabled={saving}
            className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {saving ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </Modal>

      {/* Modal: Editar usuario */}
      <Modal open={!!editUser} onClose={() => { setEditUser(null); setEditError('') }} title="Editar Usuario">
        <div className="space-y-4">
          <div>
            <label className="label">Nombre completo *</label>
            <input className="input" value={editNombre}
              onChange={e => { setEditNombre(e.target.value); setEditError('') }} autoFocus />
          </div>
          <div>
            <label className="label">Rol</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {ROLES.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setEditRol(r)}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={editRol === r ? {
                    background: 'var(--amber-dim)',
                    border: '1px solid rgba(255,149,0,0.35)',
                    color: 'var(--amber)',
                  } : {
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                  }}
                >
                  {r === 'dueno' ? <Shield size={14} /> : <ShieldCheck size={14} />}
                  {ROL_BADGE[r].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {editError && (
          <div className="flex items-center gap-2 mt-3">
            <AlertCircle size={13} style={{ color: 'var(--red)' }} />
            <p style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--red)' }}>{editError}</p>
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={() => { setEditUser(null); setEditError('') }} className="btn-secondary flex-1 justify-center">
            Cancelar
          </button>
          <button onClick={handleEdit} disabled={editSaving || !editNombre}
            className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed">
            {editSaving ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}
            {editSaving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

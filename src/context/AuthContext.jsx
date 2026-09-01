import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, setEmpresaId } from '../lib/supabase'
import { configureLogger } from '../lib/logger'
import { setCotizadorEmpresaId } from '../lib/cotizador/api'
import { COMPANY_SLUG, ADMIN_EMAILS } from '../lib/helpers'

const AuthContext = createContext(null)

export const PERMISOS = {
  dueno: {
    verIngresos: true,
    verMargen: true,
    verEERR: true,
    verFlujoCaja: true,
    verCxC: true,
    verCxP: true,
    verAsistencia: true,
    verObras: true,
    verDocumentos: true,
    subirGastos: true,
    editarTodo: true,
  },
  administrativo: {
    verIngresos: false,
    verMargen: false,
    verEERR: false,
    verFlujoCaja: false,
    verCxC: false,
    verCxP: true,
    verAsistencia: true,
    verObras: true,
    verDocumentos: true,
    subirGastos: true,
    editarTodo: false,
  },
  trabajador: {
    soloAsistencia: true,
  },
}

async function fetchUserProfile(userId, authUser) {
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    const { data } = await Promise.race([
      supabase.from('users').select('id, nombre, email, rol, avatar').eq('id', userId).single(),
      timeout,
    ])
    if (data) return data
  } catch { /* fallback below */ }

  if (authUser) {
    return {
      id: authUser.id,
      email: authUser.email,
      nombre: authUser.user_metadata?.nombre ?? authUser.email.split('@')[0],
      rol: authUser.user_metadata?.rol ?? 'dueno',
      avatar: authUser.user_metadata?.avatar ?? authUser.email.slice(0, 2).toUpperCase(),
    }
  }
  return null
}

const WORKER_KEY = 'vaion_worker_session'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [empresa, setEmpresaState] = useState(null)
  const [loading, setLoading] = useState(true)

  function applyEmpresa(entry) {
    setEmpresaState(entry)
    setEmpresaId(entry?.empresa_id ?? null)
    setCotizadorEmpresaId(entry?.empresa_id ?? null)
    configureLogger({ empresaId: entry?.empresa_id ?? null, rol: entry?.rol ?? null })
  }

  // Cada despliegue queda fijo a UNA sola empresa (COMPANY_SLUG, por variable
  // de entorno VITE_COMPANY_SLUG) — no existe selector ni cambio de empresa
  // dentro de la app. Si el usuario tiene membresías en otras empresas (ej.
  // datos históricos de una migración), se ignoran por completo.
  async function loadEmpresa(userId) {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
      return await Promise.race([loadEmpresaQuery(userId), timeout])
    } catch {
      return null
    }
  }

  async function loadEmpresaQuery(userId) {
    const { data: co, error: e1 } = await supabase
      .from('companies')
      .select('id, nombre, slug')
      .eq('slug', COMPANY_SLUG)
      .single()
    if (e1 || !co) return null

    const { data: uc, error: e2 } = await supabase
      .from('user_companies')
      .select('rol')
      .eq('user_id', userId)
      .eq('empresa_id', co.id)
      .maybeSingle()
    if (e2 || !uc) return null

    return { empresa_id: co.id, nombre: co.nombre, slug: co.slug, rol: uc.rol }
  }

  useEffect(() => {
    // Restaurar sesión de trabajador desde localStorage
    try {
      const saved = localStorage.getItem(WORKER_KEY)
      if (saved) {
        setSession({ user: JSON.parse(saved) })
        setLoading(false)
        return
      }
    } catch { /* ignorar */ }

    // Red de seguridad: si getSession() se cuelga de verdad (caso raro), deja
    // de mostrar el spinner — pero NUNCA asume "sin sesión" por un timeout.
    // Antes había un fallback a los 4s que resolvía session:null y expulsaba
    // al usuario a la Landing aunque su sesión fuera válida (condición de
    // carrera). Ver docs/RUNBOOK.md sección 4.2.
    const safetyTimeout = setTimeout(() => setLoading(false), 15000)

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s) {
        const profile = await fetchUserProfile(s.user.id, s.user)
        const entry = await loadEmpresa(s.user.id)
        setSession({ user: profile })
        if (entry) applyEmpresa(entry)
      }
      clearTimeout(safetyTimeout)
      setLoading(false)
    })

    // TOKEN_REFRESHED se dispara periódicamente mientras la sesión sigue activa
    // (renovación automática del token, no una acción del usuario). Si loadEmpresa()
    // falla en ese momento por algo transitorio (red, timeout), NUNCA se debe pisar
    // una empresa ya cargada con null — eso expulsaba al usuario a "Sin acceso"
    // en medio de una sesión válida sin que hubiera cambiado nada real.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setEmpresaState(null)
        setEmpresaId(null)
        setCotizadorEmpresaId(null)
      } else if (s && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
        const profile = await fetchUserProfile(s.user.id, s.user)
        const entry = await loadEmpresa(s.user.id)
        setSession(prev => prev ? { user: profile } : prev)
        if (entry) applyEmpresa(entry)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loginAdmin = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const profile = await fetchUserProfile(data.user.id, data.user)
    const entry = await loadEmpresa(data.user.id)
    setSession({ user: profile })
    applyEmpresa(entry)
  }

  const loginTrabajador = (trabajador) => {
    const user = { ...trabajador, rol: 'trabajador' }
    try { localStorage.setItem(WORKER_KEY, JSON.stringify(user)) } catch { /* ignorar */ }
    setSession({ user })
  }

  const logout = () => {
    setSession(null)
    setEmpresaState(null)
    setEmpresaId(null)
    if (session?.user?.rol === 'trabajador') {
      try { localStorage.removeItem(WORKER_KEY) } catch { /* ignorar */ }
    } else {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('sb-'))
          .forEach(k => localStorage.removeItem(k))
      } catch { /* silent */ }
      supabase.auth.signOut().catch(() => {})
    }
  }

  // rol activo viene de la empresa seleccionada, fallback a users.rol
  const rol = empresa?.rol ?? session?.user?.rol ?? null

  const can = (permiso) => {
    if (!session?.user) return false
    return PERMISOS[rol]?.[permiso] ?? false
  }

  const isAdmin = !!session?.user?.email && ADMIN_EMAILS.includes(session.user.email)

  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      rol,
      empresa,
      isAuth: !!session,
      isAdmin,
      loading,
      loginAdmin,
      loginTrabajador,
      logout,
      can,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

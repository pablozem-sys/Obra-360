import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
    verMapa: true,
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
    verMapa: true,
    subirGastos: true,
    editarTodo: false,
  },
  trabajador: {
    soloAsistencia: true,
  },
}

async function fetchUserProfile(userId, authUser) {
  try {
    const { data } = await supabase
      .from('users')
      .select('id, nombre, email, rol, avatar')
      .eq('id', userId)
      .single()
    if (data) return data
  } catch { /* fallback below */ }

  // Si no hay perfil en la tabla users todavía, usar datos básicos del auth
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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000)
    const sessionPromise = supabase.auth.getSession()
    const fallback = new Promise(r => setTimeout(() => r({ data: { session: null } }), 4000))
    Promise.race([sessionPromise, fallback]).then(async ({ data: { session: s } }) => {
      clearTimeout(timeout)
      if (s) {
        const profile = await fetchUserProfile(s.user.id, s.user)
        setSession({ user: profile })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setSession(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const loginAdmin = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // Setear sesión inmediatamente sin esperar onAuthStateChange
    const profile = await fetchUserProfile(data.user.id, data.user)
    setSession({ user: profile })
  }

  const loginTrabajador = (trabajador) => {
    setSession({ user: { ...trabajador, rol: 'trabajador' } })
  }

  const logout = () => {
    setSession(null)
    if (session?.user?.rol !== 'trabajador') {
      // Limpiar localStorage inmediatamente para evitar sesión corrupta
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('sb-'))
          .forEach(k => localStorage.removeItem(k))
      } catch { /* silent */ }
      supabase.auth.signOut().catch(() => {})
    }
  }

  const can = (permiso) => {
    if (!session?.user) return false
    return PERMISOS[session.user.rol]?.[permiso] ?? false
  }

  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      rol: session?.user?.rol ?? null,
      isAuth: !!session,
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

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

async function fetchUserProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, nombre, email, rol, avatar')
    .eq('id', userId)
    .single()
  if (error) return null
  return data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s) {
        const profile = await fetchUserProfile(s.user.id)
        setSession({ user: profile })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (s && event !== 'INITIAL_SESSION') {
        const profile = await fetchUserProfile(s.user.id)
        setSession({ user: profile })
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loginAdmin = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const loginTrabajador = (trabajador) => {
    setSession({ user: { ...trabajador, rol: 'trabajador' } })
  }

  const logout = async () => {
    if (session?.user?.rol === 'trabajador') {
      setSession(null)
    } else {
      await supabase.auth.signOut()
      setSession(null)
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
